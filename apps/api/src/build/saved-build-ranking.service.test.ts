import {afterEach,describe,expect,it,vi} from 'vitest';
import capture from '../../../../packages/contracts/src/__fixtures__/build-capture.json';
import {SavedBuildRankingService} from './saved-build-ranking.service';
import {RankingService} from '../ranking/ranking.service';
import {scanFixture} from '../import/scan-session.fixture';

afterEach(()=>vi.useRealTimers());

describe('saved equipped ranking',()=>{
  it('ranks a verified file without saving a profile and rejects a bad proof',async()=>{
    const valid={...capture,capture:{...capture.capture,subject:{uid:'1302104471',roleId:''},scan:scanFixture('live')}};
    const profiles={get:vi.fn(),verifySignedCapture:vi.fn(()=>valid)};
    const ranks={equippedRanks:vi.fn(async()=>({available:true,global:123,region:{code:'EU',rank:21}}))};
    const prisma={player:{findUnique:async()=>({id:'player',region:'EU',hidden:false}),aggregate:async()=>({})},playerScore:{aggregate:async()=>({})}};
    const service=new SavedBuildRankingService(profiles as never,ranks as never,prisma as never);
    const body={capture:valid,digest:'a'.repeat(64),signature:'a'.repeat(32),role:'dps',element:'Frost'};
    await expect(service.imported(body)).resolves.toMatchObject({available:true,global:123});
    expect(profiles.get).not.toHaveBeenCalled();
    expect(profiles.verifySignedCapture).toHaveBeenCalledWith(valid,body.digest,body.signature);
    profiles.verifySignedCapture.mockImplementation(()=>{throw new Error('Invalid signature');});
    await expect(service.imported(body)).rejects.toThrow('Invalid signature');
    expect(ranks.equippedRanks).toHaveBeenCalledTimes(1);
  });
  it('uses saved gear, shares duo/cache requests and invalidates after a board update or profile overwrite',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-12T00:00:00Z'));
    let revision=1,digest='saved-one';
    const profiles={get:vi.fn(async()=>({capture:{...capture,inventory:[]},source:{digest}}))};
    const ranks={equippedRanks:vi.fn(async()=>({available:true,global:123,region:{code:'EU',rank:21}}))};
    const prisma={player:{findUnique:vi.fn(async()=>({id:'player',region:'EU',hidden:false})),aggregate:vi.fn(async()=>({revision}))},
      playerScore:{aggregate:vi.fn(async()=>({revision}))}};
    const service=new SavedBuildRankingService(profiles as never,ranks as never,prisma as never);
    const first=await service.get('1301564092','dps-frost',{role:'dps',element:'Frost'});
    expect(first).toMatchObject({available:true,global:123,region:{code:'EU',rank:21},digest:'saved-one',track:'Frost-Volt'});
    expect(ranks.equippedRanks).toHaveBeenCalledWith('player','Frost-Volt','dps',expect.objectContaining({score:expect.any(Number),maxScore:expect.any(Number)}),'EU');
    await service.get('1301564092','dps-frost',{role:'dps',element:'Volt'});
    expect(ranks.equippedRanks).toHaveBeenCalledTimes(1);
    revision++;vi.advanceTimersByTime(60001);
    await service.get('1301564092','dps-frost',{role:'dps',element:'Frost'});
    expect(ranks.equippedRanks).toHaveBeenCalledTimes(2);
    digest='saved-two';
    await service.get('1301564092','dps-frost',{role:'dps',element:'Frost'});
    expect(ranks.equippedRanks).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(3600001);
    await service.get('1301564092','dps-frost',{role:'dps',element:'Frost'});
    expect(ranks.equippedRanks).toHaveBeenCalledTimes(4);
    await service.get('1301564092','dps-frost',{role:'healer',element:'Physical'});
    expect(ranks.equippedRanks).toHaveBeenLastCalledWith('player','Physical-Flame','healer',expect.any(Object),'EU');
  });

  it('rejects invalid selections and never exposes hidden owners, unmapped or absent gear',async()=>{
    const profiles={get:vi.fn(async()=>({capture:{...capture,gear:[]},source:{digest:'saved'}}))};
    const ranks={equippedRanks:vi.fn()};
    let hidden=true;
    const prisma={player:{findUnique:async()=>({id:'player',region:null,hidden}),aggregate:async()=>({})},playerScore:{aggregate:async()=>({})}};
    const service=new SavedBuildRankingService(profiles as never,ranks as never,prisma as never);
    await expect(service.get('1301564092','dps-frost',{role:'invalid',element:'Frost'})).rejects.toThrow('Invalid ranking selection');
    await expect(service.get('1301564092','dps-frost',{role:'dps',element:'Frost'})).resolves.toEqual({available:false});
    hidden=false;
    await expect(service.get('1301564092','dps-frost',{role:'dps',element:'Frost'})).resolves.toEqual({available:false});
    expect(ranks.equippedRanks).not.toHaveBeenCalled();
  });

  it('counts global and regional competitors with exact ties, excludes the owner, hidden and empty sets',async()=>{
    const rows=[
      {playerId:'owner',score:90,maxScore:100,region:'EU',hidden:false,gear:true},
      {playerId:'a',score:80,maxScore:100,region:'EU',hidden:false,gear:true},
      {playerId:'z',score:80,maxScore:100,region:'EU',hidden:false,gear:true},
      {playerId:'other',score:81,maxScore:100,region:'NA',hidden:false,gear:true},
      {playerId:'ceiling',score:80,maxScore:101,region:'EU',hidden:false,gear:true},
      {playerId:'hidden',score:99,maxScore:100,region:'EU',hidden:true,gear:true},
      {playerId:'empty',score:99,maxScore:100,region:'EU',hidden:false,gear:false},
    ];
    const count=vi.fn(async({where}:{where:Record<string,any>})=>rows.filter(row=>row.playerId!==where.playerId.not&&!row.hidden&&row.gear&&(!where.region||where.region===row.region)&&
      where.OR.some((term:Record<string,any>)=>(typeof term.score==='object'?row.score>term.score.gt:row.score===term.score)&&
        (!term.maxScore||(typeof term.maxScore==='object'?row.maxScore>term.maxScore.gt:row.maxScore===term.maxScore))&&(!term.playerId||row.playerId<term.playerId.lt))).length);
    const prisma={$transaction:async(fn:(tx:unknown)=>unknown)=>fn({playerScore:{count}})};
    const result=await new RankingService(prisma as never).equippedRanks('owner','Frost-Volt','dps',{score:80,maxScore:100},'EU');
    expect(result).toEqual({available:true,global:4,region:{code:'EU',rank:3}});
    expect(count.mock.calls[0][0].where.track).toBe('best:Frost-Volt');
  });
});
