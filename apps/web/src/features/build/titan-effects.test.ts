import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {BuildCatalog} from './types';
import {titanRareEffect} from './model';
const catalog=JSON.parse(readFileSync('apps/web/src/features/build/__fixtures__/catalog.json','utf8')) as BuildCatalog;

describe('Titan Overseas effect curves',()=>{
  it('uses combined levels and the Overseas dodge curve rather than adding item percentages',()=>{
    expect(titanRareEffect('EvadeAtkAggravatingInjury',5,catalog)?.value).toBe(.2);
    const separate=titanRareEffect('EvadeAtkAggravatingInjury',2,catalog)!.value+titanRareEffect('EvadeAtkAggravatingInjury',3,catalog)!.value;
    expect(separate).not.toBeCloseTo(.2);
    expect(titanRareEffect('FinalRigidity',4,catalog)?.value).toBeCloseTo(.096);
  });
  it('interpolates missing knots and clamps beyond the curve endpoint',()=>{
    expect(titanRareEffect('CommonBlockMult',2,catalog)?.value).toBeCloseTo(.08);
    expect(titanRareEffect('CommonBlockMult',31,catalog)?.value).toBe(.5);
    expect(titanRareEffect('CommonAtkAggravatingInjury',30,catalog)?.value).toBe(.2943);
  });
  it('preserves the game display curve separately from internal lifesteal scaling',()=>{
    const result=titanRareEffect('CommonDamageRecoverHPMult',1,catalog)!;
    expect(result.displayValue).toBeCloseTo(.08355);
    expect(result.value).toBe(.014573);
  });
  it('has no effect at zero, rejects unavailable inputs and preserves every generated knot',()=>{
    for(const item of catalog.reference.titanRare.items){
      expect(titanRareEffect(item.id,0,catalog)).toEqual({value:0,displayValue:0});
      for(const knot of item.effectCurve)expect(titanRareEffect(item.id,knot.level,catalog)?.value).toBeCloseTo(knot.value,8);
    }
    expect(titanRareEffect('missing',2,catalog)).toBeNull();
    expect(titanRareEffect('CommonBlockMult',-1,catalog)).toBeNull();
    expect(titanRareEffect('CommonBlockMult',NaN,catalog)).toBeNull();
  });
});
