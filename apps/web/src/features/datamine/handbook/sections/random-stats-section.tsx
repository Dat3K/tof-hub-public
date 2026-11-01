'use client';
import { fillText } from '@/lib/i18n/text';

import React, { useMemo, useState } from 'react';
import type { FilterVariant } from '@tof-hub/ui';
import { slotVariant } from '@/features/build/gear-slot-chips';
import { statLabel } from '@/features/build/presentation';
import { distinctRangeQualities, slotQualityChoices, visibleStatPools } from '../handbook-domain';
import type { HandbookRandomStat, HandbookRandomStatsData, HandbookStatPool } from '../../contracts/handbook';
import { ChoiceChips, Controls, HandbookTable, ShareBar, SubTabs, useHandbookText } from './handbook-ui';
import { HandbookStatLabel, useHandbookStatPresentation } from '../handbook-stat-presentation';
import styles from './sections.module.css';

/** Display names of raw attribute qualities (ORANGE is the in-game Gold, RED the Titan item). */
export function qualityLabel(quality: string, t: (en: string, ru: string) => string) {
  const [base, tier] = quality.split('_');
  const names: Record<string, [string, string]> = {
    white: ['White', 'Белое'], green: ['Green', 'Зелёное'], blue: ['Blue', 'Синее'], purple: ['Purple', 'Фиолетовое'],
    orange: ['Gold', 'Золотое'], red: ['Titan', 'Титан'],
  };
  const pair = names[base!];
  const label = pair ? t(pair[0], pair[1]) : quality;
  return tier ? `${label} ${tier}` : label;
}

function qualityOption(quality: string, t: (en: string, ru: string) => string) {
  const base = quality.split('_')[0]!;
  const variants: Record<string, FilterVariant> = {
    white: 'final', green: 'benediction', blue: 'tank', purple: 'volt', orange: 'phys', red: 'flame',
  };
  return {
    value: quality,
    label: qualityLabel(quality, t),
    variant: variants[base],
  };
}

export function statName(stat: HandbookRandomStat | undefined, id: string, name: ReturnType<typeof useHandbookText>['name']) {
  if (!stat) return id;
  // MMO keeps tiered copies of a stat as <id>_<n>; the tier keeps their rows apart.
  const tier = id.match(/_(\d+)$/)?.[1];
  return `${name(stat.name, stat.type ?? id)}${stat.percent ? ' %' : ''}${tier ? ` · ${tier}` : ''}`;
}

