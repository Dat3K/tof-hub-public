import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {PlayerDirectoryQuerySchema} from '@tof-hub/contracts';
import {afterAll,describe,expect,it} from 'vitest';
import {PlayerStoreService} from './player-store.service';
import {PlayerDirectoryService} from './player-directory.service';
import {PrismaPlayerStoreRepository} from './prisma-player-store.repository';
import {buildScoringCatalog} from './scoring-catalog';
import {RankingService,parseRankingQuery} from '../ranking/ranking.service';
import {ensureCurrentPlayerScores} from './scoring-revision';

// Runs only against a disposable database: TOF_HUB_TEST_DATABASE_URL (migrated with `prisma migrate deploy`).
const url=process.env.TOF_HUB_TEST_DATABASE_URL;
const gameData=path.resolve(__dirname,'..','..','..','web','public','game-data');

describe.skipIf(!url)('player store on Postgres',()=>{
  const pool=new Pool({connectionString:url}),prisma=new PrismaClient({adapter:new PrismaPg(pool)});
  afterAll(async()=>{await prisma.$disconnect();await pool.end();});
  const page=JSON.parse(fs.readFileSync(path.join(gameData,'build-page.json'),'utf8'));
  const catalog=buildScoringCatalog(page,JSON.parse(fs.readFileSync(path.join(gameData,'capture-card-map.json'),'utf8')));
  const gear=page.demoDraft.gear.map((item:{id:string;stars:number;enhancement:number;titan:boolean;augmented?:boolean;rareId:string;rareLevel:number;
    rows:{type:string;value:number;beforeTitan:number|null}[];augments:{type:string;value:number}[]})=>({slot:item.id,itemId:item.id+'_demo',stars:item.stars,
    enhancement:item.enhancement,titan:item.titan,augmented:!!item.augmented,rareId:item.rareId||null,rareLevel:item.rareLevel,
    stats:item.rows.map(row=>({type:row.type,value:row.value})),statsBeforeTitan:item.rows.map(row=>row.beforeTitan),augments:item.augments}));

  it('stores a card, then a gear-only update, and serves both rankings',async()=>{
    await prisma.$executeRawUnsafe('TRUNCATE players, uploads RESTART IDENTITY CASCADE');
    const service=new PlayerStoreService(new PrismaPlayerStoreRepository(prisma),catalog);
    const upload={kind:'build',fileSha256:'c'.repeat(64),exporterName:'test',exporterVersion:'1',ipHash:'h'};
    const first=await service.store({source:'self',capturedAt:'2026-10-06T10:00:00.000Z',
      player:{uid:'1300242918',roleId:'55864639637934',nickname:'kritik',crew:'Whalesong',combatScore:311318},gear,
      build:{draft:{note:'card'},combatScore:311318,element:'Frost',role:'dps'}},upload);
    expect(first).toMatchObject({duplicate:false,gearStored:12});
    expect((await service.store({source:'self',capturedAt:'2026-10-06T10:00:00.000Z',player:{uid:'1300242918'}},upload)).duplicate).toBe(true);

    const helmet={...gear[0],statsBeforeTitan:gear[0].statsBeforeTitan.map((value:number|null)=>value===null?null:value+1)};
    const inspect=await service.store({source:'inspect',capturedAt:'2026-10-07T10:00:00.000Z',player:{roleId:'55864639637934',nickname:'kritik2'},gear:[helmet]});
    expect(inspect).toMatchObject({stale:false,buildId:null,gearStored:1});

    const player=await prisma.player.findFirstOrThrow({include:{names:true}});
    expect(player).toMatchObject({uid:'1300242918',region:'EU',serverId:'13002',crew:'Whalesong',nickname:'kritik2'});
    expect(player.names.map(name=>name.nickname).sort()).toEqual(['kritik','kritik2']);
    expect(await prisma.gearItem.count({where:{playerId:player.id}})).toBe(13);
    expect(await prisma.gearItem.count({where:{playerId:player.id,equipped:true}})).toBe(12);
    expect(await prisma.build.count({where:{isCurrent:true}})).toBe(1);

    const ranking=new RankingService(prisma);
    const gearTop=await ranking.gear(parseRankingQuery({track:'Frost-Volt',region:'EU',limit:'20'}));
    expect(gearTop.available).toBe(true);
    // All 13 stored pieces rank. The inspected helmet's shifted pre-Titan values have no valid roll history,
    // so it ranks on its current score (trackScores' fallback: maxScore = score).
    expect(gearTop.entries).toHaveLength(13);
    const inspected=gearTop.entries.filter(entry=>entry.gear.source==='inspect');
    expect(inspected).toHaveLength(1);
    expect(inspected[0]!.maxScore).toBe(inspected[0]!.score);
    for(let i=1;i<gearTop.entries.length;i++)expect(gearTop.entries[i-1]!.score).toBeGreaterThanOrEqual(gearTop.entries[i]!.score);
    const players=await ranking.players(parseRankingQuery({track:'Frost',verified:'1'}));
    expect(players.entries).toHaveLength(1);
    expect(players.entries[0]!.gear).toHaveLength(12);
    expect(players.entries[0]!.buildId).toBe(first.buildId);
    const directory=new PlayerDirectoryService(prisma);
    const verifiedPlayers=await directory.list(PlayerDirectoryQuerySchema.parse({}));
    expect(verifiedPlayers.entries).toMatchObject([{id:player.id,accountStatsAt:null}]);
    expect(verifiedPlayers.filtered).toBe(1);
    expect((await directory.list(PlayerDirectoryQuerySchema.parse({known:'1'}))).entries).toEqual([]);

    const select={gearItemId:true,track:true,slot:true,region:true,score:true,maxScore:true,sourceTrack:true} as const;
    const orderBy=[{gearItemId:'asc' as const},{track:'asc' as const}];
    const before=await prisma.gearScore.findMany({select,orderBy});
    await prisma.gearScore.updateMany({where:{gearItemId:before[0].gearItemId},data:{score:1,maxScore:2,region:null}});
    await prisma.gearScore.create({data:{gearItemId:before[0].gearItemId,track:'obsolete-test-track',slot:'helmet',region:'EU',score:1,maxScore:1}});
    await prisma.scoringRevision.upsert({where:{id:'ranking:players'},create:{id:'ranking:players',fingerprint:'1000'},update:{fingerprint:'1000'}});
    const fingerprint=randomUUID();
    expect(await ensureCurrentPlayerScores(prisma,pool,catalog,fingerprint,{pauseMs:0})).toEqual({rescored:true,players:1,gear:13});
    expect(await prisma.gearScore.findMany({select,orderBy})).toEqual(before);
    expect(await prisma.scoringRevision.findUnique({where:{id:'ranking:players'}})).toMatchObject({fingerprint:'1002'});
    expect((await ensureCurrentPlayerScores(prisma,pool,catalog,fingerprint)).rescored).toBe(false);
  },30_000);
});
