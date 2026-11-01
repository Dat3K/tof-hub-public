'use client';
import { fillText } from '@/lib/i18n/text';

import React, { useMemo, useState } from 'react';
import { GameRichText, Tooltip } from '@tof-hub/ui';
import { slotVariant } from '@/features/build/gear-slot-chips';
import type { HandbookTitanData } from '../../contracts/handbook';
import { curveValue, rateRuns } from '../handbook-domain';
import { ChoiceChips, Controls, HandbookTable, RangeField, SubHeading, SubTabs, useHandbookText } from './handbook-ui';
import { HandbookStatLabel, useHandbookStatPresentation } from '../handbook-stat-presentation';
import styles from './sections.module.css';

// Player-facing explanations follow Tools Build's Titan maximum / pull-up model.
const GROWTH_RULES: Record<string, { label: [string, string]; hint: [string, string] }> = {
  SELF: {
    label: ['Independent growth', 'Собственный рост'],
    hint: ['This stat grows on its own. A stronger stat of another element on the same item does not pull it up.', 'Стат растёт самостоятельно. Более сильный стат другой стихии на этой вещи не подтягивает его вверх.'],
  },
  SAMETYPEMAXVALUE: {
    label: ['Element pull-up', 'Подтягивание стихии'],
    hint: ['A weaker elemental ATK on the same item can be pulled up from the strongest elemental ATK before Titan. If its own growth gives a higher result, that result is kept.', 'Более слабая стихийная АТК на той же вещи может подтянуться от самой сильной стихийной АТК до Titan. Если собственный рост даёт больше, сохраняется собственный результат.'],
  },
  INHERIT: {
    label: ['Element pull-up', 'Подтягивание стихии'],
    hint: ['A weaker elemental percentage can be pulled up from the strongest in its group on the same item. ATK% and DMG% are compared separately. Pull-up can improve the result, never lower it.', 'Более слабый процент стихии может подтянуться от сильнейшего в своей группе на той же вещи. АТК% и урон% сравниваются отдельно. Подтягивание может улучшить результат, но не уменьшить его.'],
  },
  COEFFICIENT: {
    label: ['From its own value', 'От своего значения'],
    hint: ['The bonus scales with this stat’s value before Titan. Better original rolls give it a higher Titan maximum.', 'Прибавка зависит от значения этого стата до Titan. Чем лучше исходные проки, тем выше его максимум после Titan.'],
  },
};

