'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { gameAsset } from '@tof-hub/game-assets';
import { downloadBlob, downloadCanvasPng } from '@/lib/download';
import type { HandbookMmoBygoneMedia } from '../contracts/handbook';
import { ChartHoverCard } from '../components/chart-hover-card';
import { CHART_FONT_FAMILY, CHART_TITLE_CANVAS_FONT, drawChartWatermark } from '../components/chart-branding';
import { useHandbookText } from '../handbook/sections/handbook-ui';
import { mmoBygoneLineup, mmoBygoneMaxEnemyHp, mmoBygoneValue, type MmoBygoneRound } from './mmo-bygone-domain';
import type { BygoneChartKind, BygoneChartTheme } from './bygone-types';
import { formatHpG, formatPowercreep } from './bygone-domain';
import styles from './bygone.module.css';
import mmo from './mmo-bygone.module.css';

const WIDTH = 1800, HEIGHT = 760;
const LEFT = 130, RIGHT = 60, TOP = 88, BOTTOM = 85;

export function MmoBygoneChart({rounds, allRounds, portraits, field, label, theme, selected, onSelect, onZoom, onReset}: {
  rounds: MmoBygoneRound[]; allRounds: MmoBygoneRound[]; field: BygoneChartKind; label: string; theme: BygoneChartTheme;
  portraits?: HandbookMmoBygoneMedia['portraits'];
  selected: number; onSelect: (floor: number) => void; onZoom: (factor: number) => void; onReset: () => void;
}) {
  const {locale, t, name, num} = useHandbookText();
  const unitLabel = field === 'hp' ? t('One enemy · highest known HP · including floor stacks', 'Один противник · максимум известных ОЗ · со стаками этажа') : t('Growth of the maximum known HP versus the previous matching floor · %', 'Прирост максимума известных ОЗ к предыдущему этажу выборки · %');
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{round: MmoBygoneRound; x: number; y: number} | null>(null);
  const values = useMemo(() => new Map(allRounds.map((round, index) => [round.index, mmoBygoneValue(round, field, allRounds[index - 1])])), [allRounds, field]);
  const points = useMemo(() => rounds.flatMap(round => {
    const value = values.get(round.index);
    return value == null ? [] : [{round, value}];
  }), [rounds, values]);
  const first = rounds[0]?.index ?? 0, last = rounds.at(-1)?.index ?? first;
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !points.length) return;
    const formatter = new Intl.NumberFormat(locale, {maximumFractionDigits: 2});
    const dark = theme === 'dark';
    const text = dark ? '#c6bdd0' : '#51475c';
    const color = field === 'hp' ? '#ff4f77' : '#ff9bb2';
    const minimum = Math.min(...points.map(point => point.value));
    const maximum = Math.max(...points.map(point => point.value));
    const spread = Math.max(maximum - minimum, maximum === minimum ? Math.max(1, Math.abs(maximum) * .15) : 1);
    const unit = 10 ** Math.floor(Math.log10(spread / 5));
    const step = [1, 2, 5, 10].find(value => value * unit >= spread / 5)! * unit;
    const low = field === 'powercreep' ? Math.floor(Math.min(0, minimum) / step) * step : Math.max(0, Math.floor((minimum - (maximum === minimum ? spread / 2 : 0)) / step) * step);
    const upper = maximum + (maximum === minimum ? spread / 2 : 0);
    const high = Math.max(low + step, Math.ceil((field === 'powercreep' ? Math.max(0, upper) : upper) / step) * step);
    const x = (floor: number) => LEFT + (floor - first) / Math.max(1, last - first) * (WIDTH - LEFT - RIGHT);
    const y = (value: number) => HEIGHT - BOTTOM - (value - low) / (high - low) * (HEIGHT - TOP - BOTTOM);
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      ctx.fillStyle = dark ? '#100c17' : '#fff'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.textAlign = 'center'; ctx.fillStyle = text; ctx.font = CHART_TITLE_CANVAS_FONT; ctx.fillText(label, WIDTH / 2, 42);
      ctx.font = `16px ${CHART_FONT_FAMILY}`; ctx.fillText(unitLabel, WIDTH / 2, 68);
      ctx.font = `20px ${CHART_FONT_FAMILY}`;
      for (let tick = 0; tick <= Math.round((high - low) / step); tick++) {
        const value = low + step * tick;
        const top = y(value);
        ctx.strokeStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.10)'; ctx.lineWidth = field === 'powercreep' && value === 0 ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(LEFT, top); ctx.lineTo(WIDTH - RIGHT, top); ctx.stroke();
        const tickLabel = field === 'hp' ? formatHpG(value, 'hp') : `${formatter.format(value)}%`;
        ctx.fillStyle = text; ctx.textAlign = 'right'; ctx.fillText(tickLabel, LEFT - 16, top + 7);
      }
      const labelStep = Math.max(1, Math.ceil(points.length / 20));
      let previousLabelX = -Infinity;
      const finalLabelX = x(points.at(-1)!.round.index);
      for (let index = 0; index < points.length; index++) {
        if (index % labelStep !== 0 && index !== points.length - 1) continue;
        const point = points[index]!;
        const labelX = x(point.round.index);
        if (labelX - previousLabelX < 70 || (index !== points.length - 1 && finalLabelX - labelX < 70)) continue;
        ctx.textAlign = 'center'; ctx.fillStyle = text; ctx.fillText(String(point.round.index), labelX, HEIGHT - BOTTOM + 32);
        previousLabelX = labelX;
      }
      ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath();
      let connected = false;
      for (const round of rounds) {
        const value = values.get(round.index);
        if (value == null) {connected = false; continue;}
        if (connected) ctx.lineTo(x(round.index), y(value)); else ctx.moveTo(x(round.index), y(value));
        connected = true;
      }
      ctx.stroke();
      if (points.length <= 30) for (const point of points) {
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x(point.round.index), y(point.value), point.round.isBossRound ? 7 : 4, 0, Math.PI * 2); ctx.fill();
      }
      const active = points.find(point => point.round.index === selected);
      if (active) {
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(x(selected), TOP); ctx.lineTo(x(selected), HEIGHT - BOTTOM); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x(selected), y(active.value), 9, 0, Math.PI * 2); ctx.fill();
      }
      drawChartWatermark(ctx, 40, HEIGHT - 20, text);
    };
    draw();
    void document.fonts.ready.then(draw);
    return () => {cancelled = true;};
  }, [points, rounds, values, field, first, last, locale, theme, selected, label, unitLabel]);
  const pick = (clientX: number, element: HTMLElement) => {
    if (!rounds.length) return null;
    const bounds = element.getBoundingClientRect();
    const plotX = (clientX - bounds.left) / bounds.width * WIDTH;
    const floor = first + Math.max(0, Math.min(1, (plotX - LEFT) / (WIDTH - LEFT - RIGHT))) * (last - first);
    return rounds.reduce((nearest, round) => Math.abs(round.index - floor) < Math.abs(nearest.index - floor) ? round : nearest, rounds[0]!);
  };
  const csv = () => {
    const rows: (string | number | null | undefined)[][] = [['Floor', 'MaxKnownEnemyHP', 'HPGrowthPercent', 'PreviousFloor', 'MissingHPEnemyCount', 'MaxHPEnemy', 'MaxHPClass', 'HPScalingCurve', 'RecommendedCS', 'EnemyLevelCurve', 'Enemy', 'Class', 'Count', 'HP', 'BaseHP', 'BaseATK', 'HPStacks', 'HPMultiplier']];
    for (const round of rounds) {
      const previous = allRounds[allRounds.indexOf(round) - 1];
      const growth = mmoBygoneValue(round, 'powercreep', previous);
      const maximum = mmoBygoneMaxEnemyHp(round);
      for (const enemy of mmoBygoneLineup(round)) rows.push([round.index, maximum.hp, growth, growth == null ? null : previous?.index, maximum.missingHpEnemyCount, maximum.enemy ? name(maximum.enemy.name, maximum.enemy.localizedNameKey ?? '') : null, maximum.enemy?.classPath, round.curveValues.HpBuffCount, round.common?.recommendedCombatScore, round.monsterLevelCurveValue, name(enemy.name, enemy.localizedNameKey ?? ''), enemy.classPath, enemy.count, enemy.hp, enemy.stats?.maxHealth, enemy.stats?.attack, round.hpScaling?.stacks, round.hpScaling?.multiplier]);
    }
    const text = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    downloadBlob(`\uFEFF${text}`, 'text/csv;charset=utf-8;', `bygone-mmo-${first}-${last}.csv`);
  };
  const hoveredMaximum = hover ? mmoBygoneMaxEnemyHp(hover.round) : null;
  const hoveredPortrait = hoveredMaximum?.enemy?.classPath ? portraits?.[hoveredMaximum.enemy.classPath] : undefined;
  const hoveredValue = hover ? values.get(hover.round.index) : null;
  const previous = hover ? allRounds[allRounds.indexOf(hover.round) - 1] : null;
  const partial = (hoveredMaximum?.missingHpEnemyCount ?? 0) > 0 || (field === 'powercreep' && previous && mmoBygoneMaxEnemyHp(previous).missingHpEnemyCount > 0);
  return <article className={styles.chartCard}>
    <div className={styles.chartCardHeader}><h3 className={styles.chartCardTitle}>{label}</h3><div className={styles.actionGroup}>
      <button type="button" className={styles.button} disabled={!points.length} onClick={() => {if (canvas.current) downloadCanvasPng(canvas.current, `bygone-mmo-${field}-${first}-${last}.png`);}}>{t('Download PNG', 'Скачать PNG')}</button>
      <button type="button" className={`${styles.button} ${styles.buttonSubtle}`} onClick={csv}>{t('Download CSV', 'Скачать CSV')}</button>
    </div></div>
    <div className={styles.chartSubbar}><span className={styles.chartUnit}>{unitLabel}</span><div className={styles.chartOptions}>
      <button className={styles.btnIcon} type="button" onClick={() => onZoom(.5)} aria-label={t('Zoom in', 'Приблизить')}>+</button>
      <button className={styles.btnIcon} type="button" onClick={() => onZoom(2)} aria-label={t('Zoom out', 'Отдалить')}>−</button>
      <button className={styles.btnIcon} type="button" onClick={onReset}>{t('Reset', 'Сброс')}</button>
    </div></div>
    <div className={styles.chartFrame} tabIndex={rounds.length ? 0 : -1} role="slider" aria-label={`${label} · ${t('select floor', 'выбор этажа')}`} aria-valuemin={first} aria-valuemax={last} aria-valuenow={rounds.length ? Math.max(first, Math.min(last, selected)) : undefined} aria-disabled={!rounds.length}
      onPointerMove={event => {const round = pick(event.clientX, event.currentTarget); if (round && event.pointerType !== 'touch') setHover({round, x: Math.max(150, Math.min(innerWidth - 150, event.clientX)), y: Math.max(220, event.clientY)});}}
      onPointerLeave={() => setHover(null)} onClick={event => {const round = pick(event.clientX, event.currentTarget); if (round) onSelect(round.index);}}
      onKeyDown={event => {if (!rounds.length) return; const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0; if (!step && event.key !== 'Home' && event.key !== 'End') return; event.preventDefault(); const index = Math.max(0, rounds.findIndex(round => round.index === selected)); onSelect(event.key === 'Home' ? first : event.key === 'End' ? last : rounds[Math.max(0, Math.min(rounds.length - 1, index + step))]!.index);}}>
      {points.length ? <canvas ref={canvas} width={WIDTH} height={HEIGHT} className={styles.chartCanvas} /> : <p className={mmo.empty}>{t('No comparable enemy HP values in this range.', 'В этом диапазоне нет сопоставимых значений ОЗ противников.')}</p>}
    </div>
    {hover && <ChartHoverCard x={hover.x} y={hover.y} eyebrow={`${t('Floor', 'Этаж')} ${hover.round.index}${field === 'powercreep' && hoveredValue != null && previous ? ` · ${t('vs floor', 'к этажу')} ${previous.index}` : ''}`} value={hoveredValue == null ? t('Value unavailable', 'Значение отсутствует') : field === 'powercreep' ? formatPowercreep(hoveredValue) : `${t('HP', 'ОЗ')}: ${formatHpG(hoveredValue, 'hp')}`}
      portrait={hoveredPortrait ? gameAsset(hoveredPortrait.thumbnail) : undefined}
      name={hoveredMaximum?.enemy ? name(hoveredMaximum.enemy.name, hoveredMaximum.enemy.localizedNameKey ?? t('Unidentified enemy', 'Неопределённый противник')) : undefined}
      meta={<>
        <div>{t('Level · curve', 'Уровень · кривая')}: {hover.round.monsterLevelCurveValue != null ? num(hover.round.monsterLevelCurveValue) : '—'}</div>
        <div>{t('Recommended CS', 'Рекомендуемый CS')}: {hover.round.common?.recommendedCombatScore != null ? num(hover.round.common.recommendedCombatScore) : '—'}</div>
        <div>{t('HP of one enemy · including floor stacks', 'ОЗ одного противника · со стаками этажа')}</div>
      </>}
      footer={partial ? t('Some enemies have no HP data; the highest known value is shown.', 'ОЗ части противников неизвестны; показан максимум среди известных значений.') : undefined} />}
  </article>;
}

