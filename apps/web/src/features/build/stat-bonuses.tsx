import { localeText } from '@/lib/i18n/text';

import type {ReactNode} from 'react';
import {GameRichText} from '@tof-hub/ui';
import styles from './build.module.css';
import {formatValue} from './presentation';
import type {BuildCatalog,BuildLocale} from './types';
import type {AttackPercentContribution} from './model';
export function attackPercentBonusText(bonuses:AttackPercentContribution[],locale:BuildLocale) {
  return bonuses.map(b=>`${localeText(locale)('ATK%')}: +${formatValue(b.value,true,locale,1)}${b.maxStacks?` ×${b.maxStacks}`:''}${b.conditional?(localeText(locale)(' (conditional)', ' (условно)')):''}`).join(' · ');
}
export function enhancementBonusText(stats:{id:string;value:number}[],locale:BuildLocale,layout:'row'|'column'='row') {
  const labels:Record<string,string>={attack:localeText(locale)('ATK'),hp:localeText(locale)('HP'),crit:localeText(locale)('Crit'),resistance:localeText(locale)('Resistance', 'Сопротивление')};
  return stats.filter(s=>s.value>0).map(s=>`${labels[s.id]??s.id}: +${formatValue(s.value,false,locale)}`).join(layout==='column'?'\n':' · ');
}
export function EnhancementBonuses({stats,catalog,locale}:{stats:{id:string;value:number}[];catalog:BuildCatalog;locale:BuildLocale}) {
  const labels:Record<string,string>={attack:localeText(locale)('ATK'),hp:localeText(locale)('HP'),crit:localeText(locale)('Crit'),resistance:localeText(locale)('Resistance', 'Сопротивление')};
  return <BonusEffects effects={stats.map(s=>({id:s.id,icon:catalog.displayIcons[s.id as 'attack'|'hp'|'crit'|'resistance']?.icon,label:labels[s.id]??s.id,value:<BonusValue tone="neutral">+{formatValue(s.value,false,locale)}</BonusValue>}))}/>;
}
export function BonusEffects({effects,density='default'}:{effects:{id:string;icon?:string;label:string;value:ReactNode}[];density?:'default'|'compact'}) {
  return <div className={[styles.computingEffects,density==='compact'?styles.compactEffects:''].filter(Boolean).join(' ')}>{effects.map(effect=><div key={effect.id}><strong>{effect.icon&&<img className={styles.computingEffectIcon} src={effect.icon} alt=""/>}{effect.label}:</strong>{typeof effect.value==='string'?<GameRichText text={effect.value}/>:effect.value}</div>)}</div>;
}
/** Numeric compositions use the same emphasis as numbers in GameRichText. */
export function BonusValue({children,tone='accent'}:{children:ReactNode;tone?:'accent'|'neutral'|'positive'|'roll'}) {
  return <span className={styles.bonusValue} data-tone={tone}>{children}</span>;
}
