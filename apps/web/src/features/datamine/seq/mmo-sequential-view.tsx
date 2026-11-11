'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { CatalogSearch, Collapsible, EmptyState, GameRichText, Tooltip } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import type { HandbookBiochemicalData, HandbookBiochemicalMedia } from '../contracts/handbook';
import { HandbookTable, useHandbookText } from '../handbook/sections/handbook-ui';
import { EncounterEffectCatalog } from '../components/encounter-effect-catalog';
import { EncounterModeSwitcher, useEncounterSelection } from '../components/encounter-ui';
import { EnemyLineupCard } from '../components/enemy-lineup-card';
import { EncounterBuffCard, EncounterRowChevron } from '../components/encounter-buff-card';
import { EnemyHealthSummary, EnemyStatBadges, type CombatStatIcons, type CombatStatTone } from '../components/enemy-combat-details';
import { MmoSequentialEnemyDetails } from './mmo-sequential-enemy-details';
import { knownEnemyValue, sequentialLineup as lineup, sequentialEnemyPortrait as portraitFor, sequentialEnemyKind, sequentialEnemyMedia } from './mmo-sequential-enemy';
import { GameStatGrade } from '../../info-sections/common/game-stat-grade';
import { parseEnemyGradeText } from './enemy-grade-text';
import { currentSequentialSeason, sequentialSeasonPeriod } from './mmo-sequential-season';
import oow from '../oow/oow.module.css';
import styles from './mmo-sequential.module.css';

type Season = HandbookBiochemicalData['seasons'][number];
type Pod = Season['levels'][number];
function PodEnemies({pod, media, icons}: {pod: Pod; media?: HandbookBiochemicalMedia | null; icons?: CombatStatIcons}) {
  const {locale, t, name, num, pct} = useHandbookText();
  const [inspectionSlot, setInspectionSlot] = useState<string | null>(null);
  const closeInspection = useCallback(() => setInspectionSlot(null), []);
  const enemies = lineup(pod);
  const inspected = enemies.find(enemy => enemy.sourceSlot === inspectionSlot);
  const compact = new Intl.NumberFormat(locale, {notation: 'compact', maximumFractionDigits: 2});
  return <section aria-label={t('Enemy lineup and base stats', 'Противники и базовые характеристики')} className={styles.enemySection}>
    <h4>{t('Enemy lineup · base stats', 'Противники · базовые характеристики')}</h4>
    <div className={styles.enemies} role="list">
      {enemies.map(enemy => {
        const portrait = portraitFor(pod, enemy, media);
        const kind = sequentialEnemyKind(enemy);
        const stats = enemy.stats;
        const badges: {tone: Exclude<CombatStatTone, 'hp'>; text: string}[] = [];
        if (knownEnemyValue(stats?.attack)) badges.push({tone: 'atk', text: `${t('ATK', 'АТК')} ${compact.format(stats.attack)}`});
        if (knownEnemyValue(stats?.armor) && stats.armor > 0) badges.push({tone: 'armor', text: `${t('Armor', 'Броня')} ${compact.format(stats.armor)}`});
        if (knownEnemyValue(stats?.critDefense) && stats.critDefense > 0) badges.push({tone: 'crit', text: `${t('Crit Res', 'Сопр. крит.')} ${pct(stats.critDefense)}`});
        return <div key={enemy.sourceSlot} role="listitem"><EnemyLineupCard name={name(enemy.name, t('Unidentified enemy', 'Неопределённый противник'))}
          portrait={portrait ? gameAsset(portrait) : null} portraitFit={sequentialEnemyMedia(pod, enemy, media)?.portraitFit ?? 'contain'} imageLoading="lazy"
          portraitFallback={!portrait ? <span role="img" aria-label={t('Full artwork unavailable', 'Полное изображение отсутствует')}>?</span> : undefined}
          quantity={enemy.count != null && enemy.count > 1 ? num(enemy.count) : undefined} kind={kind}
          nameColor={kind === 'boss' ? '#c79dff' : undefined}
          kindLabel={kind === 'boss' ? t('Boss', 'Босс') : kind === 'elite' ? t('Elite', 'Элитный') : t('Regular', 'Обычный')}
          onInspect={() => setInspectionSlot(enemy.sourceSlot)} hint={t('Open enemy details', 'Открыть карточку противника')}
          badges={enemy.level != null && <span className={oow.mobLevelTag}>{t('Lv.', 'Ур.')} {num(enemy.level)}</span>}
          aside={<EnemyHealthSummary label={t('Base HP', 'Базовые ОЗ')} icon={icons?.hp} value={knownEnemyValue(stats?.maxHealth) ? compact.format(stats.maxHealth) : '—'} />}>
          <EnemyStatBadges items={badges} icons={icons} />
        </EnemyLineupCard></div>;
      })}
    </div>
    {inspected && <MmoSequentialEnemyDetails pod={pod} enemy={inspected} media={media} icons={icons} onClose={closeInspection} />}
  </section>;
}

