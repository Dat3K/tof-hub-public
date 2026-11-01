'use client';
import { fillText } from '@/lib/i18n/text';

import React, { useState } from 'react';
import type { HandbookEnhancementData } from '../../contracts/handbook';
import { cumulativeDifference } from '../handbook-domain';
import { ChoiceChips, Controls, HandbookTable, ItemCost, ItemLegend, RangeField, SubTabs, type SubTab, useHandbookText } from './handbook-ui';
import styles from './sections.module.css';
import { HandbookStatLabel, useHandbookStatPresentation } from '../handbook-stat-presentation';

const SINGLE_SLOT: Record<string, string> = { Visor: 'visor', Reactor: 'reactor', Exoskeleton: 'exoskeleton', Core: 'core' };

export function EnhancementSection({ data }: { data: HandbookEnhancementData }) {
  const { compareStats } = useHandbookStatPresentation();
  const { t, name, num } = useHandbookText();
  const familyIds = Object.keys(data.families);
  const [familyId, setFamilyId] = useState(data.costGroups?.[0]?.id ?? familyIds[0] ?? '');
  const family = data.costGroups?.find(group => group.id === familyId) ?? data.families[familyId] ?? data.families[familyIds[0]!];
  const levels = family?.levels ?? [];
  const max = levels.length ? levels[levels.length - 1]!.level : 0;
  const [range, setRange] = useState<[number, number]>([0, max]);
  const from = Math.min(range[0], max), to = Math.min(Math.max(range[1], from), max);
  const at = (level: number) => levels.find((l) => l.level === level)?.cumulative;
  const rangeCost = cumulativeDifference(at(to), from ? at(from) : undefined);
  const itemIds = [...new Set(levels.flatMap((l) => Object.keys(l.items)))];
  const hasSuppressor = levels.some(level => level.needSuppressorLevel);
  const costNote = t('Cost between the selected levels. Requirements apply to reaching each level.', 'Стоимость между выбранными уровнями. Требования указаны для получения каждого уровня.');
  const groupLabel = (id: string, count: number) => {
    const label = id === 'normal-all' ? t('Full round', 'Круг') : id === 'vera-all' ? t('Vera only', 'Только Vera')
      : id.startsWith('normal') ? t('Normal', 'Обычный') : id.startsWith('vera') ? 'Vera' : t('All', 'Все');
    return `${label} (${count})`;
  };

  const familyLabel = (id: string) => {
    const prefix = id.split('_')[0]!;
    const single = SINGLE_SLOT[prefix];
    if (single) return name(data.slotNames[single], single);
    const slots = data.families[id]?.slots;
    if (slots?.length) return fillText(t('Armor and accessories ({0} slots)', 'Броня и аксессуары ({0} слотов)'), [slots.length]);
    const suffix = id.match(/_(old|new)(\d+)$/);
    return suffix ? t(`${suffix[1] === 'old' ? 'Earlier' : 'Newer'} ${suffix[2]} slots`, `${suffix[1] === 'old' ? 'Прежние' : 'Новые'} ${suffix[2]} слота(ов)`) : id;
  };

  const familyIcon = (id: string) => {
    const single = SINGLE_SLOT[id.split('_')[0]!];
    const slot = single ?? data.families[id]?.slots?.[0];
    return slot ? data.slotIcons[slot]?.normal : undefined;
  };

  const [statSlot, setStatSlot] = useState(data.stats?.[0]?.slot ?? '');
  const slotStats = data.stats?.find((s) => s.slot === statSlot) ?? data.stats?.[0];
  const stageRows = slotStats?.stages.augmented ?? [];
  const statTypes = [...new Set(stageRows.flatMap((row) => row.stats.map((s) => s.type)))].sort(compareStats);

  const cost = (
    <>
      <Controls>
        <ChoiceChips label={t('Slots', 'Слоты')} value={familyId} onChange={(id) => { setFamilyId(id); setRange([0, (data.costGroups?.find(group => group.id === id) ?? data.families[id])?.levels.at(-1)?.level ?? 0]); }}
          options={data.costGroups?.map(group => ({value: group.id, label: groupLabel(group.id, group.slotCount)})) ?? familyIds.map((id) => ({ value: id, label: familyLabel(id), icon: familyIcon(id) }))} />
      </Controls>
      <Controls>
        <RangeField label={t('From', 'От')} value={from} min={0} max={max} display={`+${from}`} onChange={(v) => setRange([v, Math.max(v, to)])} />
        <RangeField label={t('To', 'До')} value={to} min={0} max={max} display={`+${to}`} onChange={(v) => setRange([Math.min(from, v), v])} />
        <div className={styles.tile}>
          <span>+{from} → +{to}</span>
          <strong><ItemCost items={rangeCost} catalog={data.items} /></strong>
        </div>
      </Controls>
      <ItemLegend ids={itemIds} catalog={data.items} />
      <HandbookTable
        compact="dense"
        caption={t('Enhancement milestones', 'Вехи усиления')}
        columns={[
          { label: t('Level', 'Уровень') },
          { label: t('Total from +0', 'Итого от +0') },
          { label: t('Player level', 'Уровень игрока') },
          ...(hasSuppressor ? [{ label: t('Suppressor', 'Супрессор') }] : []),
        ]}
        rows={levels.filter((l) => l.level % 5 === 0).map((l) => ({
          key: String(l.level),
          highlight: l.level > from && l.level <= to,
          cells: [`+${l.level}`, <ItemCost key="c" items={l.cumulative} catalog={data.items} />, num(l.needPlayerLevel), ...(hasSuppressor ? [l.needSuppressorLevel ?? '—'] : [])],
        }))}
      />
    </>
  );

  const stats = slotStats && (
        <>
          <Controls>
            <ChoiceChips label={t('Slot', 'Слот')} value={slotStats.slot} onChange={setStatSlot}
              options={(data.stats ?? []).map((s) => ({ value: s.slot, label: name(data.slotNames[s.slot], s.slot), icon: data.slotIcons[s.slot]?.normal }))} />
          </Controls>
          <HandbookTable
            compact
            caption={t('Main stats by level', 'Основные статы по уровням')}
            columns={[{ label: t('Level', 'Уровень') }, ...statTypes.map((type) => ({ label: <HandbookStatLabel type={type} icon={data.statIcons[type]} label={name(data.statNames[type], type)} /> }))]}
            rows={stageRows.map((row) => ({
              key: String(row.level),
              cells: [`+${row.level}`, ...statTypes.map((type) => {
                const value = row.stats.find((s) => s.type === type)?.value;
                return value === undefined ? '—' : num(value);
              })],
            }))}
          />
        </>
  );

  const tabs: SubTab[] = [];
  if (stats) tabs.push({ id: 'stats', label: t('Main stats by level', 'Основные статы по уровням'), content: stats,
    note: t('Augmented / Titan main stats at every fifth enhancement level. These two stages have the same values.', 'Основные статы Augmented / Titan на каждом пятом уровне усиления. Значения этих двух стадий совпадают.') });
  tabs.push({ id: 'cost', label: t('Cost', 'Стоимость'), content: cost, note: costNote });
  return <SubTabs label={t('Gear enhancement', 'Усиление гира')} tabs={tabs} />;
}
