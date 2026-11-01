export interface WeaponSkillChoice {
  id:string;name:{en:string;ru:string};icon:string;description:{en:string;ru:string};
}
export interface WeaponOptions {
  elementFromResonance?:boolean;
  selectableElements?:{id:string;elements:string[]}[];
  selectableSkills?:WeaponSkillChoice[];
  selectableModes?:WeaponSkillChoice[];
  resonances?: (WeaponSkillChoice&{element:string;requiredWeapons:number;/** ATK% as a fraction, from the resonance skill (pipeline). */ attackPercent?:number;/** RES% of the element, as a fraction (pipeline). */ resistancePercent?:number})[];
}
export interface WeaponOptionsCatalog {weapons:Record<string,WeaponOptions>}
export function selectedWeaponElements(weapon:WeaponOptions&{elements:string[]},selection?:string) {
  return weapon.selectableElements?.find(option=>option.id===selection)?.elements??weapon.elements;
}
export function setWeaponSkill(skills:string[]|undefined,index:number,id:string):string[] {
  const next=[...(skills??['',''])];
  // The same Scatter Technique cannot occupy both slots.
  if(id&&next[1-index]===id)next[1-index]='';
  next[index]=id;
  return next;
}
