import {describe,it,expect} from 'vitest';
import {getBuildCriticalRates,getBuildRatedWeight,getBuildRVFactors,type BuildRVProfile} from './stats';
import {compareGrvTotals} from './gear-score';

const output=(...args:Parameters<typeof getBuildRVFactors>)=>getBuildRVFactors(...args).reduce((product,factor)=>product*factor.value,1);
const profile:BuildRVProfile={flatAttack:52500,attackPercent:1.5,damagePercent:.5,critChance:.75,critDamageBonus:.5,critDenominator:28213,
  resistance:30000,resistancePercent:.5,hp:2500000,hpPercent:0,resistanceConstant:20000};

describe('reference output (Gear Compare)',()=>{
  it('keeps post-percentage attack constant through flat and percentage swaps for DPS and healer',()=>{
    const supported={...profile,postPercentAttack:750};
    for(const role of ['dps','healer'] as const) {
      const attack=(flat:number,percent:number)=>flat*(1+percent)+750;
      const stats=[{type:'Frost Attack',value:100},{type:'Frost Attack %',value:.1}];
      expect(output(stats,supported,'Frost',undefined,role)/output([],supported,'Frost',undefined,role))
        .toBeCloseTo(attack(52600,1.6)/attack(52500,1.5),12);
    }
    for(const [type,step] of [['Frost Attack',.01],['Frost Attack %',1e-6]] as const) {
      const derivative=Math.log(output([{type,value:step}],supported,'Frost')/output([{type,value:-step}],supported,'Frost'))/(2*step);
      expect(derivative).toBeCloseTo(getBuildRatedWeight(type,supported,'Frost'),7);
    }
  });
  it('reproduces the Gear Compare sheet total damage',()=>{
    // Kritik's "Gear Compare" sheet (gid 1092741910): final ATK 144 100, DMG 47 %, Crit 26 577 + 3.42 % crit rate at enemy
    // level 100 (shown 97.62 %), crit DMG 74 % → Total DMG 364 850 (the sheet shows rounded inputs).
    const chance=getBuildCriticalRates(26577,28213,.0342).total!;
    const sheet:BuildRVProfile={...profile,flatAttack:144100,attackPercent:0,damagePercent:.47,critChance:chance,critDamageBonus:.74};
    expect(output([],sheet,'Frost')).toBeCloseTo(144100*1.47*(1+chance*.74),6);
    expect(Math.abs(output([],sheet,'Frost')/364850-1)).toBeLessThan(1e-5);
  });
  it('has the GRV weights as its log-derivatives',()=>{
    const types:[string,number][]=[['Frost Attack',1],['Attack',1],['Frost Attack %',1e-6],['Frost Damage %',1e-6],['Crit',1],['Crit Rate %',1e-6]];
    for(const [type,step] of types) {
      const gain=Math.log(output([{type,value:step}],profile,'Frost')/output([{type,value:-step}],profile,'Frost'))/(2*step);
      expect(gain/getBuildRatedWeight(type,profile,'Frost')).toBeCloseTo(1,5);
    }
    for(const [type,step] of [['HP',1],['HP %',1e-6],['Resistance',1],['Frost Resistance',1],['Frost Resistance %',1e-6]] as [string,number][]) {
      const gain=Math.log(output([{type,value:step}],profile,'Frost',undefined,'tank')/output([{type,value:-step}],profile,'Frost',undefined,'tank'))/(2*step);
      expect(gain/getBuildRatedWeight(type,profile,'Frost',undefined,'tank')).toBeCloseTo(1,5);
    }
  });
  it('ignores stats the role does not rate and caps crit at 100 %',()=>{
    expect(output([{type:'Crit',value:1e6}],profile,'Frost',undefined,'healer')).toBeCloseTo(output([],profile,'Frost',undefined,'healer'));
    const capped=output([{type:'Crit Rate %',value:.25}],profile,'Frost');
    expect(output([{type:'Crit Rate %',value:.9}],profile,'Frost')).toBeCloseTo(capped);
  });
  it('adds Altered ATK after the source percentages',()=>{
    const base=output([],profile,'Altered','Frost'),added=output([{type:'Altered Attack',value:1000}],profile,'Altered','Frost');
    expect(added/base).toBeCloseTo((52500*2.5+1000)/(52500*2.5));
  });
  it('compares GRV totals on the log scale, signed both ways',()=>{
    expect(compareGrvTotals({value:353,normalization:.0166},{value:353,normalization:.0166})).toBe(0);
    const up=compareGrvTotals({value:353,normalization:.0166},{value:342.2,normalization:.0166});
    expect(up).toBeCloseTo(Math.exp(10.8*.0166/100)-1,12);
    expect(compareGrvTotals({value:342.2,normalization:.0166},{value:353,normalization:.0166})).toBeCloseTo(1/(1+up)-1,12);
  });
});
