import {createHash} from 'node:crypto';
import {FOREIGN_STAT_REGION_CODES,PlayerSnapshotSchema,canonicalPlayerUid,playerServerRefusal,resolvePlayerServer,type PlayerServerRefusal,type PlayerSnapshot,type PlayerSnapshotGear} from '@tof-hub/contracts';
import {gearChampions,createCurrentGearScorer,TOP_RV_ROLES,roleTrackId,roleTracks,scoreBuildForTrack,scoreGearForTrack} from '@tof-hub/game-domain';
import type {GearWrite,PlayerFields,PlayerStoreRepository,StoredGear,StoredPlayer,TrackScore,UploadWrite} from './player-store.repository';
import type {ScoringCatalog} from './scoring-catalog';
import {isBestTrack} from '../ranking/best-tracks';

export interface StoreResult {playerId:string;duplicate:boolean;gearStored:number;backpackStored?:number;buildId:string|null;stale:boolean}
/** A player of a region on another game build (FOREIGN_STAT_REGION_CODES): refused before anything is stored. */
export class ForeignRegionError extends Error {
  constructor(readonly region:string) {super(`Players of region ${region} are not stored: another game build with its own stat system`);}
}

/** A player of an unknown (unverifiable) or Warp/MMO server (playerServerRefusal): refused before anything is stored. */
export class RefusedServerError extends Error {
  constructor(readonly refusal:PlayerServerRefusal) {super(refusal==='unknown-server'?'Players of servers missing from the catalog are not stored':'Players of Warp (MMO) servers are not stored');}
}

/**
 * Identity of a gear piece across observations: the game instance id when known, otherwise slot, item, stars and the
 * values before Titan (they never change). Without pre-Titan values the current stats are used, so Titan progress of
 * such a piece creates a new row; `equipped` still points at the latest one.
 */
export function gearFingerprint(gear:PlayerSnapshotGear) {
  const basis=gear.instanceId?['instance',gear.instanceId]:gear.statsBeforeTitan?.every(value=>value!==null)
    ?['before',gear.slot,gear.itemId,gear.stars,gear.stats.map(stat=>stat.type),gear.statsBeforeTitan]
    :['current',gear.slot,gear.itemId,gear.stars,gear.enhancement,gear.stats,gear.augments,gear.rareId,gear.rareLevel];
  return createHash('sha256').update(JSON.stringify(basis)).digest('hex');
}

type PieceShape=Pick<StoredGear,'slot'|'itemId'|'stars'|'rareId'|'stats'>&{statsBeforeTitan?:StoredGear['statsBeforeTitan']};
const covers=(a:PieceShape,b:PieceShape)=>a.stats.every((stat,index)=>stat.value>=b.stats[index]!.value-1e-6*Math.max(1,Math.abs(b.stats[index]!.value)));
/**
 * The same piece seen twice (2026-10-08): same slot, item, stars, Titan effect and stat types, and one observation has
 * every stat at least as high as the other (Titan clicks and enhancement only grow). Needed because an inspect has no
 * pre-Titan values: its fingerprint follows the current stats, so +66 → +68 or a Titan click looked like a new piece,
 * and the own card (fingerprint from pre-Titan values) and an inspect of the same piece were two rows.
 */
export function samePiece(a:PieceShape,b:PieceShape):boolean {
  if(a.slot!==b.slot||a.itemId!==b.itemId||a.stars!==b.stars||(a.rareId??null)!==(b.rareId??null)||a.stats.length!==b.stats.length)return false;
  if(a.stats.some((stat,index)=>stat.type!==b.stats[index]!.type))return false;
  // Pre-Titan values never change: two known and different sets are two pieces, whatever their current stats.
  const before=(item:PieceShape)=>item.statsBeforeTitan?.every(value=>value!==null)?item.statsBeforeTitan:null,beforeA=before(a),beforeB=before(b);
  if(beforeA&&beforeB&&JSON.stringify(beforeA)!==JSON.stringify(beforeB))return false;
  return covers(a,b)||covers(b,a);
}

