'use client';

import type {ReactNode} from 'react';
import {gameAsset} from '@tof-hub/game-assets';
import oow from '../oow/oow.module.css';
import styles from './enemy-combat-details.module.css';

export type EnemyKind = 'boss' | 'elite' | 'normal';
export type CombatStatTone = 'hp' | 'atk' | 'armor' | 'crit';
export type CombatStatIcons = Partial<Record<CombatStatTone, string>>;

/** Encounter adapters provide values and units; these components only present them. */
export function EnemyCombatStatIcon({src, tone, size = 'normal'}: {src?: string; tone: string; size?: 'normal' | 'small'}) {
  return src ? <img className={oow.combatStatIcon} data-tone={tone} data-size={size}
    src={src.startsWith('/datamine/shared/assets/') ? src : gameAsset(src)} alt="" /> : null;
}

export function EnemyStatBadges({items, icons}: {items: {tone: Exclude<CombatStatTone, 'hp'>; text: ReactNode}[]; icons?: CombatStatIcons}) {
  return <div className={oow.mobStatsLine}>{items.map((item, index) => <span key={item.tone} className={oow.mobStatItem}>
    {index > 0 && <span className={oow.mobStatSep}>·</span>}
    <span className={oow.mobStatValue}><EnemyCombatStatIcon src={icons?.[item.tone]} tone={item.tone} size="small" />{item.text}</span>
  </span>)}</div>;
}

export function EnemyHealthSummary({label, value, unit, icon, children}: {label: string; value: ReactNode; unit?: string; icon?: string; children?: ReactNode}) {
  return <div className={oow.mobHpCol}>
    <div className={oow.mobHpLabel}><EnemyCombatStatIcon src={icon} tone="hp" size="small" />{label}</div>
    <div className={oow.mobEhpVal}>{value}{unit && <span className={styles.healthUnit}>{unit}</span>}</div>
    {children && <div className={oow.mobHpVal}>{children}</div>}
  </div>;
}

export interface EnemySummaryStat {
  label: string;
  value: ReactNode;
  tone?: 'hp' | 'effective' | 'resistance';
}

export function EnemyDetailsHeader({name, titleId, kind, kindLabel, portrait, badges, context, stats, onClose, closeLabel}: {
  name: string; titleId?: string; kind: EnemyKind; kindLabel: string; portrait: ReactNode; badges?: ReactNode;
  context?: ReactNode; stats: EnemySummaryStat[]; onClose: () => void; closeLabel: string;
}) {
  return <div className={`${oow.modalHeader} ${oow[kind === 'boss' ? 'modalHeaderBoss' : kind === 'elite' ? 'modalHeaderElite' : 'modalHeaderNormal']} ${styles.header}`}>
    {portrait}
    <div className={styles.identity}>
      <div className={styles.titleRow}><h2 id={titleId} className={styles.title}>{name}</h2>
        <span className={styles.kind} data-kind={kind}>{kindLabel}</span>{badges}</div>
      {context && <div className={styles.context}>{context}</div>}
      <div className={styles.summary}>{stats.map(stat => <div key={stat.label} className={styles.summaryStat} data-tone={stat.tone}>
        <div className={styles.summaryLabel}>{stat.label}</div><div className={styles.summaryValue}>{stat.value}</div>
      </div>)}</div>
    </div>
    <button type="button" className={`${oow.modalCloseBtn} ${styles.close}`} onClick={onClose} aria-label={closeLabel}>✕</button>
  </div>;
}

export interface EnemyPrimaryStat {
  label: string; value: ReactNode; sub?: ReactNode; tone: CombatStatTone; icon?: string;
}

export function EnemyPrimaryStats({heading, stats}: {heading: string; stats: EnemyPrimaryStat[]}) {
  return <>
    <div className={styles.sectionHeading}>{heading}</div>
    <div className={`${oow.primaryStatsGrid} ${styles.primaryGrid}`}>{stats.map(stat => <div key={stat.label} className={`${oow.primaryStatCard} ${oow[`primaryStat${stat.tone}`]} ${styles.primaryCard}`}>
      <div className={oow.primaryStatIcon}><EnemyCombatStatIcon src={stat.icon} tone={stat.tone} /></div>
      <div className={oow.primaryStatCopy}><div className={oow.primaryStatLabel}>{stat.label}</div>
        <div className={oow.primaryStatValue}>{stat.value}</div>{stat.sub && <div className={oow.primaryStatSub}>{stat.sub}</div>}</div>
    </div>)}</div>
  </>;
}

export interface EnemyElementStat {name: string; element: string; icon: string; value: ReactNode; sub?: ReactNode}

export function EnemyElementStats({heading, context, stats}: {heading: string; context?: string; stats: EnemyElementStat[]}) {
  return <>
    <div className={styles.elementHeading}><span>{heading}</span>{context && <small>{context}</small>}</div>
    <div className={`${oow.elementalGrid} ${styles.elements}`}>{stats.map(element => <div key={element.name} className={oow.elementCard}>
      <img className={`${oow.elementIcon} resistance-icon`} data-resistance-element={element.element} src={gameAsset(element.icon)} alt="" />
      <div className={oow.elementName}>{element.name}</div><div className={oow.elementResistance}>{element.value}</div>
      {element.sub && <div className={oow.elementDefense}>{element.sub}</div>}
    </div>)}</div>
  </>;
}
