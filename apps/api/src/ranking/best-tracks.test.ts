import {describe,expect,it} from 'vitest';
import {bestTrackId,withBestTracks} from './best-tracks';

const score=(track:string,value:number)=>({track,score:value,maxScore:value+10});
describe('best rows',()=>{
  it('keeps each role at its best track including Altered, mono on a tie',()=>{
    const rows=withBestTracks([score('Frost',80),score('Frost-Volt',80),score('Volt',70),score('Altered',95),
      score('healer:Volt',60),score('healer:Volt-Frost',65),score('tank:Flame',40),score('healer:Altered',85),score('tank:Altered',55)]);
    const best=(track:string)=>rows.find(row=>row.track===track);
    expect(best('best:all')).toMatchObject({score:95,maxScore:105,sourceTrack:'Altered'});
    expect(best('healer:best:all')).toMatchObject({score:85,sourceTrack:'healer:Altered'});
    expect(best('tank:best:all')).toMatchObject({score:55,sourceTrack:'tank:Altered'});
  });
  it('stores one unordered pair row with the better orientation',()=>{
    const rows=withBestTracks([score('Frost-Volt',50),score('Volt-Frost',75)]);
    expect(rows.find(row=>row.track===bestTrackId('dps','Volt-Frost'))).toMatchObject({score:75,sourceTrack:'Volt-Frost'});
    expect(rows.filter(row=>row.track.includes('best:'))).toHaveLength(2);
  });
  it('replaces earlier best rows instead of stacking them',()=>{
    const once=withBestTracks([score('Frost',10)]);
    expect(withBestTracks(once).filter(row=>row.track==='best:all')).toHaveLength(1);
  });
});

 it.each(['','healer:','tank:'])('prefers a matching native track over inherited Altered points for %s',prefix=>{
   const native={track:prefix+'Volt',score:85,maxScore:85,selectionValue:316.1};
   const altered={track:prefix+'Altered',score:95.7,maxScore:95.7,selectionValue:316.1};
   for(const rows of [[native,altered],[altered,native]])expect(withBestTracks(rows).find(row=>row.track===prefix+'best:all')?.sourceTrack).toBe(prefix+'Volt');
   expect(withBestTracks([native,{...altered,selectionValue:317}]).find(row=>row.track===prefix+'best:all')?.sourceTrack).toBe(prefix+'Altered');
 });
