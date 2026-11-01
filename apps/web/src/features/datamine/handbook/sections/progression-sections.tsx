'use client';
import { fillText } from '@/lib/i18n/text';

import React, { useState } from 'react';
import { Tooltip } from '@tof-hub/ui';
import { slotVariant } from '@/features/build/gear-slot-chips';
import type { HandbookSupercomputerData, HandbookSuppressorData } from '../../contracts/handbook';
import { cumulativeDifference } from '../handbook-domain';
import { ChoiceChips, Controls, HandbookTable, IconLabel, ItemCost, ItemLegend, RangeField, SubHeading, SubTabs, useHandbookText } from './handbook-ui';
import styles from './sections.module.css';
import { HandbookStatLabel, useHandbookStatPresentation } from '../handbook-stat-presentation';

const OUTCOMES: Record<string, [string, string]> = {
  NullCriticalHit: ['Normal', 'Обычный'],
  SmallCriticalHit: ['Small crit', 'Малый крит'],
  MediumCriticalHit: ['Medium crit', 'Средний крит'],
  BigCriticalHit: ['Big crit', 'Большой крит'],
  UpgradeToNextLevel: ['Instant level-up', 'Мгновенный уровень'],
};

export function SupercomputerSection({ data }: { data: HandbookSupercomputerData }) {
  const { t, name, num, pct } = useHandbookText();
  const [slot, setSlot] = useState(data.nodes[0]?.slot ?? '');
  const node = data.nodes.find(entry => entry.slot === slot) ?? data.nodes[0];
  const outcomeKinds = [...new Set(data.levels.flatMap(level => level.outcomes.map(outcome => outcome.kind)))];
  const modelHint = t('Estimated from the game’s outcome weights. The model assumes excess EXP is lost at level-up; the game’s carry-over behavior is not confirmed.', 'Расчёт по весам исходов из игры. Модель считает, что лишний опыт теряется при повышении уровня; перенос опыта в игре не подтверждён.');
  const estimateHeader = (label: string) => <Tooltip portal content={modelHint}><span tabIndex={0} className={styles.ruleHint}>{label}</span></Tooltip>;

  const cost = <>
      <SubHeading note={t('EXP and estimated attempts needed to reach each level, for all four slots.', 'Опыт и расчётное число попыток для достижения каждого уровня — для всех четырёх слотов.')} />
      <HandbookTable
        compact="dense"
        caption={t('Supercomputer levels', 'Уровни суперкомпьютера')}
        columns={[
          { label: t('Level', 'Уровень') },
          { label: t('Experience', 'Опыт') },
          { label: t('Total exp.', 'Опыт итого') },
          { label: estimateHeader(t('Avg. attempts', 'В среднем попыток')) },
          { label: estimateHeader(t('Max. attempts', 'Макс. попыток')) },
        ]}
        rows={data.levels.map((level) => ({
          key: String(level.level),
          cells: [
            num(level.level),
            num(level.requiredExp),
            num(level.cumulativeExp),
            num(level.expectedClicks, 1),
            num(level.maxClicks),
          ],
        }))}
      />
    </>;

  const chances = <>
    <SubHeading note={t('One attempt can add EXP or instantly complete the level. Chances below apply within the shown current-EXP interval.', 'Одна попытка добавляет опыт или сразу завершает уровень. Шансы указаны для показанного диапазона текущего опыта.')} />
    <HandbookTable compact="dense" caption={t('Supercomputer upgrade chances', 'Шансы улучшения суперкомпьютера')}
      columns={[{label: t('Level', 'Уровень')}, {label: t('Current EXP', 'Текущий опыт')}, ...outcomeKinds.map(kind => {
        const outcome = data.levels.flatMap(level => level.outcomes).find(entry => entry.kind === kind);
        const label = OUTCOMES[kind] ? t(...OUTCOMES[kind]!) : kind;
        return { label: <Tooltip portal content={label}><span tabIndex={0} className={styles.ruleHint}>{outcome?.exp ? `+${num(outcome.exp)} ${t('EXP', 'опыта')}` : label}</span></Tooltip> };
      })]}
      rows={data.levels.flatMap(level => level.segments.map(segment => ({key: `${level.level}-${segment.fromExp}`, cells: [
        num(level.level), `${num(segment.fromExp)}–${num(segment.toExp - 1)}`,
        ...outcomeKinds.map(kind => {const outcome = segment.chances.find(entry => entry.kind === kind); return outcome ? pct(outcome.chance) : '—';}),
      ]})))} />
  </>;

  const bonuses = <>
    <Controls><ChoiceChips label={t('Slot', 'Слот')} value={slot} onChange={setSlot}
      options={data.nodes.map(entry => ({value: entry.slot, label: name(data.slotNames[entry.slot], entry.slot), icon: entry.icon, variant: slotVariant(entry.allowedStats)}))} /></Controls>
    <SubHeading note={t('Total bonus of the selected slot at each Supercomputer level.', 'Общий бонус выбранного слота на каждом уровне суперкомпьютера.')} />
    {node && <HandbookTable compact="dense" caption={t('Supercomputer bonuses', 'Бонусы суперкомпьютера')}
      columns={[{label: t('Level', 'Уровень'), width: 100}, ...node.effects.map(effect => ({width: 220, label: <IconLabel tone="mono" icon={effect.icon} label={name(effect.name, effect.id)} />}))]}
      rows={data.levels.filter(level => level.level <= node.maxLevel).map(level => ({key: String(level.level), cells: [num(level.level), ...node.effects.map(effect => {
        const value = effect.levels.find(entry => entry.level === level.level);
        return value ? value.percentage ? pct(value.value, 3) : num(value.value) : '—';
      })]}))} />}
  </>;

  return <SubTabs label={t('Supercomputer', 'Суперкомпьютер')} tabs={[
    {id: 'chances', label: t('Upgrade chances', 'Шансы улучшения'), content: chances},
    {id: 'cost', label: t('Upgrade cost', 'Стоимость'), content: cost},
    {id: 'bonuses', label: t('Bonuses by level', 'Бонусы по уровням'), content: bonuses},
  ]} />;
}

