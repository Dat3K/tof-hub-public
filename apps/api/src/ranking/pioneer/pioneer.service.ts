import {Inject,Injectable,Optional,ServiceUnavailableException} from '@nestjs/common';
import {Prisma,type PrismaClient} from '@prisma/client';
import {isPioneerCapture,PlayerSnapshotSchema,resolvePlayerServer,ServerRegionCodeSchema,UNRANKED_REGION_CODES,type PlayerSnapshot} from '@tof-hub/contracts';
import {roleTracks,preferScoringTrack,scoreBuildForTrack,scoreCurrentGearForTrack,type BuildRVRole} from '@tof-hub/game-domain';
import {PRISMA} from '../../database/database.module';
import {loadScoringCatalog} from '../../players/scoring-catalog';
import {pioneerInput,pioneerObservations,retainPioneer,type PioneerPiece,type PioneerProvenance} from './pioneer-store';
import type {GearTopEntry,PlayerTopEntry,RankingQuery} from '../ranking.service';
import {gearTopView} from '../gear-view';
import {legacyBuildGear} from '../../import/capture-import-policy';
import {RankingCacheService} from '../cache/ranking-cache.service';
import {setImmediate as yieldToRequests} from 'node:timers/promises';

@Injectable()
export class PioneerService {
  constructor(@Optional() @Inject(PRISMA) private readonly prisma:PrismaClient|null=null,
    @Optional() @Inject(RankingCacheService) private readonly cache:RankingCacheService|null=null) {}
  private boardRevision: string | null = null;
  private globalCache:{at:number;pieces:PioneerPiece[]}|null=null;
  private globalFlight:Promise<PioneerPiece[]>|null=null;
  private globalGeneration=0;
  private buildCache=new Map<string,{at:number;entry:PlayerTopEntry}>();
  invalidateGlobal() {this.globalCache=null;this.globalFlight=null;this.globalGeneration++;this.buildCache.clear();}
  private async pieces(client:Pick<PrismaClient,'$queryRaw'>):Promise<PioneerPiece[]> {
    const rows=await client.$queryRaw<{id:string;fingerprint:string;piece:PioneerPiece['piece'];provenance:unknown;observed_at:Date}[]>(Prisma.sql`SELECT * FROM pioneer_gear ORDER BY observed_at,id`);
    return rows.map(row=>({id:row.id,fingerprint:row.fingerprint,piece:row.piece,provenance:row.provenance,observedAt:row.observed_at.toISOString()}));
  }
  async store(snapshot:PlayerSnapshot,provenance:PioneerProvenance) {
    const legacy=provenance.scan.distribution==='global-pioneer'&&provenance.legacyBuild
      &&legacyBuildGear({capture:{scan:provenance.scan,...provenance.legacyBuild}});
    if(!isPioneerCapture(provenance.scan)&&!legacy)throw new Error('Only Global Pioneer scans can enter Pioneer');
    const catalog=loadScoringCatalog(),prisma=this.prisma;
    if(!prisma||!catalog)throw new ServiceUnavailableException('Pioneer storage is not configured');
    const incoming=pioneerObservations(PlayerSnapshotSchema.parse(snapshot),provenance);
    const result=await prisma.$transaction(async tx=>{
      // Serializes competing imports across workers, including the first upload into an empty pool.
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(724019031)`);
      const existing=await this.pieces(tx),retained=retainPioneer(existing,incoming,catalog);
      if(retained.pieces.length)await tx.pioneerGear.createMany({data:retained.pieces.map(item=>({id:item.id,fingerprint:item.fingerprint,
        piece:item.piece as Prisma.InputJsonValue,provenance:item.provenance as Prisma.InputJsonValue,observedAt:new Date(item.observedAt)})),skipDuplicates:true});
      await tx.pioneerWinner.deleteMany();
      if(retained.winners.length)await tx.pioneerWinner.createMany({data:retained.winners.map(winner=>({key:winner.key,gearId:winner.piece.id,score:winner.value}))});
      await tx.pioneerGear.deleteMany({where:{winners:{none:{}}}});
      const old=new Set(existing.map(item=>item.id)),added=retained.pieces.filter(item=>!old.has(item.id)).length;
      await tx.$executeRaw(Prisma.sql`INSERT INTO scoring_revisions(id,fingerprint,updated_at) VALUES ('ranking:pioneer','1',NOW())
        ON CONFLICT(id) DO UPDATE SET fingerprint=(scoring_revisions.fingerprint::bigint+1)::text,updated_at=NOW()`);
      return {duplicate:added===0,gearStored:added};
    },{timeout:60_000,maxWait:60_000});
    this.buildCache.clear();return result;
  }
  private async globalPieces():Promise<PioneerPiece[]> {
    if(this.globalCache&&Date.now()-this.globalCache.at<60_000)return this.globalCache.pieces;
    if(this.globalFlight)return this.globalFlight;
    const generation=this.globalGeneration;
    const pending=(async()=>{
    const rows=await this.prisma!.gearItem.findMany({where:{player:{hidden:false,OR:[{region:null},{region:{notIn:[...UNRANKED_REGION_CODES]}}]}},orderBy:{id:'asc'},include:{player:{select:{nickname:true,region:true,serverId:true}}}});
    const pieces=rows.map(row=>({id:row.id,fingerprint:row.fingerprint,piece:{slot:row.slot,itemId:row.itemId,stars:row.stars,enhancement:row.enhancement,
      titan:row.titan,augmented:row.augmented,rareId:row.rareId,rareLevel:row.rareLevel,stats:row.stats,statsBeforeTitan:row.statsBeforeTitan,augments:row.augments,augmentCount:row.augmentCount} as unknown as PioneerPiece['piece'],observedAt:row.lastSeenAt.toISOString(),provenance:null,ownerNickname:row.player?.nickname??null,ownerRegion:row.player?.region??null,ownerServerId:row.player?.serverId??null}));
    if(generation===this.globalGeneration)this.globalCache={at:Date.now(),pieces};
    return pieces;
    })();
    this.globalFlight=pending;
    try{return await pending;}finally{if(this.globalFlight===pending)this.globalFlight=null;}
  }
  private view(item:PioneerPiece,source:string):GearTopEntry['gear'] {
    const piece=item.piece;
    const provenance=item.provenance&&typeof item.provenance==='object'?item.provenance as Record<string,unknown>:null;
    const ownerNickname=item.ownerNickname??(typeof provenance?.ownerNickname==='string'?provenance.ownerNickname:null);
    const ownerServer=resolvePlayerServer({uid:typeof provenance?.ownerUid==='string'?provenance.ownerUid:undefined});
    const ownerRegion=item.ownerRegion??(typeof provenance?.ownerRegion==='string'?provenance.ownerRegion:null)
      ??ownerServer.regionCode??null;
    const ownerServerId=item.ownerServerId??ownerServer.server?.id??null;
    return {...gearTopView({...piece,id:item.id,source,lastSeenAt:item.observedAt,augmentCount:piece.augmentCount??null}),ownerNickname,ownerRegion,ownerServerId};
  }
  private tracks(query:RankingQuery,catalog:NonNullable<ReturnType<typeof loadScoringCatalog>>) {
    return roleTracks(query.role,catalog.tracks).filter(track=>query.track==='all'?true:
      track.length===query.track.split('-').length&&[...track].sort().join('-')===query.track.split('-').sort().join('-'));
  }
  async gear(query:RankingQuery) {
    const catalog=loadScoringCatalog();if(!this.prisma||!catalog)return {available:false,entries:[]};
    const pieces=await this.pieces(this.prisma),tracks=this.tracks(query,catalog);
    const leaders=new Map<string,{item:PioneerPiece;score:number;value:number;track:string}>();
    for(const track of tracks)for(const item of pieces) {
      const input=pioneerInput(item.piece,catalog);if(!input)continue;
      const rated=scoreCurrentGearForTrack(input,track,catalog.reference,query.role),score=rated.percent??0;if(score<=0)continue;
      const key=query.track==='all'?item.piece.slot:track.slice().sort().join('-')+':'+item.piece.slot;
      const previous=leaders.get(key);
      if(!previous||preferScoringTrack({track:track.join('-'),percent:score,value:rated.value},{track:previous.track,percent:previous.score,value:previous.value}))leaders.set(key,{item,score,value:rated.value,track:track.join('-')});
    }
    let entries:GearTopEntry[]=[...leaders.values()].sort((a,b)=>b.score-a.score||a.item.id.localeCompare(b.item.id)).map((entry,index)=>{
      const gear=this.view(entry.item,'pioneer');
      return {rank:index+1,score:entry.score,maxScore:entry.score,track:entry.track,
        player:{nickname:gear.ownerNickname??null,uid:null,region:'PIONEER',serverId:null},gear};
    });
    const overall=entries.length;
    entries=entries.filter(entry=>(!query.slot||entry.gear.slot===query.slot)&&(!query.q||`${entry.player.nickname} ${entry.gear.slot}`.toLowerCase().includes(query.q.toLowerCase())||query.slots?.includes(entry.gear.slot))&&!query.verified);
    if(query.sort==='grv-asc')entries.reverse();
    if(query.sort==='aug'||query.sort==='aug-asc')entries.sort((a,b)=>a.gear.augmentCount===null?b.gear.augmentCount===null?0:1:b.gear.augmentCount===null?-1:(a.gear.augmentCount-b.gear.augmentCount)*(query.sort==='aug'? -1:1)||a.rank-b.rank);
    return {available:true,entries:entries.slice(query.offset??0,(query.offset??0)+query.limit),total:entries.length,overall,databaseEmpty:pieces.length===0};
  }
  private async synthetic(pieces:PioneerPiece[],kind:'pioneer'|'global'|'regional',query:RankingQuery,catalog:NonNullable<ReturnType<typeof loadScoringCatalog>>,region?:string):Promise<PlayerTopEntry> {
    const key=[kind,region??'',query.role,query.track.split('-').sort().join('-')].join(':');
    const cached=this.buildCache.get(key);if(cached&&Date.now()-cached.at<60_000)return {...cached.entry};
    let best:{score:number;value:number;maximum:number;track:string;pieces:PioneerPiece[]}|null=null;
    for(const track of this.tracks(query,catalog)) {
      await yieldToRequests();
      const build=scoreBuildForTrack(pieces,item=>item.piece.slot,item=>pioneerInput(item.piece,catalog),track,catalog.reference,query.role as BuildRVRole);
      const maximum=Object.values(catalog.allowedStats).reduce((sum,allowedTypes)=>sum+scoreCurrentGearForTrack({rows:[],augments:[],allowedTypes},track,catalog.reference,query.role).maximum,0);
      const score=maximum?build.value/maximum*100:0;
      if(!best||preferScoringTrack({track:track.join('-'),percent:score,value:build.value},{track:best.track,percent:best.score,value:best.value}))best={score,value:build.value,maximum,track:track.join('-'),pieces:[...build.slots.values()].map(slot=>slot.piece)};
    }
    const selected=best?.pieces??[];
    const entry:PlayerTopEntry={rank:kind==='pioneer'?1:2,synthetic:kind,score:best?.score??0,maxScore:best?.maximum??0,track:best?.track??query.track,
      player:{nickname:kind==='pioneer'?'Pioneer Best':kind==='global'?'Global Best':`${region} Best`,uid:null,region:kind==='pioneer'?'PIONEER':kind==='global'?'GLOBAL':region??null,serverId:null,combatScore:null,maxCombatScore:null},
      buildId:null,updatedAt:selected.length?new Date(Math.max(...selected.map(piece=>Date.parse(piece.observedAt)))).toISOString():'',gear:selected.map(piece=>this.view(piece,kind==='pioneer'?'pioneer':'global-reference'))};
    this.buildCache.set(key,{at:Date.now(),entry});return {...entry};
  }
  async players(query:RankingQuery, options: {refresh?: boolean} = {}) {
    if (!this.cache) return this.computePlayers(query);
    let revision: string;
    try {revision = (await this.cache.getRevision()) + ':' + (await this.cache.getRevision('ranking:pioneer'));}
    catch {return this.computePlayers(query);}
    const normalized = {...query, q:undefined, verified:false, sort:'grv' as const, offset:0, limit:100};
    const key = this.cache.pioneerKey(query);
    const result = await this.cache.getSnapshot(key, revision, async () => {
      if (this.boardRevision !== revision) {this.invalidateGlobal(); this.boardRevision = revision;}
      else if (options.refresh) this.buildCache.clear();
      return this.computePlayers(normalized);
    }, options);
    let entries = result.entries.filter(entry => (!query.q || entry.player.nickname!.toLowerCase().includes(query.q.toLowerCase())) && !query.verified);
    if(query.sort==='name-asc'||query.sort==='name-desc')entries = [...entries].sort((a,b)=>a.player.nickname!.localeCompare(b.player.nickname!)*(query.sort==='name-desc'?-1:1));
    else if(query.sort==='grv-asc')entries = [...entries].reverse();
    return {...result, total:entries.length, entries:entries.slice(query.offset??0,(query.offset??0)+query.limit)};
  }
  private async computePlayers(query:RankingQuery) {
    const catalog=loadScoringCatalog();if(!this.prisma||!catalog)return {available:false,entries:[]};
    const [pioneer,global]=await Promise.all([this.pieces(this.prisma),this.globalPieces()]);
    const a=await this.synthetic(pioneer,'pioneer',query,catalog),b=await this.synthetic(global,'global',query,catalog);
    b.comparisonDelta=b.score-a.score;
    const regions=ServerRegionCodeSchema.options.filter(region=>!UNRANKED_REGION_CODES.includes(region));
    const regional: PlayerTopEntry[] = [];
    for (const [index,region] of regions.entries()) {
      await yieldToRequests();
      regional.push({...await this.synthetic(global.filter(piece=>piece.ownerRegion===region),'regional',query,catalog,region),rank:index+3});
    }
    const ranked=[a,b,...regional].sort((left,right)=>right.score*right.maxScore-left.score*left.maxScore||left.rank-right.rank)
      .map((entry,index)=>({...entry,rank:index+1}));
    const entries=ranked.filter(entry=>(!query.q||entry.player.nickname!.toLowerCase().includes(query.q.toLowerCase()))&&!query.verified);
    if(query.sort==='name-asc'||query.sort==='name-desc')entries.sort((a,b)=>a.player.nickname!.localeCompare(b.player.nickname!)*(query.sort==='name-desc'?-1:1));
    else if(query.sort==='grv-asc')entries.reverse();
    return {available:true,entries:entries.slice(query.offset??0,(query.offset??0)+query.limit),total:entries.length,overall:2+regional.length,databaseEmpty:pioneer.length===0&&global.length===0};
  }
}
