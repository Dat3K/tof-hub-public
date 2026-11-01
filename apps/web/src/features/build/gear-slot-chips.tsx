import {FilterChip,FilterGroup,type FilterVariant} from '@tof-hub/ui';
import type {BuildLocale,GearCatalogItem} from './types';
import styles from './gear-slot-chips.module.css';

/**
 * Slot chip colour from the slot's generated stat pool (build-page.json gear[].allowedStats): pools with ATK % / DMG %
 * stats (the four advanced slots) amber, pools with Crit red, the rest (defensive pools) green (blue is reserved for All).
 */
export function slotVariant(allowedStats:readonly string[]):FilterVariant {
  if(allowedStats.some(type=>type.endsWith('Attack %')||type.endsWith('Damage %')))return 'function';
  return allowedStats.includes('Crit')?'attack':'assist';
}

/** "Slot: All · Helmet · …" filter chips with the slot icons. Tools · Ranking gear board and the Optimizer inventory. */
export function GearSlotChips({gear,value,onChange,label,allLabel,locale}:{gear:readonly Pick<GearCatalogItem,'id'|'icon'|'name'|'allowedStats'>[];value:string|null;onChange:(slot:string|null)=>void;label:string;allLabel:string;locale:BuildLocale}) {
  return <div className={styles.slotChips}><FilterGroup label={label}>
    <FilterChip value="all" variant="all" active={!value} onClick={()=>onChange(null)}>{allLabel}</FilterChip>
    {gear.map(item=><FilterChip key={item.id} value={item.id} variant={slotVariant(item.allowedStats)} icon={item.icon} iconAlt={item.name[locale]} active={value===item.id} onClick={()=>onChange(item.id)}>{item.name[locale]}</FilterChip>)}
  </FilterGroup></div>;
}
