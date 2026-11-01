'use client';
import { fillText } from '@/lib/i18n/text';

import React, {useId, useState} from 'react';
import {getBuildCriticalRates, getBuildResistanceReduction} from '@tof-hub/game-domain';
import type {HandbookFormulasData} from '../../contracts/handbook';
import {resistanceAfterIgnore} from '../handbook-domain';
import {HandbookTable, SubTabs, useHandbookText} from './handbook-ui';
import styles from './formulas.module.css';

function readNumber(text: string, min = 0, max = Infinity, integer = false): number | null {
  if (!text.trim()) return null;
  const value = Number(text.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)) ? value : null;
}

function CalculatorField({label, hint, unit, value, onChange, min = 0, max, integer = false}: {
  label: string; hint: string; unit: string; value: string; onChange: (value: string) => void;
  min?: number; max?: number; integer?: boolean;
}) {
  const id = useId();
  const {t} = useHandbookText();
  const invalid = value !== '' && readNumber(value, min, max, integer) === null;
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.inputWrap} data-invalid={invalid || undefined}>
      <input id={id} type="text" inputMode={integer ? 'numeric' : 'decimal'} value={value}
        aria-describedby={`${id}-hint`} aria-invalid={invalid || undefined} autoComplete="off" spellCheck={false}
        onChange={event => onChange(event.target.value)} />
      <span aria-hidden="true">{unit}</span>
    </div>
    <small id={`${id}-hint`}>{invalid ? integer
      ? fillText(t('Enter a whole level from {0} to {1}.', 'Введите целый уровень от {0} до {1}.'), [min, max])
      : max !== undefined ? fillText(t('Enter a number from {0} to {1}.', 'Введите число от {0} до {1}.'), [min, max])
        : t('Enter a non-negative number.', 'Введите неотрицательное число.') : hint}</small>
  </div>;
}

function Calculator({title, description, children, result, formula, onReset}: {
  title: string; description: string; children: React.ReactNode; result: React.ReactNode;
  formula: React.ReactNode; onReset: () => void;
}) {
  const {t} = useHandbookText();
  return <section className={styles.calculator} aria-label={title}>
    <div className={styles.entry}>
      <div className={styles.heading}><h3>{title}</h3><button type="button" onClick={onReset}>{t('Reset example', 'Сбросить пример')}</button></div>
      <p>{description}</p>
      <form className={styles.fields} onSubmit={event => event.preventDefault()}>{children}</form>
      <span className={styles.liveHint}>{t('Change the values — the result updates instantly.', 'Меняйте значения — результат обновляется сразу.')}</span>
    </div>
    <div className={styles.result} role="status" aria-live="polite" aria-atomic="true">{result}</div>
    <div className={styles.equation}>{formula}</div>
  </section>;
}

