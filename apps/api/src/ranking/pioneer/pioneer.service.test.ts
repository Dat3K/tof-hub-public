import {resolvePlayerServer,ServerRegionCodeSchema,UNRANKED_REGION_CODES} from '@tof-hub/contracts';
import {describe,it,expect,vi} from 'vitest';
import {Global,Module} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {PioneerService} from './pioneer.service';
import {RankingService,parseRankingQuery} from '../ranking.service';
import {PioneerModule} from './pioneer.module';
import {PRISMA} from '../../database/database.module';
import {BuildImportService} from '../../build/build-import.service';
import {InspectImportService} from '../inspect-import.service';
import type {ScoringCatalog} from '../../players/scoring-catalog';
import {pioneerObservations} from './pioneer-store';
import {scanFixture} from '../../import/scan-session.fixture';
import {scoreBuildForTrack,type BuildRVRole} from '@tof-hub/game-domain';

const regions=ServerRegionCodeSchema.options.filter(region=>!UNRANKED_REGION_CODES.includes(region));
const liveDb=(findMany:ReturnType<typeof vi.fn>,$queryRaw=vi.fn().mockResolvedValue([]))=>({
  $queryRaw,$transaction:async(work:(tx:{gearItem:{findMany:typeof findMany}})=>Promise<unknown>)=>work({gearItem:{findMany}}),
});
const statBounds={
  randomStatDefaultValue:100,randomStatMinRollValue:100,randomStatMaxRollValue:500,
  maxAugmentIncreaseMultiplier:0,maxAugmentIncreaseFlat:0,isPercentageBased:false,
};
const physicalSlot='bracers';
const catalog:ScoringCatalog={
  reference:{
    statTypes:{'Physical Attack':statBounds,Crit:statBounds},
    titanGrowth:{pullUpFactors:[],priorities:{},fallbacks:{},maxAddedStats:0,universalAttackElements:['Physical'],unconfirmedPullUpRanks:[]},
    critFormula:{denominators:{100:10000}},
    limits:{maxNumOfRandomStats:4,maxNumOfRandomStatRolls:5},
  },
  allowedStats:{[physicalSlot]:['Physical Attack','Crit'],gloves:['Physical Attack','Crit']},
  tracks:[['Physical']],
  captureGear:{items:{},labels:{},rareIds:[],rowsPerItem:4,augmentsPerItem:0,duel:[]},
};
vi.mock('../../players/scoring-catalog',async importOriginal=>({
  ...await importOriginal<typeof import('../../players/scoring-catalog')>(),
  loadScoringCatalog:()=>catalog,
}));
const livePiece=(id:string,region:string,value:number)=>({
  id,fingerprint:id,slot:physicalSlot,itemId:'fixture',stars:5,enhancement:0,titan:false,augmented:false,rareId:null,rareLevel:null,
  stats:[{type:'Physical Attack',value}],statsBeforeTitan:null,augments:[],augmentCount:null,lastSeenAt:new Date('2026-10-09T12:00:00Z'),
  player:{nickname:id,region,serverId:null},
});
describe('Pioneer synthetic boards',()=>{
  it('shares each role scan and only caches results from the current generation',async()=>{
    const loads:Array<(rows:unknown[])=>void>=[];
    const findMany=vi.fn(()=>new Promise(resolve=>loads.push(resolve)));
    const service=new PioneerService(liveDb(findMany) as never);
    type Builds={scopes:Map<null,Map<string,{pieces:{id:string}[]}>>};
    const read=(service as unknown as {globalBuilds:(role:BuildRVRole,source:typeof catalog)=>Promise<Builds>}).globalBuilds.bind(service);
    const first=read('dps',catalog),joined=read('dps',catalog);
    await vi.waitFor(()=>expect(findMany).toHaveBeenCalledTimes(1));
    service.invalidateGlobal();
    const fresh=read('dps',catalog);
    expect(findMany).toHaveBeenCalledTimes(1);
    loads[0]!([livePiece('obsolete','EU',500)]);
    const champion=(builds:Builds)=>builds.scopes.get(null)!.get('Physical')!.pieces[0]!.id;
    expect((await Promise.all([first,joined])).map(champion)).toEqual(['obsolete','obsolete']);
    await vi.waitFor(()=>expect(findMany).toHaveBeenCalledTimes(2));
    loads[1]!([livePiece('fresh','EU',500)]);
    expect(champion(await fresh)).toBe('fresh');
    expect(champion(await read('dps',catalog))).toBe('fresh');
    expect(findMany).toHaveBeenCalledTimes(2);
  });
  it('retains global and regional winners across keyset page boundaries',async()=>{
    const prefix=Array.from({length:256},(_,index)=>livePiece(`a${String(index).padStart(3,'0')}`,'EU',100));
    const late=livePiece('b','NA',1000),findMany=vi.fn().mockResolvedValueOnce(prefix).mockResolvedValueOnce([late]);
    const service=new PioneerService(liveDb(findMany) as never);
    const result=await service.players(parseRankingQuery({track:'Physical',dataset:'pioneer'}));
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[0]![0]).toMatchObject({take:256,orderBy:{id:'asc'}});
    expect(findMany.mock.calls[1]![0]).toMatchObject({take:256,where:{id:{gt:'a255'}}});
    const expected=scoreBuildForTrack([...prefix,late],item=>item.slot,
      item=>({rows:item.stats,augments:item.augments,allowedTypes:catalog.allowedStats[item.slot]!}),
      ['Physical'],catalog.reference);
    const global=result.entries.find(entry=>entry.synthetic==='global')!;
    expect(global.score*global.maxScore/100).toBeCloseTo(expected.value);
    expect(global.gear[0]!.ownerNickname).toBe('b');
    expect(result.entries.find(entry=>entry.synthetic==='regional'&&entry.player.region==='EU')?.gear[0]?.ownerNickname).toBe('a000');
  });
  it('shows the actual gear owner and resolves their region from retained UID provenance',async()=>{
    const slot=physicalSlot;
    const [piece]=pioneerObservations({source:'inspect',capturedAt:'2026-10-10T12:00:00Z',player:{uid:'1302104471',nickname:'Actual owner'},
      gear:[{slot,itemId:'fixture',stars:5,enhancement:0,titan:false,augmented:false,rareId:null,rareLevel:null,
        stats:[{type:'Physical Attack',value:1000}],statsBeforeTitan:null,augments:[]}]},
      {scan:{...scanFixture(),distribution:'global-pioneer'},collectorUid:'10000002',fileHash:'fixture',ipHash:'private'});
    const service=new PioneerService({$queryRaw:vi.fn().mockResolvedValue([{...piece,observed_at:new Date(piece!.observedAt)}])} as never);
    const query=parseRankingQuery({track:'Physical',dataset:'pioneer'}),result=await service.gear(query);
    expect(result.entries[0]).toMatchObject({player:{nickname:'Actual owner',uid:null,region:'PIONEER'},
      gear:{ownerNickname:'Actual owner',ownerRegion:resolvePlayerServer({uid:'1302104471'}).regionCode}});
    expect((await service.gear({...query,q:'Actual owner'})).total).toBe(1);
    expect(JSON.stringify(result)).not.toMatch(/1302104471|collectorUid|ipHash/);
  });
  it('resolves the isolated store through Nest modules for Ranking and both import paths',async()=>{
    const prisma=liveDb(vi.fn().mockResolvedValue([]));
    class DatabaseFixture {}
    Global()(DatabaseFixture);Module({providers:[{provide:PRISMA,useValue:prisma}],exports:[PRISMA]})(DatabaseFixture);
    class ApplicationFixture {}
    Module({imports:[DatabaseFixture,PioneerModule],providers:[RankingService,BuildImportService,InspectImportService]})(ApplicationFixture);
    const app=await NestFactory.createApplicationContext(ApplicationFixture,{logger:false});
    try {
      const pioneer=app.get(PioneerService);
      const result=await app.get(RankingService).players(parseRankingQuery({track:'Physical',dataset:'pioneer'}));
      expect(result.available).toBe(true);expect(result.entries).toHaveLength(2+regions.length);
      for(const service of [app.get(BuildImportService),app.get(InspectImportService)])expect((service as unknown as {pioneer:unknown}).pioneer).toBe(pioneer);
    }finally{await app.close();}
  });
  it('combines real snapshots per slot, keeps the live reference separate, and exposes no private provenance',async()=>{
    const slot=physicalSlot;
    const piece={slot,itemId:'fixture',instanceId:'private-instance',stars:5,enhancement:0,titan:false,augmented:false,rareId:null,rareLevel:null,
      stats:[{type:'Crit',value:1000}],statsBeforeTitan:null,augments:[],augmentCount:null};
    const [observed]=pioneerObservations({source:'self',capturedAt:'2026-10-09T12:00:00Z',player:{uid:'10000001',nickname:'Pioneer owner'},gear:[piece]},
      {scan:{...scanFixture(),distribution:'global-pioneer'},collectorUid:'10000002',fileHash:'fixture-hash',ipHash:'private-hash'});
    const findMany=vi.fn().mockResolvedValue([{...piece,stats:[{type:'Crit',value:2000}],id:'global-piece',fingerprint:'global',lastSeenAt:new Date('2026-10-09T12:00:00Z'),playerId:'private',player:{nickname:'Global owner',region:'EU'},source:'self'}]);
    const prisma=liveDb(findMany,vi.fn().mockResolvedValue([{...observed,observed_at:new Date(observed!.observedAt)}]));
    const service=new PioneerService(prisma as never),query=parseRankingQuery({track:'Physical',dataset:'pioneer'});
    const result=await service.players(query);
    const pioneerBuild=result.entries.find(entry=>entry.synthetic==='pioneer')!;
    const globalBuild=result.entries.find(entry=>entry.synthetic==='global')!;
    expect([pioneerBuild,globalBuild].map(entry=>entry.gear[0]!.ownerNickname)).toEqual(['Pioneer owner','Global owner']);
    expect([pioneerBuild,globalBuild].map(entry=>entry.gear[0]!.ownerRegion)).toEqual([resolvePlayerServer({uid:'10000001'}).regionCode,'EU']);
    expect(globalBuild.score).toBeGreaterThan(pioneerBuild.score);
    expect(globalBuild.comparisonDelta).toBeCloseTo(globalBuild.score-pioneerBuild.score);
    const values=result.entries.map(entry=>entry.score*entry.maxScore/100);
    expect(values).toEqual([...values].sort((a,b)=>b-a));
    expect(result.entries.map(entry=>entry.rank)).toEqual(result.entries.map((_,index)=>index+1));
    const ascending=await service.players({...query,sort:'grv-asc'});
    expect(ascending.entries.map(entry=>entry.rank)).toEqual(result.entries.map(entry=>entry.rank).reverse());
    const searched=await service.players({...query,q:'Pioneer Best'});
    expect(searched.entries[0]!.rank).toBe(pioneerBuild.rank);
    for(const entry of [pioneerBuild,globalBuild]){expect(entry.player.uid).toBeNull();expect(entry.gear).toHaveLength(1);expect(JSON.stringify(entry)).not.toMatch(/private|ownerUid|collectorUid|pc|ipHash/);}
    expect(findMany.mock.calls[0]![0]).toMatchObject({where:{player:{hidden:false,OR:[{region:null},{region:{notIn:['CN','WS','TEST']}}]}}});
    const eu=result.entries.find(entry=>entry.synthetic==='regional'&&entry.player.region==='EU')!;
    expect(eu.score).toBe(globalBuild.score);expect(eu.gear[0]!.ownerNickname).toBe('Global owner');
    expect(result.entries.filter(entry=>entry.synthetic==='regional'&&entry.player.region!=='EU').every(entry=>entry.gear.length===0&&entry.score===0)).toBe(true);
    expect(new Set(result.entries.map(entry=>entry.rank)).size).toBe(result.entries.length);
    const gear=await service.gear({...query,slots:[slot],q:'localized item name'});
    expect(gear.entries).toHaveLength(1);expect(gear.entries[0]!.gear.source).toBe('pioneer');
    expect(gear.entries[0]!.score).toBeGreaterThan(pioneerBuild.score);
    await service.players(query);expect(findMany).toHaveBeenCalledTimes(1);
    service.invalidateGlobal();await service.players(query);expect(findMany).toHaveBeenCalledTimes(2);
  });
  it('shows missing slots as zero and does not invent an observation date',async()=>{
    const service=new PioneerService(liveDb(vi.fn().mockResolvedValue([])) as never);
    const result=await service.players(parseRankingQuery({track:'Physical',dataset:'pioneer'}));
    expect(result.databaseEmpty).toBe(true);expect(result.entries).toHaveLength(2+regions.length);
    for(const entry of result.entries){expect(entry.score).toBe(0);expect(entry.updatedAt).toBe('');expect(entry.gear).toEqual([]);}
  });
});
