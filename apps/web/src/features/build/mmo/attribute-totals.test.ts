import {describe,expect,it} from 'vitest';
import {mmoAttributeTotals} from './model';
import type {MmoBuildCatalog,MmoBuildDraft} from './types';

// Small synthetic pools make the weighting explicit, independently of game updates.
const catalog={gear:[{id:'a',quality:'tier-a'},{id:'b',quality:'tier-b'}],randomStats:{
  crit_1:{attribute:'Crit',ranges:{'tier-a':{min:100,max:200}}},
  crit_2:{attribute:'Crit',ranges:{'tier-b':{min:200,max:500}}},
  fixed:{attribute:'Healing',ranges:{'tier-a':{min:50,max:50}}},
}} as unknown as MmoBuildCatalog;
const draft=(gear:MmoBuildDraft['gear'])=>({gear}) as MmoBuildDraft;
const gear=(itemId:string,prop:string,value:number|null)=>({itemId,rolls:[{prop,value}],card:null});

describe('MMO footer attribute quality',()=>{
  it('shows 50% for a midpoint and weights mixed pools by their range spans',()=>{
    expect(mmoAttributeTotals(draft({helmet:gear('a','crit_1',150)}),catalog)).toEqual([
      {attribute:'Crit',value:150,pieces:1,quality:.5},
    ]);
    expect(mmoAttributeTotals(draft({helmet:gear('a','crit_1',100),boots:gear('b','crit_2',500)}),catalog)).toEqual([
      {attribute:'Crit',value:600,pieces:2,quality:.75},
    ]);
  });
  it('counts each equipped piece once and excludes unequipped or null rows',()=>{
    const helmet=gear('a','crit_1',150);helmet.rolls.push({prop:'crit_1',value:150});
    expect(mmoAttributeTotals(draft({helmet,boots:gear('','crit_2',500),armor:gear('b','crit_2',null)}),catalog)).toEqual([
      {attribute:'Crit',value:300,pieces:1,quality:.5},
    ]);
  });
  it('omits quality when any contributing range is unknown',()=>{
    expect(mmoAttributeTotals(draft({helmet:gear('a','crit_1',150),boots:gear('b','crit_1',160)}),catalog)).toEqual([
      {attribute:'Crit',value:310,pieces:2,quality:null},
    ]);
  });
  it('handles fixed pools and bounds quality without changing captured values',()=>{
    expect(mmoAttributeTotals(draft({helmet:gear('a','fixed',50)}),catalog)[0]?.quality).toBe(1);
    expect(mmoAttributeTotals(draft({helmet:gear('a','fixed',40)}),catalog)[0]?.quality).toBeNull();
    expect(mmoAttributeTotals(draft({helmet:gear('a','crit_1',250)}),catalog)[0]).toMatchObject({value:250,quality:1});
    expect(mmoAttributeTotals(draft({helmet:gear('a','crit_1',50)}),catalog)[0]?.quality).toBe(0);
  });
});
