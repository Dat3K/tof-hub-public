'use client';
import { localized } from '@tof-hub/i18n';
import {localeText} from '@/lib/i18n/text';
import {PLAYER_ROLE_LABELS} from '@tof-hub/game-domain';
import {BuildTooltip as Tooltip} from './build-inspection';
import {IconPick} from './build-fields';
import {useBuildEditing} from './build-editing';
import {buildRole,rollValueElement,supportRoleElement} from './model';
import {elementLabel} from './presentation';
import {activeWeaponResonances} from './weapon-resonances';
import type {BuildCatalog,BuildDraft,BuildLocale} from './types';
import styles from './build.module.css';

// Editorial short role names; the game names stay in the role resonance catalog.
const ROLE_LABELS=PLAYER_ROLE_LABELS;

/**
 * Header "role / selected element". The model resolves role weights and weapon-pair inheritance
 * independently of the short element label.
 */
export function BuildFocus({draft,catalog,locale}:{draft:BuildDraft;catalog:BuildCatalog;locale:BuildLocale}) {
  const {change}=useBuildEditing();
  const t=localeText(locale);
  // Every build starts as DPS; the weapon resonance never picks the role.
  // Balance is a DPS build: it is not offered as a role (its resonance stays), and an old choice shows as DPS.
  const role=catalog.roleResonances.items.find(item=>item.id===buildRole(draft));
  // An empty card has no strongest element; show a dash until ATK or a manual choice exists.
  const element=rollValueElement(draft,catalog);
  // A tank is rated by resistance: the element choice shows the resistance icons.
  const tank=buildRole(draft)==='tank';
  const iconOf=(id:string)=>(tank?catalog.resistanceIcons[id]?.icon:undefined)??catalog.elementIcons[id]?.icon;
  const elementIcon=element?iconOf(element):undefined;
  const roleText=<span className="build-role">{role&&<img src={role.icon} alt=""/>}{role?localized(ROLE_LABELS[role.id], locale):'—'}</span>;
  // Tank icons take the resistance colours of the stat table (data-resistance-element / data-tank-icons in build.module.css).
  // Name the selected element in the header; rollValueContext still resolves the weapon pair for calculations.
  const elementText=<span className="build-element">{elementIcon&&<img src={elementIcon} alt="" data-resistance-element={tank?element:undefined}/>}{element?elementLabel(element,locale):'—'}</span>;
  const supportAuto=!draft.rv?.element&&supportRoleElement(draft,catalog)!=='';
  const autoElementLabel=supportAuto?{en:'Auto · newest role weapon',ru:'Авто · новейшее оружие роли'}
    :activeWeaponResonances(draft,catalog).length?{en:'Auto · build resonance',ru:'Авто · резонанс билда'}
    :{en:'Auto · highest ATK',ru:'Авто · наибольшая АТК'};
  const separator=<span className="build-focus-separator">/</span>;
  // Both parts are direct choices in every mode; the card editor ignores clicks inside (data-build-edit-skip).
  if(!change)return <div className={`build-title ${styles.buildTitle}`} data-tank-icons={tank||undefined}>{roleText}{separator}{elementText}</div>;
  const roles=catalog.roleResonances.items.filter(item=>item.id!=='balance').map(item=>({id:item.id,icon:item.icon,name:{en:ROLE_LABELS[item.id].en,ru:ROLE_LABELS[item.id].ru}}));
  const elements=Object.keys(catalog.elementIcons).map(id=>({id,icon:iconOf(id)!,name:{en:elementLabel(id,'en'),ru:elementLabel(id,'ru')}}));
  const help=t('Edit the role or element to change the gear calculation category.');
  return <div className={`build-title build-focus ${styles.buildTitle}`} data-build-edit-skip data-tank-icons={tank||undefined} data-rv-element={element||undefined} data-rv-element-source={draft.rv?.element?'manual':'auto'} data-role-source={draft.profile.role?'manual':'auto'}>
    <Tooltip content={help} placement="bottom" portal><IconPick hint={false} inline label={t('Build role')} value={buildRole(draft)} items={roles} locale={locale}
      emptyLabel={{en:'DPS · default',ru:'ДД · по умолчанию'}} display={roleText}
      onChange={id=>change(d=>{d.profile.role=id;})}/></Tooltip>
    {separator}
    <Tooltip content={help} placement="bottom" portal><IconPick hint={false} inline label={t('GRV / PRV element')} value={draft.rv?.element||''} items={elements} locale={locale}
      emptyLabel={autoElementLabel} display={elementText}
      onChange={id=>change(d=>{d.rv??={element:'',includeCrit:true};d.rv.element=id;})}/></Tooltip>
  </div>;
}
