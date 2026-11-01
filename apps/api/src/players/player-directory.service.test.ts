import {describe,expect,it,vi} from 'vitest';
import {Prisma,type PrismaClient} from '@prisma/client';
import {PLAYER_DIRECTORY_SORTS,PlayerDirectoryQuerySchema} from '@tof-hub/contracts';
import {PlayerDirectoryService,playerDirectoryPageSql} from './player-directory.service';
import {PlayersController} from './players.controller';
import {playerSearch,playerSearchSql} from './player-search';

describe('player directory',()=>{
  it('validates sort, region and bounded pagination without accepting SQL fragments',()=>{
    const controller=new PlayersController(new PlayerDirectoryService());
    for(const query of [{sort:'total_recharge;drop table players'},{direction:'up'},{region:'XX'},{limit:101},{offset:-1},{q:'x'.repeat(41)},{known:'yes'},{server:'13002 OR true'}])
      expect(()=>controller.list(query)).toThrow('Invalid player directory query');
    expect(PlayerDirectoryQuerySchema.parse({q:' Alex ',region:'EU',limit:'10',offset:'20'})).toMatchObject({q:'Alex',region:'EU',limit:10,offset:20,sort:'recharge',direction:'desc'});
  });
  it('keeps normalized current/former nickname and server search, escaping literal LIKE characters',()=>{
    expect(JSON.stringify(playerSearch('Phan\u200btom'))).toContain('phantom');
    expect(JSON.stringify(playerSearch('eden'))).toContain('11001');
    expect(JSON.stringify(playerSearch('eu'))).toContain('"region":"EU"');
    const search=playerSearchSql("A_%'\\");
    expect(search.sql).toContain('player_names');
    expect(search.sql).not.toContain("A_%'");
    expect(search.values).toContain("A\\_\\%'\\\\%");
  });
  it('sorts numeric expressions, leaves NULL last in both directions and binds limit/offset',()=>{
    for(const sort of ['packs','recharge','recharge-value'] as const)for(const direction of ['asc','desc'] as const) {
      const sql=playerDirectoryPageSql(PlayerDirectoryQuerySchema.parse({sort,direction,offset:100}),Prisma.sql`p.hidden=false`);
      expect(sql.sql).toContain('::numeric');
      expect(sql.sql).toContain(`${direction.toUpperCase()} NULLS LAST,p.id ASC LIMIT ? OFFSET ?`);
      expect(sql.values.slice(-2)).toEqual([100,100]);
    }
  });
  it('orders every directory column on the server, numeric ids as numbers',()=>{
    for(const sort of PLAYER_DIRECTORY_SORTS)
      expect(playerDirectoryPageSql(PlayerDirectoryQuerySchema.parse({sort}),Prisma.sql`p.hidden=false`).sql).toMatch(/ORDER BY .+ DESC NULLS LAST,p\.id ASC/s);
    expect(playerDirectoryPageSql(PlayerDirectoryQuerySchema.parse({sort:'uid'}),Prisma.sql`p.hidden=false`).sql).toContain('p.uid::numeric');
  });
  it('preserves zero/large integer strings and excludes hidden players',async()=>{
    const row={id:'id',nickname:'  Phantom\u200b',uid:'13002123',region:'EU',serverId:'13002',packsBought:'0',
      totalRecharge:'9007199254740993',totalRechargeValue:null,maxCombatScore:123,lastSeenAt:new Date('2026-10-11T01:00:00Z'),
      firstSeenAt:new Date('2026-10-01T00:00:00Z'),accountStatsAt:null,maxCombatScoreAt:new Date('2026-09-30T12:00:00Z')};
    const $queryRaw=vi.fn().mockResolvedValueOnce([row]).mockResolvedValueOnce([{count:1n}]);
    const count=vi.fn().mockResolvedValue(5);
    const service=new PlayerDirectoryService({$queryRaw,player:{count}} as unknown as PrismaClient);
    const response=await service.list(PlayerDirectoryQuerySchema.parse({region:'EU',server:'13002',q:'Phantom',known:'1'}));
    expect(response).toMatchObject({available:true,total:5,filtered:1,entries:[{nickname:row.nickname,packsBought:'0',totalRecharge:'9007199254740993',totalRechargeValue:null,lastSeenAt:'2026-10-11T01:00:00.000Z',
      firstSeenAt:'2026-10-01T00:00:00.000Z',accountStatsAt:null,maxCombatScoreAt:'2026-09-30T12:00:00.000Z'}]});
    const sql=$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.sql).toContain('p.hidden=false');expect(sql.sql).toContain('p.region=?');expect(sql.sql).toContain('p.server_id=?');
    expect(sql.sql).toContain('IS NOT NULL OR');
    expect(sql.values).toContain('buyGemCount');expect(sql.values).not.toContain('reportCount');
    expect(count).toHaveBeenCalledWith({where:{hidden:false}});
  });
  it('distinguishes a missing database from an empty connected directory',async()=>{
    const query=PlayerDirectoryQuerySchema.parse({});
    expect(await new PlayerDirectoryService().list(query)).toMatchObject({available:false,total:0,filtered:0,entries:[]});
    const prisma={$queryRaw:vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{count:0n}]),player:{count:vi.fn().mockResolvedValue(0)}};
    expect(await new PlayerDirectoryService(prisma as unknown as PrismaClient).list(query)).toMatchObject({available:true,total:0,filtered:0,entries:[]});
  });
});
