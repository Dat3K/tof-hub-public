import type {BuildCatalog,BuildDraft} from './types';
import {detectResonance} from '../comp/state';
import {selectedWeaponElements} from '../info-sections/common/weapon-options';

export type ResonanceWeapon=Pick<BuildCatalog['weapons'][number],'id'|'weaponId'|'weapon'|'role'|'elements'|'resonances'|'elementFromResonance'|'selectableElements'>;
type ResonanceLoadout={weapons:readonly Pick<BuildDraft['weapons'][number],'id'|'element'|'stars'>[]};
type ResonanceCatalog={weapons:readonly ResonanceWeapon[]};

/** Resolve automatic weapons from the other slots without creating a circular resonance. */
export function buildWeaponElements(draft:ResonanceLoadout,catalog:ResonanceCatalog) {
  const slots=draft.weapons.map(chosen=>{
    const weapon=catalog.weapons.find(item=>item.id===chosen.id);
    const elements=!weapon?[]:weapon.selectableElements?.length&&!chosen.element?[]:selectedWeaponElements(weapon,chosen.element);
    return {weapon,elements};
  });
  return slots.map(slot=>{
    if(!slot.weapon?.elementFromResonance)return slot.elements;
    const others=slots.filter(other=>other.weapon&&!other.weapon.elementFromResonance);
    const inherited=[...new Set(others.flatMap(other=>other.elements))].filter(element=>
      others.some(other=>other.elements.includes(element)&&other.weapon?.resonances?.some(resonance=>resonance.element===element&&others.filter(source=>source.elements.includes(element)).length>=resonance.requiredWeapons)));
    // A single copied element takes its duo pair, as Nola/Lana define it (Volt → Volt-Frost); Altered stays single.
    const pair=inherited.length===1?catalog.weapons.flatMap(item=>item.selectableElements??[]).find(option=>option.id===inherited[0]&&option.elements.length===2)?.elements:undefined;
    return pair??(inherited.length?inherited:slot.weapon.elements);
  });
}
/** Catalog order is generated newest-first. Each equipped slot counts once per element. */
export function activeWeaponResonances(draft:ResonanceLoadout,catalog:ResonanceCatalog) {
  const resolved=buildWeaponElements(draft,catalog);
  const equipped=draft.weapons.flatMap((chosen,index)=>{
    const weapon=catalog.weapons.find(item=>item.id===chosen.id);
    if(!weapon)return [];
    const elements=resolved[index];
    return [{weapon,elements}];
  });
  const winners=new Map<string,NonNullable<BuildCatalog['weapons'][number]['resonances']>[number]&{weaponName:{en:string;ru:string}}>();
  for(const weapon of catalog.weapons) {
    const sources=equipped.filter(item=>item.weapon.id===weapon.id);
    for(const resonance of weapon.resonances??[]) {
      if(winners.has(resonance.element)||!sources.some(source=>source.elements.includes(resonance.element)))continue;
      if(equipped.filter(item=>item.elements.includes(resonance.element)).length<resonance.requiredWeapons)continue;
      winners.set(resonance.element,{...resonance,weaponName:weapon.weapon});
    }
  }
  return [...winners.values()];
}
/** Auto names the primary element of the newest equipped weapon with an active resonance.
 * Raw resonance table order can differ from the weapon's main/secondary element order. */
export function mainWeaponResonance(draft:ResonanceLoadout,catalog:ResonanceCatalog) {
  const active=activeWeaponResonances(draft,catalog),resolved=buildWeaponElements(draft,catalog);
  for(const weapon of catalog.weapons) {
    for(const [slot,chosen] of draft.weapons.entries()) {
      if(chosen.id!==weapon.id)continue;
      const primary=resolved[slot]?.[0];
      if(!weapon.resonances?.some(item=>item.element===primary))continue;
      const main=active.find(item=>item.element===primary);
      if(main)return main;
    }
  }
  return active[0];
}
/** Same role rule as the comp tab (2+ of one role, otherwise balance); the card shows it once two weapons are equipped. */
export function activeRoleResonance(draft:ResonanceLoadout,catalog:ResonanceCatalog & Pick<BuildCatalog,'roleResonances'>) {
  const equipped=draft.weapons.filter(chosen=>catalog.weapons.some(item=>item.id===chosen.id));
  if(equipped.length<2)return null;
  const view={weapons:catalog.weapons.map(({id,weaponId,role})=>({id,weaponId,role}))} as unknown as Parameters<typeof detectResonance>[1];
  const role=detectResonance(equipped.map(chosen=>({id:chosen.id,stars:chosen.stars,matrix:null})),view);
  return catalog.roleResonances.items.find(item=>item.id===role)??null;
}
