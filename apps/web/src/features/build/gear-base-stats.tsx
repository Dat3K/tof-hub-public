import type {ReactNode} from 'react';
import {BonusEffects,BonusValue} from './stat-bonuses';
import {formatValue,statIcon,statLabel} from './presentation';
import type {BuildCatalog,BuildLocale,GearBaseStat} from './types';
import {localeText} from '@/lib/i18n/text';
import styles from './build.module.css';

export function GearStatSection({title,children}:{title:string;children:ReactNode}) {
  return <section className={styles.gearInspectionSection}><h3>{title}</h3>{children}</section>;
}

/** Game base / enhancement / unlocked sections. Callers supply the item's generated progression values. */
export function GearBaseStats({stats,catalog,locale,combatScore,emptyLabel='—',footer}:{
  stats:readonly GearBaseStat[];catalog:Pick<BuildCatalog,'statTypeIcons'|'displayIcons'>;locale:BuildLocale;
  combatScore?:number|null;emptyLabel?:string;footer?:ReactNode;
}) {
  const t=localeText(locale),fmt=(value:number)=>formatValue(value,false,locale);
  const visible=stats.filter(stat=>stat.base+stat.enhancement+stat.unlocked>0);
  const effects=visible.filter(stat=>stat.base+stat.enhancement>0).map(stat=>({id:stat.label,icon:statIcon(stat.label,catalog),label:statLabel(stat.label,locale),
    value:<BonusValue tone="neutral">+{fmt(stat.base)} <span className={styles.gearEnhancement}>+{fmt(stat.enhancement)}</span></BonusValue>}));
  const unlocked=visible.filter(stat=>stat.unlocked>0).map(stat=>({id:stat.label,icon:statIcon(stat.label,catalog),label:statLabel(stat.label,locale),value:<BonusValue tone="neutral">+{fmt(stat.unlocked)}</BonusValue>}));
  return <div className={`${styles.itemEffects} ${styles.gearBaseEffects}`}>
    {combatScore!==undefined&&<div className={styles.gearCSLine} data-gear-cs><span>{t('CS')}</span><b>{combatScore===null?'—':'= '+fmt(combatScore)}</b></div>}
    <GearStatSection title={t('Base Stats')}>{effects.length?<BonusEffects density="compact" effects={effects}/>:<div>{emptyLabel}</div>}</GearStatSection>
    {unlocked.length>0&&<GearStatSection title={t('Enhancement Unlocked')}><BonusEffects density="compact" effects={unlocked}/></GearStatSection>}
    {footer}
  </div>;
}
