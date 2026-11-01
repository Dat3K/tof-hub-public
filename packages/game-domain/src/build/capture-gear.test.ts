import {describe,expect,it} from 'vitest';
import {mapCaptureGear,type CaptureGearMapping} from './capture-gear';

const mapping:CaptureGearMapping={items:{glove1_orange:{id:'gloves',stage:'normal'}},labels:{MaxHealthAdded:'HP'},rareIds:[],rowsPerItem:4,augmentsPerItem:2,
  duel:['glove2_pvp']};

describe('mapCaptureGear',()=>{
  // East13, 2026-10-08: a full duel set (glove2_PVP …: fixed HP +1000, Duel Attack) must not count as PvE gear.
  it('reports duel armour apart, neither mapped nor unknown',()=>{
    const {gear,unresolved,duel}=mapCaptureGear([
      {itemId:'glove2_PVP',enhancement:68,stars:5,stats:[{attribute:'MaxHealthAdded',value:1000}]},
      {itemId:'glove1_orange',enhancement:65,stars:5,stats:[{attribute:'MaxHealthAdded',value:22856}]},
      {itemId:'unknown_item',enhancement:1,stars:0,stats:[]},
    ] as never,mapping);
    expect(duel).toEqual(['glove2_PVP']);
    expect(gear.map(item=>item.itemId)).toEqual(['glove1_orange']);
    expect(unresolved).toEqual(['gear: unknown_item']);
  });
});