function PodDetails({pod, media, icons}: {pod: Pod; media?: HandbookBiochemicalMedia | null; icons?: CombatStatIcons}) {
  const {t, name, num} = useHandbookText();
  const gradeText = name(pod.enemyGrades);
  const grades = parseEnemyGradeText(gradeText);
  return <div className={styles.drawer}>
    <header className={styles.drawerHeader}><h3>{name(pod.name, pod.id)}</h3>
      {pod.enemyGrades && <div className={styles.grades}>
        <GameRichText density="compact" text={grades?.summary ?? gradeText} />
        {grades && <dl className={styles.gradeList}>{grades.ratings.map((rating, index) => <div key={index}>
          <dt>{rating.label}</dt><dd><GameStatGrade grade={rating.grade} /></dd>
        </div>)}</dl>}
      </div>}</header>
    <div className={styles.overview}>
      <PodEnemies pod={pod} media={media} icons={icons} />
      {pod.bonusObjectives.length > 0 && <section className={styles.objectives}>
        <h4>{t('Bonus objectives', 'Дополнительные условия')}</h4>
        <HandbookTable compact caption={t('Bonus objectives', 'Дополнительные условия')}
          columns={[{label: t('Condition', 'Условие')}, {label: t('Score', 'Очки')} ]}
          rows={pod.bonusObjectives.map((objective, index) => ({key: String(index), cells: [
            <span key="description" className={styles.objectiveDescription}>{name(objective.description)}</span>,
            objective.score != null ? <b key="score" className={styles.objectiveScore}>+{num(objective.score)}</b> : '—',
          ]}))} />
      </section>}
    </div>
    <section aria-label={t('Combat effects', 'Боевые эффекты')} className={styles.buffColumns}>
      {([false, true, null] as const).flatMap(negative => {
        const buffs = pod.buffs.filter(buff => buff.isDisadvantage === negative);
        return buffs.map((buff, index) => <div key={buff.id} className={styles.buffColumn} data-negative={negative}>
          <h4 data-placeholder={index > 0} aria-hidden={index > 0 || undefined}>{negative === null ? t('Other effects', 'Прочие эффекты') : negative ? t('Disadvantages', 'Недостатки') : t('Advantages', 'Преимущества')}</h4>
          <EncounterBuffCard name={name(buff.name, buff.id)}
            icon={buff.icon ? gameAsset(buff.icon) : null} accent={negative === null ? '#f5d97a' : negative ? '#ff6b8b' : '#4fe3c1'}
            badge={negative === null ? undefined : negative ? t('Disadvantage', 'Недостаток') : t('Advantage', 'Преимущество')}
            description={name(buff.description) && <GameRichText density="compact" text={name(buff.description)} />} />
        </div>);
      })}
    </section>
  </div>;
}

