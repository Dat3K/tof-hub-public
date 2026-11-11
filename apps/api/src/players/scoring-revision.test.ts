import {describe,expect,it,vi} from 'vitest';
import type {PrismaClient} from '@prisma/client';
import type {Pool} from 'pg';
import {PlayerStoreService} from './player-store.service';
import {loadScoringCatalog} from './scoring-catalog';
import {ensureCurrentPlayerScores,isScoringRevisionCurrent,scoringFingerprint} from './scoring-revision';

const catalog=loadScoringCatalog()!;
describe('persisted ranking scoring revision',()=>{
  it('detects runtime code, reference coefficients, tracks and slot rules without a manual version bump',()=>{
    const sources=[{name:'scorer.js',content:'original scoring implementation'}];
    const original=scoringFingerprint(catalog,sources);
    expect(scoringFingerprint(catalog,sources)).toBe(original);
    expect(scoringFingerprint(catalog,[{...sources[0],content:'duo ATK correction'}])).not.toBe(original);
    for(const change of [
      (next:typeof catalog)=>{next.reference.limits.maxNumOfRandomStatRolls++;},
      (next:typeof catalog)=>{next.allowedStats.helmet=[];},
      (next:typeof catalog)=>{next.tracks=[['Frost']];},
    ]) {
      const next=structuredClone(catalog);change(next);
      expect(scoringFingerprint(next,sources)).not.toBe(original);
    }
    expect(scoringFingerprint(catalog,[{name:'b',content:'2'},{name:'a',content:'1'}])).toBe(
      scoringFingerprint(catalog,[{name:'a',content:'1'},{name:'b',content:'2'}]));
  });
  it('checks the startup revision without rescoring or writing',async()=>{
    const rescore=vi.spyOn(PlayerStoreService.prototype,'rescoreAll');
    const prisma=(fingerprint?:string)=>({scoringRevision:{findUnique:vi.fn(async()=>fingerprint?{fingerprint}:null)}}) as unknown as PrismaClient;
    try {
      expect(await isScoringRevisionCurrent(prisma('same'),catalog,'same')).toBe(true);
      expect(await isScoringRevisionCurrent(prisma('old'),catalog,'new')).toBe(false);
      expect(await isScoringRevisionCurrent(prisma(),catalog,'new')).toBe(false);
      expect(rescore).not.toHaveBeenCalled();
    } finally {rescore.mockRestore();}
  });
  it('records the revision after the last player, resumes from its checkpoint and skips matching revisions',async()=>{
    const rows=new Map<string,string>();
    const write=vi.fn(async({where:{id},create:{fingerprint}}:{where:{id:string};create:{fingerprint:string}})=>{rows.set(id,fingerprint);});
    const prisma={
      $executeRaw:vi.fn(async()=>0),
      $transaction:async(writes:Promise<unknown>[])=>Promise.all(writes),
      scoringRevision:{
        findUnique:vi.fn(async({where:{id}}:{where:{id:string}})=>rows.has(id)?{fingerprint:rows.get(id)}:null),
        upsert:write,
        deleteMany:vi.fn(async({where:{id}}:{where:{id:string}})=>{rows.delete(id);}),
      },
    } as unknown as PrismaClient;
    const client={query:vi.fn(async()=>({rows:[{locked:true}]})),release:vi.fn()};
    const pool={connect:async()=>client} as unknown as Pool;
    const rescore=vi.spyOn(PlayerStoreService.prototype,'rescoreAll');
    try {
      rescore.mockImplementationOnce(async({onProgress}={})=>{
        await onProgress?.({lastPlayerId:'p100',done:100,total:200});
        throw new Error('score write failed');
      });
      await expect(ensureCurrentPlayerScores(prisma,pool,catalog,'next')).rejects.toThrow('score write failed');
      expect(rows.get('live-players')).toBeUndefined();
      expect(rows.get('live-players:rescore')).toBe('next|p100');
      expect(client.release).toHaveBeenCalledOnce();

      rescore.mockResolvedValueOnce({players:100,gear:1200});
      expect(await ensureCurrentPlayerScores(prisma,pool,catalog,'next')).toEqual({rescored:true,players:100,gear:1200});
      expect(rescore.mock.calls[1]?.[0]?.afterId).toBe('p100');
      expect(rows.get('live-players')).toBe('next');
      expect(rows.has('live-players:rescore')).toBe(false);

      expect(await ensureCurrentPlayerScores(prisma,pool,catalog,'next')).toEqual({rescored:false,players:0,gear:0});
      expect(rescore).toHaveBeenCalledTimes(2);

      // A checkpoint of another model is not resumed.
      rows.set('live-players:rescore','other|p150');
      rescore.mockResolvedValueOnce({players:200,gear:2400});
      await ensureCurrentPlayerScores(prisma,pool,catalog,'newest');
      expect(rescore.mock.calls[2]?.[0]?.afterId).toBeUndefined();

      client.query.mockResolvedValueOnce({rows:[{locked:false}]});
      await expect(ensureCurrentPlayerScores(prisma,pool,catalog,'latest')).rejects.toThrow('already running');
    } finally {rescore.mockRestore();}
  });
});
