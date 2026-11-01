import {describe,expect,it,vi} from 'vitest';
import {NegativeCombatScoreService,negativeCombatScorePeak} from './negative-combat-score.service';
import {scanFixture} from '../import/scan-session.fixture';

describe('negative current combat score',()=>{
  const uid='1302104471',scan=scanFixture('live');
  it('keeps the raw negative value and scan date, using observation time only when scan time is unavailable',()=>{
    expect(negativeCombatScorePeak({uid,cs:-900.5,scan,capturedAt:'2026-10-11T12:00:00Z'})).toMatchObject({
      score:-900.5,scannedAt:new Date(scan.startedAt!),timeSource:'scan',capturedAt:new Date('2026-10-11T12:00:00Z')});
    expect(negativeCombatScorePeak({uid,cs:-1,lastSeenAt:'2026-10-10T12:00:00Z'})).toMatchObject({scannedAt:new Date('2026-10-10T12:00:00Z'),timeSource:'observation'});
    expect(negativeCombatScorePeak({uid,cs:-1,capturedAt:'invalid'})).toMatchObject({scannedAt:null,timeSource:'unknown'});
  });
  it('ignores missing/invalid UIDs and nonnegative or invalid scores without a DB write',async()=>{
    const execute=vi.fn(),service=new NegativeCombatScoreService({$executeRaw:execute} as never);
    const rows=[null,0,100,NaN,Infinity,-Infinity,-1e13].map(cs=>({uid,cs}));
    rows.push({uid:'bad',cs:-100},{uid:'',cs:-100});
    expect(await service.observe(rows,{kind:'players',fileHash:'fixture'})).toBe(0);
    expect(execute).not.toHaveBeenCalled();
  });
  it('groups duplicate UIDs by magnitude and dates, writing one batch without needing a live profile',async()=>{
    const execute=vi.fn().mockResolvedValue(1),service=new NegativeCombatScoreService({$executeRaw:execute} as never);
    expect(await service.observe([{uid,cs:-100},{uid,cs:-900},{uid,cs:-900,capturedAt:'2026-10-11T12:00:00Z'},
      {uid,cs:10000}],{kind:'build',fileHash:'fixture'})).toBe(1);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].values).toContain(-900);
    expect(execute.mock.calls[0][0].values).not.toContain(-100);
    expect(execute.mock.calls[0][0].values).toContainEqual(new Date('2026-10-11T12:00:00Z'));
  });
});
