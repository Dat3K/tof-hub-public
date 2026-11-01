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
import {loadScoringCatalog} from '../../players/scoring-catalog';
import {pioneerObservations} from './pioneer-store';
import {scanFixture} from '../../import/scan-session.fixture';

const regions=ServerRegionCodeSchema.options.filter(region=>!UNRANKED_REGION_CODES.includes(region));
describe('Pioneer synthetic boards',()=>{
  it('shares the large live pool across concurrent role/track requests and isolates invalidated reads',async()=>{
    const loads:Array<(rows:unknown[])=>void>=[];
    const findMany=vi.fn(()=>new Promise(resolve=>loads.push(resolve)));
    const service=new PioneerService({gearItem:{findMany}} as never);
    const read=(service as unknown as {globalPieces:()=>Promise<{id:string}[]>}).globalPieces.bind(service);
    const first=read(),joined=read();
    expect(findMany).toHaveBeenCalledTimes(1);
    service.invalidateGlobal();
    const fresh=read();
    expect(findMany).toHaveBeenCalledTimes(2);
    const row=(id:string)=>({id,fingerprint:id,lastSeenAt:new Date(),player:{nickname:id,region:'EU'}});
    loads[1]!([row('fresh')]);
    await fresh;
    loads[0]!([row('obsolete')]);
    expect((await Promise.all([first,joined])).map(rows=>rows[0]!.id)).toEqual(['obsolete','obsolete']);
    expect((await read())[0]!.id).toBe('fresh');
    expect(findMany).toHaveBeenCalledTimes(2);
  });
  it('shows the actual gear owner and resolves their region from retained UID provenance',async()=>{
    const catalog=loadScoringCatalog()!,slot=Object.keys(catalog.allowedStats).find(slot=>catalog.allowedStats[slot]!.includes('Physical Attack'))!;
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
    const prisma={$queryRaw:vi.fn().mockResolvedValue([]),gearItem:{findMany:vi.fn().mockResolvedValue([])}};
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
    const catalog=loadScoringCatalog()!,slot=Object.keys(catalog.allowedStats).find(id=>catalog.allowedStats[id]!.includes('Crit'))!;
    const piece={slot,itemId:'fixture',instanceId:'private-instance',stars:5,enhancement:0,titan:false,augmented:false,rareId:null,rareLevel:null,
      stats:[{type:'Crit',value:1000}],statsBeforeTitan:null,augments:[],augmentCount:null};
    const [observed]=pioneerObservations({source:'self',capturedAt:'2026-10-09T12:00:00Z',player:{uid:'10000001',nickname:'Pioneer owner'},gear:[piece]},
      {scan:{...scanFixture(),distribution:'global-pioneer'},collectorUid:'10000002',fileHash:'fixture-hash',ipHash:'private-hash'});
    const findMany=vi.fn().mockResolvedValue([{...piece,stats:[{type:'Crit',value:2000}],id:'global-piece',fingerprint:'global',lastSeenAt:new Date('2026-10-09T12:00:00Z'),playerId:'private',player:{nickname:'Global owner',region:'EU'},source:'self'}]);
    const prisma={$queryRaw:vi.fn().mockResolvedValue([{...observed,observed_at:new Date(observed!.observedAt)}]),gearItem:{findMany}};
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
    const service=new PioneerService({$queryRaw:vi.fn().mockResolvedValue([]),gearItem:{findMany:vi.fn().mockResolvedValue([])}} as never);
    const result=await service.players(parseRankingQuery({track:'Physical',dataset:'pioneer'}));
    expect(result.databaseEmpty).toBe(true);expect(result.entries).toHaveLength(2+regions.length);
    for(const entry of result.entries){expect(entry.score).toBe(0);expect(entry.updatedAt).toBe('');expect(entry.gear).toEqual([]);}
  });
});
