'use client';

import { localized } from '@tof-hub/i18n';
import { useEffect, useRef, useState } from 'react';
import { GameRichText } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import type { HandbookBrainfieldData } from '../../contracts/handbook';
import { brainfieldCosts, brainfieldLayout, brainfieldStats, type BrainfieldNode } from '../brainfield-domain';
import { HandbookStatLabel, useHandbookStatPresentation } from '../handbook-stat-presentation';
import { HandbookTable, IconLabel, ItemCost, Note, RangeField, SubTabs, useHandbookText } from './handbook-ui';
import board from './brainfield.module.css';

export function MmoBrainfieldSection({ data }: { data: HandbookBrainfieldData }) {
  const { t, name } = useHandbookText();
  const allNodes = data.groups.flatMap(group => group.nodes);
  const [levels, setLevels] = useState<Record<string, number>>(() => Object.fromEntries(allNodes.map(node => [node.id, node.maxLevel])));
  if (!data.groups.length) return <Note>{t('No MMO Brainfield groups available.', 'Группы Brainfield MMO недоступны.')}</Note>;
  return <div className={board.root}>
    <SubTabs label={t('Neuron Chains', 'Нейронные цепи')} tabs={data.groups.map(group => ({ id: String(group.index), label: name(group.name, String(group.index + 1)),
      content: <BrainfieldChain key={group.index} group={group} allNodes={allNodes} levels={levels} setLevels={setLevels} />,
    }))} />
  </div>;
}

