import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {preferScoringTrack,scoreBuildForTrack,scoreCurrentGearForTrack,standardRVProfile,createCurrentGearScorer,type GearScoreReference} from './gear-score';
import {gearChampions} from './gear-champions';
import {getBuildRatedWeight,getBuildRVFactors} from './stats';
const page=JSON.parse(readFileSync('apps/web/public/game-data/build-page.json','utf8')) as {reference:GearScoreReference;gear:{id:string;allowedStats:string[]}[]};
const reference=page.reference;
const input=(slot:string,rows:{type:string;value:number}[])=>({slot,rows,augments:[],allowedTypes:page.gear.find(item=>item.id===slot)!.allowedStats});
describe('Altered gear scoring',()=>{
  it.each(['dps','healer'] as const)('uses one source for the whole %s set and cannot mix native stats',role=>{
    const pieces=[input('helmet',[{type:'Frost Attack',value:5000},{type:'Volt Attack',value:100}]),
      input('visor',[{type:'Volt Attack %',value:.2},{type:'Frost Attack %',value:.01},{type:'Altered Attack',value:1000}])];
    const build=scoreBuildForTrack(pieces,item=>item.slot,item=>item,['Altered'],reference,role);
    const slots=[...build.slots.values()];
    expect(slots.every(item=>item.score.inheritFrom===build.inheritFrom)).toBe(true);
    expect(build.value).toBeCloseTo(slots.reduce((sum,item)=>sum+item.score.value,0),10);
    const independentlyMixed=pieces.reduce((sum,item)=>sum+scoreCurrentGearForTrack(item,['Altered'],reference,role).value,0);
    expect(build.value).toBeLessThan(independentlyMixed);
    expect(slots.flatMap(item=>item.score.entries).filter(row=>/^(Frost|Volt) Attack/.test(row.type)).every(row=>row.type.startsWith(build.inheritFrom!))).toBe(true);
  });
  it('rates own Altered ATK after percentages, DMG at zero and healer crit at zero',()=>{
    const profile=standardRVProfile(reference,'Altered');
    expect(getBuildRatedWeight('Altered Attack',profile,'Altered','Frost')).toBeCloseTo(1/(52500*2.5),12);
    const piece=input('visor',[{type:'Frost Attack',value:1000},{type:'Frost Damage %',value:.8},{type:'Crit',value:4000},{type:'Altered Attack',value:500}]);
    const dps=scoreCurrentGearForTrack(piece,['Altered'],reference),healer=scoreCurrentGearForTrack(piece,['Altered'],reference,'healer');
    expect(dps.entries.some(row=>row.type.endsWith('Damage %'))).toBe(false);
    expect(healer.entries.some(row=>row.type==='Crit')).toBe(false);
    const factors=getBuildRVFactors([{type:'Frost Attack',value:1000},{type:'Frost Attack %',value:.1},{type:'Altered Attack',value:500}],profile,'Altered','Frost','healer');
    expect(factors.reduce((value,factor)=>value*factor.value,1)).toBeCloseTo(53500*2.6+500,8);
  });
  it('uses the Altered tank reference and excludes native resistance inheritance',()=>{
    expect(standardRVProfile(reference,'Altered')).toMatchObject({hp:2500000,hpPercent:0,resistance:15000,resistancePercent:.2});
    expect(standardRVProfile(reference,'Frost').resistance).toBe(30000);
    const piece=input('visor',[{type:'Resistance',value:1000},{type:'Altered Resistance',value:500},{type:'Altered Resistance %',value:.1},{type:'Frost Resistance',value:90000}]);
    const score=scoreCurrentGearForTrack(piece,['Altered'],reference,'tank');
    expect(score.entries.map(row=>row.type)).toEqual(expect.arrayContaining(['Resistance','Altered Resistance','Altered Resistance %']));
    expect(score.entries.some(row=>row.type==='Frost Resistance')).toBe(false);
  });
  it.each(['dps','healer','tank'] as const)('keeps cached and uncached Altered %s results equal',role=>{
    const piece=input('visor',[{type:'Frost Attack',value:1000},{type:'Altered Attack',value:500},{type:'Altered Resistance',value:500}]);
    expect(createCurrentGearScorer(reference)(piece,['Altered'],role)).toEqual(scoreCurrentGearForTrack(piece,['Altered'],reference,role));
  });
});

 it('retains native-specific Altered champions for later coherent whole builds',()=>{
 const pieces=[input('helmet',[{type:'Frost Attack',value:1000}]),input('helmet',[{type:'Volt Attack',value:2000}])];
 const winners=gearChampions(pieces,item=>item.slot,item=>item,[['Altered']],reference);
 expect(new Set(winners.map(item=>item.piece)).size).toBe(2);
 expect(winners.some(item=>item.key.includes('Frost'))).toBe(true);
 });

 it('does not let the missing DMG family turn identical Volt gear into Altered under All',()=>{
   const piece=input('core',[{type:'Volt Attack',value:739.381836},{type:'Attack',value:295.050781},{type:'Volt Attack %',value:.08171}]);
   const native=scoreCurrentGearForTrack(piece,['Volt'],reference),altered=scoreCurrentGearForTrack(piece,['Altered'],reference);
   expect(altered.value).toBeCloseTo(native.value,8);
   expect(altered.percent!).toBeGreaterThan(native.percent!);
   expect(preferScoringTrack({track:'Altered',percent:altered.percent!,value:altered.value},{track:'Volt',percent:native.percent!,value:native.value})).toBe(false);
 });

it('makes a maximum Altered RES% roll stronger than flat RES at the 15000 base',()=>{
 const profile=standardRVProfile(reference,'Altered'),flat=reference.statTypes['Altered Resistance'],percent=reference.statTypes['Altered Resistance %'];
 const flatGain=flat.randomStatMaxRollValue*(1+flat.maxAugmentIncreaseMultiplier)*getBuildRatedWeight('Altered Resistance',profile,'Altered',undefined,'tank');
 const percentGain=percent.randomStatMaxRollValue*(1+percent.maxAugmentIncreaseMultiplier)*getBuildRatedWeight('Altered Resistance %',profile,'Altered',undefined,'tank');
 expect(percentGain).toBeGreaterThan(flatGain);
 expect(percentGain/flatGain).toBeCloseTo(1417.5/1285.68,10);
});
