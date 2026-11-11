import {Prisma,type PrismaClient} from '@prisma/client';
import {withBestTracks} from '../ranking/best-tracks';
import {normalizeSearchText} from '@tof-hub/contracts';
import type {GearWrite,PlayerFields,PlayerStoreRepository,StoredGear,StoredPlayer,TrackScore,UploadWrite} from './player-store.repository';

type Client=PrismaClient|Prisma.TransactionClient;
const json=(value:unknown)=>value===null?Prisma.JsonNull:value as Prisma.InputJsonValue;
function gearRow(row:Prisma.GearItemGetPayload<object>):StoredGear {
  return {...row,stats:row.stats as StoredGear['stats'],statsBeforeTitan:row.statsBeforeTitan as StoredGear['statsBeforeTitan'],augments:row.augments as StoredGear['augments']};
}

function playerRow(row:Prisma.PlayerGetPayload<object>):StoredPlayer {
  return {...row,accountStats:row.accountStats as StoredPlayer['accountStats']};
}
/** Account counters go to a JSON column; absent fields are left out (never erased). */
function playerData<T extends PlayerFields>(fields:T) {
  const {accountStats,...rest}=fields;
  return {...rest,...(accountStats?{accountStats:accountStats as Prisma.InputJsonObject}:{}),
    ...(typeof rest.nickname==='string'?{searchName:normalizeSearchText(rest.nickname)}:{})};
}

export class PrismaPlayerStoreRepository implements PlayerStoreRepository {
  constructor(private readonly client:Client,private readonly deferRankingRevision=false) {}