export function TitanSection({ data }: { data: HandbookTitanData }) {
  const { compareStats, compareTitan } = useHandbookStatPresentation();
  const { t, name, num, pct } = useHandbookText();
  const [slot, setSlot] = useState(data.pools[0]?.slot ?? '');
  const pool = data.pools.find((p) => p.slot === slot) ?? data.pools[0];
  const sortedProperties = useMemo(() => {
    if (!pool) return [];
    const chances = new Map<string, number>();
    for (const bracket of pool.brackets) {
      for (const entry of bracket.chances) {
        chances.set(entry.id, (chances.get(entry.id) ?? 0) + entry.chance);
      }
    }
    return [...pool.properties].sort((a, b) => (chances.get(b.id) ?? 0) - (chances.get(a.id) ?? 0) || compareTitan(a.id, b.id));
  }, [pool, compareTitan]);
  const maxRareLevel = Math.max(0, ...data.rareValues.flatMap((r) => r.values.map((v) => v.level)));
  const rareLevels = Array.from({ length: maxRareLevel }, (_, index) => index + 1);
  const counts = useMemo(() => [...new Set(data.mainGrowth.flatMap((g) => g.levels.map((l) => l.count)))].sort((a, b) => a - b), [data.mainGrowth]);
  const [countIndex, setCountIndex] = useState(counts.length - 1);
  const count = counts[countIndex] ?? 0;
  const typeNames = useMemo(
    () => Object.fromEntries(data.mainGrowth.filter((g) => g.type).map((g) => [g.type!, `${name(g.name, g.type!)}${g.percent ? ' %' : ''}`])),
    [data.mainGrowth, name]
  );
  const typeIcons = useMemo(() => Object.fromEntries(data.mainGrowth.filter((g) => g.type).map((g) => [g.type!, g.icon])), [data.mainGrowth]);
  const statList = (types: string[]) => types.length
    ? <span className={styles.statList}>{types.map((type) => <HandbookStatLabel key={type} type={type} icon={typeIcons[type]} label={typeNames[type] ?? type} />)}</span>
    : <span className={styles.muted}>—</span>;
  const runs = rateRuns(data.triggerRates).filter((run) => run.rate > 0);
  const growthValue = (percent: boolean | null, value: number) => (percent ? pct(value, 3) : num(value, 1));
  const propertyLabel = (id: string, size: 'md' | 'lg' = 'md') => {
    const property = data.rareValues.find((entry) => entry.id === id);
    const label = name(property?.name, id);
    const icon = <HandbookStatLabel size={size} kind="titan" type={id} icon={property?.icon} label={label} />;
    const description = name(property?.description);
    return description ? <Tooltip portal content={<div className={styles.propertyDescription}>
      <strong>{label}</strong><GameRichText text={description.replace(/\{0\}%/g, '<blue>{value}%</blue>')} />
    </div>}><span tabIndex={0}>{icon}</span></Tooltip> : icon;
  };

  const slotChips = (
    <Controls>
      <ChoiceChips label={t('Slot', 'Слот')} value={slot} onChange={setSlot}
        options={data.pools.map((p) => ({ value: p.slot, label: name(data.slotNames[p.slot], p.slot), icon: data.slotIcons[p.slot]?.titan,
          variant: slotVariant(data.slotStats[p.slot] ?? []),
        }))} />
    </Controls>
  );

  const rare = (
    <>
      <SubHeading note={t('Rare-property chances depend on augmentation count.',
        'Шансы редких свойств зависят от числа аугментаций.')} />
      {slotChips}
      {pool && (
        <HandbookTable
          compact
          caption={t('Rare property chances', 'Шансы редких свойств')}
          columns={[
            { label: t('Property', 'Свойство'), width: 240 },
            ...pool.brackets.map((b, index) => ({
              width: 200 + index * 80,
              label: b.toCount === null ? fillText(t('{0}+ augmentations', '{0}+ улучшений'), [b.fromCount]) : fillText(t('{0}–{1} augmentations', '{0}–{1} улучшений'), [b.fromCount, b.toCount]),
            })),
          ]}
          rows={sortedProperties.map((property) => ({
            key: property.id,
            cells: [
              <React.Fragment key="p">{propertyLabel(property.id, 'lg')}</React.Fragment>,
              ...pool.brackets.map((bracket, index) => {
                // One tag + value column pair per level, each value column as wide as the period's
                // longest value at that level, so +1/+2/+3 line up down the column without slack.
                const levels = Array.from({ length: Math.max(1, ...bracket.chances.map((c) => c.level)) }, (_, i) => i + 1);
                const widths = levels.map((level) => Math.max(1, ...bracket.chances.filter((c) => c.level === level).map((c) => pct(c.chance, 3).length)));
                const byLevel = new Map(bracket.chances.filter((c) => c.id === property.id).map((c) => [c.level, c.chance]));
                return (
                  <span key={index} className={styles.chanceLevels} style={{ gridTemplateColumns: widths.map((w) => `auto ${w + 0.5}ch`).join(' ') }}>
                    {levels.map((level) => {
                      const chance = byLevel.get(level);
                      return (
                        <span key={level} className={styles.chanceLevel}>
                          <span className={styles.chanceLevelTag}>+{level}</span>
                          {chance === undefined ? <span className={styles.muted}>—</span> : <span className={styles.strong}>{pct(chance, 3)}</span>}
                        </span>
                      );
                    })}
                  </span>
                );
              }),
            ],
          }))}
        />
      )}
      {runs.length > 0 && (
        <>
          <SubHeading note={t('Chance to change the Titan stat on each augmentation.', 'Шанс изменения Titan-стата при каждой прокачке.')}>
            {t('Rare-property roll chance', 'Шанс выбора редкого свойства')}
          </SubHeading>
          <HandbookTable
            caption={t('Rare-property roll chance', 'Шанс выбора редкого свойства')}
            columns={[
              { label: t('Augmentations', 'Аугментации') },
              ...runs.map((run) => ({ label: <span className={styles.rollChanceNumber}>{run.from === run.to ? String(run.from) : `${run.from}–${run.to}`}</span> })),
            ]}
            rows={[{ key: 'chance', cells: [t('Chance', 'Шанс'), ...runs.map((run) => <strong key={run.from} className={styles.rollChanceNumber}>{pct(run.rate)}</strong>)] }]} />
        </>
      )}
    </>
  );

  const values = (
    <>
      <HandbookTable
        compact
        caption={t('Rare property values', 'Значения редких свойств')}
        highlightColumnHeader
        columns={[
          { label: t('Property', 'Свойство'), width: 190, pinned: true },
          ...rareLevels.map((level) => ({
            label: <span title={level > data.rareValueLevelLimit ? t('Beyond the gameplay limit', 'Выше игрового лимита') : undefined}>
              {fillText(t('Lv. {0}', 'Ур. {0}'), [level])}
              {level === data.rareValueLevelLimit && <span className={styles.levelLimit}>{t('MAX', 'MAX')}</span>}
            </span>,
            width: 82,
            divider: level === data.rareValueLevelLimit + 1 ? 'neutral' as const : undefined,
          })),
        ]}
        rows={[...data.rareValues].sort((a, b) => compareTitan(a.id, b.id)).map((rare) => ({ key: rare.id, cells: [
          <React.Fragment key="r">{propertyLabel(rare.id)}</React.Fragment>,
          ...rareLevels.map((level) => {
            const value = curveValue(rare.values, level);
            const text = value === null ? '—' : pct(value, 3);
            return level > data.rareValueLevelLimit ? <span key={level} className={styles.muted}>{text}</span> : text;
          }),
        ] }))}
      />
    </>
  );

  const growth = (
    <>
      <SubHeading note={t('Total stat bonus at the selected augmentation count: minimum, estimated average and maximum.', 'Общая прибавка к стату при выбранном числе прокачек: минимум, расчётное среднее и максимум.')} />
      <Controls>
        <RangeField label={t('Augmentation count', 'Число улучшений')} value={countIndex} min={0} max={Math.max(0, counts.length - 1)}
          onChange={setCountIndex} display={String(count)} />
      </Controls>
      <HandbookTable
        compact="dense"
        caption={t('Main-stat growth', 'Рост основных статов')}
        columns={[{ label: t('Stat', 'Стат') }, { label: t('Min.', 'Мин.') }, { label: <Tooltip portal content={t('Weighted average of the game’s ranges, assuming values are equally likely within each range.', 'Среднее по весам игровых диапазонов. Внутри каждого диапазона значения считаются равновероятными.')}><span tabIndex={0} className={styles.ruleHint}>{t('Average', 'Среднее')}</span></Tooltip> }, { label: t('Max.', 'Макс.') }, { label: t('Rule', 'Правило') }]}
        rows={[...data.mainGrowth].sort((a, b) => compareStats(a.type ?? a.stat, b.type ?? b.stat)).map((growth) => {
          const level = growth.levels.find((l) => l.count === count);
          const summary = level ?? null;
          return {
            key: growth.stat,
            cells: [
              <HandbookStatLabel key="s" type={growth.type} icon={growth.icon} label={`${name(growth.name, growth.type ?? growth.stat)}${growth.percent ? ' %' : ''}`} />,
              summary ? growthValue(growth.percent, summary.min) : '—',
              summary ? growthValue(growth.percent, summary.expected) : '—',
              summary ? growthValue(growth.percent, summary.max) : '—',
              <Tooltip key="rule" portal content={<div className={styles.propertyDescription}>
                <strong>{GROWTH_RULES[growth.algorithm] ? t(...GROWTH_RULES[growth.algorithm]!.label) : growth.algorithm}</strong>
                <span>{GROWTH_RULES[growth.algorithm] ? t(...GROWTH_RULES[growth.algorithm]!.hint) : t('Calculation rule for this stat.', 'Правило расчёта этого стата.')}</span>
              </div>}><span tabIndex={0} className={styles.ruleHint}>{GROWTH_RULES[growth.algorithm] ? t(...GROWTH_RULES[growth.algorithm]!.label) : growth.algorithm}</span></Tooltip>,
            ],
          };
        })}
      />
    </>
  );

  const added = (
    <>
      <SubHeading note={fillText(t('Up to {0} added stats: {1} of main-stat rolls after Titan, in their own ranges; no further growth.', 'До {0} доп. статов: {1} проков основного стата после Titan в своих диапазонах; дальше не растут.'), [data.addedStats.maxAddedStats, pct(data.addedStats.addedStatShare, 1)])} />
      <HandbookTable
        compact="dense"
        caption={t('Added stats', 'Добавленные статы')}
        columns={[{ label: t('Main stat', 'Основной стат') }, { label: t('Added first', 'Добавляются в первую очередь'), align: 'start' }, { label: <Tooltip portal content={t('Build’s default fill order, from left to right. Stats already on the item are skipped; this list is used only for slots the priority pool cannot fill.', 'Порядок заполнения по умолчанию в Build — слева направо. Уже имеющиеся статы пропускаются; этот список используется только для мест, которые не заполнил приоритетный пул.')}><span tabIndex={0} className={styles.ruleHint}>{t('Then, in order', 'Далее по порядку')}</span></Tooltip>, align: 'start' }]}
        rows={Object.entries(data.addedStats.priorities).sort(([a], [b]) => compareStats(a, b)).map(([type, priority]) => ({
          key: type,
          cells: [
            <HandbookStatLabel key="t" type={type} icon={typeIcons[type]} label={typeNames[type] ?? type} />,
            <span key="p">{statList(priority)}</span>,
            <span key="f">{statList(data.addedStats.fallbacks[type] ?? [])}</span>,
          ],
        }))}
      />
    </>
  );

  return (
    <SubTabs label={t('Titan', 'Titan')} tabs={[
      { id: 'rare', label: t('Rare properties', 'Редкие свойства'), content: rare },
      { id: 'values', label: t('Property values', 'Значения свойств'), content: values },
      { id: 'growth', label: t('Main-stat growth', 'Рост основных статов'), content: growth },
      { id: 'added', label: t('Added stats', 'Добавленные статы'), content: added },
    ]} />
  );
}