export function SuppressorSection({ data }: { data: HandbookSuppressorData }) {
  const { t, name, num, pct } = useHandbookText();
  const { compareStats } = useHandbookStatPresentation();
  const stats = [...new Set(data.levels.flatMap(level => (level.stats ?? []).map(stat => stat.type)))].sort(compareStats);
  const hasStats = stats.length > 0;
  const hasCombatBuffs = data.levels.some(level => (level.effects?.length ?? 0) > 0);
  const last = Math.max(0, data.levels.length - 1);
  const [range, setRange] = useState<[number, number]>([0, last]);
  const from = Math.min(range[0], last), to = Math.min(Math.max(range[1], from), last);
  const cost = cumulativeDifference(data.levels[to]?.cumulative, data.levels[from]?.cumulative);
  const itemIds = Object.keys(data.total);
  const upgrade = <>
      <Controls>
        <RangeField label={t('From', 'От')} value={from} min={0} max={last} display={data.levels[from]?.version ?? ''} onChange={(v) => setRange([v, Math.max(v, to)])} />
        <RangeField label={t('To', 'До')} value={to} min={0} max={last} display={data.levels[to]?.version ?? ''} onChange={(v) => setRange([Math.min(from, v), v])} />
        <div className={styles.tile}>
          <span>{data.levels[from]?.version} → {data.levels[to]?.version}</span>
          <strong><ItemCost items={cost} catalog={data.items} /></strong>
        </div>
      </Controls>
      <ItemLegend ids={itemIds} catalog={data.items} />
      <HandbookTable
        compact="dense"
        caption={t('Suppressor versions', 'Версии супрессора')}
        columns={[
          { label: t('Version', 'Версия') },
          { label: t('Cost', 'Цена') },
          { label: t('Total', 'Итого') },
          { label: t('Player level', 'Уровень игрока') },
          { label: t('Required CS', 'Требуемый CS') },
        ]}
        rows={data.levels.map((level, index) => ({
          key: level.row,
          highlight: index > from && index <= to,
          cells: [
            <IconLabel key="v" icon={level.icon} label={level.version} />,
            <ItemCost key="c" items={level.items} catalog={data.items} />,
            <ItemCost key="t" items={level.cumulative} catalog={data.items} />,
            num(level.needPlayerLevel),
            level.needScore ? num(level.needScore) : '—',
          ],
        }))}
      />
    </>;
  const tabs = [
    ...(hasStats ? [{id: 'stats', label: t('Stats by level', 'Статы по уровням'), content: <HandbookTable compact="dense"
      caption={t('Suppressor stats', 'Статы супрессора')}
      columns={[{label: t('Version', 'Версия'), width: 160}, ...stats.map(type => ({width: 180, label: <HandbookStatLabel type={type} icon={data.statIcons[type]} label={name(data.statNames[type], type)} />}))]}
      rows={data.levels.map(level => ({key: level.row, cells: [<IconLabel key="v" icon={level.icon} label={level.version} />,
        ...stats.map(type => {const stat = level.stats?.find(entry => entry.type === type); return stat ? num(stat.value, 1) : '—';})]}))} />}] : []),
    ...(hasCombatBuffs ? [{id: 'combat-buff', label: t('Combat Buff', 'Боевой баф'), content: <HandbookTable compact="dense"
      caption={t('Suppressor combat buffs', 'Боевые бафы супрессора')}
      columns={[{label: t('Version', 'Версия'), width: 120}, {label: t('Enemy level', 'Уровень противника'), width: 180},
        {label: t('Damage to enemies', 'Урон противникам'), width: 180}, {label: t('Damage reduction', 'Снижение получаемого урона'), width: 220}]}
      rows={data.levels.flatMap(level => (level.effects ?? []).map(effect => ({
        key: `${level.row}-${effect.sourceIndex}`,
        cells: [
          <IconLabel key="v" icon={level.icon} label={level.version} />,
          effect.minLevel <= 0 ? fillText(t('Level {0} or below', 'Уровень {0} и ниже'), [num(effect.maxLevel)]) : `${num(effect.minLevel)}–${num(effect.maxLevel)}`,
          `+${pct(effect.attackDamageMulti)}`,
          `−${pct(effect.beAttackedDamageReduceMulti)}`,
        ],
      })))}/>} ] : []),
    {id: 'cost', label: t('Upgrade cost', 'Стоимость прокачки'), content: upgrade,
      note: t('Each row shows the cost to reach that version from the previous one.', 'В каждой строке — стоимость перехода с предыдущей версии на указанную.')},
  ];
  return <SubTabs label={t('Suppressor', 'Супрессор')} tabs={tabs} />;
}
