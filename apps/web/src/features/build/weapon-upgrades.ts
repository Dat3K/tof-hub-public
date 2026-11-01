import type {BuildCatalog,BuildDraft} from './types';

/** Inclusive ranges retain both stages at a breakthrough boundary, including the terminal stage. */
export function weaponUpgradeBounds(weapon:BuildDraft['weapons'][number],catalog:BuildCatalog){
  const stages=catalog.weapons.find(item=>item.id===weapon.id)?.upgradeStages?.filter(stage=>weapon.level>=stage.minLevel&&weapon.level<=stage.maxLevel);
  if(!stages?.length)return null;
  return {min:Math.min(...stages.map(stage=>stage.upgrade)),max:Math.max(...stages.map(stage=>stage.upgrade))};
}

export function reconcileWeaponUpgrade(weapon:BuildDraft['weapons'][number],catalog:BuildCatalog){
  const bounds=weaponUpgradeBounds(weapon,catalog);
  if(bounds&&weapon.upgradeLevel!==undefined)weapon.upgradeLevel=Math.min(bounds.max,Math.max(bounds.min,weapon.upgradeLevel));
}