  transaction<T>(work:(repository:PlayerStoreRepository)=>Promise<T>):Promise<T> {
    if(!('$transaction' in this.client))return work(this);
    // Scoring a player (every role, track and known piece) can outlast the 5 s default on a cold ceiling cache.
    return (this.client as PrismaClient).$transaction(tx=>work(new PrismaPlayerStoreRepository(tx,this.deferRankingRevision)),{timeout:60_000,maxWait:60_000});
  }
  async findPlayer({uid,roleId}:{uid?:string;roleId?:string}):Promise<StoredPlayer|null> {
    const or=[...(uid?[{uid}]:[]),...(roleId?[{roleId}]:[])];
    const row=or.length?await this.client.player.findFirst({where:{OR:or}}):null;
    return row?playerRow(row):null;
  }
  async bumpRankingRevision() {
    // A full rescore publishes one revision per saved batch instead of one per gear piece.
    if(this.deferRankingRevision)return;
    if ('$executeRaw' in this.client) {
      await (this.client as PrismaClient).$executeRaw(
        Prisma.sql`INSERT INTO scoring_revisions (id, fingerprint, updated_at)
          VALUES ('ranking:players', '1', NOW())
          ON CONFLICT (id) DO UPDATE
          SET fingerprint = (scoring_revisions.fingerprint::bigint + 1)::text, updated_at = NOW()`
      ).catch(()=>{});
    }
  }
  async createPlayer(fields:PlayerFields&{firstSeenAt:Date;lastSeenAt:Date}):Promise<StoredPlayer> {
    const row=await this.client.player.create({data:playerData(fields)});
    await this.bumpRankingRevision();
    return playerRow(row);
  }
  async updatePlayer(id:string,fields:PlayerFields):Promise<StoredPlayer> {
    const row=await this.client.player.update({where:{id},data:playerData(fields)});
    await this.bumpRankingRevision();
    return playerRow(row);
  }
  async touchName(playerId:string,nickname:string,seenAt:Date) {
    // Preserve capture dates separately from the distinct-name search index, including late and repeated-name observations.
    await this.client.playerNameObservation.createMany({data:[{playerId,nickname,observedAt:seenAt}],skipDuplicates:true});
    const existing=await this.client.playerName.findUnique({where:{playerId_nickname:{playerId,nickname}}});
    if(!existing)await this.client.playerName.create({data:{playerId,nickname,searchName:normalizeSearchText(nickname),firstSeenAt:seenAt,lastSeenAt:seenAt}});
    else await this.client.playerName.update({where:{id:existing.id},data:{firstSeenAt:seenAt<existing.firstSeenAt?seenAt:existing.firstSeenAt,lastSeenAt:seenAt>existing.lastSeenAt?seenAt:existing.lastSeenAt}});
  }
  async createUpload(upload:UploadWrite) {
    const existing=await this.client.upload.findUnique({where:{kind_fileSha256:{kind:upload.kind,fileSha256:upload.fileSha256}}});
    return existing?null:(await this.client.upload.create({data:upload})).id;
  }
  async upsertGear(gear:GearWrite,uploadId:string|null):Promise<StoredGear> {
    const {seenAt,lastSeenAt,equipped,...fields}=gear;
    const existing=await this.client.gearItem.findUnique({where:{playerId_fingerprint:{playerId:gear.playerId,fingerprint:gear.fingerprint}}});
    const {augmentCount,...rest}=fields;
    // An inspect has no Titan click count: it never erases one read from an own capture.
    const values={...rest,...(augmentCount===null?{}:{augmentCount}),stats:json(fields.stats),statsBeforeTitan:json(fields.statsBeforeTitan),augments:json(fields.augments)};
    if(!existing)return gearRow(await this.client.gearItem.create({data:{...values,equipped,uploadId,firstSeenAt:seenAt,lastSeenAt}}));
    // An older observation never unequips or rewinds a piece; replaceEquipped handles the current set.
    const newer=lastSeenAt>=existing.lastSeenAt;
    return gearRow(await this.client.gearItem.update({where:{id:existing.id},data:{...(newer?values:{}),...(equipped?{equipped:true}:{}),
      firstSeenAt:seenAt<existing.firstSeenAt?seenAt:existing.firstSeenAt,lastSeenAt:lastSeenAt>existing.lastSeenAt?lastSeenAt:existing.lastSeenAt}}));
  }
  async replaceEquipped(playerId:string,slots:string[],equippedIds:string[]) {
    await this.client.gearItem.updateMany({where:{playerId,slot:{in:slots},id:{notIn:equippedIds}},data:{equipped:false}});
  }
  async listEquipped(playerId:string) {return (await this.client.gearItem.findMany({where:{playerId,equipped:true}})).map(gearRow);}
  async listPlayers():Promise<StoredPlayer[]> {return (await this.client.player.findMany({orderBy:{createdAt:'asc'}})).map(playerRow);}
  async listGear(playerId:string) {return (await this.client.gearItem.findMany({where:{playerId}})).map(gearRow);}
  // Merge base/best-track rows in bounded groups, leaving unchanged indexed scores untouched.
  // Updating one track no longer rebuilds the piece's complete set of ranking indexes;
  // removed tracks are still deleted before the active ranking revision is published.
  async saveGearScores(gear:StoredGear,region:string|null,scores:TrackScore[]) {
    await this.saveGearScoresBatch([{gear,scores}],region);
  }
  async saveGearScoresBatch(pieces:{gear:StoredGear;scores:TrackScore[]}[],region:string|null) {
    for(let offset=0;offset<pieces.length;offset+=32) {
      const batch=pieces.slice(offset,offset+32).map(({gear,scores})=>({gear,rows:withBestTracks(scores)}));
      const previous=await this.client.gearScore.findMany({where:{gearItemId:{in:batch.map(item=>item.gear.id)}},
        select:{gearItemId:true,track:true,slot:true,region:true,score:true,maxScore:true,sourceTrack:true}});
      const previousByGear=new Map<string,typeof previous>();
      for(const row of previous){const rows=previousByGear.get(row.gearItemId)??[];rows.push(row);previousByGear.set(row.gearItemId,rows);}
      type ScoreRow={gearItemId:string;track:string;slot:string;region:string|null;score:number;maxScore:number;sourceTrack:string|null};
      const inserts:ScoreRow[]=[],updates:ScoreRow[]=[],obsolete:{gearItemId:string;track:string}[]=[];
      for(const {gear,rows} of batch) {
        const oldRows=previousByGear.get(gear.id)??[],byTrack=new Map(oldRows.map(row=>[row.track,row]));
        const tracks=new Set(rows.map(row=>row.track));
        for(const old of oldRows)if(!tracks.has(old.track))obsolete.push({gearItemId:gear.id,track:old.track});
        for(const row of rows) {
          const old=byTrack.get(row.track);
          const next={gearItemId:gear.id,track:row.track,slot:gear.slot,region,score:row.score,maxScore:row.maxScore,sourceTrack:row.sourceTrack??null};
          if(!old)inserts.push(next);
          else if(old.slot!==next.slot||old.region!==next.region||old.score!==next.score||old.maxScore!==next.maxScore||old.sourceTrack!==next.sourceTrack)updates.push(next);
        }
      }
      if(!inserts.length&&!updates.length&&!obsolete.length)continue;
      for(let index=0;index<obsolete.length;index+=1000)await this.client.gearScore.deleteMany({where:{OR:obsolete.slice(index,index+1000)}});
      for(let index=0;index<inserts.length;index+=1000)await this.client.gearScore.createMany({data:inserts.slice(index,index+1000)});
      for(let index=0;index<updates.length;index+=1000) {
        const values=updates.slice(index,index+1000).map(row=>Prisma.sql`(${row.gearItemId}::text,${row.track}::text,${row.slot}::text,${row.region}::text,${row.score}::double precision,${row.maxScore}::double precision,${row.sourceTrack}::text)`);
        await this.client.$executeRaw(Prisma.sql`UPDATE gear_scores AS target
          SET slot=source.slot,region=source.region,score=source.score,max_score=source.max_score,source_track=source.source_track,updated_at=NOW()
          FROM (VALUES ${Prisma.join(values)}) AS source(gear_item_id,track,slot,region,score,max_score,source_track)
          WHERE target.gear_item_id=source.gear_item_id AND target.track=source.track`);
      }
      await this.bumpRankingRevision();
    }
  }
  async updateGear(id:string,fields:Partial<Omit<StoredGear,'id'|'playerId'>>) {
    const {stats,statsBeforeTitan,augments,...rest}=fields;
    const row=gearRow(await this.client.gearItem.update({where:{id},data:{...rest,...(stats?{stats:json(stats)}:{}),
      ...(statsBeforeTitan!==undefined?{statsBeforeTitan:json(statsBeforeTitan)}:{}),...(augments?{augments:json(augments)}:{})}}));
    await this.bumpRankingRevision();
    return row;
  }
  async absorbGear(survivorId:string,absorbed:string[]) {
    if(!absorbed.length)return;
    await this.client.buildGear.updateMany({where:{gearItemId:{in:absorbed}},data:{gearItemId:survivorId}});
    await this.client.gearItem.deleteMany({where:{id:{in:absorbed}}});
    await this.bumpRankingRevision();
  }
  async listGearScores(playerId:string) {
    return (await this.client.gearScore.findMany({where:{gear:{playerId}},select:{gearItemId:true,track:true,score:true}}))
      .map(row=>({gearId:row.gearItemId,track:row.track,score:row.score}));
  }
  async listScoredGearIds(playerId:string) {
    const rows=await this.client.playerScore.findMany({where:{playerId},select:{gearIds:true}});
    return [...new Set(rows.flatMap(row=>row.gearIds))];
  }
  async listCurrentBuildGearIds(playerId:string) {
    return [...new Set((await this.client.buildGear.findMany({where:{build:{isCurrent:true},gear:{playerId}},select:{gearItemId:true}})).map(row=>row.gearItemId))];
  }
  async deleteGear(ids:string[]) {
    if(ids.length) {
      await this.client.gearItem.deleteMany({where:{id:{in:ids}}});
      await this.bumpRankingRevision();
    }
  }
  async createBuild(build:{playerId:string;uploadId:string|null;capturedAt:Date;combatScore:number|null;element:string|null;role:string|null;draft:unknown;gear:{slot:string;gearId:string}[]}) {
    await this.client.build.updateMany({where:{playerId:build.playerId,isCurrent:true},data:{isCurrent:false}});
    const created=await this.client.build.create({data:{playerId:build.playerId,uploadId:build.uploadId,capturedAt:build.capturedAt,combatScore:build.combatScore,
      element:build.element,role:build.role,draft:json(build.draft),gear:{create:build.gear.map(item=>({slot:item.slot,gearItemId:item.gearId}))}}});
    await this.bumpRankingRevision();
    return created.id;
  }
  async savePlayerScores(playerId:string,region:string|null,buildId:string|null,scores:TrackScore[]) {
    // A rescore passes no build id: the stored one is kept.
    const kept=buildId??(await this.client.playerScore.findFirst({where:{playerId,buildId:{not:null}},select:{buildId:true}}))?.buildId??null;
    const rows=withBestTracks(scores);
    const previous=await this.client.playerScore.findMany({where:{playerId},select:{track:true,region:true,buildId:true,score:true,maxScore:true,sourceTrack:true,gearIds:true}});
    const byTrack=new Map(previous.map(row=>[row.track,row]));
    if(previous.length===rows.length&&rows.every(row=>{
      const old=byTrack.get(row.track);
      return old&&old.region===region&&old.buildId===kept&&old.score===row.score&&old.maxScore===row.maxScore
        &&old.sourceTrack===(row.sourceTrack??null)&&JSON.stringify(old.gearIds)===JSON.stringify(row.gearIds??[]);
    }))return;
    await this.client.playerScore.deleteMany({where:{playerId}});
    if(rows.length) {
      await this.client.playerScore.createMany({data:rows.map(score=>({playerId,track:score.track,region,buildId:kept,
        score:score.score,maxScore:score.maxScore,sourceTrack:score.sourceTrack??null,gearIds:score.gearIds??[]}))});
      await this.bumpRankingRevision();
    }
  }
}
