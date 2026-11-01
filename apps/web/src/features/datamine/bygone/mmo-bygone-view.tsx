'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import type { HandbookMmoBygoneData, HandbookMmoBygoneMedia } from '../contracts/handbook';
import { useHandbookText } from '../handbook/sections/handbook-ui';
import { useEncounterSelection } from '../components/encounter-ui';
import { EnemyHealthSummary, EnemyStatBadges, type CombatStatIcons, type CombatStatTone } from '../components/enemy-combat-details';
import { EnemyLineupCard } from '../components/enemy-lineup-card';
import { BygoneHeader } from './bygone-header';
import { BYGONE_COPY } from './bygone-copy';
import { formatHpG, formatRangeStatus } from './bygone-domain';
import { MmoBygoneChart, MmoBygoneNavigator } from './mmo-bygone-chart';
import { mmoBygoneLineup, mmoBygoneRounds, mmoBygoneWindow, type MmoBygoneRound } from './mmo-bygone-domain';
import {MmoBygoneEnemyDetails, type MmoEnemyInspection} from './mmo-bygone-enemy-details';
import type { BygoneChartTheme, BygoneRangeState } from './bygone-types';
import styles from './bygone.module.css';
import mmo from './mmo-bygone.module.css';

function MmoFloorRow({round, portraits, identities, icons, selected, onSelect, onInspect}: {round: MmoBygoneRound; portraits?: HandbookMmoBygoneMedia['portraits']; identities?: HandbookMmoBygoneMedia['identities']; icons?: CombatStatIcons; selected: boolean; onSelect: () => void; onInspect: (inspection: MmoEnemyInspection) => void}) {
  const {locale, t, name, num, pct} = useHandbookText();
  const compact = new Intl.NumberFormat(locale, {notation: 'compact', maximumFractionDigits: 2});
  const enemies = mmoBygoneLineup(round);
  return <article className={mmo.floorRow} data-selected={selected} data-boss={round.isBossRound} aria-label={`${t('Floor', 'Этаж')} ${round.index}`}>
    <div className={mmo.floorSummary}><h3 className={mmo.floorTitle}><button type="button" className={mmo.floorButton} aria-pressed={selected} aria-label={`${t('Floor', 'Этаж')} ${round.index}${round.isBossRound ? ` · ${t('Boss', 'Босс')}` : ''}`} onClick={onSelect}>
      {t('Floor', 'Этаж')} {round.index}{round.isBossRound && <span className={`${styles.badge} ${styles.badgeBoss}`}>{t('Boss', 'Босс')}</span>}
    </button></h3>
      <dl className={mmo.floorStats}>
        {round.common?.recommendedCombatScore != null && <div><dt>{t('Recommended CS', 'Рекомендуемый CS')}</dt><dd>{num(round.common.recommendedCombatScore)}</dd></div>}
        {round.monsterLevelCurveValue != null && <div><dt tabIndex={0} title={t('Curve value at this floor. Final combat level and rounding are unconfirmed.', 'Значение кривой на этом этаже. Итоговый боевой уровень и округление не установлены.')}>{t('Level · curve', 'Уровень · кривая')}</dt><dd>{num(round.monsterLevelCurveValue)}</dd></div>}
        {enemies.length > 0 && <div><dt>{t('Enemies', 'Противники')}</dt><dd>{num(enemies.reduce((sum, enemy) => sum + enemy.count, 0))}</dd></div>}
      </dl>
    </div>
    <div className={mmo.lineup} role="list" aria-label={t('Enemy lineup', 'Состав противников')}>
      {enemies.map((enemy, index) => {
        const portrait = enemy.classPath ? portraits?.[enemy.classPath] : undefined;
        const identity = enemy.classPath ? identities?.[enemy.classPath] : undefined;
        const inspection = {enemy, floor: round.index, pool: round.pool?.id ?? null, hpScaling: round.hpScaling, defenseCurveValue: round.curveValues.DefBuffCount};
        const kind = enemy.type?.endsWith('_BOSS') ? 'boss' : enemy.type?.endsWith('_ELITE') ? 'elite' : 'normal';
        const stats = enemy.stats;
        const badges: {tone: Exclude<CombatStatTone, 'hp'>; text: string}[] = [];
        if (stats?.attack != null) badges.push({tone: 'atk', text: `${t('ATK', 'АТК')} ${compact.format(stats.attack)}`});
        if (stats?.armor != null && stats.armor > 0) badges.push({tone: 'armor', text: `${t('Armor', 'Броня')} ${compact.format(stats.armor)}`});
        if (stats?.finalCritDefense != null && stats.finalCritDefense > 0) badges.push({tone: 'crit', text: `${t('Crit Res', 'Сопр. крит.')} ${pct(stats.finalCritDefense)}`});
        return <div key={index} role="listitem" className={mmo.enemyItem}><EnemyLineupCard
          name={name(identity?.name ?? enemy.name, t('Unidentified enemy', 'Неопределённый противник'))}
          portrait={portrait ? gameAsset(portrait.thumbnail) : null} portraitFit="auto" imageLoading="lazy"
          portraitFallback={<span role={portrait ? undefined : 'img'} aria-hidden={Boolean(portrait)} aria-label={t('Artwork unavailable', 'Изображение отсутствует')}>?</span>}
          onInspect={() => onInspect(inspection)} hint={t('Open enemy details', 'Открыть карточку противника')}
          quantity={enemy.count > 1 ? num(enemy.count) : undefined} nameColor={kind === 'boss' ? '#c79dff' : undefined} kind={kind} kindLabel={kind === 'boss' ? t('Boss', 'Босс') : kind === 'elite' ? t('Elite', 'Элитный') : t('Regular', 'Обычный')}
          aside={<EnemyHealthSummary label={t('HP', 'ОЗ')} icon={icons?.hp} value={enemy.hp != null ? formatHpG(enemy.hp, 'hp', 2) : '—'} />}>
          <EnemyStatBadges items={badges} icons={icons} />
        </EnemyLineupCard></div>;
      })}
      {!enemies.length && <span className={mmo.status}>{t('No configured lineup.', 'Состав не задан.')}</span>}
    </div>
  </article>;
}

