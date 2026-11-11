import type { ReactNode } from 'react';
import { titanStatsByLevel, type TitanLevels, type TitanStat } from './model';
import type { TitanStatHints } from './titan-stat-hints';
import styles from './titan-calculator.module.css';

interface StatInfo { name: string; icon?: string }
export type TitanStatInfo = Record<TitanStat, StatInfo>;

export function TitanStatLabel({info, level, name = info.name, hint, focusable, compact = false}: {
  info: StatInfo; level?: number; name?: string; hint?: string; focusable?: boolean; compact?: boolean;
}) {
  const iconLabel = compact && info.icon && level !== undefined;
  return <span className={styles.statLabel} data-hint={hint} tabIndex={hint&&focusable?0:undefined} title={iconLabel ? name : undefined}>
    {info.icon && <img src={info.icon} alt="" width={14} height={14}/>}
    <span><span className={iconLabel ? 'sr-only' : undefined}>{name} </span>{level !== undefined && <strong>+{level}</strong>}</span>
  </span>;
}

export function TitanLevelSet({levels, stats, hints, children, compact = false}: {
  levels: TitanLevels; stats: TitanStatInfo; hints?: TitanStatHints; children?: ReactNode; compact?: boolean;
}) {
  const active=titanStatsByLevel(levels).filter(stat=>levels[stat]>0);
  return <span className={styles.levelSet} data-compact={compact || undefined}>
    {active.length?active.map(stat=><TitanStatLabel key={stat} info={stats[stat]} level={levels[stat]} hint={hints?.(stat)} compact={compact}/>):'—'}
    {children}
  </span>;
}

export function TitanWornSet({title,levels,stats,hints}: {title:string; levels:TitanLevels; stats:TitanStatInfo; hints?:TitanStatHints}) {
  return <div className={styles.wornSet}><b>{title}</b><TitanLevelSet levels={levels} stats={stats} hints={hints}/></div>;
}

export function TitanRankResult({value, choice}: {value: string; choice?: string}) {
  return <span className={styles.rankMeta}>
    <b className={styles.rankResult}>{value}</b>
    {choice && <span className={styles.rankChoice}>{choice}</span>}
  </span>;
}