export function MmoBygoneNavigator({rounds, min, max, onChange}: {rounds: MmoBygoneRound[]; min: number; max: number; onChange: (floor: number) => void}) {
  const {t} = useHandbookText();
  const first = rounds[0]?.index ?? 0, last = rounds.at(-1)?.index ?? first;
  const x = (floor: number) => 10 + (floor - first) / Math.max(1, last - first) * 1780;
  const values = rounds.flatMap(round => mmoBygoneValue(round, 'hp') == null ? [] : [{floor: round.index, value: mmoBygoneValue(round, 'hp')!}]);
  const highest = Math.max(1, ...values.map(point => point.value));
  const nearest = (floor: number) => rounds.reduce((best, round) => Math.abs(round.index - floor) < Math.abs(best.index - floor) ? round : best, rounds[0]!);
  const pick = (clientX: number, element: SVGSVGElement) => {if (!rounds.length) return; const bounds = element.getBoundingClientRect(); onChange(nearest(first + Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)) * (last - first)).index);};
  const midpoint = Math.max(first, Math.min(last, Math.round((min + max) / 2)));
  return <div className={styles.overviewPanel}><div className={styles.overviewWrap}>
    <span className={styles.overviewLabel}>{t('Mini Overview Navigator', 'Навигация по этажам')} ({first}–{last})</span>
    <svg viewBox="0 0 1800 42" preserveAspectRatio="none" className={`${styles.overviewCanvas} ${mmo.navigator}`} role="slider" tabIndex={rounds.length ? 0 : -1} aria-disabled={!rounds.length} aria-label={t('Floor range navigator', 'Навигатор диапазона этажей')} aria-valuemin={first} aria-valuemax={last} aria-valuenow={rounds.length ? midpoint : undefined}
      onPointerDown={event => {event.currentTarget.setPointerCapture(event.pointerId); pick(event.clientX, event.currentTarget);}} onPointerMove={event => {if (event.buttons === 1) pick(event.clientX, event.currentTarget);}}
      onKeyDown={event => {if (!rounds.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const index = rounds.indexOf(nearest(midpoint)); onChange(event.key === 'Home' ? first : event.key === 'End' ? last : rounds[Math.max(0, Math.min(rounds.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)))]!.index);}}>
      <polyline points={values.map(point => `${x(point.floor)},${38 - point.value / highest * 32}`).join(' ')} fill="none" stroke="#b197ba" strokeWidth="2" />
      <rect x={x(min)} y="1" width={Math.max(8, x(max) - x(min))} height="40" rx="3" fill="rgba(245,217,122,.18)" stroke="#f5d97a" strokeWidth="2" />
    </svg>
  </div><p className={styles.chartHint}>{t('Click or drag to move the visible range. Select a floor on either chart to highlight its lineup below.', 'Нажмите или перетащите для смены диапазона. Выберите этаж на графике, чтобы выделить его состав ниже.')}</p></div>;
}