function BrainfieldChain({ group, allNodes, levels, setLevels }: {
  group: HandbookBrainfieldData['groups'][number]; allNodes: BrainfieldNode[];
  levels: Record<string, number>; setLevels: (update: (current: Record<string, number>) => Record<string, number>) => void;
}) {
  const { locale, t, name, num } = useHandbookText();
  const { stats, compareStats } = useHandbookStatPresentation();
  const statTotals = brainfieldStats(allNodes, levels);
  const [selectedId, setSelected] = useState(group.nodes[0]?.id ?? '');
  const graph = useRef<HTMLDivElement>(null);
  const node = group.nodes.find(entry => entry.id === selectedId) ?? group.nodes[0];
  useEffect(() => {
    const panel = graph.current;
    const active = panel?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!panel || !active) return;
    const bounds = panel.getBoundingClientRect();
    const target = active.getBoundingClientRect();
    if (target.left < bounds.left || target.right > bounds.right)
      panel.scrollLeft += target.left - bounds.left - (panel.clientWidth - target.width) / 2;
  }, [node?.id, group.index]);
  const { positions, width, height } = brainfieldLayout(group);
  const catalog = Object.fromEntries(allNodes.flatMap(entry => entry.levels.flatMap(level => level.materials.map(material => [material.id, {...material, name: material.name ?? {en: material.id, ru: material.id}}]))));
  const total = group.nodes.reduce((sum, entry) => sum + (levels[entry.id] ?? 0), 0);
  const setPreset = (max: boolean) => setLevels(current => ({ ...current, ...Object.fromEntries(group.nodes.map(entry => [entry.id, max ? entry.maxLevel : 0])) }));
  const requirement = (conditions: unknown[]) => conditions.flatMap(entry => {
    if (!entry || typeof entry !== 'object' || !('TalentUnlockConditions' in entry)) return [];
    const list = (entry as { TalentUnlockConditions?: {TalentID?: string; TalentLevel?: number; NeedPlayerLevel?: number}[] }).TalentUnlockConditions;
    return (list ?? []).map(condition => [
      condition.TalentID && condition.TalentID !== 'None' ? `${name(allNodes.find(entry => entry.id === condition.TalentID)?.name, condition.TalentID)} ${t('Lv.', 'ур.')} ${condition.TalentLevel ?? '—'}` : '',
      condition.NeedPlayerLevel ? `${t('Wanderer level', 'Уровень странника')} ${condition.NeedPlayerLevel}` : '',
    ].filter(Boolean).join(' · '));
  }).join(' / ') || '—';
  if (!node) return null;
  const selectedLevel = levels[node.id] ?? 0;
  const record = node.levels.find(entry => entry.level === Math.max(1, selectedLevel));
  const nodeButton = (entry: BrainfieldNode, floating = false) => {
    const point = positions.get(entry.id);
    const level = levels[entry.id] ?? 0;
    return <button key={entry.id} type="button" className={floating ? board.node : board.skill} style={floating && point ? { left: point.x, top: point.y } : undefined}
      data-active={level > 0} aria-pressed={entry.id === node.id} aria-label={`${name(entry.name, entry.id)} · ${entry.id} · ${level}/${entry.maxLevel}`} onClick={() => setSelected(entry.id)}>
      {entry.icons.activated ? <img src={gameAsset(entry.icons.activated)} alt="" /> : <span className={board.missingIcon}>{name(entry.name, entry.id).slice(0, 1)}</span>}
      {!floating && <span className={board.skillName}>{name(entry.name, entry.id)}</span>}
      <span className={board.rank}>{level}<span> / {entry.maxLevel}</span></span>
    </button>;
  };
  return <div className={board.chain}>
    <div className={board.toolbar}><h3>{name(group.name)} <span>{total} / {group.maximumLevelTotal}</span></h3>
      <div><button type="button" onClick={() => setPreset(false)}>{t('Reset chain', 'Сбросить цепь')}</button><button type="button" onClick={() => setPreset(true)}>{t('Max chain', 'Вся цепь на максимум')}</button></div>
    </div>
    <div className={board.layout}>
      <div className={board.canvasPanel}>
        <div ref={graph} className={board.scroller} tabIndex={0} role="region" aria-label={t('Neuron graph, scroll horizontally to explore', 'Граф нейронов, доступна горизонтальная прокрутка')}>
          <div className={board.canvas} style={{ width, height }}>
            <svg width={width} height={height} className={board.connections} aria-hidden="true">{group.connections.map((edge, index) => {
              const from = positions.get(edge.from ?? ''); const to = positions.get(edge.to ?? '');
              if (!from || !to) return null;
              const middle = from.x + (to.x - from.x) / 2;
              return <path key={index} d={`M ${from.x + 25} ${from.y} H ${middle} V ${to.y} H ${to.x - 25}`} data-active={(levels[edge.from!] ?? 0) > 0 && (levels[edge.to!] ?? 0) > 0} />;
            })}</svg>
            {group.nodes.filter(entry => positions.has(entry.id)).map(entry => nodeButton(entry, true))}
          </div>
        </div>
        <p className={board.panHint}>{t('Scroll horizontally to explore the chain. Select a neuron to inspect its levels.', 'Прокручивайте цепь по горизонтали. Выберите нейрон, чтобы посмотреть его уровни.')}</p>
        <div className={board.costs} aria-live="polite"><span>{t('Chain materials · from level 0', 'Материалы цепи · с уровня 0')}</span><ItemCost items={brainfieldCosts(group.nodes, levels)} catalog={catalog} /></div>
      </div>
      <div className={board.sideColumn}>
      <section className={board.inspector} aria-label={t('Selected neuron', 'Выбранный нейрон')}>
        <header className={board.inspectorHeader}>
          <div className={board.selectedTitle}><IconLabel size="lg" icon={node.icons.activated} label={name(node.name, node.id)} /></div>
          <span className={board.nodeKind}>{node.kind === 'skill' ? t('Special skill', 'Особый навык') : t('Attribute neuron', 'Нейрон атрибута')}</span>
        </header>
        <RangeField label={t('Planned level', 'Планируемый уровень')} value={selectedLevel} min={0} max={node.maxLevel} onChange={value => setLevels(current => ({...current, [node.id]: value}))} />
        {node.description && !record?.buffDescription && <GameRichText density="compact" text={name(node.description)} />}
        {record?.attribute.propName && <div className={board.effect}><HandbookStatLabel type={record.attribute.propName} icon={node.icons.activated} fallbackTone="color" label={name(stats.get(record.attribute.propName)?.name ?? node.name, record.attribute.propName)} />
          <strong>+{num(record.attribute.propValue ?? 0)}</strong><small>{t('Direct value per level record', 'Прямое значение записи уровня')}</small>
        </div>}
        {record?.buffDescription && <GameRichText density="compact" text={name(record.buffDescription)} />}
        {selectedLevel === 0 && <p className={board.help}>{t('Inactive in this plan. The level 1 effect is shown for reference.', 'Не активен в плане. Для справки показан эффект уровня 1.')}</p>}
        <div className={board.requirement}><h4>{t('Requirement', 'Требование')}</h4><p>{record ? requirement(record.unlockConditions) : '—'}</p></div>
        <div className={board.nodeCosts}>
          <div className={board.requirement}><h4>{t('Total cost', 'Полная стоимость')}</h4><ItemCost items={brainfieldCosts([node], levels)} catalog={catalog} /></div>
          <div className={board.requirement}><h4>{t('One level cost', 'Стоимость уровня')}</h4><ItemCost items={Object.fromEntries(record?.materials.map(material => [material.id, material.count ?? 0]) ?? [])} catalog={catalog} /></div>
        </div>
      </section>
      <div className={board.skills} role="group" aria-label={t('Special skills', 'Особые навыки')}>
        {group.nodes.filter(entry => !positions.has(entry.id)).map(entry => nodeButton(entry))}
      </div>
      </div>
    </div>
    <section className={board.statSummary} aria-label={t('Total upgrade stats', 'Сумма статов прокачки')} aria-live="polite">
      <header><h3>{t('Total upgrade stats', 'Сумма статов прокачки')}</h3>
        <p>{t('All four chains · selected levels', 'Все четыре цепи · выбранные уровни')}</p></header>
      {Object.keys(statTotals).length ? <dl className={board.statTotals}>
        {Object.entries(statTotals).sort(([a], [b]) => compareStats(a, b)).map(([type, value]) => {
          const source = allNodes.find(entry => entry.levels.some(level => level.attribute.propName === type));
          return <div key={type}><dt><HandbookStatLabel type={type} icon={source?.icons.activated} fallbackTone="color" label={name(stats.get(type)?.name ?? source?.name, type)} /></dt>
            <dd>{value > 0 ? '+' : ''}{num(value, 2)}</dd></div>;
        })}
      </dl> : <p>{t('No attribute upgrades selected.', 'Прокачка атрибутов не выбрана.')}</p>}
      <small>{t('Direct stat increases. Special skill effects are shown separately.', 'Прямые прибавки статов. Эффекты особых навыков показаны отдельно.')}</small>
    </section>
    <p className={board.help}>{t('This is an upgrade plan. The planner does not simulate unlock state or special buff stacking; prerequisites and banned levels are listed below.', 'Это план прокачки. Он не моделирует открытые узлы и сложение особых бафов; требования и запрещённые уровни перечислены ниже.')}</p>
    <details className={board.details}><summary>{t('Selected neuron · all level records', 'Выбранный нейрон · все уровни')}</summary>
      <HandbookTable caption={t('Neuron level requirements and costs', 'Требования и стоимость уровней нейрона')} compact="dense" columns={[{label: t('Level', 'Уровень')}, {label: t('Effect', 'Эффект')}, {label: t('Requirement', 'Требование')}, {label: t('Materials', 'Материалы')}, {label: t('Banned levels', 'Запрещённые уровни')}]} rows={node.levels.map(level => ({key: level.rowKey, cells: [num(level.level), localized(level.buffDescription, locale) ? <GameRichText key="effect" density="compact" text={localized(level.buffDescription, locale)} /> : num(level.attribute.propValue ?? 0), requirement(level.unlockConditions), <ItemCost key="cost" items={Object.fromEntries(level.materials.map(material => [material.id, material.count ?? 0]))} catalog={catalog} />, level.bannedLevels.join(', ') || '—']}))} />
    </details>
  </div>;
}
