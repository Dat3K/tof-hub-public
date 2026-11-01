import {afterEach,describe,expect,it,vi} from 'vitest';
import type {PrismaClient} from '@prisma/client';
import {RankingService,pageTrack,parseRankingQuery,playerSearch,trackFilter} from './ranking.service';

const driver=process.env.WISH_DB_DRIVER;
afterEach(()=>{if(driver===undefined)delete process.env.WISH_DB_DRIVER;else process.env.WISH_DB_DRIVER=driver;});

describe('ranking query',()=>{
  it('filters and badges own-profile players even when their best set contains inspected gear',async()=>{
    const at=new Date('2026-10-25'),gear={id:'inspect-piece',slot:'helmet',itemId:'helmet',stars:5,enhancement:0,titan:false,augmented:false,
      rareId:null,rareLevel:null,stats:[],statsBeforeTitan:null,augments:[],source:'inspect',lastSeenAt:at};
    const row={playerId:'owner',track:'Physical',score:80,maxScore:90,gearIds:[gear.id],buildId:null,updatedAt:at,
      player:{uid:'1302677129',nickname:'Owner',region:'EU',serverId:null,selfCaptureAt:at,combatScore:null,maxCombatScore:null,gear:[gear]}};
    const queryRaw=vi.fn().mockResolvedValueOnce([{id:'owner'}]).mockResolvedValueOnce([{id:'owner',rank:23n}]);
    const prisma={$queryRaw:queryRaw,playerScore:{findMany:vi.fn().mockResolvedValue([row]),count:vi.fn().mockResolvedValue(1)},player:{count:vi.fn().mockResolvedValue(1)}};
    const result=await new RankingService(prisma as never).players(parseRankingQuery({track:'Physical',verified:'1'}));
    expect(queryRaw.mock.calls[0][0].sql).toContain('p.self_capture_at IS NOT NULL');
    expect(result.entries[0]).toMatchObject({verified:true,rank:23,gear:[{source:'inspect',statsBeforeTitan:null}]});
    row.player.selfCaptureAt=null as never;
    const ordinary=await new RankingService(prisma as never).players(parseRankingQuery({track:'Physical'}));
    expect(ordinary.entries[0].verified).toBe(false);
  });
  it('uses the gear cache for live tops while keeping Pioneer on its own path',async()=>{
    const cached={available:true,entries:[],total:3};
    const cache={getOrCompute:vi.fn().mockResolvedValue(cached)};
    const pioneer={gear:vi.fn().mockResolvedValue({available:true,entries:[]})};
    const service=new RankingService(null,pioneer as never,null,cache as never);
    const query=parseRankingQuery({track:'all',slot:'helmet',limit:'100'});
    expect(await service.gear(query)).toBe(cached);
    expect(cache.getOrCompute).toHaveBeenCalledExactlyOnceWith(query,expect.any(Function),{board:'gear'});
    await service.gear({...query,dataset:'pioneer'});
    expect(pioneer.gear).toHaveBeenCalledOnce();expect(cache.getOrCompute).toHaveBeenCalledOnce();
  });
  it('attaches participation by UID with one lookup for the page, without changing ranks',async()=>{
    const at=new Date('2026-10-10'),uids=['1302104471','1302104472'];
    const rows=uids.map((uid,index)=>({playerId:uid,track:'Physical',score:80-index,maxScore:90,gearIds:[],buildId:null,updatedAt:at,
      player:{nickname:uid,uid,region:'EU',serverId:null,combatScore:null,maxCombatScore:null,maxCombatScoreAt:null,gear:[]}}));
    const prisma={playerScore:{findMany:vi.fn().mockResolvedValue(rows),count:vi.fn().mockResolvedValue(2)},player:{count:vi.fn().mockResolvedValue(2)}};
    const marks=[{distribution:'global-pioneer',firstSeenAt:at.toISOString(),lastSeenAt:at.toISOString()}];
    const ledger={forUids:vi.fn().mockResolvedValue(new Map([[uids[0],marks]]))};
    const result=await new RankingService(prisma as never,null,ledger as never).players(parseRankingQuery({track:'Physical'}));
    expect(ledger.forUids).toHaveBeenCalledExactlyOnceWith(uids);
    expect(result.entries.map(row=>row.rank)).toEqual([1,2]);
    expect(result.entries[0].player.testServers).toEqual(marks);expect(result.entries[1].player.testServers).toEqual([]);
  });
  it('routes only explicit Pioneer selections to its isolated store and refuses mixed regions',async()=>{
    const isolated={gear:vi.fn().mockResolvedValue({available:true,entries:[]}),players:vi.fn().mockResolvedValue({available:true,entries:[]})};
    const service=new RankingService(null,isolated as never);
    const query=parseRankingQuery({track:'all',dataset:'pioneer'});
    await service.gear(query);await service.players(query);
    expect(isolated.gear).toHaveBeenCalledTimes(1);expect(isolated.players).toHaveBeenCalledTimes(1);
    await service.gear(parseRankingQuery({track:'all'}));await service.players(parseRankingQuery({track:'all',region:'EU'}));
    expect(isolated.gear).toHaveBeenCalledTimes(1);expect(isolated.players).toHaveBeenCalledTimes(1);
    expect(()=>parseRankingQuery({track:'all',dataset:'pioneer',region:'EU'})).toThrow('cannot be combined');
    await expect(service.boardRank('players',query,NaN)).rejects.toThrow('Invalid score');
    await expect(service.gearRanks(query,['bad-id'])).rejects.toThrow('Invalid ids');
  });
  it('accepts mono and pair tracks, slots, regions and a bounded limit',()=>{
    expect(parseRankingQuery({track:'Frost-Volt',slot:'helmet',region:'EU',limit:'20'})).toEqual({track:'Frost-Volt',role:'dps',slot:'helmet',region:'EU',limit:20});
    expect(parseRankingQuery({track:'Altered'})).toMatchObject({track:'Altered',limit:50});
    expect(parseRankingQuery({track:'all'})).toMatchObject({track:'all'});
  });
  it('reads role tracks: DPS plain, healer and tank prefixed, no tank pairs',()=>{
    expect(parseRankingQuery({track:'Frost',role:'tank'})).toMatchObject({track:'Frost',role:'tank'});
    expect(()=>parseRankingQuery({track:'Frost-Volt',role:'tank'})).toThrow();
    expect(()=>parseRankingQuery({track:'Frost',role:'support'})).toThrow();
    expect(trackFilter('Frost','healer')).toEqual({track:'healer:Frost'});
    // All and unordered pairs read the precomputed best rows: one track, one index range.
    expect(trackFilter('Frost-Volt','healer')).toEqual({track:'healer:best:Frost-Volt'});
    expect(trackFilter('Volt-Frost')).toEqual({track:'best:Frost-Volt'});
    expect(trackFilter('Frost')).toEqual({track:'Frost'});
    expect(trackFilter('all','tank')).toEqual({track:'tank:best:all'});
    expect(pageTrack('tank:Volt')).toBe('Volt');expect(pageTrack('Frost-Volt')).toBe('Frost-Volt');
  });
  it('accepts a bounded search and item slots',()=>{
    expect(parseRankingQuery({track:'all',q:' Kostia ',slots:'helmet,boots'})).toMatchObject({q:'Kostia',slots:['helmet','boots']});
    expect(()=>parseRankingQuery({track:'all',q:'x'.repeat(41)})).toThrow();
    expect(()=>parseRankingQuery({track:'all',slots:'Helmet!'})).toThrow();
    const search=JSON.stringify(playerSearch('eden'));
    expect(search).toContain('"serverId":{"in":["11001"');expect(search).toContain('"searchName":{"contains":"eden"}');
    expect(JSON.stringify(playerSearch('eu'))).toContain('"region":"EU"');
  });
  it('rejects unknown tracks, regions and limits',()=>{
    for(const query of [{track:'Fire'},{track:'Frost-'},{track:'Frost',region:'XX'},{track:'Frost',limit:'0'},{track:'Frost',limit:'101'},{track:'Frost',slot:'Helmet!'}])
      expect(()=>parseRankingQuery(query)).toThrow();
  });
  it('reports an unavailable store without Postgres',async()=>{
    delete process.env.WISH_DB_DRIVER;
    const service=new RankingService();
    await expect(service.gear(parseRankingQuery({track:'Frost'}))).resolves.toEqual({available:false,entries:[]});
    await expect(service.players(parseRankingQuery({track:'Frost'}))).resolves.toEqual({available:false,entries:[]});
  });
  it('distinguishes an empty database from stored gear without matching scores',async()=>{
    const findFirst=vi.fn().mockResolvedValue({id:'unranked-piece'});
    const prisma={gearItem:{findFirst},gearScore:{findMany:vi.fn().mockResolvedValue([]),count:vi.fn().mockResolvedValue(0)},
      playerScore:{findMany:vi.fn().mockResolvedValue([]),count:vi.fn().mockResolvedValue(0)},player:{count:vi.fn().mockResolvedValue(0)}};
    const service=new RankingService(prisma as unknown as PrismaClient);
    for(const board of ['gear','players'] as const){
      await expect(service[board](parseRankingQuery({track:'Frost',region:'EU'}))).resolves.toMatchObject({databaseEmpty:false});
    }
    findFirst.mockResolvedValue(null);
    for(const board of ['gear','players'] as const){
      await expect(service[board](parseRankingQuery({track:'Frost',region:'EU'}))).resolves.toMatchObject({databaseEmpty:true});
    }
    expect(findFirst).toHaveBeenCalledWith({select:{id:true}});
  });
  it('validates visual filters independently of the ranking track',()=>{
    expect(parseRankingQuery({track:'Physical',region:'EU',verified:'1',places:'global',sort:'cs'})).toMatchObject({verified:true,places:'global',sort:'cs'});
    for(const key of ['verified','places','sort'])expect(()=>parseRankingQuery({track:'all',[key]:'invalid'})).toThrow();
    for(const sort of ['grv-asc','cs-asc','aug','aug-asc','name-asc','name-desc'])expect(parseRankingQuery({track:'all',sort})).toMatchObject({sort});
  });
  it('sorts nicknames before pagination and keeps the original GRV place',async()=>{
    const row={playerId:'later',track:'Physical',sourceTrack:null,score:50,maxScore:90,gearIds:['piece'],buildId:null,updatedAt:new Date('2026-10-08'),
      player:{nickname:'Alpha',uid:'1',region:'EU',serverId:null,combatScore:null,maxCombatScore:null,gear:[]}};
    const findMany=vi.fn().mockResolvedValue([row]);
    const count=vi.fn().mockResolvedValue(38);
    const prisma={$queryRaw:vi.fn().mockResolvedValue([{id:'later',rank:39n}]),playerScore:{findMany,count}};
    const service=new RankingService(prisma as unknown as PrismaClient);
    for(const sort of ['name-asc','name-desc']){
      const result=await service.players(parseRankingQuery({track:'Physical',region:'EU',sort,offset:'100',limit:'20'}));
      expect(result.entries[0].rank).toBe(39);
      expect(findMany.mock.lastCall?.[0]).toMatchObject({skip:100,take:20,orderBy:[{player:{nickname:sort==='name-asc'?'asc':'desc'}},{score:'desc'},{maxScore:'desc'},{playerId:'asc'}]});
    }
  });
  it('keeps the original regional place after hiding unverified gear, including on later pages',async()=>{
    const count=vi.fn().mockResolvedValue(9);
    const player={nickname:'Verified',uid:'1',region:'EU',serverId:null};
    const gear={id:'piece',slot:'helmet',itemId:'1',stars:5,enhancement:80,titan:true,augmented:true,rareId:null,rareLevel:null,
      source:'self',stats:[],statsBeforeTitan:[0,null],augments:[],lastSeenAt:new Date('2026-10-08'),augmentCount:142,player};
    const findMany=vi.fn().mockResolvedValue([{gearItemId:'piece',track:'Physical',sourceTrack:null,score:80,maxScore:90,gear}]);
    const prisma={$queryRaw:vi.fn().mockResolvedValueOnce([{id:'piece'}]).mockResolvedValue([{id:'piece',rank:10n}]),gearScore:{findMany,count}};
    const result=await new RankingService(prisma as unknown as PrismaClient).gear(parseRankingQuery({track:'Physical',region:'EU',verified:'1',offset:'100'}));
    expect(result.entries[0].rank).toBe(10);
    expect(findMany.mock.calls[0][0]).toMatchObject({where:{gearItemId:{in:['piece']},region:'EU'},skip:100});
    expect(count).not.toHaveBeenCalled();
    expect(prisma.$queryRaw.mock.calls[1][0].values).toContain('EU');
    expect(prisma.$queryRaw.mock.calls[0][0].sql).toContain("g.source='self'");
    expect(result.entries[0].gear.source).toBe('self');
  });
  it('orders gear by nullable augmentation count before paging, with GRV fallback and original ranks',async()=>{
    const player={nickname:'Known',uid:'1',region:'EU',serverId:null};
    const gear={id:'piece',slot:'helmet',itemId:'1',stars:5,enhancement:80,titan:true,augmented:true,rareId:null,rareLevel:null,source:'self',stats:[],statsBeforeTitan:[],augments:[],lastSeenAt:new Date('2026-10-08'),augmentCount:0,player};
    const findMany=vi.fn().mockResolvedValue([{gearItemId:'piece',track:'Physical',sourceTrack:null,score:80,maxScore:90,gear}]);
    const count=vi.fn().mockResolvedValue(9);
    const service=new RankingService({$queryRaw:vi.fn().mockResolvedValue([{id:'piece',rank:10n}]),gearScore:{findMany,count}} as unknown as PrismaClient);
    for(const sort of ['aug','aug-asc']){
      const result=await service.gear(parseRankingQuery({track:'Physical',sort,offset:'100',limit:'20'}));
      expect(findMany.mock.lastCall?.[0]).toMatchObject({skip:100,take:20,orderBy:[{gear:{augmentCount:{sort:sort==='aug'?'desc':'asc',nulls:'last'}}},{score:'desc'},{maxScore:'desc'},{gearItemId:'asc'}]});
      expect(result.entries[0].rank).toBe(10);
      expect(result.entries[0].gear.augmentCount).toBe(0);
    }
  });
  it('orders players by CS but retains global GRV places, excluding visual filters from rank counts',async()=>{
    const makeRow=(id:string,cs:number)=>({playerId:id,track:'Physical',sourceTrack:null,score:80,maxScore:90,gearIds:['piece'],buildId:null,updatedAt:new Date('2026-10-08'),
      player:{nickname:id,uid:id,region:'EU',serverId:null,combatScore:cs,maxCombatScore:null,gear:[]}});
    const findMany=vi.fn().mockResolvedValue([makeRow('low',100),makeRow('high',200)]);
    const count=vi.fn().mockResolvedValue(9);
    const prisma={$queryRaw:vi.fn().mockResolvedValueOnce([{id:'low'},{id:'high'}]).mockResolvedValueOnce([{id:'high'},{id:'low'}]).mockResolvedValueOnce([{id:'low',rank:10n},{id:'high',rank:9n}]),
      playerScore:{findMany,count},player:{count:vi.fn().mockResolvedValue(20)}};
    const result=await new RankingService(prisma as unknown as PrismaClient).players(parseRankingQuery({track:'Physical',region:'EU',verified:'1',places:'global',sort:'cs'}));
    expect(result.entries.map(row=>row.player.uid)).toEqual(['high','low']);
    expect(result.entries.map(row=>row.rank)).toEqual([9,10]);
    const ranks=count.mock.calls.slice(1).map(call=>call[0].where);
    for(const where of ranks){expect(where.region).toBeUndefined();expect(where).not.toHaveProperty('playerId');expect(where.player).toEqual({hidden:false});}
    expect(prisma.$queryRaw.mock.calls[1][0].sql).toContain('coalesce(p.max_combat_score,p.combat_score) DESC NULLS LAST');
  });
  it('supports ascending GRV and CS while preserving GRV ranks',async()=>{
    const row={playerId:'low',track:'Physical',sourceTrack:null,score:50,maxScore:90,gearIds:['piece'],buildId:null,updatedAt:new Date('2026-10-08'),
      player:{nickname:'Low',uid:'1',region:'EU',serverId:null,combatScore:100,maxCombatScore:null,gear:[]}};
    const findMany=vi.fn().mockResolvedValue([row]);
    const prisma={$queryRaw:vi.fn().mockResolvedValue([{id:'low',rank:10n}]),playerScore:{findMany,count:vi.fn().mockResolvedValue(9)},player:{count:vi.fn().mockResolvedValue(20)}};
    const service=new RankingService(prisma as unknown as PrismaClient);
    const grv=await service.players(parseRankingQuery({track:'Physical',sort:'grv-asc'}));
    expect(grv.entries[0].rank).toBe(10);
    expect(findMany.mock.lastCall?.[0].orderBy).toEqual([{score:'asc'},{maxScore:'asc'},{playerId:'desc'}]);
    const cs=await service.players(parseRankingQuery({track:'Physical',sort:'cs-asc'}));
    expect(cs.entries[0].rank).toBe(10);
    expect(prisma.$queryRaw.mock.calls.some(call=>call[0].sql.includes('coalesce(p.max_combat_score,p.combat_score) ASC NULLS LAST'))).toBe(true);
  });
});
