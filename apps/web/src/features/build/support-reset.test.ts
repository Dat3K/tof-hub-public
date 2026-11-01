import {describe,expect,it} from 'vitest';
import {parseCivilTime,supportResetStatus} from './support-reset';

// source observation/5: stored reset 2026-10-03T23:46:31.405 (game clock); the game showed 29d and 28d.
const stored='2026-10-03T23:46:31.405';
const at=(iso:string)=>Date.parse(iso);

describe('Space Support reset cooldown',()=>{
  it('reads civil capture time as clock fields',()=>{
    expect(parseCivilTime(stored)).toBe(Date.UTC(2026,9,3,23,46,31,405));
    expect(parseCivilTime('2026-10-03T23:46:31')).toBe(Date.UTC(2026,9,3,23,46,31));
    expect(parseCivilTime('not a time')).toBeNull();
  });
  it('matches the in-game remaining days',()=>{
    expect(supportResetStatus(stored,30,at('2026-10-03T21:47:00Z'))).toMatchObject({state:'cooldown',days:29});
    expect(supportResetStatus(stored,30,at('2026-10-05T09:01:39Z'))).toMatchObject({state:'cooldown',days:28});
    expect(supportResetStatus(stored,30,at('2026-10-05T09:01:39Z')).availableAt).toBe(Date.UTC(2026,10,2,23,46,31,405));
  });
  it('stays approximate within the unconfirmed time-zone window',()=>{
    expect(supportResetStatus(stored,30,at('2026-11-02T20:00:00Z')).state).toBe('soon');
    expect(supportResetStatus(stored,30,at('2026-11-04T00:00:00Z')).state).toBe('ready');
  });
  it('is unknown without a capture or cooldown',()=>{
    expect(supportResetStatus(null,30,0).state).toBe('unknown');
    expect(supportResetStatus(stored,undefined,0).state).toBe('unknown');
  });
});

describe('card date format',()=>{
  it('uses numeric DD.MM.YYYY HH:mm; instants in UTC, game clock as stored',async()=>{
    const {formatBuildDate}=await import('./presentation');
    expect(formatBuildDate('2026-10-01T18:42:00.000Z','instant')).toBe('01.10.2026 18:42 UTC');
    expect(formatBuildDate(stored,'civil')).toBe('03.10.2026 23:46');
    expect(formatBuildDate('2026-10-05T00:10:00Z','instant',false)).toBe('05.10.2026');
  });
});