/** Reference-only ceilings reused for the life of a catalog; real gear values are always recomputed. */
const scoringContexts=new WeakMap<ScoringCatalog,{score:ReturnType<typeof createCurrentGearScorer>;scorerForSource:(source?:string)=>ReturnType<typeof createCurrentGearScorer>;maximums:Map<string,number>}>();
function scoringContext(catalog:ScoringCatalog) {
  let context=scoringContexts.get(catalog);
  if(!context){
    const scorers=new Map<string,ReturnType<typeof createCurrentGearScorer>>();
    const scorerForSource=(source?:string)=>{
      const key=source??'';let score=scorers.get(key);
      if(!score){score=createCurrentGearScorer(catalog.reference,source);scorers.set(key,score);}
      return score;
    };
    context={score:scorerForSource(),scorerForSource,maximums:new Map()};scoringContexts.set(catalog,context);
  }
  return context;
}

/**
 * Pieces no top needs any more (2026-10-08): not equipped, not in the current captured build, and in every track of
 * its slot the player has a better piece (ties: the newer observation wins). Best rows are derived and do not count.
 */
export function obsoleteGear(gear:Pick<StoredGear,'id'|'slot'|'equipped'|'lastSeenAt'>[],scores:{gearId:string;track:string;score:number}[],protectedIds:string[]):string[] {
  const byId=new Map(gear.map(item=>[item.id,item])),best=new Map<string,{id:string;score:number;seen:number}>();
  for(const row of scores) {
    const item=byId.get(row.gearId);
    if(!item||isBestTrack(row.track))continue;
    const key=`${item.slot}|${row.track}`,current=best.get(key),seen=item.lastSeenAt.getTime();
    if(!current||row.score>current.score||(row.score===current.score&&seen>current.seen))best.set(key,{id:item.id,score:row.score,seen});
  }
  const keep=new Set([...protectedIds,...[...best.values()].map(entry=>entry.id),...gear.filter(item=>item.equipped).map(item=>item.id)]);
  return gear.filter(item=>!keep.has(item.id)).map(item=>item.id);
}

/**
 * Backpack Titan pieces that the rankings need (2026-10-09): per slot and track (every role, derived best rows excluded) the
 * strongest candidate is kept only when it is strictly better than every known piece of that slot, equipped or stored.
 * Returns candidate indexes; a candidate that wins nowhere is never written (the full backpack is not stored).
 */
export function backpackWinners(known:{slot:string;track:string;score:number}[],candidates:{slot:string;scores:TrackScore[]}[]):number[] {
  const best=new Map<string,number>();
  for(const row of known)if(!isBestTrack(row.track))best.set(`${row.slot}|${row.track}`,Math.max(best.get(`${row.slot}|${row.track}`)??-Infinity,row.score));
  const top=new Map<string,{index:number;score:number}>();
  candidates.forEach((candidate,index)=>{for(const row of candidate.scores) {
    if(isBestTrack(row.track))continue;
    const key=`${candidate.slot}|${row.track}`,current=top.get(key);
    if(row.score>(best.get(key)??-Infinity)&&(!current||row.score>current.score))top.set(key,{index,score:row.score});
  }});
  return [...new Set([...top.values()].map(entry=>entry.index))].sort((a,b)=>a-b);
}

/** Preserve slot leaders for every independent whole-set source, including contexts a future upload can activate. */
function gearSetChampions<T extends Pick<StoredGear,'slot'|'stats'|'augments'|'titan'|'augmented'>>(pieces:T[],catalog:ScoringCatalog):T[] {
  return [...new Set(gearChampions(pieces,item=>item.slot,item=>{
    const allowedTypes=catalog.allowedStats[item.slot];
    return allowedTypes?{rows:item.stats,augments:item.titan||item.augmented?item.augments:[],allowedTypes}:null;
  },catalog.tracks,catalog.reference).map(winner=>winner.piece))];
}