export function RandomStatsSection({ data }: { data: HandbookRandomStatsData }) {
  const { compareStats } = useHandbookStatPresentation();
  const { t, name, num, pct, locale } = useHandbookText();
  const { mode, slotNames, slotIcons, itemNames } = data;
  const rangeQualities = useMemo(() => distinctRangeQualities(mode), [mode]);
  const value = (stat: HandbookRandomStat, amount: number | undefined) =>
    amount === undefined ? '—' : stat.percent ? pct(amount) : num(Math.round(amount * 10) / 10);

  const [rangeQuality, setRangeQuality] = useState(mode.qualities.includes('orange') ? 'orange' : mode.qualities[0]!);
  const slotIds = Object.keys(slotNames).filter((id) => mode.slots[id]);
  const slotTone = (id: string) => slotVariant(Object.values(mode.slots[id] ?? {}).flatMap((pools) =>
    pools.flatMap((entry) => entry.weights.map((weight) => mode.stats[weight.stat]?.type ?? ''))));
  const [slot, setSlot] = useState(slotIds[0] ?? '');
  const slotQualities = useMemo(() => slotQualityChoices(mode, slot), [mode, slot]);
  const [poolQuality, setPoolQuality] = useState('orange');
  const quality = slotQualities.includes(poolQuality) ? poolQuality : slotQualities[0] ?? '';
  const pools = visibleStatPools(mode.slots[slot]?.[quality] ?? [], slotTone(slot) === 'function');
  const [poolId, setPoolId] = useState('');
  const pool = pools.find((p) => p.pool === poolId) ?? pools.find((p) => p.selection.category === 'standard') ?? pools[0];

  const statRows = useMemo(
    () => Object.entries(mode.stats).filter(([, stat]) => stat.ranges[rangeQuality]).sort(([a, aStat], [b, bStat]) =>
      Number(Boolean(aStat.unreleased)) - Number(Boolean(bStat.unreleased)) || compareStats(a, b)),
    [mode.stats, rangeQuality, compareStats]
  );
  const totals = mode.rollsForTotals;
  const maxChance = Math.max(0, ...(pool?.weights.map((w) => w.chance) ?? []));
  const poolLabel = (pool: HandbookStatPool) => {
    if (pool.presentation) return `${name(pool.presentation.name)} ${name(pool.presentation.variant)}`;
    const names = [...new Set(pool.items.map((id) => name(itemNames[id], id)))].slice(0, 2);
    return names.join(', ');
  };
  const sourceLabel = (source: HandbookStatPool['origins'][number]) => source.presentation
    ? `${name(source.presentation.name)} ${name(source.presentation.variant)}` : name(source.name);
  const originSources = (pool: HandbookStatPool) => {
    const containers = pool.origins.filter((source) => source.kind === 'container');
    const sources = containers.length ? containers : pool.origins;
    return [...new Map(sources.map((source) => [sourceLabel(source), source])).values()];
  };
  const originLabel = (pool: HandbookStatPool) => {
    const names = originSources(pool).map(sourceLabel).filter(Boolean);
    return names.length ? names.join(' / ') : t('Source unconfirmed', 'Источник не подтверждён');
  };
  const poolGroups = (['standard', 'promo', 'premium'] as const).map((category) => {
    const groups = new Map<string, HandbookStatPool[]>();
    for (const entry of [...pools].filter((p) => p.selection.category === category).sort((a, b) =>
      Number(Boolean(a.selection.variant)) - Number(Boolean(b.selection.variant)) || a.selection.order - b.selection.order)) {
      const key = entry.selection.variant?.variant.en ?? entry.pool;
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return {category, groups: [...groups.values()]};
  });
  const selectedVariants = pools.filter((entry) => pool && entry.selection.category === pool.selection.category &&
    entry.selection.variant?.variant.en === pool.selection.variant?.variant.en);
  const categoryLabels = {standard: t('Standard', 'Обычная'), promo: t('Promo', 'Промо'),
    premium: slotTone(slot) === 'function' ? '100 USD' : '50 USD'};

  const ranges = (
    <>
      <Controls>
        <ChoiceChips label={t('Quality', 'Качество')} value={rangeQuality} onChange={setRangeQuality}
          options={rangeQualities.map((q) => qualityOption(q, t))} />
      </Controls>
      <HandbookTable
        compact="dense"
        caption={t('Stat ranges', 'Диапазоны статов')}
        columns={[
          { label: t('Stat', 'Стат') },
          { label: t('Base value', 'База') },
          { label: t('Min. roll', 'Мин. прок') },
          { label: t('Max. roll', 'Макс. прок') },
          ...(totals ? [{ label: fillText(t('Avg. at {0} rolls', 'Среднее за {0}'), [totals]) }, { label: fillText(t('Max. at {0} rolls', 'Максимум за {0}'), [totals]) }] : []),
        ]}
        rows={statRows.map(([id, stat]) => {
          const range = stat.ranges[rangeQuality]!;
          return {
            key: id,
            cells: [<HandbookStatLabel key="s" type={id} icon={stat.icon} alert={stat.unreleased}
              label={stat.unreleased ? <>{statName(stat, id, name)} <span className={styles.unavailable}>({t('unavailable', 'недоступен')})</span></> : statName(stat, id, name)}
              hint={stat.unreleased ? t('This exact random-stat row is not available from the exported gear pools. Base attributes and other variants may still be used.', 'Эта строка случайного стата недоступна в экспортированных пулах экипировки. Базовая характеристика и другие варианты могут использоваться.') : undefined} />, value(stat, range.base), value(stat, range.min), value(stat, range.max),
              ...(totals ? [value(stat, range.average), value(stat, range.maximum)] : [])],
          };
        })}
      />
    </>
  );
  const chances = (
    <>
      <div className={styles.block}>
        <ChoiceChips label={t('Slot', 'Слот')} value={slot} onChange={(id) => { setSlot(id); setPoolId(''); }}
          options={slotIds.map((id) => ({ value: id, label: name(slotNames[id], id), icon: slotIcons[id]?.normal,
            variant: slotTone(id),
          }))} />
        <ChoiceChips label={t('Quality', 'Качество')} value={quality} onChange={(q) => { setPoolQuality(q); setPoolId(''); }}
          options={slotQualities.map((q) => qualityOption(q, t))} />
      </div>
      <div className={`${styles.block} ${styles.poolChoices}`}>
        <div className={styles.poolCategoryRow}>
        {poolGroups.filter((group) => group.groups.length).map(({category, groups}) => (
          <ChoiceChips key={category} label={categoryLabels[category]} role="button"
            value={groups.find((entries) => entries.some((entry) => entry.pool === pool?.pool))?.[0]?.pool ?? ''}
            onChange={setPoolId}
            options={groups.map((entries) => {
              const entry = entries[0]!;
              const variant = entry.selection.variant;
              return {value: entry.pool, label: variant ? name(variant.variant)
                : groups.length === 1 || groups.some((group) => group[0]?.selection.variant) ? t('Standard', 'Обычная') : poolLabel(entry),
              icon: variant?.icon, variant: variant?.element.toLowerCase() as FilterVariant | undefined, title: originLabel(entry)};
            })} />
        ))}
        </div>
        {pool?.selection.category === 'premium' && selectedVariants.length > 1 && (
          <ChoiceChips label={t('Guaranteed stats', 'Гарантированные статы')} role="button" value={pool.pool} onChange={setPoolId}
            options={selectedVariants.map((entry) => ({value: entry.pool,
              title: entry.selection.guaranteedStats.map((id) => statName(mode.stats[id], id, name)).join(' + '),
              label: <span className={styles.statCombination}>{entry.selection.guaranteedStats.map((id, index) => {
                const stat = mode.stats[id];
                const type = stat?.type?.replace(/^(Physical|Frost|Flame|Volt|Altered)\s+/, '');
                const short = type ? statLabel(type, locale).replace(/\s+%/g, '%') : statName(stat, id, name);
                return <React.Fragment key={id}>{index > 0 && <span>+</span>}<HandbookStatLabel size="sm" type={stat?.type} icon={stat?.icon} label={short} /></React.Fragment>;
              })}</span>}))} />
        )}
      </div>
      {pool && (
        <>
          <HandbookTable
            compact="dense"
            caption={t('Stat chances', 'Шансы статов')}
            columns={[{ label: t('Stat', 'Стат'), width: 260 }, { label: t('Weight', 'Вес'), width: 140 },
              { label: t('One draw', 'Один выбор'), width: 210 }, {label: t('On item', 'Есть на вещи'), width: 210}, {label: t('Without stat', 'Нет на вещи'), width: 150}]}
            rows={[...pool.weights].sort((a, b) => b.chance - a.chance || compareStats(a.stat, b.stat)).map((w) => ({
              key: w.stat,
              cells: [<HandbookStatLabel key="s" type={w.stat} icon={mode.stats[w.stat]?.icon} label={statName(mode.stats[w.stat], w.stat, name)} />, w.weight === -1 ? t('Guaranteed', 'Гарантированно') : num(w.weight),
                <ShareBar key="bar" value={w.chance} max={maxChance} label={pct(w.chance)} />,
                w.onItemChance === null ? '—' : <ShareBar key="item" value={w.onItemChance} label={pct(w.onItemChance)} />,
                w.withoutStatChance === null ? '—' : pct(w.withoutStatChance)],
            }))}
          />
        </>
      )}
    </>
  );
  return (
    <SubTabs label={t('Gear stats', 'Статы гира')} tabs={[
      { id: 'ranges', label: t('Stat ranges', 'Диапазоны статов'), content: ranges,
        note: totals
          ? fillText(t('Each upgrade adds one roll. Totals include the base value and {0} rolls.', 'Каждое улучшение добавляет один прок. Итоги включают базовое значение и {0} проков.'), [totals])
          : t('Each upgrade adds one roll to the base value.', 'Каждое улучшение добавляет один прок к базовому значению.'),
      },
      { id: 'chances', label: t('Chances by slot', 'Шансы по слотам'), content: chances,
        note: mode.itemChanceModel ? fillText(t('Model: {0} stats without repeats; guaranteed stats fill slots first.', 'Модель: {0} стата без повторов; гарантированные занимают места первыми.'), [mode.itemChanceModel.statCount]) : undefined,
      },
    ]} />
  );
}
