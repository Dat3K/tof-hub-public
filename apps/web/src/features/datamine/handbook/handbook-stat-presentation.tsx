'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type { HandbookSectionsData, Localized } from '../contracts/handbook';
import { GameRichText, Tooltip } from '@tof-hub/ui';
import { IconLabel, useHandbookText } from './sections/handbook-ui';
import styles from './sections/sections.module.css';

type StatPresentation = {order: number; name?: Localized | null; icon?: string | null; type?: string | null; description?: Localized | null; accent?: React.ComponentProps<typeof IconLabel>['accent']};

function mmoAccent(id: string): StatPresentation['accent'] {
  const base = id.replace(/_\d+$/, '');
  if (/Heal|Restore|Vampirism/.test(base)) return 'green';
  if (/SuperArmor|DefenseIntensity/.test(base)) return 'violet';
  if (/Ignore|ApproachingSpeed/.test(base)) return 'cyan';
  if (/Crit|Atk|AttackPower|WildAnimal|HumanoidMonster|MechanicalMonster/.test(base)) return 'gold';
  return undefined;
}

function presentation(data: HandbookSectionsData) {
  const stats = new Map<string, StatPresentation>();
  const order = new Map((data['random-stats']?.statOrder ?? []).map((type, index) => [type, index]));
  for (const [id, stat] of Object.entries(data['random-stats']?.mode.stats ?? {})) {
    const entry = { order: order.get(stat.type ?? id) ?? order.size + stats.size, name: stat.name, icon: stat.icon, type: stat.type,
      description: stat.description, accent: stat.description !== undefined ? mmoAccent(id) : undefined };
    stats.set(id, entry);
    if (stat.type && !stats.has(stat.type)) stats.set(stat.type, entry);
  }
  for (const [id, stat] of Object.entries(data['random-stats']?.statPresentation ?? {})) {
    if (stats.has(id)) continue;
    const entry = {order: order.get(stat.type ?? id) ?? order.size + stats.size, name: stat.name, icon: stat.icon, type: stat.type};
    stats.set(id, entry);
    if (stat.type && !stats.has(stat.type)) stats.set(stat.type, entry);
  }
  const titan = new Map((data.titan?.rareValues ?? []).map((stat, order) => [stat.id, { order, icon: stat.icon }]));
  const compare = (map: typeof stats) => (a: string, b: string) =>
    (map.get(a)?.order ?? Number.MAX_SAFE_INTEGER) - (map.get(b)?.order ?? Number.MAX_SAFE_INTEGER);
  return { stats, titan, compareStats: compare(stats), compareTitan: compare(titan) };
}

const Context = createContext(presentation({}));

/** Gear stats defines ordinary presentation; Titan Property values defines rare properties. */
export function HandbookStatPresentation({ data, children }: { data: HandbookSectionsData; children: React.ReactNode }) {
  const value = useMemo(() => presentation(data), [data]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useHandbookStatPresentation = () => useContext(Context);

export function HandbookStatLabel({ type, kind = 'stat', fallbackTone = 'stat', ...props }: Omit<React.ComponentProps<typeof IconLabel>, 'tone' | 'statType'> & {
  type?: string | null; kind?: 'stat' | 'titan'; fallbackTone?: 'stat' | 'color';
}) {
  const data = useHandbookStatPresentation();
  const {name} = useHandbookText();
  const canonical = type ? (kind === 'titan' ? data.titan : data.stats).get(type) : undefined;
  const stat = kind === 'stat' && type ? data.stats.get(type) : undefined;
  const label = <IconLabel {...props} icon={canonical?.icon ?? props.icon} accent={stat?.accent ?? props.accent}
    tone={kind === 'titan' ? 'red' : canonical?.icon ? 'stat' : fallbackTone} statType={stat?.type ?? type ?? undefined} />;
  const description = name(stat?.description);
  return description ? <Tooltip portal content={<div className={styles.propertyDescription}><strong>{props.label}</strong>
    <GameRichText density="compact" text={description.replace(/\{\d+\}/g, '<blue>{value}</blue>')} /></div>}>
    <span tabIndex={0} className={styles.statDescriptionTrigger}>{label}</span>
  </Tooltip> : label;
}
