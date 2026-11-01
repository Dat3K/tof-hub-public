import {describe,expect,it,vi} from 'vitest';
import type {PrismaClient} from '@prisma/client';
import {PlayerStoreService} from './player-store.service';
import {loadScoringCatalog} from './scoring-catalog';
import {ensureCurrentPlayerScores,scoringFingerprint} from './scoring-revision';

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
  it('waits for rescoring before marking a revision, skips matching revisions, and propagates failures',async()=>{
    let fingerprint:string|undefined;
    const tx={
      $executeRaw:vi.fn(async()=>0),
      scoringRevision:{findUnique:vi.fn(async()=>fingerprint?{fingerprint}:null),
        upsert:vi.fn(async(args:{create:{fingerprint:string}})=>{fingerprint=args.create.fingerprint;})},
    };
    const prisma={$transaction:async(work:(client:typeof tx)=>Promise<unknown>)=>work(tx)} as unknown as PrismaClient;
    let complete!:()=>void;
    const rescore=vi.spyOn(PlayerStoreService.prototype,'rescoreAll').mockImplementation(()=>new Promise(resolve=>{
      complete=()=>resolve({players:2,gear:24});
    }));
    try {
      const pending=ensureCurrentPlayerScores(prisma,catalog,'new');
      await vi.waitFor(()=>expect(rescore).toHaveBeenCalledOnce());
      expect(tx.scoringRevision.upsert).not.toHaveBeenCalled();
      complete();
      expect(await pending).toEqual({rescored:true,players:2,gear:24});
      expect(await ensureCurrentPlayerScores(prisma,catalog,'new')).toEqual({rescored:false,players:0,gear:0});
      expect(rescore).toHaveBeenCalledOnce();
      rescore.mockRejectedValueOnce(new Error('score write failed'));
      await expect(ensureCurrentPlayerScores(prisma,catalog,'next')).rejects.toThrow('score write failed');
      expect(fingerprint).toBe('new');
    } finally {rescore.mockRestore();}
  });
});
