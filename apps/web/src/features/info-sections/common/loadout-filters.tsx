'use client';
import { type Locale } from '@tof-hub/i18n';
import {localeText} from '@/lib/i18n/text';
import {GameBadge,FilterChip,FilterGroup,type RoleVariant,type ElementVariant} from '@tof-hub/ui';
import {gameAsset} from '@tof-hub/game-assets';
import {getElementShortLabel,getPlayerRoleLabel} from '@tof-hub/game-domain';
import {ELEMENT_FILTER_OPTIONS,ROLE_FILTER_OPTIONS} from '../../simulacra/constants';
import {RELIC_PROPERTY_FILTER_OPTIONS} from '../relics/constants';
import {getRelicsStrings} from '../relics/copy';
import {getDualElementIconPath} from './element-icons';

type MultiFilter={selected:string[];onChange:(selected:string[])=>void};
export interface LoadoutFiltersProps {
  labels?:{element:string;role:string;rarity:string;property:string;all:string};
  locale:Locale;elements?:MultiFilter;roles?:MultiFilter;properties?:MultiFilter;
  quality?:{selected:string;onChange:(quality:string)=>void};
}
/** Weapon resonance filters (dps / tank / benediction): player-role terms, the healer resonance by its game name. */
const roleLabel=(role:string,locale:Locale)=>role==='dps'||role==='tank'?getPlayerRoleLabel(role,locale):role==='benediction'?(localeText(locale)('Benediction', 'Благословение')):role;
const toggle=(values:string[],value:string)=>values.includes(value)?values.filter(item=>item!==value):[...values,value];

/** Canonical loadout filter controls shared by Comp and Build pickers. */
export function LoadoutFilters({locale,elements,roles,quality,properties,labels}:LoadoutFiltersProps) {
  const t=localeText(locale);
  const relicCopy=getRelicsStrings(locale);
  return <div className="tool-panel-filters">
    {elements&&<FilterGroup label={labels?.element??t('Element','Элемент')}><FilterChip value="all" variant="all" active={!elements.selected.length} onClick={()=>elements.onChange([])}>{labels?.all??t('All')}</FilterChip>{ELEMENT_FILTER_OPTIONS.filter(option=>option.id!=='all').map(option=>{
      const id=option.id.charAt(0).toUpperCase()+option.id.slice(1),label=getElementShortLabel(id,locale);
      return <FilterChip key={id} value={id} variant={option.variant} icon={option.iconPath?gameAsset(option.iconPath):undefined} iconAlt={label} active={elements.selected.includes(id)} onClick={()=>elements.onChange(toggle(elements.selected,id))}>{label}</FilterChip>;
    })}</FilterGroup>}
    {roles&&<FilterGroup label={labels?.role??t('Role')}><FilterChip value="all" variant="all" active={!roles.selected.length} onClick={()=>roles.onChange([])}>{labels?.all??t('All')}</FilterChip>{ROLE_FILTER_OPTIONS.filter(option=>option.id!=='all').map(option=>{
      const label=roleLabel(option.id,locale);
      return <FilterChip key={option.id} value={option.id} variant={option.variant} icon={option.iconPath?gameAsset(option.iconPath):undefined} iconAlt={label} active={roles.selected.includes(option.id)} onClick={()=>roles.onChange(toggle(roles.selected,option.id))}>{label}</FilterChip>;
    })}</FilterGroup>}
    {quality&&<FilterGroup label={labels?.rarity??t('Rarity')}><FilterChip value="all" variant="all" active={quality.selected==='all'} onClick={()=>quality.onChange('all')}>{labels?.all??t('All')}</FilterChip>{(['SSR','SR'] as const).map(value=><FilterChip key={value} value={value} variant={value==='SSR'?'ssr':'sr'} active={quality.selected===value} onClick={()=>quality.onChange(value)}>{value}</FilterChip>)}</FilterGroup>}
    {properties&&<FilterGroup label={labels?.property??t('Type')}><FilterChip value="all" variant="all" active={!properties.selected.length} onClick={()=>properties.onChange([])}>{labels?.all??t('All')}</FilterChip>{RELIC_PROPERTY_FILTER_OPTIONS.filter(option=>option.id!=='all').map(option=><FilterChip key={option.id} value={option.id} variant={option.variant} icon={option.iconPath?(option.iconPath.startsWith('/')?option.iconPath:gameAsset(option.iconPath)):undefined} iconAlt={relicCopy[option.copyKey]} active={properties.selected.includes(option.id)} onClick={()=>properties.onChange(toggle(properties.selected,option.id))}>{relicCopy[option.copyKey]}</FilterChip>)}</FilterGroup>}
  </div>;
}

/** Compact, canonical badges for a weapon picker card. */
export function LoadoutBadges({elements,role,locale}:{elements:string[];role:string;locale:Locale}) {
  const primary=ELEMENT_FILTER_OPTIONS.find(option=>option.id===elements[0]?.toLowerCase());
  const roleOption=ROLE_FILTER_OPTIONS.find(option=>option.id===role);
  const elementIcon=getDualElementIconPath(elements[0],elements[1])||primary?.iconPath;
  const elementText=elements.map(element=>getElementShortLabel(element,locale)).join(' / ');
  return <>
    {primary&&<GameBadge variant={primary.variant as ElementVariant} secondaryElement={elements[1]?.toLowerCase() as ElementVariant} icon={elementIcon?<img src={gameAsset(elementIcon)} alt=""/>:undefined} presentation="icon" size="sm">{elementText}</GameBadge>}
    {roleOption&&<GameBadge variant={roleOption.variant as RoleVariant} icon={roleOption.iconPath?<img src={gameAsset(roleOption.iconPath)} alt=""/>:undefined} presentation="icon" size="sm">{roleLabel(role,locale)}</GameBadge>}
  </>;
}
