import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
import type {GearWrite,PlayerFields,PlayerStoreRepository,StoredGear,StoredPlayer,TrackScore,UploadWrite} from './player-store.repository';
import {PlayerStoreService,backpackWinners,gearFingerprint,obsoleteGear,samePiece} from './player-store.service';
import {buildScoringCatalog} from './scoring-catalog';
import type {BuildCapture} from '@tof-hub/contracts';
import {snapshotFromCapture} from './capture-snapshot';
import {snapshotFromInspect,type InspectPayload} from './inspect-snapshot';
import {scanFixture} from '../import/scan-session.fixture';
import {scoreBuildForTrack,scoreCurrentGearForTrack} from '@tof-hub/game-domain';

const gameData=path.resolve(__dirname,'..','..','..','web','public','game-data');
const page=JSON.parse(fs.readFileSync(path.join(gameData,'build-page.json'),'utf8'));
const catalog=buildScoringCatalog(page,JSON.parse(fs.readFileSync(path.join(gameData,'capture-card-map.json'),'utf8')));

class MemoryRepository implements PlayerStoreRepository {
  players:StoredPlayer[]=[];names:{playerId:string;nickname:string}[]=[];uploads:UploadWrite[]=[];gear:StoredGear[]=[];
  gearScores=new Map<string,TrackScore[]>();playerScores=new Map<string,{buildId:string|null;scores:TrackScore[]}>();builds:{id:string;playerId:string}[]=[];
  transaction<T>(work:(repository:PlayerStoreRepository)=>Promise<T>):Promise<T> {return work(this);}
  async findPlayer({uid,roleId}:{uid?:string;roleId?:string}) {return this.players.find(p=>(uid&&p.uid===uid)||(roleId&&p.roleId===roleId))??null;}
  async createPlayer(fields:PlayerFields&{firstSeenAt:Date;lastSeenAt:Date}) {
    const player={id:randomUUID(),uid:null,roleId:null,nickname:null,serverId:null,region:null,level:null,crew:null,titleId:null,avatarId:null,
      avatarFrameId:null,combatScore:null,maxCombatScore:null,totalRecharge:null,...fields} as StoredPlayer;
    this.players.push(player);return player;
  }
  async updatePlayer(id:string,fields:PlayerFields) {const player=this.players.find(p=>p.id===id)!;Object.assign(player,fields);return player;}
  async touchName(playerId:string,nickname:string) {if(!this.names.some(n=>n.playerId===playerId&&n.nickname===nickname))this.names.push({playerId,nickname});}
  async createUpload(upload:UploadWrite) {if(this.uploads.some(u=>u.kind===upload.kind&&u.fileSha256===upload.fileSha256))return null;this.uploads.push(upload);return randomUUID();}
  async upsertGear(write:GearWrite) {
    const {seenAt,...fields}=write;
    const existing=this.gear.find(g=>g.playerId===write.playerId&&g.fingerprint===write.fingerprint);
    if(existing){const newer=+write.lastSeenAt>=+existing.lastSeenAt;Object.assign(existing,{...(newer?fields:{}),equipped:existing.equipped||write.equipped,lastSeenAt:new Date(Math.max(+existing.lastSeenAt,+write.lastSeenAt))});return existing;}
    const gear={...fields,id:randomUUID(),firstSeenAt:seenAt} as StoredGear;this.gear.push(gear);return gear;
  }
  async replaceEquipped(playerId:string,slots:string[],ids:string[]) {for(const g of this.gear)if(g.playerId===playerId&&slots.includes(g.slot)&&!ids.includes(g.id))g.equipped=false;}
  async listEquipped(playerId:string) {return this.gear.filter(g=>g.playerId===playerId&&g.equipped);}
  async listPlayers() {return this.players;}
  async listGear(playerId:string) {return this.gear.filter(g=>g.playerId===playerId);}
  async saveGearScores(gear:StoredGear,_region:string|null,scores:TrackScore[]) {this.gearScores.set(gear.id,scores);}
  buildGear:{buildId:string;gearId:string}[]=[];
  async updateGear(id:string,fields:Partial<StoredGear>) {const gear=this.gear.find(g=>g.id===id)!;Object.assign(gear,fields);return gear;}
  async absorbGear(survivorId:string,absorbed:string[]) {
    for(const ref of this.buildGear)if(absorbed.includes(ref.gearId))ref.gearId=survivorId;
    this.gear=this.gear.filter(g=>!absorbed.includes(g.id));
  }
  async listGearScores(playerId:string) {
    return this.gear.filter(g=>g.playerId===playerId).flatMap(g=>(this.gearScores.get(g.id)??[]).map(s=>({gearId:g.id,track:s.track,score:s.score})));
  }
  async listScoredGearIds(playerId:string) {return [...new Set((this.playerScores.get(playerId)?.scores??[]).flatMap(score=>score.gearIds??[]))];}
  async listCurrentBuildGearIds(playerId:string) {
    const currentBuildId=[...this.builds].reverse().find(build=>build.playerId===playerId)?.id;
    return this.buildGear.filter(row=>row.buildId===currentBuildId).map(row=>row.gearId).filter(id=>this.gear.some(g=>g.id===id&&g.playerId===playerId));
  }
  async deleteGear(ids:string[]) {this.gear=this.gear.filter(g=>!ids.includes(g.id));}
  async createBuild(build:{playerId:string;gear:{gearId:string}[]}) {const id=randomUUID();this.builds.push({id,playerId:build.playerId});this.buildGear.push(...build.gear.map(g=>({buildId:id,gearId:g.gearId})));return id;}
  async savePlayerScores(playerId:string,_region:string|null,buildId:string|null,scores:TrackScore[]) {
    const previous=this.playerScores.get(playerId);this.playerScores.set(playerId,{buildId:buildId??previous?.buildId??null,scores});
  }
}