export function MmoBygoneView({ data, portraits, identities, combatIcons, selection }: {data: HandbookMmoBygoneData | null; portraits?: HandbookMmoBygoneMedia['portraits']; identities?: HandbookMmoBygoneMedia['identities']; combatIcons?: CombatStatIcons; selection?: {season?: string; floor?: string}}) {
  const {locale, t, name, num} = useHandbookText();
  const copy = BYGONE_COPY[locale];
  const [seasonId, setSeason] = useEncounterSelection('season', data?.rounds.at(-1)?.id ?? '', selection?.season);
  const season = data?.rounds.find(entry => entry.id === seasonId) ?? data?.rounds.at(-1);
  const rounds = useMemo(() => mmoBygoneRounds(season, identities), [season, identities]);
  const first = rounds[0]?.index ?? 0, last = rounds.at(-1)?.index ?? first;
  const [floorId, setFloor, ready] = useEncounterSelection('floor', String(last), selection?.floor);
  const selected = rounds.find(round => String(round.index) === floorId) ?? rounds.at(-1);
  const [range, setRange] = useState<BygoneRangeState>(() => selection?.floor ? {...mmoBygoneWindow(rounds, Number(selection.floor) || last), preset: 'custom'} : {minFloor: first, maxFloor: last, preset: 'all'});
  const [filter, setFilter] = useState<'all' | 'boss'>('all');
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState<BygoneChartTheme>('light');
  const [inspection, setInspection] = useState<MmoEnemyInspection | null>(null);
  const closeInspection = useCallback(() => setInspection(null), []);
  const directory = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const stored = new URL(window.location.href).searchParams.get('chartTheme') || localStorage.getItem('tof-datamine-bygone-chart-theme');
      if (stored === 'light' || stored === 'dark') setTheme(stored);
    } catch {}
  }, []);
  useEffect(() => {
    if (selected && (selected.index < range.minFloor || selected.index > range.maxFloor)) setRange({...mmoBygoneWindow(rounds, selected.index), preset: 'custom'});
  }, [selected, rounds, range.minFloor, range.maxFloor]);
  const filteredRounds = useMemo(() => rounds.filter(round => filter === 'all' || round.isBossRound), [rounds, filter]);
  const rangeRounds = useMemo(() => rounds.filter(round => round.index >= range.minFloor && round.index <= range.maxFloor), [rounds, range.minFloor, range.maxFloor]);
  const chartRounds = useMemo(() => filteredRounds.filter(round => round.index >= range.minFloor && round.index <= range.maxFloor), [filteredRounds, range.minFloor, range.maxFloor]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (query ? rounds : chartRounds).filter(round => {
      if (filter === 'boss' && !round.isBossRound) return false;
      if (!query) return true;
      if (/^\d+$/.test(query)) return round.index === Number(query);
      return mmoBygoneLineup(round).some(enemy => `${name((enemy.classPath ? identities?.[enemy.classPath]?.name : null) ?? enemy.name)} ${enemy.localizedNameKey ?? ''} ${enemy.classPath ?? ''}`.toLowerCase().includes(query));
    });
  }, [rounds, chartRounds, search, filter, name, identities]);
  useEffect(() => {
    const panel = directory.current;
    const row = panel?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!panel || !row) return;
    const bounds = panel.getBoundingClientRect(), target = row.getBoundingClientRect();
    if (target.top < bounds.top || target.bottom > bounds.bottom) panel.scrollTop += target.top - bounds.top - (panel.clientHeight - target.height) / 2;
  }, [selected?.index, range.minFloor, range.maxFloor, search, filter]);
  const chooseFloor = (floor: number) => {setSearch(''); setFloor(String(floor));};
  const chooseWindow = (floor: number, size = rangeRounds.length || 20) => {setSearch(''); setRange({...mmoBygoneWindow(rounds, floor, size), preset: 'custom'}); setFloor(String(floor));};
  const latest = () => {setSearch(''); setRange({...mmoBygoneWindow(rounds, last), preset: 'latest20'}); setFloor(String(last));};
  const chooseFilter = (value: 'all' | 'boss') => {
    setFilter(value);
    setSearch('');
    if (value === 'boss' && selected && !selected.isBossRound) {
      const candidates = rangeRounds.filter(round => round.isBossRound);
      const target = candidates.find(round => round.index >= selected.index) ?? candidates.at(-1);
      if (target) setFloor(String(target.index));
    }
  };
  if (!data || !season || !selected) return <div className={styles.container}><div className={styles.layout}><BygoneHeader mode="mmo" /><EmptyState title={t('No MMO floors available', 'Этажи MMO недоступны')} /></div></div>;
  const previousRound = filteredRounds.filter(round => round.index < selected.index).at(-1);
  const nextRound = filteredRounds.find(round => round.index > selected.index);
  return <div className={`${styles.container} ${mmo.root}`} data-chart-theme={theme} data-encounter-ready={ready}><div className={styles.layout}>
    <BygoneHeader mode="mmo" />
    <section className={styles.section} aria-labelledby="mmo-bygone-charts"><div className={styles.sectionInner}>
      <div className={styles.sectionHeader}><h2 className={styles.sectionTitle} id="mmo-bygone-charts">{copy.chartsTitle}</h2><div className={`${styles.chartsControls} ${mmo.controls}`}>
        {data.rounds.length > 1 && <label className={mmo.rangeField}>{t('Season', 'Сезон')}<select className={mmo.season} value={season.id} onChange={event => {setSeason(event.target.value); setFloor(String(data.rounds.find(entry => entry.id === event.target.value)?.rounds.at(-1)?.index ?? ''));}}>{data.rounds.map(entry => <option key={entry.id} value={entry.id}>{entry.id}</option>)}</select></label>}
        <div className={styles.controlItem}><span className={styles.controlLabel}>{copy.ctrlRange}</span><div className={styles.segmentedSwitch} role="group" aria-label={t('Floor range', 'Диапазон этажей')}>
          <button type="button" className={`${styles.switchBtn} ${range.preset === 'latest20' ? styles.isActive : ''}`} aria-pressed={range.preset === 'latest20'} onClick={latest}>{copy.rangeLatest20}</button>
          <button type="button" className={`${styles.switchBtn} ${range.preset === 'all' ? styles.isActive : ''}`} aria-pressed={range.preset === 'all'} onClick={() => {setSearch(''); setRange({minFloor: first, maxFloor: last, preset: 'all'});}}>{copy.rangeAll}</button>
        </div></div>
        <div className={styles.controlItem}><span className={styles.controlLabel}>{t('Floors', 'Этажи')}</span><div className={styles.segmentedSwitch} role="group" aria-label={t('Chart floors', 'Этажи на графиках')}>
          {(['all', 'boss'] as const).map(value => <button key={value} type="button" className={`${styles.switchBtn} ${filter === value ? styles.isActive : ''}`} aria-pressed={filter === value} onClick={() => chooseFilter(value)}>{value === 'all' ? t('All', 'Все') : t('Bosses', 'Боссы')}</button>)}
        </div></div>
        <label className={mmo.rangeField}>{t('From', 'От')}<input type="number" min={first} max={range.maxFloor} value={range.minFloor} onChange={event => {if (event.target.value) {setSearch(''); const value = Math.max(first, Math.min(range.maxFloor, Number(event.target.value))); setRange({...range, minFloor: value, preset: 'custom'}); if (selected.index < value) setFloor(String(value));}}} /></label>
        <label className={mmo.rangeField}>{t('To', 'До')}<input type="number" min={range.minFloor} max={last} value={range.maxFloor} onChange={event => {if (event.target.value) {setSearch(''); const value = Math.min(last, Math.max(range.minFloor, Number(event.target.value))); setRange({...range, maxFloor: value, preset: 'custom'}); if (selected.index > value) setFloor(String(value));}}} /></label>
        <span className={styles.rangeStatus} aria-live="polite">{formatRangeStatus(copy.rangeStatus, range.minFloor, range.maxFloor, chartRounds.length)}</span>
        <div className={styles.controlItem}><span className={styles.controlLabel}>{copy.chartPalette}</span><div className={styles.segmentedSwitch} role="group" aria-label={t('Chart palette', 'Палитра графиков')}>{(['light', 'dark'] as const).map(value => <button key={value} type="button" className={`${styles.switchBtn} ${theme === value ? styles.isActive : ''}`} aria-pressed={theme === value} onClick={() => {setTheme(value); localStorage.setItem('tof-datamine-bygone-chart-theme', value);}}>{value === 'light' ? copy.paletteLight : copy.paletteDark}</button>)}</div></div>
      </div></div>
      <div className={styles.chartStack}>
        <MmoBygoneChart rounds={chartRounds} allRounds={filteredRounds} portraits={portraits} selected={selected.index} field="hp" label={t('Bygone MMO: maximum known enemy HP', 'Былой фантазм MMO: максимум известных ОЗ противника')} theme={theme} onSelect={chooseFloor} onZoom={factor => chooseWindow(selected.index, Math.max(2, rangeRounds.length * factor))} onReset={latest} />
        <MmoBygoneChart rounds={chartRounds} allRounds={filteredRounds} portraits={portraits} selected={selected.index} field="powercreep" label={t('Bygone MMO: required damage growth', 'Былой фантазм MMO: прирост требуемого урона')} theme={theme} onSelect={chooseFloor} onZoom={factor => chooseWindow(selected.index, Math.max(2, rangeRounds.length * factor))} onReset={latest} />
      </div>
      <MmoBygoneNavigator rounds={filteredRounds} min={range.minFloor} max={range.maxFloor} onChange={floor => chooseWindow(floor)} />
    </div></section>
    <section className={styles.section} aria-labelledby="mmo-bygone-floors"><div className={styles.sectionInner}>
      <div className={styles.floorsHeader}><div><h2 className={styles.sectionTitle} id="mmo-bygone-floors">{t('Floors', 'Этажи')}</h2><p className={styles.sectionBody}>{t('HP includes floor HP stacks. Other attributes use source baselines.', 'ОЗ учитывают стаки HP этажа. Остальные характеристики показаны по исходной базе.')}</p></div>
        <div className={styles.searchWrap}><input className={styles.searchInput} type="search" value={search} aria-label={t('Find a floor or enemy', 'Найти этаж или противника')} placeholder={t('Find a floor or enemy…', 'Найти этаж или противника…')} onChange={event => {const value = event.target.value; setSearch(value); if (/^\d+$/.test(value) && filteredRounds.some(round => round.index === Number(value))) {setFloor(value); setRange({...mmoBygoneWindow(rounds, Number(value)), preset: 'custom'});}}} /></div>
      </div>
      <div className={styles.filterBar}><div className={styles.segmentedSwitch} role="group" aria-label={t('Floor filters', 'Фильтры этажей')}>{(['all', 'boss'] as const).map(value => <button key={value} type="button" className={`${styles.switchBtn} ${filter === value ? styles.isActive : ''}`} aria-pressed={filter === value} onClick={() => chooseFilter(value)}>{value === 'all' ? copy.filterAll : t('Boss floors', 'Этажи с боссом')}</button>)}</div>
        <div className={styles.actionGroup}><button type="button" className={`${styles.button} ${styles.buttonSubtle}`} disabled={!previousRound} aria-label={t('Previous floor', 'Предыдущий этаж')} onClick={() => {if (previousRound) chooseFloor(previousRound.index);}}>←</button><span className={mmo.status}>{t('Floor', 'Этаж')} {selected.index}</span><button type="button" className={`${styles.button} ${styles.buttonSubtle}`} disabled={!nextRound} aria-label={t('Next floor', 'Следующий этаж')} onClick={() => {if (nextRound) chooseFloor(nextRound.index);}}>→</button></div>
      </div>
      <div ref={directory} className={`${styles.tableWrap} ${mmo.rows}`} role="region" aria-label={t('Floor lineups', 'Состав этажей')} tabIndex={0}>
      <div className={mmo.tableHeader} aria-hidden="true"><span>{t('Floor', 'Этаж')}</span><span>{t('Enemy lineup', 'Состав противников')}</span></div><div className={styles.floorRowList}>
        {visible.map(round => <MmoFloorRow key={round.index} round={round} portraits={portraits} identities={identities} icons={combatIcons} selected={selected.index === round.index} onSelect={() => chooseFloor(round.index)} onInspect={setInspection} />)}
        {!visible.length && <p className={mmo.empty}>{t('No matching floors.', 'Этажи не найдены.')}</p>}
      </div></div>
    </div></section>
    {inspection && <MmoBygoneEnemyDetails inspection={inspection} icons={combatIcons} media={{portraits: portraits ?? {}, identities}} onClose={closeInspection} />}
  </div></div>;
}