/**
 * Ranking rank gear by its current stats (agreed 2026-10-06): Titan growth is random per stat, so
 * someone else's pre-Titan values cannot be recovered. `maxScore` is the full-Titan projection when the item's
 * pre-Titan values are known (own capture), otherwise the current score.
 */
function trackScores(gear:Pick<StoredGear,'slot'|'stats'|'statsBeforeTitan'|'stars'|'titan'|'augmented'|'augments'>,catalog:ScoringCatalog):TrackScore[] {
  const allowedTypes=catalog.allowedStats[gear.slot];
  if(!allowedTypes)return [];
  const rows=gear.stats.map((stat,index)=>({type:stat.type,value:stat.value,beforeTitan:gear.statsBeforeTitan?.[index]??null}));
  // Inspected Titan gear has no originals: the canonical projection returns null,
  // so use the same current-score fallback without rebuilding an unused ceiling for every track.
  const canProject=rows.length===catalog.reference.limits.maxNumOfRandomStats
    &&(!(gear.titan||gear.augmented)||rows.every(row=>row.beforeTitan!==null));
  // Every role keeps its own tracks (DPS plain, `healer:` / `tank:` prefixed; a tank has mono tracks only).
  return TOP_RV_ROLES.flatMap(role=>roleTracks(role,catalog.tracks).flatMap(track=>{
    const current=scoringContext(catalog).score({rows:gear.stats,augments:gear.titan||gear.augmented?gear.augments:[],allowedTypes},track,role);
    // Nothing of this track on the item: it does not rank there.
    if(current.percent===null||current.value<=0)return [];
    const projected=canProject?scoreGearForTrack({rows,stars:gear.stars,augmented:gear.titan||gear.augmented,allowedTypes},track,catalog.reference,role):null;
    return [{track:roleTrackId(role,track.join('-')),selectionValue:current.value,score:current.percent,maxScore:projected?.percent??current.percent}];
  }));
}

/** Defined values only: an absent field never erases what is stored. */
function present<T extends object>(fields:T):Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([,value])=>value!==undefined&&value!==null)) as Partial<T>;
}

/**
 * Stores everything an observation brings: a full build card or only someone's gear from an inspect.
 * Newer observations update the player and the equipped set; an older one only fills fields that are still empty.
 */
export class PlayerStoreService {
  constructor(private readonly repository:PlayerStoreRepository,private readonly catalog:ScoringCatalog|null) {}