// The sample card's gear in snapshot form.
const demoGear=page.demoDraft.gear.map((item:{id:string;stars:number;enhancement:number;titan:boolean;augmented?:boolean;rareId:string;rareLevel:number;
  rows:{type:string;value:number;beforeTitan:number|null}[];augments:{type:string;value:number}[]})=>({slot:item.id,itemId:item.id+'_demo',stars:item.stars,
  enhancement:item.enhancement,titan:item.titan,augmented:!!item.augmented,rareId:item.rareId||null,rareLevel:item.rareLevel,
  stats:item.rows.map(row=>({type:row.type,value:row.value})),statsBeforeTitan:item.rows.map(row=>row.beforeTitan),augments:item.augments}));
const full={source:'self',capturedAt:'2026-10-06T10:00:00.000Z',
  player:{uid:'1300242918',roleId:'55864639637934',nickname:'kritik',level:100,crew:'Whalesong',combatScore:311318},
  gear:demoGear,build:{draft:{note:'card'},combatScore:311318,element:'Frost',role:'dps'}};

describe('PlayerStoreService',()=>{
  it('reuses the same player for padded legacy and current UIDs even when the later file has no RoleID',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,null);
    const old={source:'inspect',capturedAt:'2026-10-10T00:00:00Z',player:{uid:'1300701214',roleId:'55864639620286',nickname:'stalkill'}};
    const first=await service.store(old);
    const second=await service.store({...old,capturedAt:'2026-10-27T00:00:00Z',player:{uid:'130071214',nickname:'stalkill'}});
    expect(second.playerId).toBe(first.playerId);
    expect(repository.players).toHaveLength(1);
    expect(repository.players[0]).toMatchObject({uid:'130071214',roleId:'55864639620286',serverId:'13007'});
    expect(old.player.uid).toBe('1300701214');
  });
  it('remembers an old own profile and merges its backpack without downgrading any existing track',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,{...catalog,tracks:[['Frost'],['Frost','Volt']]});
    await service.store({...full,source:'inspect',capturedAt:'2026-10-24T10:00:00Z',build:undefined});
    const player=repository.players[0]!,equipped=repository.gear.filter(item=>item.equipped).map(item=>item.id);
    expect(player.selfCaptureAt).toBeUndefined();
    const before=new Map(repository.playerScores.get(player.id)!.scores.map(score=>[score.track,score.score]));
    const helmet=demoGear[0],better={...helmet,statsBeforeTitan:helmet.statsBeforeTitan.map((value:number|null)=>value===null?null:value+1),
      stats:helmet.stats.map((stat:{type:string;value:number})=>({...stat,value:stat.value*2}))};
    const own={...full,capturedAt:'2026-10-18T10:00:00Z',backpack:[better]};
    const upload={kind:'build',fileSha256:'e'.repeat(64),exporterName:'test',exporterVersion:'1',ipHash:'h'};
    const first=await service.store(own,upload);
    expect(first).toMatchObject({stale:true,backpackStored:1,buildId:null});
    expect(player.selfCaptureAt).toEqual(new Date(own.capturedAt));
    expect(player.lastSeenAt).toEqual(new Date('2026-10-24T10:00:00Z'));
    expect(repository.gear.filter(item=>item.equipped).map(item=>item.id)).toEqual(equipped);
    const improved=repository.playerScores.get(player.id)!.scores;
    for(const score of improved)expect(score.score).toBeGreaterThanOrEqual(before.get(score.track)!-1e-9);
    expect(improved.some(score=>score.score>(before.get(score.track)??0)+1e-9)).toBe(true);
    const ids=repository.gear.map(item=>item.id).sort();
    // Replaying an already recorded own upload can repair candidates skipped by an older importer.
    const repeated=await service.store(own,upload);
    expect(repeated.duplicate).toBe(true);
    expect(repository.gear.map(item=>item.id).sort()).toEqual(ids);
    await service.store({...full,capturedAt:'2026-10-25T10:00:00Z',gear:[],build:undefined,
      backpack:[{...helmet,statsBeforeTitan:helmet.statsBeforeTitan.map((value:number|null)=>value===null?null:value+2),
        stats:helmet.stats.map((stat:{type:string;value:number})=>({...stat,value:stat.value/2}))}]});
    expect(repository.playerScores.get(player.id)!.scores).toEqual(improved);
    await service.store({...full,source:'inspect',capturedAt:'2026-10-26T10:00:00Z',gear:[],build:undefined});
    expect(player.selfCaptureAt).toEqual(new Date('2026-10-25T10:00:00Z'));
  },20_000);
  it('replaces stale persisted GRV and keeps the build link when rescoring',async()=>{
    const tracks=[['Frost','Volt'],['Volt','Frost']];
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,{...catalog,tracks});
    await service.store(full);
    const player=repository.players[0]!,saved=repository.playerScores.get(player.id)!;
    const buildId=saved.buildId;
    for(const score of saved.scores){score.score=1;score.maxScore=1;score.gearIds=[];}
    for(const scores of repository.gearScores.values())for(const score of scores){score.score=1;score.maxScore=1;}
    expect(await service.rescoreAll()).toEqual({players:1,gear:repository.gear.length});
    const rescored=repository.playerScores.get(player.id)!;
    expect(rescored.buildId).toBe(buildId);
    for(const track of tracks) {
      const pieces=repository.gear.filter(item=>item.playerId===player.id);
      const input=(item:StoredGear)=>({rows:item.stats,augments:item.titan||item.augmented?item.augments:[],allowedTypes:catalog.allowedStats[item.slot]!});
      const current=scoreBuildForTrack(pieces,item=>item.slot,input,track,catalog.reference);
      const maximum=Object.values(catalog.allowedStats).reduce((sum,allowedTypes)=>sum+scoreCurrentGearForTrack({rows:[],augments:[],allowedTypes},track,catalog.reference).maximum,0);
      const stored=rescored.scores.find(score=>score.track===track.join('-'))!;
      expect(stored.score).toBeCloseTo(current.value/maximum*100,9);
      expect(stored.maxScore).toBeCloseTo(maximum,9);
      expect(stored.gearIds).toEqual([...current.slots.values()].map(slot=>slot.piece.id));
      for(const item of pieces) {
        const currentItem=scoreCurrentGearForTrack(input(item),track,catalog.reference);
        const score=repository.gearScores.get(item.id)!.find(score=>score.track===track.join('-'));
        if(currentItem.value<=0)expect(score).toBeUndefined();
        else expect(score!.score).toBeCloseTo(currentItem.percent!,9);
      }
    }
  });
  it('dates a fresh character entry independently of the long-running scan and updates a profile with no gear',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,null);
    await service.store(full);
    const capture=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../../packages/contracts/src/__fixtures__/build-capture.json'),'utf8')) as BuildCapture;
    capture.capture={...capture.capture,exporterVersion:'0.1.2',capturedAt:'2026-10-07T10:00:00.000Z',
      subject:{uid:full.player.uid,roleId:full.player.roleId},
      scan:{...scanFixture('live'),startedAt:'2026-10-05T10:00:00.000Z',finishedAt:'2026-10-07T10:05:00.000Z'}};
    capture.profile={...capture.profile,name:'  Fresh\u200b name',cs:350000,maxCs:450000};capture.gear=[];
    const {snapshot}=snapshotFromCapture(capture,catalog);
    expect(snapshot.capturedAt).toBe(capture.capture.capturedAt);
    expect(await service.store(snapshot)).toMatchObject({stale:false,gearStored:0});
    expect(repository.players[0]).toMatchObject({nickname:'  Fresh\u200b name',combatScore:350000,maxCombatScore:450000,
      lastSeenAt:new Date(capture.capture.capturedAt)});
  });
  it.each(['build','inspect'] as const)('refreshes %s profile fields with unchanged gear, or no gear, and protects them from old files',async kind=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,null);
    const capture=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../../packages/contracts/src/__fixtures__/build-capture.json'),'utf8')) as BuildCapture;
    const snapshot=(at:string,name:string,cs:number,max:number,gear=true)=>{
      const mapped=kind==='build'?snapshotFromCapture({...capture,
        capture:{...capture.capture,scan:undefined,capturedAt:at,subject:{uid:full.player.uid,roleId:full.player.roleId}},
        profile:{...capture.profile,name,cs,maxCs:max,level:100,crew:'Updated crew',titleId:'updated-title',avatarId:'updated-avatar',avatarFrameId:'updated-frame'}},catalog).snapshot:
        snapshotFromInspect({version:1,observer:{uid:null,role_id:null,server_id:null},player:{uid:full.player.uid,role_id:full.player.roleId,name,
          level:100,cs,max_cs:max,guild:'Updated crew',title:'updated-title',properties:{AvatarId:'updated-avatar',AvatarFrameId:'updated-frame'},
          last_seen_at:at,profile_captured_at:at}} satisfies InspectPayload,catalog).snapshot;
      return {...mapped,gear:gear?demoGear:[]};
    };
    const upload=(hash:string)=>({kind,fileSha256:hash.repeat(64),exporterName:'fixture',exporterVersion:'1',ipHash:'test'});
    await service.store({...full,player:{...full.player,maxCombatScore:400_000}},upload('a'));
    const ids=repository.gear.map(item=>item.id);
    await service.store(snapshot('2026-10-07T10:00:00Z','  New\u200b name',350_000,450_000),upload('b'));
    expect(repository.players).toHaveLength(1);
    expect(repository.players[0]).toMatchObject({nickname:'  New\u200b name',combatScore:350_000,maxCombatScore:450_000,
      crew:'Updated crew',titleId:'updated-title',avatarId:'updated-avatar',avatarFrameId:'updated-frame'});
    expect(repository.gear.map(item=>item.id)).toEqual(ids);
    const latest=snapshot('2026-10-08T10:00:00Z','Latest name',360_000,460_000,false);
    expect(await service.store(latest,upload('c'))).toMatchObject({duplicate:false,gearStored:0});
    expect(repository.players[0]).toMatchObject({nickname:'Latest name',combatScore:360_000,maxCombatScore:460_000});
    expect(repository.gear.map(item=>item.id)).toEqual(ids);
    expect(await service.store(latest,upload('c'))).toMatchObject({duplicate:true,gearStored:0});
    await service.store(snapshot('2026-10-05T10:00:00Z','Old name',1,2,false),upload('d'));
    expect(repository.players[0]).toMatchObject({nickname:'Latest name',combatScore:360_000,maxCombatScore:460_000});
    expect(repository.names.map(item=>item.nickname)).toContain('  New\u200b name');
  });
  it('does not replace a known recharge counter with an unavailable inspect value',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,null);
    await service.store({...full,player:{...full.player,totalRecharge:123}});
    for(const value of [undefined,null,'','   ',false]) {
      const {snapshot}=snapshotFromInspect({version:1,observer:{uid:null,role_id:null,server_id:null},player:{uid:full.player.uid,role_id:null,
        name:null,level:null,cs:null,max_cs:null,guild:null,title:null,properties:{TotalRecharge:value},
        last_seen_at:'2026-10-07T10:00:00Z',profile_captured_at:null}},catalog);
      await service.store(snapshot);
      expect(repository.players[0]!.totalRecharge).toBe(123n);
    }
    const {snapshot}=snapshotFromInspect({version:1,observer:{uid:null,role_id:null,server_id:null},player:{uid:full.player.uid,role_id:null,
      name:null,level:null,cs:null,max_cs:null,guild:null,title:null,properties:{TotalRecharge:'0'},
      last_seen_at:'2026-10-08T10:00:00Z',profile_captured_at:null}},catalog);
    await service.store(snapshot);
    expect(repository.players[0]!.totalRecharge).toBe(0n);
  });
  it('merges partial account counters, preserves unknown fields and accepts a confirmed zero',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,null);
    await service.store({...full,player:{...full.player,totalRecharge:123,account:{totalRecharge:123,totalRechargeValue:456,buyGemCount:7}}});
    const scan=(at:string,account:unknown)=>({...full,capturedAt:at,gear:[],build:undefined,player:{uid:full.player.uid,account}});
    await service.store(scan('2026-10-07T10:00:00.000Z',{totalRecharge:null,totalRechargeValue:null,buyGemCount:null}));
    expect(repository.players[0]).toMatchObject({totalRecharge:123n,accountStats:{totalRecharge:123,totalRechargeValue:456,buyGemCount:7},
      accountStatsAt:new Date(full.capturedAt)});
    await service.store(scan('2026-10-08T10:00:00.000Z',{totalRechargeValue:0,buyGemCount:null}));
    expect(repository.players[0]!.accountStats).toEqual({totalRecharge:123,totalRechargeValue:0,buyGemCount:7});
    await service.store(scan('2026-10-05T10:00:00.000Z',{totalRechargeValue:999,totalLoginDays:2}));
    expect(repository.players[0]!.accountStats).toEqual({totalRecharge:123,totalRechargeValue:0,buyGemCount:7,totalLoginDays:2});
    expect(repository.players[0]!.accountStatsAt).toEqual(new Date('2026-10-08T10:00:00.000Z'));
  });
  // Scores every role and track, including the tank ceiling search (cached after the first slot): give it time.
  it('stores a full build card: player, server from the UID, gear, scores per track and a build',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,catalog);
    const result=await service.store(full,{kind:'build',fileSha256:'a'.repeat(64),exporterName:'test',exporterVersion:'1',ipHash:'h'});
    expect(result).toMatchObject({duplicate:false,gearStored:12,stale:false});
    expect(repository.players[0]).toMatchObject({uid:'1300242918',roleId:'55864639637934',serverId:'13002',region:'EU',crew:'Whalesong'});
    expect(repository.gear.every(g=>g.equipped)).toBe(true);
    // DPS tracks plain, healer tracks prefixed, tank mono tracks only.
    const dps=catalog.tracks.map(track=>track.join('-'));
    const tracks=[...dps,...dps.map(id=>`healer:${id}`),...catalog.tracks.filter(track=>track.length===1).map(track=>`tank:${track[0]}`)];
    // Only tracks the slot can roll get a score (a zero ceiling is not a ranking).
    const visor=repository.gearScores.get(repository.gear.find(g=>g.slot==='visor')!.id)!;
    expect(visor.map(s=>s.track)).toEqual(expect.arrayContaining(['Frost','Frost-Volt','healer:Altered']));
    expect(visor.every(s=>tracks.includes(s.track)&&s.maxScore>0)).toBe(true);
    const player=repository.playerScores.get(result.playerId)!;
    expect(player.buildId).toBe(result.buildId);
    expect([...player.scores.map(s=>s.track)].sort()).toEqual([...tracks].sort());
    // A DPS set scores on every DPS track; a tank score can be 0 when the set has no resistance.
    for(const score of player.scores.filter(s=>dps.includes(s.track)))expect(score.score).toBeGreaterThan(0);
  },20000);
  it('keeps own account counters and Titan clicks; an inspect without them erases nothing',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,null);
    const account={totalRecharge:49636992,totalRechargeValue:185008,totalLoginDays:879,reportCount:3,buyGemCount:2,monthCardLeftDays:null};
    await service.store({...full,player:{...full.player,account,totalRecharge:49636992},gear:[{...demoGear[0],augmentCount:180}]});
    // An unavailable counter (null) is unknown, not stored.
    const {monthCardLeftDays,...known}=account;void monthCardLeftDays;
    expect(repository.players[0]).toMatchObject({accountStats:known,totalRecharge:49636992n});
    expect(repository.players[0]!.accountStatsAt).toEqual(new Date(full.capturedAt));
    expect(repository.gear[0]!.augmentCount).toBe(180);
    await service.store({...full,source:'inspect',capturedAt:'2026-10-07T10:00:00.000Z',player:{uid:full.player.uid},gear:[demoGear[0]],build:undefined});
    expect(repository.players[0]!.accountStats).toEqual(known);
  });
  it('accepts a later gear-only inspect without erasing profile fields and replaces only the observed slots',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,catalog);
    await service.store(full);
    // A different helmet: other values before Titan.
    const helmet={...demoGear[0],statsBeforeTitan:demoGear[0].statsBeforeTitan.map((value:number|null)=>value===null?null:value+1)};
    const result=await service.store({source:'inspect',capturedAt:'2026-10-07T10:00:00.000Z',player:{roleId:'55864639637934'},gear:[helmet]});
    expect(result).toMatchObject({stale:false,buildId:null,gearStored:1});
    expect(repository.players).toHaveLength(1);
    expect(repository.players[0]).toMatchObject({nickname:'kritik',crew:'Whalesong',combatScore:311318});
    const helmets=repository.gear.filter(g=>g.slot===helmet.slot);
    expect(helmets).toHaveLength(2);
    expect(helmets.filter(g=>g.equipped).map(g=>g.source)).toEqual(['inspect']);
    expect(repository.gear.filter(g=>g.equipped)).toHaveLength(12);
    expect(repository.playerScores.get(result.playerId)!.buildId).not.toBeNull();
  });
  it('keeps an older observation as history only and fills just the missing fields',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,catalog);
    await service.store({...full,player:{uid:'1300242918',nickname:'kritik'}});
    const old={...demoGear[1],enhancement:demoGear[1].enhancement-10,stats:demoGear[1].stats.map((stat:{type:string;value:number})=>({...stat,value:stat.value-1}))};
    const result=await service.store({source:'inspect',capturedAt:'2026-09-01T10:00:00.000Z',player:{uid:'1300242918',nickname:'old_name',level:90},gear:[old]});
    expect(result.stale).toBe(true);
    expect(repository.players[0]).toMatchObject({nickname:'kritik',level:90});
    expect(repository.names.map(n=>n.nickname)).toEqual(['kritik','old_name']);
    const spaulders=repository.gear.filter(g=>g.slot===old.slot);
    expect(spaulders.filter(g=>g.equipped)).toHaveLength(1);
    expect(spaulders.find(g=>g.equipped)!.enhancement).toBe(demoGear[1].enhancement);
  });
  it('skips a file that was already accepted and identifies gear by its values before Titan',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,catalog);
    const upload={kind:'build',fileSha256:'b'.repeat(64),exporterName:'test',exporterVersion:'1',ipHash:'h'};
    await service.store(full,upload);
    expect((await service.store(full,upload)).duplicate).toBe(true);
    const titanProgress={...demoGear[2],stats:demoGear[2].stats.map((stat:{type:string;value:number})=>({...stat,value:stat.value+5}))};
    expect(gearFingerprint(titanProgress)).toBe(gearFingerprint(demoGear[2]));
    expect(gearFingerprint({...demoGear[2],statsBeforeTitan:null})).not.toBe(gearFingerprint(demoGear[2]));
  });
  it('dates the max combat score only by the game (HistoryMaxGSChangeTime of an own card)',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,catalog);
    const store=(at:string,max:number,maxAt?:string)=>service.store({source:maxAt?'self':'inspect',capturedAt:at,
      player:{uid:'1300242918',maxCombatScore:max,...(maxAt?{maxCombatScoreAt:maxAt}:{})}});
    await store('2026-10-07T10:00:00.000Z',500_000);
    expect(repository.players[0]!.maxCombatScoreAt??null).toBeNull();
    await store('2026-10-08T10:00:00.000Z',500_000,'2026-09-30T18:20:00.000Z');
    expect(repository.players[0]!.maxCombatScoreAt).toEqual(new Date('2026-09-30T18:20:00.000Z'));
    // An inspect of the same max keeps the game date; a newer max without one clears it.
    await store('2026-10-09T10:00:00.000Z',500_000);
    expect(repository.players[0]!.maxCombatScoreAt).toEqual(new Date('2026-09-30T18:20:00.000Z'));
    await store('2026-10-10T10:00:00.000Z',520_000);
    expect(repository.players[0]!.maxCombatScoreAt??null).toBeNull();
  });
  it('stores nothing of a Chinese server player (another stat system)',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,catalog);
    await expect(service.store({source:'inspect',capturedAt:'2026-10-09T10:00:00.000Z',player:{uid:'1410112345'},gear:[demoGear[0]]})).rejects.toThrow(/CN/);
    expect(repository.players).toHaveLength(0);
  });
  it('stores nothing of a Warp (MMO) or unknown-server player',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,catalog);
    for(const uid of ['888810312345','60832888'])
      await expect(service.store({source:'inspect',capturedAt:'2026-10-09T10:00:00.000Z',player:{uid},gear:[demoGear[0]]})).rejects.toThrow(/not stored/);
    expect(repository.players).toHaveLength(0);
  });
  it('rejects a snapshot without identity or with duplicate slots',async()=>{
    const service=new PlayerStoreService(new MemoryRepository(),catalog);
    await expect(service.store({source:'inspect',capturedAt:'2026-10-07T10:00:00.000Z',player:{nickname:'x'}})).rejects.toThrow();
    await expect(service.store({...full,gear:[demoGear[0],demoGear[0]]})).rejects.toThrow();
  });
  // 2026-10-08: an inspect has no pre-Titan values, so +66 → +68 and the own card + an inspect were two rows of one piece.
  // Shino Asada, 2026-10-08: a Physical set put on over a Frost set must not drop the Frost total.
  // 2026-10-08: pruning must keep every piece behind a stored player total of any role and track.
  it('never deletes a piece behind a player total',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,catalog);
    await service.store(full);
    const weak={...demoGear[0],statsBeforeTitan:demoGear[0].statsBeforeTitan.map((value:number|null)=>value===null?null:value+1),
      stats:demoGear[0].stats.map((stat:{type:string;value:number})=>({...stat,value:Math.floor(stat.value/2)}))};
    await service.store({source:'inspect',capturedAt:'2026-10-07T10:00:00.000Z',player:{roleId:'55864639637934'},gear:[weak]});
    const ids=new Set(repository.gear.map(g=>g.id));
    for(const [,{scores}] of repository.playerScores)for(const score of scores)for(const id of score.gearIds??[])expect(ids.has(id)).toBe(true);
    expect(await repository.listScoredGearIds(repository.players[0]!.id)).not.toHaveLength(0);
  });
  it('totals each track from the best known piece per slot, equipped or not',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,catalog);
    const first=await service.store(full);
    const before=repository.playerScores.get(first.playerId)!.scores.find(score=>score.track==='Frost')!;
    const strong=repository.gear.find(g=>g.slot===demoGear[0].slot)!;
    // A weaker helmet of another set (other pre-Titan values, every stat lower) is put on.
    const weak={...demoGear[0],statsBeforeTitan:demoGear[0].statsBeforeTitan.map((value:number|null)=>value===null?null:value+1),
      stats:demoGear[0].stats.map((stat:{type:string;value:number})=>({...stat,value:Math.floor(stat.value/2)}))};
    await service.store({source:'inspect',capturedAt:'2026-10-07T10:00:00.000Z',player:{roleId:'55864639637934'},gear:[weak]});
    expect(repository.gear.filter(g=>g.slot===demoGear[0].slot&&g.equipped).map(g=>g.id)).not.toContain(strong.id);
    const after=repository.playerScores.get(first.playerId)!.scores.find(score=>score.track==='Frost')!;
    expect(after.score).toBeCloseTo(before.score,9);
    expect(after.gearIds).toContain(strong.id);
    expect(after.gearIds).toHaveLength(12);
  });
  it('keeps one row per piece: a later inspect updates the own-card row (its pre-Titan values and build stay)',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,catalog);
    await service.store(full);
    const own=repository.gear.find(g=>g.slot===demoGear[0].slot)!;
    // The same helmet inspected a day later: two levels higher, one stat grew (a Titan click), no pre-Titan values.
    const grown={...demoGear[0],enhancement:demoGear[0].enhancement+2,statsBeforeTitan:demoGear[0].statsBeforeTitan.map(()=>null),
      stats:demoGear[0].stats.map((stat:{type:string;value:number},index:number)=>index===0?{...stat,value:stat.value+5}:stat)};
    await service.store({source:'inspect',capturedAt:'2026-10-07T10:00:00.000Z',player:{roleId:'55864639637934'},gear:[grown]});
    await service.store({source:'inspect',capturedAt:'2026-10-08T10:00:00.000Z',player:{roleId:'55864639637934'},gear:[{...grown,enhancement:grown.enhancement+2}]});
    const helmets=repository.gear.filter(g=>g.slot===demoGear[0].slot);
    expect(helmets).toHaveLength(1);
    expect(helmets[0]).toMatchObject({id:own.id,enhancement:demoGear[0].enhancement+4,equipped:true,fingerprint:own.fingerprint});
    expect(helmets[0]!.statsBeforeTitan).toEqual(demoGear[0].statsBeforeTitan);
    expect(helmets[0]!.stats[0]!.value).toBe(demoGear[0].stats[0].value+5);
  });
  it('keeps a backpack Titan piece only where it beats every known piece of its slot',()=>{
    const known=[{slot:'helmet',track:'Frost',score:50},{slot:'helmet',track:'Physical',score:30},{slot:'helmet',track:'best:all',score:1}];
    const candidates=[{slot:'helmet',scores:[{track:'Frost',score:49,maxScore:49},{track:'Physical',score:31,maxScore:31}]},
      {slot:'helmet',scores:[{track:'Frost',score:50,maxScore:50},{track:'Physical',score:35,maxScore:35}]},
      {slot:'helmet',scores:[{track:'best:all',score:99,maxScore:99}]},{slot:'gloves',scores:[{track:'Volt',score:1,maxScore:1}]}];
    // Physical: the second beats the first and the known 30; a tie (Frost 50) or a derived best row never wins; an empty slot does.
    expect(backpackWinners(known,candidates)).toEqual([1,3]);
  });
  it('stores only the backpack Titan pieces that improve a track, never a weaker one',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,catalog);
    const helmet=demoGear[0];
    const pre=(delta:number)=>helmet.statsBeforeTitan.map((value:number|null)=>value===null?null:value+delta);
    const better={...helmet,statsBeforeTitan:pre(1),stats:helmet.stats.map((stat:{type:string;value:number})=>({...stat,value:stat.value*1.5}))};
    const weaker={...helmet,statsBeforeTitan:pre(2),stats:helmet.stats.map((stat:{type:string;value:number})=>({...stat,value:stat.value/2}))};
    const result=await service.store({...full,backpack:[weaker,better]});
    expect(result.backpackStored).toBe(1);
    const helmets=repository.gear.filter(g=>g.slot===helmet.slot);
    expect(helmets).toHaveLength(2);
    expect(helmets.find(g=>!g.equipped)!.stats[0]!.value).toBe(better.stats[0].value);
    // An older capture still contributes better candidates without replacing the current equipped set.
    const stale=await service.store({...full,capturedAt:'2026-10-01T10:00:00.000Z',backpack:[{...better,statsBeforeTitan:pre(3),stats:better.stats.map((stat:{type:string;value:number})=>({...stat,value:stat.value*2}))}]});
    expect(stale.backpackStored).toBe(1);
    expect(stale.stale).toBe(true);
  });
  it('also stores a stronger non-Titan backpack piece, without a Titan flag',async()=>{
    const repository=new MemoryRepository(),service=new PlayerStoreService(repository,catalog);
    const helmet=demoGear[0];
    const plain={...helmet,titan:false,augmented:false,augments:[],statsBeforeTitan:helmet.stats.map((stat:{type:string;value:number})=>stat.value*1.5),stats:helmet.stats.map((stat:{type:string;value:number})=>({...stat,value:stat.value*1.5}))};
    const result=await service.store({...full,backpack:[plain]});
    expect(result.backpackStored).toBe(1);
    const stored=repository.gear.find(g=>g.slot===helmet.slot&&!g.equipped)!;
    expect(stored.titan).toBe(false);
  });
  it('tells pieces apart by pre-Titan values and deletes pieces no top needs',()=>{
    const base={slot:'helmet',itemId:'h',stars:5,rareId:null,stats:[{type:'Frost Attack',value:100},{type:'HP',value:10}]};
    expect(samePiece(base,{...base,stats:[{type:'Frost Attack',value:120},{type:'HP',value:10}]})).toBe(true);
    expect(samePiece(base,{...base,stats:[{type:'Frost Attack',value:120},{type:'HP',value:9}]})).toBe(false);
    expect(samePiece({...base,statsBeforeTitan:[1,2]},{...base,statsBeforeTitan:[1,3]})).toBe(false);
    expect(samePiece({...base,statsBeforeTitan:[1,2]},{...base,statsBeforeTitan:null})).toBe(true);
    const at=(day:number)=>new Date(Date.UTC(2026,9,day));
    const gear=[{id:'equipped',slot:'helmet',equipped:true,lastSeenAt:at(8)},{id:'frostOld',slot:'helmet',equipped:false,lastSeenAt:at(1)},
      {id:'voltBest',slot:'helmet',equipped:false,lastSeenAt:at(2)},{id:'inBuild',slot:'helmet',equipped:false,lastSeenAt:at(1)},{id:'tie',slot:'helmet',equipped:false,lastSeenAt:at(3)}];
    const scores=[{gearId:'equipped',track:'Frost',score:50},{gearId:'frostOld',track:'Frost',score:40},{gearId:'voltBest',track:'Volt',score:30},
      {gearId:'equipped',track:'Volt',score:20},{gearId:'inBuild',track:'Frost',score:10},{gearId:'tie',track:'Flame',score:5},{gearId:'equipped',track:'Flame',score:5},
      {gearId:'frostOld',track:'best:all',score:99}];
    // frostOld is beaten in Frost (and best rows do not count); a tie goes to the newer piece (the equipped one).
    expect(obsoleteGear(gear,scores,['inBuild']).sort()).toEqual(['frostOld','tie']);
  });
});
