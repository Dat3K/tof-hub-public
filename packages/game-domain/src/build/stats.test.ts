import {describe,it,expect} from 'vitest';
import {enumerateBuildRolls,getBuildCriticalRates,getBuildResistanceReduction,getBuildRollCandidates,getBuildRollQuality,getBuildTitanProjection} from './stats';
const bounds={randomStatDefaultValue:10,randomStatMinRollValue:10,randomStatMaxRollValue:20,maxAugmentIncreaseMultiplier:.1,maxAugmentIncreaseFlat:5,isPercentageBased:false};
describe('build stat formulas',()=>{
  it('preserves independent Titan growth for equal and close elemental stats in either row order',()=>{
    const growth={pullUpFactors:[.95,.9,.85],priorities:{},fallbacks:{},maxAddedStats:2,universalAttackElements:['Volt','Physical'],unconfirmedPullUpRanks:[4]};
    for(const family of ['Attack','Attack %','Damage %']) {
      const types=Object.fromEntries(['Volt','Physical'].map(element=>[`${element} ${family}`,bounds]));
      for(const before of [69,70])for(const reverse of [false,true]) {
        const rows=[{type:`Volt ${family}`,beforeTitan:before},{type:`Physical ${family}`,beforeTitan:69}];
        if(reverse)rows.reverse();
        const projection=getBuildTitanProjection(rows,types,growth,0);
        rows.forEach((row,i)=>{
          expect(projection.random[i]).toBeCloseTo(row.beforeTitan*1.1+5);
          expect(projection.sources[i]).toBe(row.type);
        });
      }
      const rows=[{type:`Volt ${family}`,beforeTitan:100},{type:`Physical ${family}`,beforeTitan:10}];
      const projection=getBuildTitanProjection(rows,types,growth,0);
      expect(projection.random[1]).toBeCloseTo(115*.95);
      expect(projection.sources[1]).toBe(rows[0].type);
      expect(getBuildTitanProjection(rows,types,{...growth,unconfirmedPullUpRanks:[2]},0).random[1]).toBeNull();
    }
  });
  it('normalizes upgrade quality between the minimum and maximum for all rolls',()=>{
    expect(getBuildRollQuality(10,1,bounds)).toBe(0);
    expect(getBuildRollQuality(15,1,bounds)).toBe(.5);
    expect(getBuildRollQuality(20,1,bounds)).toBe(1);
    expect(getBuildRollQuality(30,2,bounds)).toBe(.5);
    expect(getBuildRollQuality(0,0,bounds)).toBeNull();
    expect(getBuildRollQuality(15,null,bounds)).toBeNull();
    expect(getBuildRollQuality(null,1,bounds)).toBeNull();
    expect(getBuildRollQuality(10,1,{...bounds,randomStatMaxRollValue:10})).toBeNull();
  });
  it('rejects values outside the materialized bounds and enumerates ambiguous histories',()=>{
    expect(getBuildRollCandidates(Number.NaN,bounds,5)).toEqual([]);
    expect(getBuildRollCandidates(9,bounds,5)).toEqual([]);
    expect(enumerateBuildRolls([{type:'test',beforeTitan:30},{type:'test',beforeTitan:30}],{test:bounds},3,5)).toEqual([[1,2],[2,1]]);
  });
  it('does not guess missing or invalid coefficients',()=>{
    expect(getBuildCriticalRates(19840,undefined,.124)).toEqual({base:null,total:null});
    expect(getBuildResistanceReduction(14630,undefined)).toBeNull();
    expect(getBuildResistanceReduction(0,14106)).toBe(0);
    expect(getBuildResistanceReduction(14630,14106)).toBeCloseTo(.50912,4);
  });
});
