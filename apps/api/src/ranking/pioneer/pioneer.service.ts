import {Inject,Injectable,Optional,ServiceUnavailableException} from '@nestjs/common';
import {Prisma,type PrismaClient} from '@prisma/client';
import {isPioneerCapture,PlayerSnapshotSchema,resolvePlayerServer,ServerRegionCodeSchema,UNRANKED_REGION_CODES,type PlayerSnapshot} from '@tof-hub/contracts';
import {createBuildTrackAccumulator,roleTracks,preferScoringTrack,scoreBuildForTrack,scoreCurrentGearForTrack,type BuildRVRole} from '@tof-hub/game-domain';
import {PRISMA} from '../../database/database.module';
import {loadScoringCatalog,type ScoringCatalog} from '../../players/scoring-catalog';
import {pioneerInput,pioneerObservations,retainPioneer,type PioneerPiece,type PioneerProvenance} from './pioneer-store';
import type {GearTopEntry,PlayerTopEntry,RankingQuery} from '../ranking.service';
import {gearTopView} from '../gear-view';
import {legacyBuildGear} from '../../import/capture-import-policy';
import {RankingCacheService} from '../cache/ranking-cache.service';
import {setImmediate as yieldToRequests} from 'node:timers/promises';

const LIVE_GEAR_PAGE_SIZE=256;
const LIVE_REGIONS=ServerRegionCodeSchema.options.filter(region=>!UNRANKED_REGION_CODES.includes(region));
const LIVE_REGION_SET=new Set<string>(LIVE_REGIONS);
type BuildSelection={value:number;pieces:PioneerPiece[]};
type LiveBuilds={scopes:Map<string|null,Map<string,BuildSelection>>;hasGear:boolean};
type BuildForTrack=(track:string[])=>BuildSelection;
const selectedBuild=({value,slots}:ReturnType<typeof scoreBuildForTrack<PioneerPiece>>):BuildSelection=>
  ({value,pieces:[...slots.values()].map(slot=>slot.piece)});