  /**
   * `profileOnly`: an MMO (Warp) own card stores the player and its upload only; Warp has no gear, builds or ranking
   * (docs/imports.md). It admits exactly the Warp refusal, never an unknown server.
   */
  async store(input:unknown,upload?:Omit<UploadWrite,'playerId'>,{profileOnly=false}:{profileOnly?:boolean}={}):Promise<StoreResult> {
    const snapshot:PlayerSnapshot=PlayerSnapshotSchema.parse(input);
    if(snapshot.player.uid)snapshot.player.uid=canonicalPlayerUid(snapshot.player.uid,{roleId:snapshot.player.roleId});
    // China runs another game build with its own stat system: its gear cannot be rated against the global tables.
    const region=resolvePlayerServer({uid:snapshot.player.uid}).regionCode;
    if(region&&FOREIGN_STAT_REGION_CODES.includes(region))throw new ForeignRegionError(region);
    // Without a UID (a player known only by role id) the server cannot be classified; the CN rule above works the same way.
    const refusal=snapshot.player.uid?playerServerRefusal({uid:snapshot.player.uid}):null;
    if(refusal&&!(profileOnly&&refusal==='unsupported-game'))throw new RefusedServerError(refusal);
    const seenAt=new Date(snapshot.capturedAt);
    return this.repository.transaction(async repository=>{
      const {player,stale}=await this.savePlayer(repository,snapshot,seenAt);
      const uploadId=upload?await repository.createUpload({...upload,playerId:player.id}):null;
      const duplicate=!!upload&&uploadId===null;
      // Revisit own backpacks: earlier import policies skipped candidates behind a newer inspect.
      if(duplicate&&snapshot.source!=='self')return {playerId:player.id,duplicate:true,gearStored:0,buildId:null,stale};
      if(profileOnly)return {playerId:player.id,duplicate:false,gearStored:0,buildId:null,stale};
      const stored:StoredGear[]=[];
      const known=await repository.listGear(player.id);
      const write=async(item:PlayerSnapshotGear,equipped:boolean)=>{
        const write:GearWrite={playerId:player.id,slot:item.slot,itemId:item.itemId,instanceId:item.instanceId??null,fingerprint:gearFingerprint(item),
          stars:item.stars,enhancement:item.enhancement,titan:item.titan,augmented:item.augmented,rareId:item.rareId,rareLevel:item.rareLevel,
          stats:item.stats,statsBeforeTitan:item.statsBeforeTitan,augments:item.augments,augmentCount:item.augmentCount??null,equipped,source:snapshot.source,lastSeenAt:seenAt,seenAt};
        const gear=known.some(row=>row.fingerprint===write.fingerprint)?await repository.upsertGear(write,uploadId)
          :await this.observeKnownPiece(repository,known,write)??await repository.upsertGear(write,uploadId);
        const at=known.findIndex(row=>row.id===gear.id);if(at>=0)known[at]=gear;else known.push(gear);
        if(this.catalog)await repository.saveGearScores(gear,player.region,trackScores(gear,this.catalog));
        return gear;
      };
      for(const item of snapshot.gear??[])stored.push(await write(item,!stale));
      // An older observation keeps its gear in history but never replaces the current equipped set.
      if(!stale&&stored.length)await repository.replaceEquipped(player.id,stored.map(gear=>gear.slot),stored.map(gear=>gear.id));
      // Old own backpacks can still contain a better piece. Freshness only controls profile/equipped metadata.
      let backpackStored=0;
      if(this.catalog&&snapshot.backpack?.length) {
        const slots=new Map(known.map(row=>[row.id,row.slot]));
        const scores=(await repository.listGearScores(player.id)).flatMap(row=>slots.has(row.gearId)?[{slot:slots.get(row.gearId)!,track:row.track,score:row.score}]:[]);
        const winners=backpackWinners(scores,snapshot.backpack.map(item=>({slot:item.slot,scores:trackScores(item,this.catalog!)})));
        // Any coherent duo / Altered set may need a piece that is not a standalone winner.
      const champions=gearSetChampions<Pick<StoredGear,'slot'|'stats'|'augments'|'titan'|'augmented'>>([...known,...snapshot.backpack],this.catalog);
      const retained=new Set(winners);
      for(const winner of champions){const index=snapshot.backpack.indexOf(winner as PlayerSnapshotGear);if(index>=0)retained.add(index);}
      for(const index of retained){await write(snapshot.backpack[index]!,false);backpackStored++;}
      }
      const buildId=snapshot.build&&!stale&&!duplicate?await repository.createBuild({playerId:player.id,uploadId,capturedAt:seenAt,combatScore:snapshot.build.combatScore,
        element:snapshot.build.element,role:snapshot.build.role,draft:snapshot.build.draft,gear:stored.map(gear=>({slot:gear.slot,gearId:gear.id}))}):null;
      if(this.catalog&&stored.length+backpackStored)await this.savePlayerScores(repository,player,buildId);
      if(this.catalog&&stored.length+backpackStored)await this.pruneGear(repository,player.id);
      return {playerId:player.id,duplicate,gearStored:stored.length,backpackStored,buildId,stale};
    });
  }

