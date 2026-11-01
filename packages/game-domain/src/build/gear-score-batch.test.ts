import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,it,expect} from 'vitest';
import {createCurrentGearScorer,scoreCurrentGearForTrack,type GearScoreReference} from './gear-score';
const page=JSON.parse(readFileSync(resolve(__dirname,'../../../../apps/web/public/game-data/build-page.json'),'utf8')) as
  {reference:GearScoreReference;gear:{allowedStats:string[]}[]};
describe('current gear batch scoring',()=>{
  it('matches uncached results across roles, tracks, slot types, values and additions',()=>{
    const score=createCurrentGearScorer(page.reference);
    for(const role of ['dps','healer','tank'] as const)for(const track of [['Physical'],['Frost'],['Frost','Volt']])for(const {allowedStats:allowedTypes} of page.gear) {
      const rows=allowedTypes.slice(0,4).map((type,index)=>({type,value:type.endsWith('%')?(index+1)/100:(index+1)*100}));
      const gear={rows,augments:[{type:'HP',value:10000}],allowedTypes};
      expect(score(gear,track,role)).toEqual(scoreCurrentGearForTrack(gear,track,page.reference,role));
      const changed={...gear,rows:rows.map(row=>({...row,value:row.value*2}))};
      expect(score(changed,track,role)).toEqual(scoreCurrentGearForTrack(changed,track,page.reference,role));
    }
  },30_000);
});