@Injectable()
export class PioneerService {
  constructor(@Optional() @Inject(PRISMA) private readonly prisma:PrismaClient|null=null,
    @Optional() @Inject(RankingCacheService) private readonly cache:RankingCacheService|null=null) {}
  private boardRevision: string | null = null;
  private readonly globalCache=new Map<BuildRVRole,{at:number;builds:LiveBuilds}>();
  private readonly globalFlights=new Map<BuildRVRole,Promise<LiveBuilds>>();
  private globalTail:Promise<void>=Promise.resolve();
  private globalGeneration=0;
  invalidateGlobal() {this.globalCache.clear();this.globalFlights.clear();this.globalGeneration++;}
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
    return result;
  }
  private async globalBuilds(role:BuildRVRole,catalog:ScoringCatalog):Promise<LiveBuilds> {
    const cached=this.globalCache.get(role);
    if(cached&&Date.now()-cached.at<60_000)return cached.builds;
    const existing=this.globalFlights.get(role);
    if(existing)return existing;
    const generation=this.globalGeneration;
    // Different roles take turns so cold requests cannot multiply the live scan's load.
    const pending=this.globalTail.then(async()=>{
      const builds=await this.readGlobalBuilds(role,catalog);
      if(generation===this.globalGeneration)this.globalCache.set(role,{at:Date.now(),builds});
      return builds;
    });
    this.globalTail=pending.then(()=>{},()=>{});
    this.globalFlights.set(role,pending);
    try{return await pending;}finally{if(this.globalFlights.get(role)===pending)this.globalFlights.delete(role);}
  }
  private readGlobalBuilds(role:BuildRVRole,catalog:ScoringCatalog):Promise<LiveBuilds> {
    const tracks=roleTracks(role,catalog.tracks).map(track=>[track.join('-'),
      createBuildTrackAccumulator<PioneerPiece,string|null>(item=>item.piece.slot,item=>pioneerInput(item.piece,catalog),track,catalog.reference,role)] as const);
    return this.prisma!.$transaction(async tx=>{
      let after:string|undefined;
      for(;;) {
        const rows=await tx.gearItem.findMany({
          where:{...(after===undefined?{}:{id:{gt:after}}),
            player:{hidden:false,OR:[{region:null},{region:{notIn:[...UNRANKED_REGION_CODES]}}]}},
          orderBy:{id:'asc'},take:LIVE_GEAR_PAGE_SIZE,
          select:{id:true,fingerprint:true,slot:true,itemId:true,stars:true,enhancement:true,titan:true,augmented:true,rareId:true,rareLevel:true,
            stats:true,statsBeforeTitan:true,augments:true,augmentCount:true,lastSeenAt:true,player:{select:{nickname:true,region:true,serverId:true}}},
        });
        for(const {id,fingerprint,lastSeenAt,player,...piece} of rows) {
          const item:PioneerPiece={id,fingerprint,piece:piece as unknown as PioneerPiece['piece'],
            observedAt:lastSeenAt.toISOString(),provenance:null,ownerNickname:player.nickname,ownerRegion:player.region,ownerServerId:player.serverId};
          const scopes=player.region&&LIVE_REGION_SET.has(player.region)?[null,player.region]:[null];
          for(const [,track] of tracks)track.add(item,scopes);
        }
        after=rows.at(-1)?.id??after;
        if(rows.length<LIVE_GEAR_PAGE_SIZE)break;
        await yieldToRequests();
      }
      const scopes=new Map([null,...LIVE_REGIONS].map(scope=>[scope,
        new Map(tracks.map(([key,track])=>[key,selectedBuild(track.result(scope))]))]));
      return {scopes,hasGear:after!==undefined};
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:180_000});
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
  private async synthetic(buildForTrack:BuildForTrack,kind:'pioneer'|'global'|'regional',query:RankingQuery,catalog:ScoringCatalog,region?:string):Promise<PlayerTopEntry> {
    let best:{score:number;value:number;maximum:number;track:string;pieces:PioneerPiece[]}|null=null;
    for(const track of this.tracks(query,catalog)) {
      await yieldToRequests();
      const build=buildForTrack(track);
      const maximum=Object.values(catalog.allowedStats).reduce((sum,allowedTypes)=>sum+scoreCurrentGearForTrack({rows:[],augments:[],allowedTypes},track,catalog.reference,query.role).maximum,0);
      const score=maximum?build.value/maximum*100:0;
      if(!best||preferScoringTrack({track:track.join('-'),percent:score,value:build.value},{track:best.track,percent:best.score,value:best.value}))best={score,value:build.value,maximum,track:track.join('-'),pieces:build.pieces};
    }
    const selected=best?.pieces??[];
    return {rank:kind==='pioneer'?1:2,synthetic:kind,score:best?.score??0,maxScore:best?.maximum??0,track:best?.track??query.track,
      player:{nickname:kind==='pioneer'?'Pioneer Best':kind==='global'?'Global Best':`${region} Best`,uid:null,region:kind==='pioneer'?'PIONEER':kind==='global'?'GLOBAL':region??null,serverId:null,combatScore:null,maxCombatScore:null},
      buildId:null,updatedAt:selected.length?new Date(Math.max(...selected.map(piece=>Date.parse(piece.observedAt)))).toISOString():'',gear:selected.map(piece=>this.view(piece,kind==='pioneer'?'pioneer':'global-reference'))};
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
      return this.computePlayers(normalized);
    }, options);
    let entries = result.entries.filter(entry => (!query.q || entry.player.nickname!.toLowerCase().includes(query.q.toLowerCase())) && !query.verified);
    if(query.sort==='name-asc'||query.sort==='name-desc')entries = [...entries].sort((a,b)=>a.player.nickname!.localeCompare(b.player.nickname!)*(query.sort==='name-desc'?-1:1));
    else if(query.sort==='grv-asc')entries = [...entries].reverse();
    return {...result, total:entries.length, entries:entries.slice(query.offset??0,(query.offset??0)+query.limit)};
  }
  private async computePlayers(query:RankingQuery) {
    const catalog=loadScoringCatalog();if(!this.prisma||!catalog)return {available:false,entries:[]};
    const [pioneer,global]=await Promise.all([this.pieces(this.prisma),this.globalBuilds(query.role,catalog)]);
    const live=(scope:string|null):BuildForTrack=>track=>global.scopes.get(scope)!.get(track.join('-'))!;
    const isolated:BuildForTrack=track=>selectedBuild(scoreBuildForTrack(pioneer,item=>item.piece.slot,
      item=>pioneerInput(item.piece,catalog),track,catalog.reference,query.role));
    const a=await this.synthetic(isolated,'pioneer',query,catalog),b=await this.synthetic(live(null),'global',query,catalog);
    b.comparisonDelta=b.score-a.score;
    const regional: PlayerTopEntry[] = [];
    for (const [index,region] of LIVE_REGIONS.entries()) {
      await yieldToRequests();
      regional.push({...await this.synthetic(live(region),'regional',query,catalog,region),rank:index+3});
    }
    const ranked=[a,b,...regional].sort((left,right)=>right.score*right.maxScore-left.score*left.maxScore||left.rank-right.rank)
      .map((entry,index)=>({...entry,rank:index+1}));
    const entries=ranked.filter(entry=>(!query.q||entry.player.nickname!.toLowerCase().includes(query.q.toLowerCase()))&&!query.verified);
    if(query.sort==='name-asc'||query.sort==='name-desc')entries.sort((a,b)=>a.player.nickname!.localeCompare(b.player.nickname!)*(query.sort==='name-desc'?-1:1));
    else if(query.sort==='grv-asc')entries.reverse();
    return {available:true,entries:entries.slice(query.offset??0,(query.offset??0)+query.limit),total:entries.length,overall:2+regional.length,databaseEmpty:pioneer.length===0&&!global.hasGear};
  }
}