  private async savePlayer(repository:PlayerStoreRepository,snapshot:PlayerSnapshot,seenAt:Date):Promise<{player:StoredPlayer;stale:boolean}> {
    const p=snapshot.player;
    const account=Object.fromEntries([
      ...Object.entries(p.account??{}).filter(([,value])=>typeof value==='number'),
      ...Object.entries(p.gearCounters??{}),
    ]) as Record<string,number|null>;
    const hasAccount=Object.keys(account).length>0;
    const {server,regionCode}=resolvePlayerServer({uid:p.uid});
    const fields:PlayerFields=present({uid:p.uid,roleId:p.roleId,nickname:p.nickname,level:p.level,crew:p.crew,titleId:p.titleId,avatarId:p.avatarId,
      avatarFrameId:p.avatarFrameId,combatScore:p.combatScore,maxCombatScore:p.maxCombatScore,
      totalRecharge:p.totalRecharge===undefined?undefined:BigInt(p.totalRecharge),serverId:server?.id,region:regionCode??undefined,
      accountStats:hasAccount?account:undefined,
      accountStatsAt:hasAccount?seenAt:undefined,selfCaptureAt:snapshot.source==='self'?seenAt:undefined});
    // The game's own date of the max combat score (HistoryMaxGSChangeTime; sent for the own character only, so only a
    // .tofbuild carries it). Nothing else dates the max (2026-10-09).
    const maxAt=p.maxCombatScore!=null&&p.maxCombatScoreAt?new Date(p.maxCombatScoreAt):null;
    const existing=await repository.findPlayer({uid:p.uid,roleId:p.roleId});
    if(!existing) {
      const player=await repository.createPlayer({...fields,...(maxAt?{maxCombatScoreAt:maxAt}:{}),firstSeenAt:seenAt,lastSeenAt:seenAt});
      if(p.nickname)await repository.touchName(player.id,p.nickname,seenAt);
      return {player,stale:false};
    }
    const stale=existing.lastSeenAt.getTime()>seenAt.getTime();
    const update:PlayerFields=stale?Object.fromEntries(Object.entries(fields).filter(([key])=>existing[key as keyof StoredPlayer]===null)):{...fields,lastSeenAt:seenAt};
    if(snapshot.source==='self')update.selfCaptureAt=existing.selfCaptureAt&&existing.selfCaptureAt>seenAt?existing.selfCaptureAt:seenAt;
    if(hasAccount) {
      // Partial builds can bring some counters but leave the rest unknown.
      // Preserve every known counter; an old observation only fills unknown keys.
      const incoming=Object.fromEntries(Object.entries(account).filter(([key,value])=>stale
        ?existing.accountStats?.[key]==null:value!==null||existing.accountStats?.[key]==null));
      if(Object.keys(incoming).length) {
        update.accountStats={...existing.accountStats,...incoming};
        update.accountStatsAt=stale?(existing.accountStatsAt??seenAt):seenAt;
      }
    }
    if(seenAt<existing.firstSeenAt)update.firstSeenAt=seenAt;
    // A newer capture (or one with the same max) carries the game's date of that max; a newer max without one clears
    // the old date, which belonged to the previous max.
    if(maxAt&&(!stale||existing.maxCombatScore===p.maxCombatScore))update.maxCombatScoreAt=maxAt;
    else if(!stale&&p.maxCombatScore!=null&&p.maxCombatScore!==existing.maxCombatScore&&existing.maxCombatScoreAt)update.maxCombatScoreAt=null;
    const player=Object.keys(update).length?await repository.updatePlayer(existing.id,update):existing;
    if(p.nickname)await repository.touchName(player.id,p.nickname,seenAt);
    return {player,stale};
  }

