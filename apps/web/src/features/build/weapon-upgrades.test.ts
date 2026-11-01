import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
import type {BuildCatalog} from './types';
import {weaponUpgradeBounds,reconcileWeaponUpgrade} from './weapon-upgrades';
import {restoreDraft,selectBuildWeapon} from './model';
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'__fixtures__/catalog.json'),'utf8')) as BuildCatalog;
describe('generated weapon breakthrough stages',()=>{
  it.each([[190,19,20],[195,20,20],[200,20,21],[185,19,19],[180,18,19]])('Lv. %i allows Up. %i–%i for every catalog weapon',(level,min,max)=>{
    for(const item of catalog.weapons){
      const weapon={...structuredClone(catalog.demoDraft.weapons[0]),id:item.id,level};
      expect(weaponUpgradeBounds(weapon,catalog),item.id).toEqual({min,max});
    }
  });
  it('reconciles saved upgrades, level changes and weapon replacements without inventing an unknown upgrade',()=>{
    const draft=structuredClone(catalog.demoDraft),weapon=draft.weapons[0];
    weapon.level=195;weapon.upgradeLevel=21;
    reconcileWeaponUpgrade(weapon,catalog);expect(weapon.upgradeLevel).toBe(20);
    weapon.level=190;weapon.upgradeLevel=19;
    expect(restoreDraft(draft,catalog)?.weapons[0].upgradeLevel).toBe(19);
    selectBuildWeapon(draft,0,catalog.weapons[0].id,catalog);
    expect(weapon.upgradeLevel).toBe(20);
    delete weapon.upgradeLevel;reconcileWeaponUpgrade(weapon,catalog);
    expect(weapon.upgradeLevel).toBeUndefined();
  });
});