export function FormulasSection({data}: {data: HandbookFormulasData}) {
  const {t, num, pct} = useHandbookText();
  const levels = Object.keys(data.crit.denominators).map(Number).sort((a, b) => a - b);
  const resistanceLevels = Object.keys(data.resistance.constants).map(Number).sort((a, b) => a - b);
  const maxLevel = levels.at(-1) ?? 1, maxResLevel = resistanceLevels.at(-1) ?? 1;
  const [critText, setCrit] = useState('10000'), [enemyText, setEnemy] = useState(String(maxLevel));
  const [bonusText, setBonus] = useState('0');
  const [resText, setRes] = useState('7500'), [levelText, setLevel] = useState(String(maxResLevel));
  const [ignoreText, setIgnore] = useState('30'), [shredText, setShred] = useState('0');
  const crit = readNumber(critText), enemy = readNumber(enemyText, levels[0], maxLevel, true), bonus = readNumber(bonusText, 0, 100);
  const res = readNumber(resText), level = readNumber(levelText, resistanceLevels[0], maxResLevel, true);
  const ignore = readNumber(ignoreText, 0, 100), shred = readNumber(shredText, 0, 100);
  const denominator = enemy === null ? undefined : data.crit.denominators[enemy];
  const constant = level === null ? undefined : data.resistance.constants[level];
  const critRate = crit === null || bonus === null ? null : getBuildCriticalRates(crit, denominator, bonus / 100).total;
  const reduction = res === null ? null : getBuildResistanceReduction(res, constant);
  const after = res === null || !constant || ignore === null || shred === null ? null : resistanceAfterIgnore(res, constant, ignore / 100, shred / 100);
  const empty = t('Enter valid values to calculate.', 'Введите корректные значения для расчёта.');
  const resetResistance = () => {setRes('7500'); setLevel(String(maxResLevel));};
  const resistanceFields = <>
    <CalculatorField label={t('Target resistance', 'Сопротивление цели')} hint={t('Flat RES value, before ignore and shred.', 'Числовое СОПР до игнора и среза.')} unit={t('RES', 'СОПР')} value={resText} onChange={setRes} />
    <CalculatorField label={t('Character level', 'Уровень персонажа')} hint={t('Uses the same level basis as Tools Build.', 'Основа уровня — как в Tools Build.')} unit={t('Lv.', 'ур.')} value={levelText} onChange={setLevel} min={resistanceLevels[0]} max={maxResLevel} integer />
  </>;
  const reference = (kind: 'crit' | 'resistance') => <details className={styles.reference}>
    <summary>{t('Level reference table', 'Справочная таблица по уровням')}</summary>
    {kind === 'crit' ? <HandbookTable compact="dense" caption={t('Crit denominators', 'Знаменатели крита')}
      columns={[{label: t('Enemy level', 'Уровень врага')}, {label: t('Level coefficient D', 'Коэффициент уровня D')}, {label: t('Chance with your values', 'Шанс с вашими значениями')}]}
      rows={levels.filter(l => l === 1 || l % 10 === 0 || l === maxLevel).map(l => ({key: String(l), highlight: l === enemy,
        cells: [num(l), num(data.crit.denominators[l]!), crit === null || bonus === null ? '—' : pct(getBuildCriticalRates(crit, data.crit.denominators[l], bonus / 100).total!)]}))} />
      : <HandbookTable compact="dense" caption={t('Resistance constants', 'Константы сопротивления')}
        columns={[{label: t('Character level', 'Уровень персонажа')}, {label: t('Level coefficient K', 'Коэффициент уровня K')}, {label: t('Reduction with your RES', 'Снижение с вашим СОПР')}]}
        rows={resistanceLevels.filter(l => l === 1 || l % 10 === 0 || l === maxResLevel).map(l => ({key: String(l), highlight: l === level,
          cells: [num(l), num(data.resistance.constants[l]!), res === null ? '—' : pct(getBuildResistanceReduction(res, data.resistance.constants[l])!)]}))} />}
  </details>;
  const critTab = <>
    <Calculator title={t('Calculate your crit chance', 'Рассчитайте шанс крита')}
      description={t('Enter your Crit rating and the enemy’s level. Add any separate Crit Rate bonus below.', 'Введите свой Крит и уровень врага. Отдельный бонус к шансу крита укажите ниже.')}
      onReset={() => {setCrit('10000'); setEnemy(String(maxLevel)); setBonus('0');}}
      result={<><span>{t('Calculated crit chance', 'Расчётный шанс крита')}</span><strong>{critRate === null ? '—' : pct(critRate)}</strong>
        <p>{critRate === null ? empty : fillText(t('Against a level {0} enemy', 'Против врага {0} уровня'), [enemy])}</p>
        {denominator && <dl><div><dt>{t('Level coefficient D', 'Коэффициент уровня D')}</dt><dd>{num(denominator)}</dd></div></dl>}
        {critRate !== null && critRate > 1 && <small>{t('The formula result exceeds 100%.', 'Результат формулы превышает 100%.')}</small>}</>}
      formula={<><span>{t('Crit ÷ level coefficient + bonus chance', 'Крит ÷ коэффициент уровня + дополнительный шанс')}</span><code>{critRate === null || !denominator ? '—' : `${num(crit!)} ÷ ${num(denominator)} + ${pct(bonus! / 100)} = ${pct(critRate)}`}</code></>}>
      <CalculatorField label={t('Your Crit', 'Ваш Крит')} hint={t('Crit rating from your character stats, not a percentage.', 'Крит из характеристик персонажа, не процент.')} unit={t('Crit', 'Крит')} value={critText} onChange={setCrit} />
      <CalculatorField label={t('Enemy level', 'Уровень врага')} hint={t('Higher enemy levels change the conversion.', 'Уровень врага влияет на пересчёт Крита в шанс.')} unit={t('Lv.', 'ур.')} value={enemyText} onChange={setEnemy} min={levels[0]} max={maxLevel} integer />
      <CalculatorField label={t('Bonus Crit Rate', 'Доп. шанс крита')} hint={t('A separate percentage bonus. Leave 0 if none.', 'Отдельный процентный бонус. Если его нет, оставьте 0.')} unit="%" value={bonusText} onChange={setBonus} max={100} />
    </Calculator>{reference('crit')}
  </>;
  const resistanceTab = <>
    <Calculator title={t('How much damage does RES absorb?', 'Сколько урона поглощает сопротивление?')}
      description={t('Enter the resistance value and character level to see damage reduction and effective HP.', 'Введите сопротивление и уровень персонажа, чтобы узнать снижение урона и эффективное здоровье.')}
      onReset={resetResistance}
      result={<><span>{t('Damage reduction', 'Снижение урона')}</span><strong>{reduction === null ? '—' : pct(reduction)}</strong>
        <p>{reduction === null ? empty : fillText(t('Of 1,000 incoming damage, {0} gets through.', 'Из 1 000 входящего урона пройдёт {0}.'), [num(1000 * (1 - reduction))])}</p>
        <dl><div><dt>{t('Effective HP multiplier', 'Множитель эффективного ОЗ')}</dt><dd>{reduction === null ? '—' : `×${num(1 + res! / constant!, 3)}`}</dd></div>
          <div><dt>{t('Level coefficient K', 'Коэффициент уровня K')}</dt><dd>{constant ? num(constant) : '—'}</dd></div></dl></>}
      formula={<><span>{t('RES ÷ (RES + level coefficient)', 'СОПР ÷ (СОПР + коэффициент уровня)')}</span><code>{reduction === null ? '—' : `${num(res!)} ÷ (${num(res!)} + ${num(constant!)}) = ${pct(reduction)}`}</code></>}>
      {resistanceFields}
    </Calculator>
    <p className={styles.modelNote}>{t('The level basis follows Tools Build. Dependence on the attacker’s level has not been verified.', 'Основа уровня — как в Tools Build. Зависимость от уровня атакующего не проверена.')}</p>
    {reference('resistance')}
  </>;
  const ignoreTab = <>
    <Calculator title={t('Compare damage with ignore and shred', 'Сравните урон с игнором и срезом')}
      description={t('Ignore belongs to the attacker; shred is a debuff on the target. They reduce RES one after another.', 'Игнор — у атакующего, срез — дебафф на цели. Они последовательно уменьшают сопротивление.')}
      onReset={() => {resetResistance(); setIgnore('30'); setShred('0');}}
      result={<><span>{t('More damage than without ignore / shred', 'Прирост урона относительно исходного')}</span><strong>{after ? `+${pct(after.damageFactor - 1)}` : '—'}</strong>
        <p>{after ? t('Compared with the same target before these effects.', 'По сравнению с той же целью без этих эффектов.') : empty}</p>
        <dl><div><dt>{t('Effective RES', 'Итоговое СОПР')}</dt><dd>{after ? `${num(res!)} → ${num(after.effective)}` : '—'}</dd></div>
          <div><dt>{t('Damage reduction', 'Снижение урона')}</dt><dd>{after && reduction !== null ? `${pct(reduction)} → ${pct(after.reduction)}` : '—'}</dd></div></dl></>}
      formula={<><span>{t('RES × (1 − ignore) × (1 − shred)', 'СОПР × (1 − игнор) × (1 − срез)')}</span>
        <code>{after ? `${num(res!)} × (1 − ${pct(ignore! / 100)}) × (1 − ${pct(shred! / 100)}) = ${num(after.effective)}` : '—'}</code>
        <span>{t('Damage multiplier = (K + original RES) ÷ (K + effective RES)', 'Множитель урона = (K + исходное СОПР) ÷ (K + итоговое СОПР)')}</span></>}>
      {resistanceFields}
      <CalculatorField label={t('Resistance ignore', 'Игнор сопротивления')} hint={t('Attacker’s ignore percentage.', 'Процент игнора у атакующего.')} unit="%" value={ignoreText} onChange={setIgnore} max={100} />
      <CalculatorField label={t('Resistance shred', 'Срез сопротивления')} hint={t('Resistance reduction debuff on the target.', 'Дебафф снижения сопротивления на цели.')} unit="%" value={shredText} onChange={setShred} max={100} />
    </Calculator>
    <p className={styles.modelNote}>{t('30% ignore and 30% shred remove 51% of RES. Community-sheet model; intermediate rounding is not applied.', '30% игнора и 30% среза убирают 51% СОПР. Модель таблицы сообщества, без промежуточного округления.')}</p>
    {reference('resistance')}
  </>;
  return <SubTabs label={t('Combat formulas', 'Формулы боя')} tabs={[
    {id: 'crit', label: t('Crit chance', 'Шанс крита'), content: critTab},
    {id: 'resistance', label: t('Damage reduction', 'Снижение урона'), content: resistanceTab},
    {id: 'ignore', label: t('Ignore & shred', 'Игнор и срез'), content: ignoreTab},
  ]} />;
}