  /**
   * Player total per track: per slot the best known piece for that track (equipped or kept from an earlier inspect, so
   * a Frost set and a Physical set of one player both rank; 2026-10-08, Shino Asada), its current GRV over the ceilings
   * of every slot, so an empty or off-element slot counts as 0. Ties go to the equipped, then the newer piece, as in
   * `obsoleteGear`. A pair track counts ATK % / DMG % of one element over the whole build (scoreBuildForTrack).
   * `maxScore` is that sum of ceilings; `gearIds` the chosen pieces.
   */
  private async savePlayerScores(repository:PlayerStoreRepository,player:StoredPlayer,buildId:string|null) {
    const catalog=this.catalog!,gear=(await repository.listGear(player.id))
      .sort((a,b)=>Number(b.equipped)-Number(a.equipped)||+b.lastSeenAt-+a.lastSeenAt);
    const scores=TOP_RV_ROLES.flatMap(role=>roleTracks(role,catalog.tracks).map(track=>{
      const context=scoringContext(catalog),key=roleTrackId(role,track.join('-'));
      let maximum=context.maximums.get(key);
      if(maximum===undefined){maximum=Object.values(catalog.allowedStats).reduce((sum,allowedTypes)=>
        sum+context.score({rows:[],augments:[],allowedTypes},track,role).maximum,0);context.maximums.set(key,maximum);}
      const build=scoreBuildForTrack(gear,item=>item.slot,item=>{
        const allowedTypes=catalog.allowedStats[item.slot];
        return allowedTypes?{rows:item.stats,augments:item.titan||item.augmented?item.augments:[],allowedTypes}:null;
      },track,catalog.reference,role,undefined,context.scorerForSource);
      return {track:roleTrackId(role,track.join('-')),selectionValue:build.value,score:maximum>0?build.value/maximum*100:0,maxScore:maximum,gearIds:[...build.slots.values()].map(entry=>entry.piece.id)};
    }));
    await repository.savePlayerScores(player.id,player.region,buildId,scores);
  }

  /**
   * A piece already stored under another fingerprint (samePiece): the stored row is updated in place, so it keeps its
   * id (build links), its pre-Titan values and fingerprint from an own capture, and its Titan click count. Every
   * other stored copy of the piece is absorbed into it. Null when the piece is new.
   */
  private async observeKnownPiece(repository:PlayerStoreRepository,known:StoredGear[],write:GearWrite):Promise<StoredGear|null> {
    const matches=known.filter(row=>samePiece(row,write));
    if(!matches.length)return null;
    const survivor=matches.find(row=>row.statsBeforeTitan?.every(value=>value!==null))??[...matches].sort((a,b)=>+b.lastSeenAt-+a.lastSeenAt)[0]!;
    const newer=write.lastSeenAt>=survivor.lastSeenAt,ownBefore=survivor.statsBeforeTitan?.every(value=>value!==null);
    const updated=await repository.updateGear(survivor.id,{
      ...(newer?{stats:write.stats,enhancement:write.enhancement,titan:write.titan,augmented:write.augmented,rareLevel:write.rareLevel,augments:write.augments,
        lastSeenAt:write.lastSeenAt,...(write.equipped?{equipped:true}:{})}:{}),
      // Pre-Titan values (and the fingerprint made from them) come only from an own capture and never change.
      ...(!ownBefore&&write.statsBeforeTitan?.every(value=>value!==null)?{statsBeforeTitan:write.statsBeforeTitan,fingerprint:write.fingerprint,source:write.source}:{}),
      ...(write.augmentCount!==null?{augmentCount:write.augmentCount}:{}),
      firstSeenAt:write.seenAt<survivor.firstSeenAt?write.seenAt:survivor.firstSeenAt});
    const absorbed=matches.filter(row=>row.id!==survivor.id).map(row=>row.id);
    await repository.absorbGear(survivor.id,absorbed);
    for(const id of absorbed){const at=known.findIndex(row=>row.id===id);if(at>=0)known.splice(at,1);}
    return updated;
  }

  /**
   * Deletes pieces no top needs. The current captured build and stored player totals can pin gear; older automatic
   * captures cannot. A pair-track total can use a piece that is not the best of its slot on its own.
   */
  private async pruneGear(repository:PlayerStoreRepository,playerId:string):Promise<number> {
    const [gear,scores,builds,scored]=await Promise.all([repository.listGear(playerId),repository.listGearScores(playerId),
      repository.listCurrentBuildGearIds(playerId),repository.listScoredGearIds(playerId)]);
    const champions=this.catalog?gearSetChampions(gear,this.catalog).map(item=>item.id):[];
    const ids=obsoleteGear(gear,scores,[...builds,...scored,...champions]);
    await repository.deleteGear(ids);
    return ids.length;
  }