export function MmoSequentialView({data, media, combatIcons, selection}: {data: HandbookBiochemicalData | null; media?: HandbookBiochemicalMedia | null; combatIcons?: CombatStatIcons; selection?: {season?: string; pod?: string}}) {
  const {locale, t, name, num} = useHandbookText();
  const liveSeason = currentSequentialSeason(data?.seasons ?? []);
  const fallbackSeason = (selection?.pod ? data?.seasons.filter(entry => entry.levels.some(pod => pod.id === selection.pod)).at(-1) : undefined) ?? liveSeason ?? data?.seasons.slice().reverse().find(entry => entry.levels.length > 0) ?? data?.seasons.at(-1);
  const [seasonId, setSeason, ready] = useEncounterSelection('season', fallbackSeason?.id ?? '', selection?.season);
  const [podId, setPod] = useEncounterSelection('pod', '', selection?.pod);
  const [search, setSearch] = useState('');
  const rail = useRef<HTMLDivElement>(null);
  const season = data?.seasons.find(entry => entry.id === seasonId) ?? fallbackSeason;
  useEffect(() => {
    const panel = rail.current;
    if (!panel) return;
    const reveal = () => {
      const active = panel.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!active) return;
      const bounds = panel.getBoundingClientRect(), item = active.getBoundingClientRect();
      if (item.top < bounds.top || item.bottom > bounds.bottom) panel.scrollTop += item.top - bounds.top - (panel.clientHeight - item.height) / 2;
      if (item.left < bounds.left || item.right > bounds.right) panel.scrollLeft += item.left - bounds.left - (panel.clientWidth - item.width) / 2;
    };
    const frame = requestAnimationFrame(reveal);
    const observer = new ResizeObserver(reveal);
    observer.observe(panel);
    return () => {cancelAnimationFrame(frame); observer.disconnect();};
  }, [season?.id]);
  const seasonLabel = (entry: Season) => entry.seasonNumber != null ? `${t('Season', 'Сезон')} ${num(entry.seasonNumber)}` : name(entry.name, `${t('Activity', 'Активность')} ${entry.id.replace(/^Activity/, '')}`);
  const date = (value: Season['start']) => value ? `${String(value.day).padStart(2, '0')}.${String(value.month).padStart(2, '0')}` : '';
  const chooseSeason = (id: string) => {setSeason(id); setPod(''); setSearch('');};
  const header = <header className={oow.hero}><div><p className={oow.heroSubtitle}>{t('DATAMINE · SEQUENTIAL MMO', 'ДАТАМАЙН · SEQUENTIAL MMO')}</p><h1 className={oow.heroTitle}>{t('Biochemical Collapse', 'Биохимический коллапс')}</h1></div><EncounterModeSwitcher mode="mmo" path="/datamine/seq/" /></header>;
  if (!data || !season) return <div className={oow.container}><div className={oow.mainWrap}>{header}<EmptyState title={t('No MMO seasons available', 'Сезоны MMO недоступны')} /></div></div>;
  const period = sequentialSeasonPeriod(season);
  const query = search.trim().toLowerCase();
  const pods = season.levels.filter(pod => !query || `${name(pod.name)} ${name(pod.featuredName)} ${lineup(pod).map(enemy => name(enemy.name)).join(' ')} ${pod.buffs.map(buff => name(buff.name)).join(' ')}`.toLowerCase().includes(query));
  return <div className={`${oow.container} ${styles.root} info-ui`} data-encounter-ready={ready}><div className={oow.mainWrap}>{header}
    <div className={oow.mainLayout}>
      <aside className={oow.seasonAside} aria-label={t('Seasons', 'Сезоны')}><div className={oow.seasonHeader}><strong className={styles.railTitle}>{t('Season configurations', 'Конфигурации сезонов')}</strong><span className={styles.note}>{num(data.seasons.length)}</span></div>
        <div ref={rail} className={oow.seasonRailScroll}>{data.seasons.map(entry => {
          const last = entry.levels.at(-1);
          const image = (last ? media?.pods[last.id]?.portrait : null) ?? last?.bossIcon ?? last?.slotIcon;
          const entryPeriod = sequentialSeasonPeriod(entry);
          return <button type="button" key={entry.id} className={`${oow.seasonPill} ${entry.id === season.id ? oow.seasonPillActive : ''}`} aria-pressed={entry.id === season.id} onClick={() => chooseSeason(entry.id)}
            title={`${entryPeriod.regional ? 'Global' : t('Client default dates', 'Базовые даты клиента')} · ${date(entryPeriod.start)} → ${date(entryPeriod.end)}`}>
            {image && <span className={styles.seasonPortrait}><img src={gameAsset(image)} alt="" loading="lazy" /></span>}
            <span className={oow.seasonPillHeader}><span className={oow.seasonPillTop}><span className={oow.seasonPillTitle}>{seasonLabel(entry)}{entry.id === liveSeason?.id && <span className={oow.seasonPillDot} title={t('Current regional season', 'Текущий региональный сезон')} />}</span><span className={oow.seasonPillFloors}>{entry.levels.length}</span></span><span className={oow.seasonPillSub}>{date(entryPeriod.start)} → {date(entryPeriod.end)}</span></span>
          </button>;
        })}</div>
      </aside>
      <div className={`${oow.contentColumn} ${styles.content}`}>
        <div className={oow.toolbar}>
          <div className={`${oow.toolbarLeft} ${styles.seasonMeta}`}>
            <div className={`${oow.activeSeasonBadge} ${season.id === liveSeason?.id ? '' : oow.activeSeasonBadgeIdle} ${styles.seasonBadge}`}>
              <h2 className={styles.seasonTitle}><span className={season.id === liveSeason?.id ? oow.pulsingDot : oow.idleDot} aria-hidden="true" />{seasonLabel(season)}</h2>
              <span>· {period.regional ? '' : `${t('Client dates', 'Даты клиента')} · `}{date(period.start)} → {date(period.end)}</span>
            </div>
            {season.weaponLimit != null && <span className={styles.weaponLimit}>{t('Weapon limit', 'Лимит оружия')}: <b>{num(season.weaponLimit)}</b></span>}
          </div>
          <div className={styles.search}><CatalogSearch id="biochemical-search" value={search} onChange={setSearch} placeholder={t('Find a pod, enemy or effect…', 'Найти инкубатор, врага или эффект…')} clearAriaLabel={t('Clear search', 'Очистить поиск')} /></div>
        </div>
        <section className={`${oow.tablePanel} ${styles.table}`} aria-label={t('Culture Pod lineup', 'Состав инкубаторов')}>
          <div className={`${oow.floorGrid} ${oow.gridHeader} ${styles.podRow} ${styles.tableHead}`} aria-hidden="true"><div>{t('Culture Pod', 'Инкубатор')}</div><div>{t('Enemies', 'Противники')}</div><div>{t('Level', 'Уровень')}</div><div>{t('Time', 'Время')}</div><div>{t('Base score', 'Базовые очки')}</div><div>{t('Effects', 'Эффекты')}</div><div /></div>
          {pods.map(pod => {
            const enemies = lineup(pod), expanded = pod.id === podId;
            const image = media?.pods[pod.id]?.portrait ?? pod.bossIcon ?? pod.slotIcon;
            const levels = [...new Set(enemies.flatMap(enemy => enemy.level == null ? [] : [enemy.level]))];
            return <div key={pod.id}>
              <div className={`${oow.floorGrid} ${oow.gridRow} ${styles.podRow}`} role="button" tabIndex={0} aria-label={name(pod.name, pod.id)} aria-expanded={expanded} aria-controls={`culture-pod-${pod.id}`} onClick={() => setPod(expanded ? '' : pod.id)} onKeyDown={event => {if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {event.preventDefault(); setPod(expanded ? '' : pod.id);}}}>
                <div className={styles.podMain}>{image && <img src={gameAsset(image)} data-fit={media?.pods[pod.id]?.portraitFit} alt="" />}<strong>{name(pod.name, pod.id)}</strong></div>
                <div className={styles.podEnemies}>{enemies.map((enemy, index) => {
                  const portrait = portraitFor(pod, enemy, media);
                  return <span className={styles.podEnemy} key={index}>
                    {portrait && <img src={gameAsset(portrait)} data-fit={media?.pods[pod.id]?.enemies[enemy.sourceSlot]?.portraitFit} alt="" loading="lazy" />}<span>{name(enemy.name, t('Unidentified enemy', 'Неопределённый противник'))}</span>{enemy.count != null && <b>×{num(enemy.count)}</b>}
                  </span>;
                })}</div>
                <div className={styles.metric}><small>{t('Level', 'Уровень')}</small>{levels.map(level => num(level)).join(' / ')}</div>
                <div className={styles.metric}><small>{t('Time', 'Время')}</small>{pod.timeLimitSeconds != null && `${Math.floor(pod.timeLimitSeconds / 60)}:${String(pod.timeLimitSeconds % 60).padStart(2, '0')}`}</div>
                <div className={styles.metric}><small>{t('Base score', 'Базовые очки')}</small>{pod.baseScore != null && num(pod.baseScore)}</div>
                <div className={styles.effects}>{pod.buffs.map(buff => <Tooltip key={buff.id} portal content={<div><strong>{name(buff.name, buff.id)}</strong><GameRichText density="compact" text={name(buff.description)} /></div>}><span tabIndex={0} className={styles.effectIcon} data-negative={buff.isDisadvantage} aria-label={name(buff.name, buff.id)} onClick={event => event.stopPropagation()}>{buff.icon && <img src={gameAsset(buff.icon)} alt="" />}</span></Tooltip>)}</div>
                <div className={styles.chevron} data-open={expanded}><EncounterRowChevron /></div>
              </div>
              <Collapsible open={expanded} id={`culture-pod-${pod.id}`}>{() => <PodDetails pod={pod} media={media} icons={combatIcons} />}</Collapsible>
            </div>;
          })}
          {!pods.length && <p className={styles.empty}>{!season.levels.length && season.unresolvedLevelIds?.length ? t('This season is scheduled, but its Culture Pods are not in the client yet.', 'Сезон запланирован, но его инкубаторов пока нет в клиенте.') : t('No matching Culture Pods.', 'Инкубаторы не найдены.')}</p>}
        </section>
        <EncounterEffectCatalog effects={data.buffCatalog} />
      </div>
    </div>
  </div></div>;
}
