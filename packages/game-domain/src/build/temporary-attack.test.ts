import {describe,expect,it} from 'vitest';
import {temporaryAttackAtCapture,type TemporaryAttackCatalog} from './temporary-attack';

const all=['Physical','Flame','Frost','Volt','Altered'];
// Raw values: Proof of Trust 4-piece (CommonAtkMult 0.2, 6 s), SSR27 Volt ATK (ThunderAtkMult 0.08), a wormhole flat ATK.
const catalog:TemporaryAttackCatalog={effects:{
  Default__Buff_Matrix_SSR_4_level4_3_OS_C:{source:'',duration:6,modifiers:[{attribute:'CommonAtkMult',elements:all,kind:'percent',magnitude:.2}]},
  Default__Buff_Matrix_SSR27_ThuAtkUp_level1_OS_C:{source:'',duration:20,modifiers:[{attribute:'ThunderAtkMult',elements:['Volt'],kind:'percent',magnitude:.08}]},
  Default__buff_Wormhole_Atk_Level1_C:{source:'',duration:60,modifiers:[{attribute:'CommonAtkAdded',elements:all,kind:'flat',magnitude:2000}]},
}};
const record=(definition:string,durationSeconds:number|null=6,stackCount=1)=>({definition,durationSeconds,stackCount});

describe('temporary ATK at capture',()=>{
  it('sums constant ATK% per element and ignores permanent records',()=>{
    const result=temporaryAttackAtCapture([record('Default__Buff_Matrix_SSR_4_level4_3_OS_C'),record('Default__Buff_Matrix_SSR27_ThuAtkUp_level1_OS_C',20,2),
      record('Default__Buff_Matrix_SSR_4_level4_3_OS_C',null)],catalog);
    expect(result.percent.Flame).toBeCloseTo(.2);
    expect(result.percent.Volt).toBeCloseTo(.36);
    expect(result.blocking).toEqual([]);
  });
  it('blocks flat ATK',()=>{
    expect(temporaryAttackAtCapture([record('Default__buff_Wormhole_Atk_Level1_C',60)],catalog).blocking).toEqual(['Default__buff_Wormhole_Atk_Level1_C']);
  });
  it('preserves permitted food and shots while still rejecting another temporary ATK effect',()=>{
    const input:TemporaryAttackCatalog={...catalog,allowed:{food:{kind:'food',rows:['raw-food']},shot:{kind:'injection',rows:['raw-shot']}},
      effects:{...catalog.effects,food:{source:'food-fixture',duration:900,modifiers:[{attribute:'PhysicalAtkMult',elements:['Physical'],kind:'percent',magnitude:null}]},
        shot:{source:'shot-fixture',duration:604800,modifiers:[{attribute:'FireAtkMult',elements:['Flame'],kind:'percent',magnitude:.025}]}}};
    const result=temporaryAttackAtCapture([record('food',900),record('shot',604800),record('Default__buff_Wormhole_Atk_Level1_C',60)],input);
    expect(result.percent).toEqual({});expect(result.sources).toEqual([]);
    expect(result.blocking).toEqual(['Default__buff_Wormhole_Atk_Level1_C']);
  });
});