  /**
   * One-off cleanup of stored data with the rules above: copies of the same piece are merged into one row (rescored),
   * then pieces no top needs are deleted, and the player totals are recomputed.
   */
  async compactAll():Promise<{players:number;merged:number;deleted:number}> {
    if(!this.catalog)return {players:0,merged:0,deleted:0};
    let merged=0,deleted=0;
    const players=await this.repository.listPlayers();
    for(const player of players)await this.repository.transaction(async repository=>{
      const gear=(await repository.listGear(player.id)).sort((a,b)=>+b.lastSeenAt-+a.lastSeenAt);
      const done=new Set<string>();
      for(const item of gear) {
        if(done.has(item.id))continue;
        const group=gear.filter(other=>!done.has(other.id)&&samePiece(other,item));
        group.forEach(other=>done.add(other.id));
        if(group.length<2)continue;
        // Survivor: the own-capture row (pre-Titan values) or the newest; it takes the newest values and equipped state.
        const newest=group[0]!,survivor=group.find(row=>row.statsBeforeTitan?.every(value=>value!==null))??newest;
        const updated=survivor.id===newest.id?survivor:await repository.updateGear(survivor.id,{stats:newest.stats,enhancement:newest.enhancement,
          titan:newest.titan,augmented:newest.augmented,rareLevel:newest.rareLevel,augments:newest.augments,lastSeenAt:newest.lastSeenAt,
          equipped:group.some(row=>row.equipped),firstSeenAt:new Date(Math.min(...group.map(row=>+row.firstSeenAt)))});
        await repository.absorbGear(survivor.id,group.filter(row=>row.id!==survivor.id).map(row=>row.id));
        await repository.saveGearScores(updated,player.region,trackScores(updated,this.catalog!));
        merged+=group.length-1;
      }
      await this.savePlayerScores(repository,player,null);
      deleted+=await this.pruneGear(repository,player.id);
    });
    return {players:players.length,merged,deleted};
  }

  /**
   * Recomputes every stored gear and player score with the current rules (after a scoring change).
   * Each player commits alone; `onProgress` runs after every `batchSize` players with the last finished ID, so a run can resume after it.
   */
  async rescoreAll({afterId,batchSize=100,pauseMs=0,onProgress}:{afterId?:string;batchSize?:number;pauseMs?:number;onProgress?:(progress:{lastPlayerId:string;done:number;total:number})=>Promise<void>}={}):Promise<{players:number;gear:number}> {
    if(!this.catalog)return {players:0,gear:0};
    let gearCount=0,done=0;
    const all=(await this.repository.listPlayers()).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    const players=afterId===undefined?all:all.filter(player=>player.id>afterId);
    for(const player of players){
      await this.repository.transaction(async repository=>{
        const gear=await repository.listGear(player.id);
        for(let offset=0;offset<gear.length;offset+=32) {
          const pieces=gear.slice(offset,offset+32).map(gear=>({gear,scores:trackScores(gear,this.catalog!)}));
          if(repository.saveGearScoresBatch)await repository.saveGearScoresBatch(pieces,player.region);
          else for(const {gear,scores} of pieces)await repository.saveGearScores(gear,player.region,scores);
          gearCount+=pieces.length;
        }
        await this.savePlayerScores(repository,player,null);
      });
      done++;
      if(onProgress&&(done%batchSize===0||done===players.length))await onProgress({lastPlayerId:player.id,done,total:players.length});
      if(pauseMs>0)await new Promise(resolve=>setTimeout(resolve,pauseMs));
    }
    return {players:players.length,gear:gearCount};
  }

}
