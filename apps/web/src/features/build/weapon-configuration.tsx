'use client';
import { localeText } from '@/lib/i18n/text';
import {Field} from './build-fields';
import {elementLabel} from './presentation';
import type {BuildCatalog,BuildDraft,BuildLocale} from './types';
import type {BuildChange} from './build-editor';
import {WeaponSkillChoices} from '../info-sections/common/weapon-skill-choices';
import {setWeaponSkill} from '../info-sections/common/weapon-options';
export function WeaponConfiguration({draft,catalog,index,locale,change}:{draft:BuildDraft;catalog:BuildCatalog;index:number;locale:BuildLocale;change:BuildChange}) {
  const chosen=draft.weapons[index],weapon=catalog.weapons.find(item=>item.id===chosen.id);
  return <>
    {!!weapon?.selectableElements?.length&&<Field label={localeText(locale)('Weapon element', 'Элемент оружия')}><select value={chosen.element??''} onChange={event=>change(d=>{d.weapons[index].element=event.target.value||undefined;})}><option value="">{localeText(locale)('Unspecified', 'Не указан')}</option>{weapon.selectableElements.map(option=><option key={option.id} value={option.id}>{option.elements.map(element=>elementLabel(element,locale)).join(' / ')}</option>)}</select></Field>}
    {!!weapon?.selectableSkills?.length&&<WeaponSkillChoices options={weapon.selectableSkills} value={chosen.skills} locale={locale} onChange={(slot,id)=>change(d=>{d.weapons[index].skills=setWeaponSkill(d.weapons[index].skills,slot,id);})}/>}
    {!!weapon?.selectableModes?.length&&<WeaponSkillChoices kind="mode" options={weapon.selectableModes} value={[chosen.mode??'']} locale={locale} onChange={(_,id)=>change(d=>{d.weapons[index].mode=id||undefined;})}/>}
  </>;
}
