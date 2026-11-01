'use client';
import { fillText } from '@/lib/i18n/text';

import React, { useMemo, useState } from 'react';
import { GameRichText, Tooltip } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import type { HandbookSpaceSupportData } from '../../contracts/handbook';
import { spaceSupportPlan, type SpaceSupportLevels } from '../handbook-domain';
import { ChoiceChips, Controls, RangeField, HandbookTable, SubHeading, useHandbookText } from './handbook-ui';
import styles from './sections.module.css';
import board from './space-support.module.css';

export function SpaceSupportSection({ data }: { data: HandbookSpaceSupportData }) {
  const { t, name, num } = useHandbookText();
  const item = Object.values(data.item)[0];
  const maxLevel = Math.max(0, ...data.modules.map(module => module.maxLevel));
  const preset = (target: number): SpaceSupportLevels => Object.fromEntries(data.modules.map(module => [module.id, {current: 0, target: Math.min(target, module.maxLevel)}]));
  const [levels, setLevels] = useState<SpaceSupportLevels>(() => preset(maxLevel));
  const plan = useMemo(() => spaceSupportPlan(data, levels), [data, levels]);
  const highestTarget = Math.max(0, ...Object.values(levels).map(value => value.target));
  const systems = [...data.systemLevels].sort((a, b) => a.maxModuleLevel - b.maxModuleLevel);
  const system = systems.find(entry => entry.maxModuleLevel >= highestTarget) ?? systems.at(-1);
  const cost = (value: number) => <span className={styles.costItem}>
    {item?.icon && <img src={gameAsset(item.icon)} alt="" width={18} height={18} />}{num(value)}
  </span>;
  const moduleGroup = (base: boolean) => <div className={board.group} role="group" aria-label={base ? t('Base modules', 'Базовые модули') : t('Mode modules', 'Модули режимов')}>
    {base && <div className={board.presets}><Controls><ChoiceChips label={t('Preset', 'Пресет')} role="button" value={-1} onChange={target => setLevels(preset(target))}
      options={[...new Set([0, ...systems.map(entry => entry.maxModuleLevel)])].map(target => ({value: target, label: fillText(t('All {0}', 'Все {0}'), [target])}))} /></Controls></div>}
    <h3>{base ? t('Base modules', 'Базовые модули') : t('Mode modules', 'Модули режимов')}</h3>
    <div className={board.moduleGrid}>{data.modules.filter(module => module.base === base).map(module => {
      const value = levels[module.id] ?? {current: 0, target: 0};
      const moduleEffect = module.levels.find(entry => entry.level === value.target)?.effect;
      return <div key={module.id} className={board.module} role="group" aria-label={name(module.name, module.id)}>
        <span className={board.moduleHeading}>{module.icon && <img src={gameAsset(module.icon)} alt="" loading="lazy" />}<span>{name(module.name, module.id)}</span></span>
        <div className={board.moduleSlider}><RangeField compact label={t('Level', 'Уровень')} value={value.target} min={0} max={module.maxLevel}
          onChange={target => setLevels(all => ({...all, [module.id]: {current: 0, target}}))} /></div>
        {moduleEffect ? <GameRichText className={board.moduleEffect} text={name(moduleEffect)} density="compact" />
          : <span className={board.moduleEffect}>{t('Module inactive', 'Модуль не активен')}</span>}
      </div>;
    })}</div>
  </div>;

  return <div className={styles.block}>
    <SubHeading note={t('Set each module level. The centre shows the total cost from level 0.', 'Задайте уровень каждого модуля. В центре — общая стоимость с нулевого уровня.')} />
    <div className={board.layout}>
      {moduleGroup(true)}
      <div className={board.core}>
        <div className={board.coreRing}>
          {system?.icon && <img src={gameAsset(system.icon)} alt="" />}
          <strong>{name(system?.name, '')}</strong>
          <span>{t('Module level cap', 'Предел уровня модулей')}: {system?.maxModuleLevel ?? '—'}</span>
        </div>
        <dl className={board.totals} aria-live="polite">
          <div><dt>{t('Modules', 'Модули')}</dt><dd>{cost(plan.modules)}</dd></div>
          <div><dt><Tooltip portal content={t('Only the extra cost of bringing missing base modules to the unlock level. If their selected levels already meet the requirement, this is 0: their cost is already included in Modules.', 'Только дополнительная стоимость недостающих уровней базовых модулей для открытия ступени. Если выбранные уровни уже соответствуют требованию, здесь 0: их стоимость включена в строку «Модули».')}><span tabIndex={0} className={styles.ruleHint}>{t('Extra to unlock', 'Доплата за открытие')}</span></Tooltip></dt><dd>{cost(plan.unlock)}</dd></div>
          <div className={board.total}><dt>{t('Total', 'Всего')}</dt><dd>{cost(plan.total)}</dd></div>
        </dl>
      </div>
      {moduleGroup(false)}
    </div>
    <section className={board.details}>
      <SubHeading note={t('The same costs apply to every module.', 'Стоимость одинакова для всех модулей.')} />
      <HandbookTable compact="dense" caption={t('Module level requirements', 'Требования по уровням модуля')}
        columns={[{label: t('Level', 'Уровень')}, {label: t('Cost', 'Стоимость')}, {label: t('Total from 0', 'Итого с 0')}, {label: t('Requirement', 'Требование')}]}
        rows={(data.modules[0]?.levels ?? []).map(level => {
          const requirement = systems.find(entry => entry.maxModuleLevel >= level.level);
          return {key: String(level.level), cells: [num(level.level), cost(level.cost), cost(level.cumulative),
            requirement?.needAllModuleLevel ? fillText(t('All base modules at level {0}', 'Все базовые модули уровня {0}'), [requirement.needAllModuleLevel]) : '—']};
        })} />
    </section>
    {plan.blocking.length > 0 && <p className={styles.warning}>
      {fillText(t('To unlock these targets, base modules must reach level {0}. Their additional cost is included: ', 'Для открытия целей базовые модули должны достичь уровня {0}. Их дополнительная стоимость учтена: '), [plan.required])}
      {plan.blocking.map(id => name(data.modules.find(module => module.id === id)?.name, id)).join(', ')}.
    </p>}
  </div>;
}
