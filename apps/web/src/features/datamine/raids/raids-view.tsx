'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EmptyState, EncounterChoice, ExportButton, GameRichText, MediaLightbox, ModeSwitcher } from '@tof-hub/ui';
import type { RaidRankingDataset } from '@tof-hub/game-domain';
import { gameAsset } from '@tof-hub/game-assets';
import { PillSwitcher } from '@/components/pill-switcher/pill-switcher';
import type { HandbookMmoRaidData, HandbookTeamRaidData, Localized } from '../contracts/handbook';
import { HandbookTable, useHandbookText } from '../handbook/sections/handbook-ui';
import { useEncounterSelection } from '../components/encounter-ui';
import { normalizeRaidSelection, selectedRaidSeason } from './raid-selection';
import styles from '../components/encounter.module.css';
import { exportCardPng } from '../fce/fce-export';
import { BossDefenses, BossStatsToggle, useBossStatsVisible, type BossDefensesData } from '../components/boss-defenses';
import { challengeDefenses } from './boss-stats';
import { DEFAULT_RAID_NAME_COLOR, RAID_NAME_COLORS } from './raid-name-colors';
import raidStyles from './raids.module.css';
import {EncounterChoices} from '../components/encounter-choices';
import type { CSSProperties, ReactNode } from 'react';
import { RaidRankingComparison, RaidRankingPanel, type RaidRankingSelection } from './raid-rankings';
import { withoutRaidDifficulty } from './raid-title';

type Stage = HandbookMmoRaidData['stages'][number];
type Text = ReturnType<typeof useHandbookText>;
type Range = {lower: number | null; upper: number | null} | null | undefined;
type Team = {minPlayers: number | null; maxPlayers: number | null; roleCounts: Record<string, number | null>} | null | undefined;

const GLOBAL_REGION = 'Region_Oversea';

function RaidServerSwitcher({ server, onChange, ready, t }: {server: 'original' | 'mmo'; onChange: (next: string) => void; ready: boolean; t: (en: string, ru: string) => string}) {
  return <PillSwitcher mode={server === 'mmo' ? 'mmo' : 'standard'} onChange={next => onChange(next === 'mmo' ? 'mmo' : 'original')}
    disabled={!ready} originalLabel={t('Original', 'Оригинал')} mmoLabel="MMO" ariaLabel={t('Raid server', 'Сервер рейдов')} />;
}

/** Client time strings use `YYYY.M.D-H.MM.SS`; the source does not state a timezone, so wall time is shown as-is. */
function parseRaidTime(raw: string | null | undefined) {
  const match = raw?.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{2})\.(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

/**
 * The global raid guide (`Levy_OS`) is one text with `<blue>Heading</>` sections.
 * Returns the section whose heading matches, heading included, or null.
 */
function guideSection(text: string, heading: RegExp) {
  const parts = text.split(/(?=<blue>)/);
  return parts.find(part => heading.test(part.match(/^<blue>(.*?)<\/>/)?.[1] ?? ''))?.trim() ?? null;
}

/** Status needs the viewer clock, so it is only shown after hydration. */
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  return now;
}

function teamFacts(team: Team, text: Text) {
  const { t, num } = text;
  const stat = (value: number | null | undefined) => value == null ? '—' : num(value);
  const roles: [string, string][] = [['attack', t('Attack', 'Атака')], ['defense', t('Fortitude', 'Стойкость')], ['assist', t('Benediction', 'Благословение')]];
  return [
    {label: t('Team size', 'Размер команды'), value: team ? `${stat(team.minPlayers)}–${stat(team.maxPlayers)}` : '—'},
    {label: t('Role slots', 'Слоты ролей'), value: team ? <span className={raidStyles.roles}>{roles.map(([role, label]) =>
      <span key={role} data-role={role}>{label} <b>{stat(team.roleCounts[role])}</b></span>)}</span> : '—'},
  ];
}

function rangeText(range: Range, text: Text) {
  if (!range || (range.lower == null && range.upper == null)) return '—';
  const stat = (value: number | null) => value == null ? '—' : text.num(value);
  return `${stat(range.lower)}–${stat(range.upper)}`;
}

const SCENE_WIDTH = 1920;
const SCENE_HEIGHT = 1080;
/** Height of the three-row Original catalog below the hero, reserved on both servers so the card keeps one size. */

/**
 * Rendered without a per-boss key (like the FCE card) so the drifting backdrop keeps running
 * when the selection changes; only the content and the art image are replaced.
 *
 * FCE-style encounter card: a fixed 1920×1080 scene scaled to the page, so the
 * PNG export (shared FCE renderer, 4K) matches what is on screen. Mechanics
 * shrink their type size until they fit the scene.
 */
function RaidCard({ eyebrow, title, level, bosses, facts, mechanics, art, artTitle, background, fileName, nameColor, windows, rewards, defenses, critIcon, hpIcon }: {
  eyebrow: string;
  title: string;
  bosses: string[];
  facts?: {label: string; value: ReactNode}[];
  mechanics: {index: number; text: Localized; icon: string | null}[];
  art: string | null | undefined;
  artTitle: string;
  background: string | null | undefined;
  fileName: string;
  nameColor: string;
  /** The open window, else the next one, else the latest is printed in the card corner. */
  windows: AvailabilityRow[];
  /** Short level label printed after the title (MMO stages). */
  level?: string;
  /** Reward preview icons under the date in the card corner. */
  rewards?: {key: string; name: string; icon: string | null}[];
  /** Boss resistances and crit resistance printed under the date; omitted when the data does not identify the fight's row. */
  defenses?: BossDefensesData | null;
  critIcon?: string | null;
  hpIcon?: string | null;
}) {
  const { locale, t, name } = useHandbookText();
  const { visible: statsVisible, toggle: toggleStats } = useBossStatsVisible();
  const now = useNow();
  const windowLabels = useWindowLabels();
  const dated = windowItems(windows).map(item => ({...item, status: windowStatus(now, item.from, item.to)}));
  const shownWindow = dated.find(item => item.status === 'open') ?? dated.find(item => item.status === 'upcoming') ?? dated.at(-1);
  const [lightbox, setLightbox] = useState(false);
  const [rendering, setRendering] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const exportBarRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const bossLabel = bosses.join(' · ');
  // Keep numbered names plain even when localization inflects the surrounding words
  // ("Дурной глаз № 5" → "Дурного глаза № 5"). Derive designations from the names.
  const plainTerms = [...bosses, title].flatMap(term => [term, ...term.match(/(?:№|No\.|Nr\.|N\.º|n°)\s*\d+/gi) ?? []]);

  useLayoutEffect(() => {
    const shell = shellRef.current, viewport = viewportRef.current;
    if (!shell || !viewport) return;
    // Same fit as FCE: the whole card stays within the window below the catalog.
    const update = () => {
      const top = shell.getBoundingClientRect().top + window.scrollY;
      const unit = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
      const actionsTop = exportBarRef.current?.getBoundingClientRect().top ?? window.innerHeight - 48 * unit;
      // Stepped so sub-pixel differences between the two headers don't change the card size.
      const scale = Math.floor(Math.min(shell.clientWidth / SCENE_WIDTH, Math.max(actionsTop - top - 12 * unit, 1) / SCENE_HEIGHT) * 200) / 200;
      viewport.style.width = `${Math.round(SCENE_WIDTH * scale)}px`;
      viewport.style.height = `${Math.round(SCENE_HEIGHT * scale)}px`;
      viewport.style.setProperty('--raid-scale', scale.toFixed(5));
      viewport.setAttribute('data-ready', 'true');
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(shell);
    if (exportBarRef.current) observer.observe(exportBarRef.current);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  useLayoutEffect(() => {
    const copy = copyRef.current, card = cardRef.current;
    if (!copy || !card) return;
    let size = 40;
    card.style.setProperty('--raid-copy-size', `${size}px`);
    while (copy.scrollHeight > copy.clientHeight && size > 15) {
      size -= 1;
      card.style.setProperty('--raid-copy-size', `${size}px`);
    }
    // Long names wrap to at most two lines inside their column, then shrink.
    const label = nameRef.current;
    let scale = 1;
    card.style.setProperty('--raid-name-scale', '1');
    while (label && scale > 0.4 && (label.scrollWidth > label.clientWidth || label.offsetHeight > 200)) {
      scale -= 0.05;
      card.style.setProperty('--raid-name-scale', scale.toFixed(2));
    }
  }, [mechanics, title, bossLabel, locale]);

  const download = async () => {
    if (!cardRef.current || rendering) return;
    setRendering(true);
    try {
      // The boss name (any script) names the file; the raid/stage ID is only the fallback.
      const slug = bossLabel.toLocaleLowerCase(locale).normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
      await exportCardPng(cardRef.current, `raid-${slug || fileName}-${locale}.png`, {rootClassName: raidStyles.exportRoot, backgroundColor: '#c9d6ee'});
    } catch (error) {
      console.error('[Raids] Export failed:', error);
      alert(t('Could not render the PNG.', 'Не удалось создать PNG.'));
    } finally {
      setRendering(false);
    }
  };

  return <div ref={shellRef} className={raidStyles.cardShell}>
    <div ref={viewportRef} className={raidStyles.cardViewport}>
      <article ref={cardRef} className={raidStyles.card} aria-label={title}
        style={{'--raid-name-color': nameColor, ...(background ? {'--raid-card-bg': `url("${gameAsset(background)}")`} : {})} as CSSProperties}>
        <div className={raidStyles.cardBackdrop} />
        <div className={raidStyles.cardWash} />
        <div ref={copyRef} className={raidStyles.cardCopy}>
          <div className={raidStyles.titlePlate}>
            <p className={raidStyles.eyebrow}>{eyebrow}</p>
            <div className={raidStyles.titleRow}>
              <h2 className={raidStyles.cardTitle}>{title}</h2>
              {level && <span className={raidStyles.titleLevel}>{level}</span>}
            </div>
          </div>
          {facts?.length ? <dl className={raidStyles.facts}>{facts.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl> : null}
          {mechanics.length ? <ol className={raidStyles.mechanics} aria-label={t('Instance mechanics', 'Механики инстанса')}>{mechanics.map((mechanic, position) => <li key={mechanic.index}>
            <span className={raidStyles.mechanicIcon}>{mechanic.icon ? <img src={gameAsset(mechanic.icon)} alt="" /> : <b>{position + 1}</b>}</span>
            <GameRichText className={raidStyles.mechanicText} plainTerms={plainTerms} text={name(mechanic.text, t('Description unavailable in localization', 'Описание отсутствует в локализации'))} />
          </li>)}</ol> : <p className={raidStyles.mechanicsEmpty}>{t('No mechanics are configured for this difficulty in the available client data.', 'В доступных данных клиента для этой сложности механики не заданы.')}</p>}
        </div>
        <figure className={raidStyles.cardVisual}>
          {art ? <button type="button" className={raidStyles.artButton} aria-label={t('Open boss artwork', 'Открыть иллюстрацию босса')} onClick={() => setLightbox(true)}>
            <img key={art} src={gameAsset(art)} alt={bossLabel || title} />
          </button> : <div className={raidStyles.artEmpty}>{t('Artwork is not in the current export', 'Иллюстрации нет в текущем экспорте')}</div>}
          <figcaption className={raidStyles.bossName}><span ref={nameRef}>{bossLabel || t('Boss name unavailable', 'Имя босса недоступно')}</span></figcaption>
        </figure>
        <div className={raidStyles.cardCorner}>
          <div className={raidStyles.cardTopRow}>
            {shownWindow && <p className={raidStyles.cardWindow} data-status={shownWindow.status ?? undefined}>
              {shownWindow.status && <span className={raidStyles.cardWindowStatus}><i aria-hidden="true" />{windowLabels[shownWindow.status]}</span>}
              <span>{formatRaidDate(shownWindow.from, shownWindow.begin)} – {formatRaidDate(shownWindow.to, shownWindow.end)}</span>
            </p>}
          </div>
          {rewards?.length ? <ul className={raidStyles.cardRewards} aria-label={t('Reward preview', 'Предпросмотр наград')}>{rewards.map(item => <li key={item.key} title={item.name}>
            {item.icon ? <img src={gameAsset(item.icon)} alt={item.name} /> : <span>{item.name}</span>}
          </li>)}</ul> : null}
        </div>
        {defenses && statsVisible && <BossDefenses data={defenses} hpIcon={hpIcon} critIcon={critIcon} className={raidStyles.defenses} label={t('Boss resistances', 'Сопротивления босса')} />}
        <div className={raidStyles.signature}>@kritik</div>
      </article>
    </div>
    {art && <MediaLightbox isOpen={lightbox} onClose={() => setLightbox(false)} src={gameAsset(art)} webpSrc={gameAsset(art)} showPngDownload={false}
      downloadWebpLabel={t('Download WebP', 'Скачать WebP')} title={artTitle} alt={bossLabel || title} zoomable={false} locale={locale} />}
    <div ref={exportBarRef} className={raidStyles.exportBar}>
      {defenses && <BossStatsToggle visible={statsVisible} onToggle={toggleStats} />}
      <ExportButton aria-label={t('Download raid card as PNG', 'Скачать карточку рейда в PNG')} busy={rendering} onClick={download}>
        {rendering ? t('Rendering…', 'Рендер…') : t('Download PNG', 'Скачать PNG')}
      </ExportButton>
    </div>
  </div>;
}

type AvailabilityRow = {key: string; begin: string | null; end: string | null; detail?: ReactNode};
type WindowStatus = 'open' | 'upcoming' | 'ended';

/** Same `DD.MM.YYYY` style as the OOW season dates. */
function formatRaidDate(value: number | null, raw: string | null) {
  if (value == null) return raw ?? '—';
  const date = new Date(value);
  return `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${date.getUTCFullYear()}`;
}

function windowItems(rows: AvailabilityRow[]) {
  return rows.map(row => ({...row, from: parseRaidTime(row.begin), to: parseRaidTime(row.end)}))
    .sort((a, b) => (a.from ?? Infinity) - (b.from ?? Infinity));
}

function windowStatus(now: number | null, from: number | null, to: number | null): WindowStatus | null {
  return now == null || from == null ? null : now < from ? 'upcoming' : to == null || now < to ? 'open' : 'ended';
}

function useWindowLabels(): Record<WindowStatus, string> {
  const { t } = useHandbookText();
  return {open: t('Open', 'Открыт'), upcoming: t('Upcoming', 'Скоро'), ended: t('Ended', 'Завершён')};
}

/**
 * Every exported MMO schedule row (`DT_LevyClone_MMO`) in date order, with the linked raid art.
 * Collapsed by default; opening it scrolls to the open (or next) week. Status uses the viewer clock.
 */
function ScheduleHistory({ schedules, raidArt }: {schedules: HandbookMmoRaidData['schedules']; raidArt: Record<string, string | null>}) {
  const { t, name } = useHandbookText();
  const now = useNow();
  const labels = useWindowLabels();
  const rows = schedules.map(entry => ({entry, from: parseRaidTime(entry.beginRaw), to: parseRaidTime(entry.endRaw)}))
    .sort((a, b) => (a.from ?? Infinity) - (b.from ?? Infinity));
  const listRef = useRef<HTMLOListElement>(null);
  const focusCurrent = () => {
    const list = listRef.current, target = list?.querySelector<HTMLElement>('[data-status="open"], [data-status="upcoming"]');
    // The list is positioned, so offsetTop is already relative to it.
    if (list && target) list.scrollTop = target.offsetTop;
  };
  return <details className={`${styles.details} ${raidStyles.technical}`} onToggle={event => { if (event.currentTarget.open) focusCurrent(); }}>
    <summary>{t('Weekly raid schedule', 'Недельное расписание рейдов')} · {rows.length}</summary>
    <ol ref={listRef} className={raidStyles.schedule}>{rows.map(({entry, from, to}) => {
      const state = windowStatus(now, from, to);
      return <li key={entry.id} data-status={state ?? undefined}>
        <span className={raidStyles.scheduleArt}>{entry.linkedLevels.map(link => {
          const art = raidArt[link.variantId.replace(/_D(?:_II)?$/, '')];
          return art ? <img key={link.variantId} src={gameAsset(art)} alt="" loading="lazy" /> : <i key={link.variantId} aria-hidden="true" />;
        })}</span>
        <span className={raidStyles.scheduleName}>{entry.linkedLevels.map(link => withoutRaidDifficulty(name(link.name, link.variantId))).join(', ')}</span>
        <span className={raidStyles.scheduleDates}>{formatRaidDate(from, entry.beginRaw)} – {formatRaidDate(to, entry.endRaw)}</span>
        {entry.bossDebuff && <span className={raidStyles.scheduleDebuff}>{entry.bossDebuff.icon && <img src={gameAsset(entry.bossDebuff.icon)} alt="" loading="lazy" />}{name(entry.bossDebuff.description)}</span>}
        {state && <span className={raidStyles.windowStatus}>{labels[state]}</span>}
      </li>;
    })}</ol>
  </details>;
}

export function RaidsView({ originalData, mmoData, critIcon, hpIcon, selection, rankingData = null, rankingError = false }: {
  originalData: HandbookTeamRaidData | null;
  mmoData: HandbookMmoRaidData | null;
  /** Crit resistance icon of the Origin of War enemy panel. */
  critIcon?: string | null;
  /** Max HP icon of the Origin of War enemy panel. */
  hpIcon?: string | null;
  selection?: {server?: string; raid?: string; variant?: string; stage?: string; schedule?: string} & RaidRankingSelection;
  rankingData?: RaidRankingDataset | null;
  rankingError?: boolean;
}) {
  const { t } = useHandbookText();
  const [server, setServer, ready] = useEncounterSelection('server', selection?.server ?? 'original', selection?.server);
  const activeServer = server === 'mmo' ? 'mmo' : 'original';
  const [tab, setTab, tabReady] = useEncounterSelection('tab', 'overview', selection?.tab, 'overview');
  const activeTab = tab === 'ranking' || tab === 'comparison' ? tab : 'overview';
  useEffect(() => {
    const sync = () => {
      const url = new URL(window.location.href);
      normalizeRaidSelection(url.searchParams, rankingData?.seasons ?? []);
      if (url.href !== window.location.href) {
        window.history.replaceState(window.history.state, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    };
    sync(); window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [rankingData]);
  // Compact hero with the same rhythm as the Bosses (FCE) page.
  const header = (controls?: ReactNode) => <header className={raidStyles.hero}>
    <div><p className={raidStyles.heroEyebrow}>{t('Datamine · Raids', 'Датамайн · Рейды')}</p><h1 className={raidStyles.heroTitle}>{t('Raids', 'Рейды')}</h1></div>
    <div className={raidStyles.headerControls}>{controls}{activeServer === 'original' && <fieldset className={raidStyles.pageTabs} disabled={!ready || !tabReady}>
      <ModeSwitcher presentation="standalone" value={activeTab} onChange={setTab} ariaLabel={t('Raid page', 'Раздел рейдов')} options={[
        {value: 'overview', label: t('Description', 'Описание')}, {value: 'ranking', label: t('Ranking', 'Рейтинг')}, {value: 'comparison', label: t('Comparison', 'Сравнение')},
      ]} />
    </fieldset>}<RaidServerSwitcher server={activeServer} onChange={setServer} ready={ready} t={t} /></div>
  </header>;
  const background = originalData?.presentation?.cardBackground?.url;
  // Schedule rows link Team8P variant IDs; their selection/title art comes from the Original catalog rows.
  const raidArt = Object.fromEntries((originalData?.raids ?? []).map(raid => {
    const artwork = raid.variants.find(variant => variant.artwork?.thumbnail || variant.artwork?.title)?.artwork;
    return [raid.id, artwork?.thumbnail ?? artwork?.title ?? null];
  }));
  if (activeServer === 'mmo') return <MmoRaidsContent data={mmoData} selection={selection} header={header} serverReady={ready} background={background} raidArt={raidArt} />;
  if (activeTab === 'comparison') return <div className={`${styles.page} ${raidStyles.page} info-ui`} data-encounter-ready={ready && tabReady}>{header()}<RaidRankingComparison data={rankingData} raids={originalData?.raids} error={rankingError} initial={selection} /></div>;
  return <OriginalRaidsContent data={originalData} selection={selection} header={header} ready={ready} critIcon={critIcon} hpIcon={hpIcon} ranking={activeTab === 'ranking'} rankingData={rankingData} rankingError={rankingError} />;
}

function MmoRaidsContent({ data, selection, header, serverReady, background, raidArt }: {data: HandbookMmoRaidData | null; selection?: {stage?: string}; header: (controls?: ReactNode) => ReactNode; serverReady: boolean; background: string | null | undefined; raidArt: Record<string, string | null>}) {
  const text = useHandbookText();
  const { t, name, num } = text;
  // The newest stage (highest number) is the default.
  const firstStage = data?.stages.slice().sort((a, b) => (a.stageNumber ?? 0) - (b.stageNumber ?? 0)).at(-1);
  const [stageId, setStage, ready] = useEncounterSelection('stage', firstStage?.id ?? '', selection?.stage);
  const stage = data?.stages.find(entry => entry.id === stageId) ?? firstStage;
  const stat = (value: number | null | undefined) => value == null ? '—' : num(value);
  if (!data || !stage) return <div className={`${styles.page} ${raidStyles.page}`}>{header()}<EmptyState title={t('No MMO raids available', 'Рейды MMO недоступны')} /></div>;
  const stageNumbers = [...new Set(data.stages.map(entry => entry.stageNumber))].sort((a, b) => (a ?? 0) - (b ?? 0));
  const change = (values: Partial<Pick<Stage, 'stageNumber' | 'floorEnum' | 'difficultyEnum'>>) => {
    const requested = { ...stage, ...values };
    const next = data.stages.find(entry => entry.stageNumber === requested.stageNumber && entry.floorEnum === requested.floorEnum && entry.difficultyEnum === requested.difficultyEnum)
      ?? data.stages.find(entry => entry.stageNumber === requested.stageNumber && entry.difficultyEnum === requested.difficultyEnum)
      ?? data.stages.find(entry => entry.stageNumber === requested.stageNumber);
    if (next) setStage(next.id);
  };
  const difficultyLabel = (value: string | null) => value?.endsWith('Multi2') ? t('Challenge', 'Испытание') : value?.endsWith('Multi') ? t('Heroic', 'Героический') : value ?? '—';
  const floorLabel = (value: string | null) => value === 'ELCSF_0' ? t('Upper level', 'Верхний уровень') : value === 'ELCSF_1' ? t('Lower level', 'Нижний уровень') : value ?? '—';
  const title = withoutRaidDifficulty(name(stage.name, stage.id));
  const levels = stage.requiredLevel?.regionalOverrides.filter(entry => entry.serverMode === 'MMOServer') ?? [];
  const globalLevel = levels.find(entry => entry.region === GLOBAL_REGION)?.range ?? levels[0]?.range;
  const scheduleIds = new Set(stage.scheduleRows);
  const schedules = data.schedules.filter(entry => scheduleIds.has(entry.id));
  const rewards = stage.rewards.display.flatMap(group => group.items.map((item, index) => ({key: `${group.id}-${index}`, name: name(item.name, item.id), icon: item.icon})));
  const difficulties = [...new Set(data.stages.filter(entry => entry.stageNumber === stage.stageNumber).map(entry => entry.difficultyEnum))];
  return <div className={`${styles.page} ${raidStyles.page} info-ui`} data-encounter-ready={serverReady && ready}>{header(
        <div className={raidStyles.toggleGroup} role="group" aria-label={t('Difficulty selection', 'Выбор сложности')}>
          {difficulties.map(value => <button type="button" key={value} aria-pressed={stage.difficultyEnum === value} disabled={!ready} onClick={() => change({difficultyEnum: value})}>{difficultyLabel(value)}</button>)}
        </div>)}
    <section className={raidStyles.catalog}>
      <EncounterChoices label={t('Raid stage', 'Этап рейда')} selectedKey={stage.id} className={raidStyles.list}>
        {stageNumbers.map(number => {
          // Same boss thumbnail as the Gacha catalog for this Team8P raid; the stage tab image is the fallback.
          const chipArt = (row: Stage | undefined) => row ? raidArt[row.id.replace(/_D(?:_II)?$/, '')] ?? row.stageImages.small : null;
          const rows = data.stages.filter(entry => entry.stageNumber === number && entry.difficultyEnum === stage.difficultyEnum);
          const stageFloors = [...new Set(rows.map(entry => entry.floorEnum))].sort();
          return <div key={number} className={raidStyles.stageColumn}>{stageFloors.map(floor => {
            const row = rows.find(entry => entry.floorEnum === floor);
            const label = `${t('Stage', 'Этап')} ${number} · ${floorLabel(floor)}`;
            return <EncounterChoice key={floor ?? 'floor'} label={label} title={row ? `${label} · ${name(row.bosses[0]?.name, row.id)}` : label}
              image={chipArt(row) ? gameAsset(chipArt(row)!) : null}
              active={stage.stageNumber === number && stage.floorEnum === floor} disabled={!ready} onClick={() => change({stageNumber: number, floorEnum: floor})} />;
          })}</div>;
        })}
      </EncounterChoices>
    </section>
    <RaidCard eyebrow={`${t('Stage', 'Этап')} ${stat(stage.stageNumber)} · ${difficultyLabel(stage.difficultyEnum)} · ${floorLabel(stage.floorEnum)}`}
      title={title} bosses={stage.bosses.map(boss => name(boss.name, boss.id))} mechanics={stage.mechanics}
      art={stage.stageImages.title} artTitle={title} background={background} fileName={stage.id}
      nameColor={RAID_NAME_COLORS[stage.id.replace(/_D(?:_II)?$/, '')] ?? DEFAULT_RAID_NAME_COLOR}
      windows={schedules.map(entry => ({key: entry.id, begin: entry.beginRaw, end: entry.endRaw}))} rewards={rewards}
      level={globalLevel?.lower != null ? `${t('Lv.', 'Ур.')} ${num(globalLevel.lower)}` : undefined} />
    <ScheduleHistory schedules={data.schedules} raidArt={raidArt} />
    <details className={`${styles.details} ${raidStyles.technical}`}><summary>{t('Technical details', 'Технические детали')}</summary>
      <p className={styles.note}>{t('This is a static client catalog. The schedule timezone, active rotation, live difficulty percentage and final boss resistances are unresolved. Generic ProposedScore is not the MMO CS gate.', 'Это статический каталог клиента. Часовой пояс расписания, текущая ротация, серверная сложность и финальные резисты боссов не установлены. Общий ProposedScore не является порогом CS MMO.')}</p>
      <HandbookTable caption={t('Stage data', 'Данные этапа')} columns={[{label: t('Field', 'Поле')}, {label: t('Value', 'Значение')}]} rows={[
        {key: 'id', cells: ['Stage ID', stage.id]},
        {key: 'bosses', cells: [t('Boss IDs', 'Boss IDs'), stage.bosses.map(boss => boss.id).join(', ') || '—']},
        {key: 'score', cells: [t('ProposedScore (base)', 'ProposedScore (base)'), stat(stage.recommendedScore?.baseValue)]},
        {key: 'time', cells: ['ChallengeTime (raw)', stat(stage.challengeTimeRaw?.value)]},
        {key: 'team', cells: [t('Team size · role slots (Attack / Fortitude / Benediction)', 'Команда · слоты ролей (Атака / Стойкость / Благословение)'),
          stage.team ? `${stat(stage.team.minPlayers)}–${stat(stage.team.maxPlayers)} · ${['attack', 'defense', 'assist'].map(role => stat(stage.team?.roleCounts[role])).join(' / ')}` : '—']},
        {key: 'schedules', cells: [t('Direct schedule links', 'Прямые связи расписания'), num(schedules.length)]},
      ]} />
      <HandbookTable caption={t('MMO level limits', 'Ограничения уровня MMO')} columns={[{label: t('Region', 'Регион')}, {label: t('Minimum', 'Минимум')}, {label: t('Maximum', 'Максимум')}]} rows={levels.map(entry => ({key: entry.region, cells: [entry.region, stat(entry.range?.lower), stat(entry.range?.upper)]}))} />
      <HandbookTable caption={t('Reward quantity source fields', 'Исходные поля количества наград')} columns={[{label: t('Group', 'Группа')}, {label: 'ModifyNum'}, {label: 'ModifyCount'}, {label: t('Item', 'Предмет')}, {label: 'Sequence Num'}]} rows={(['normal', 'poor', 'display'] as const).flatMap(kind => stage.rewards[kind].flatMap(group => group.items.map((item, index) => ({key: `${kind}-${group.id}-${index}`, cells: [`${kind} · ${group.id}`, stat(group.modifyNum), stat(group.modifyCount), name(item.name, item.id), stat(item.count)]}))))} />
      <p className={styles.note}>{t('Schedule variants without a serialized stage row', 'Варианты расписания без сериализованной строки этапа')}: {data.scheduleVariantIdsWithoutStageRows.join(', ') || '—'}</p>
    </details>
  </div>;
}

function useRaidSelection(seasons: RaidRankingDataset['seasons'] | undefined, fallback: string, initial?: {raid?: string; season?: string}) {
  const resolve = (params: URLSearchParams) => {
    const season = selectedRaidSeason(params, seasons ?? []);
    return (params.has('season') ? season?.raidId : params.get('raid') || season?.raidId) || fallback;
  };
  const [raidId, setRaidId] = useState(() => resolve(typeof window === 'undefined'
    ? new URLSearchParams(Object.entries(initial ?? {}).filter((item): item is [string, string] => typeof item[1] === 'string'))
    : new URL(window.location.href).searchParams));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => {
      const params = new URL(window.location.href).searchParams;
      const season = selectedRaidSeason(params, seasons ?? []);
      setRaidId((params.has('season') ? season?.raidId : params.get('raid') || season?.raidId) || fallback);
    };
    sync(); setReady(true); window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [seasons, fallback]);
  return [raidId, ready] as const;
}

function OriginalRaidsContent({ data, selection, header, ready, critIcon, hpIcon, ranking, rankingData, rankingError }: {
  data: HandbookTeamRaidData | null;
  selection?: {raid?: string} & RaidRankingSelection;
  header: (controls?: ReactNode) => ReactNode;
  ready: boolean;
  critIcon?: string | null;
  hpIcon?: string | null;
  ranking?: boolean;
  rankingData?: RaidRankingDataset | null;
  rankingError?: boolean;
}) {
  const text = useHandbookText();
  const { t, name, num } = text;
  const firstRaid = data?.raids.reduce<(typeof data.raids)[number] | undefined>((best, entry) => (!best || entry.index >= best.index ? entry : best), undefined);
  const [raidId, selectionReady] = useRaidSelection(rankingData?.seasons, firstRaid?.id ?? '', selection);
  const raid = data?.raids.find(entry => entry.id === raidId) ?? firstRaid;
  // The Original page shows only Challenge (the paired `_D_II` row); Heroic stays out of the UI by request.
  const challenge = (entry: typeof raid) => entry?.variants.find(value => value.id.endsWith('_D_II')) ?? entry?.variants[1] ?? entry?.variants[0];
  const variant = challenge(raid);
  const stat = (value: number | null | undefined) => value == null ? '—' : num(value);
  const bossNames = new Map((raid?.bosses ?? []).map(boss => [boss.id, name(boss.name, boss.id)]));
  const variantBosses = [...new Set((variant?.bossIds ?? []).map(id => bossNames.get(id) ?? id))];
  // DT_MonsterStaticData rows matched by boss number + "8P"; shared by bosses of one raid, so listed once per row.
  const statRows = [...new Map((variant?.bossIds ?? []).flatMap(id => raid?.bosses.find(boss => boss.id === id)?.stats ?? []).map(row => [row.rowId, row])).values()];
  const statFields = [...new Set(statRows.flatMap(row => Object.keys(row.fields)))];
  const globalScore = variant?.recommendedScore?.regionalOverrides.find(entry => entry.region === GLOBAL_REGION && entry.serverMode === 'NormalServer');
  const globalLevel = variant?.requiredLevel?.regionalOverrides.find(entry => entry.region === GLOBAL_REGION && entry.serverMode === 'NormalServer');
  if (!data || !raid || !variant) return <div className={`${styles.page} ${raidStyles.page}`}>{header()}<EmptyState title={t('No Original-server raids available', 'Рейды оригинального сервера недоступны')} /></div>;
  const title = withoutRaidDifficulty(name(variant.name, variant.id));
  // Limited-time raids (e.g. Team8P_22) carry their own difficulty rules; don't repeat the global ones there.
  const ownsDifficultyRules = raid.guides.some(guide => /<blue>[^<]*(?:difficulty|сложност)/i.test(name(guide.text)));
  const challengeRules = ownsDifficultyRules ? null : guideSection(name(data.guide?.text), /challeng|испытани/i);
  const availability = (variant.availability?.timeWindowsRaw ?? []).map((window, index) => ({key: String(index), begin: window.begin, end: window.end}));
  // Site season sequence: the first timed raid is Season 0, followed by Season 1 onward.
  const seasonIndex = data.raids.filter(entry => entry.variants.some(value => value.availability?.timeWindowsRaw.length))
    .sort((left, right) => left.index - right.index).findIndex(entry => entry.id === raid.id);
  const rankingSeason = rankingData?.seasons.find(season => season.raidId === raid.id);
  const rankingTitles = data.rankingTitles?.find(entry => entry.seasonId === rankingSeason?.id)?.titles ?? [];
  return <div className={`${styles.page} ${raidStyles.page} info-ui`} data-encounter-ready={ready && selectionReady}>
    {header()}
    {!ranking && <section className={raidStyles.catalog}>
      <EncounterChoices label={t('Original raid selection', 'Выбор рейда оригинального сервера')} selectedKey={raid.id} layout="columns" className={raidStyles.list}>
        {data.raids.map(entry => {
          const display = withoutRaidDifficulty(name(entry.variants[0]?.name, entry.id));
          const preview = challenge(entry)?.artwork;
          return <EncounterChoice key={entry.id} label={display} image={preview?.thumbnail ?? preview?.title ?? null} active={entry.id === raid.id}
            aria-label={`${entry.id} · ${display}`} title={display} disabled={!selectionReady}
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('raid', entry.id); url.searchParams.delete('season');
              normalizeRaidSelection(url.searchParams, rankingData?.seasons ?? []);
              window.history.replaceState(window.history.state, '', url);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }} />;
        })}
      </EncounterChoices>
    </section>}
    {ranking ? <RaidRankingPanel data={rankingData ?? null} error={rankingError} raidId={raid.id} title={title} initial={selection} /> : <>
    <RaidCard eyebrow={`${t('Challenge', 'Испытание')} · ${t('Raid', 'Рейд')} ${stat(raid.index)}${seasonIndex < 0 ? '' : ` · ${t('Season', 'Сезон')} ${stat(seasonIndex)}`}`}
      title={title} bosses={variantBosses} mechanics={variant.mechanics} art={variant.artwork?.title} artTitle={title} background={data.presentation?.cardBackground?.url} fileName={variant.id}
      nameColor={RAID_NAME_COLORS[raid.id] ?? DEFAULT_RAID_NAME_COLOR} windows={availability}
      defenses={challengeDefenses(raid, variant.bossIds)} critIcon={critIcon} hpIcon={hpIcon} />
    {(raid.guides.length > 0 || raid.bossTips.length > 0 || challengeRules) && <details className={`${styles.details} ${raidStyles.technical}`}>
      <summary>{t('In-game raid description', 'Описание рейда из игры')}</summary>
      <div className={raidStyles.guides}>
        {raid.guides.map(guide => <GameRichText key={guide.id} density="compact" text={name(guide.text)} />)}
        {raid.bossTips.map(tip => <GameRichText key={tip.key} density="compact" text={name(tip.text, t('Tip unavailable', 'Подсказка недоступна'))} />)}
        {challengeRules && <GameRichText density="compact" text={challengeRules} />}
      </div>
    </details>}
    {rankingSeason && <details key={raid.id} className={`${styles.details} ${raidStyles.technical}`} data-raid-titles={rankingSeason.id}>
      <summary>{t('Ranking titles', 'Титулы за рейтинг')} <span className={raidStyles.titleSeason}>{rankingSeason.id}</span></summary>
      {rankingTitles.length ? <dl className={raidStyles.titleRewards}>
        {rankingTitles.map(reward => <div key={reward.id}>
          <dt><span>{t('Place', 'Место')}</span><b>{num(reward.minRank)}–{num(reward.maxRank)}</b></dt>
          <dd>
            <strong style={reward.color ? {color: reward.color} : undefined}>{name(reward.name)}</strong>
            <GameRichText density="compact" text={name(reward.description)} />
          </dd>
        </div>)}
      </dl> : <p className={styles.note}>{t('Title rewards for this season are not available in the game data yet.', 'Титулы этого сезона пока отсутствуют в игровых данных.')}</p>}
    </details>}
    <details className={`${styles.details} ${raidStyles.technical}`}>
      <summary>{t('Technical details', 'Технические детали')}</summary>
      <HandbookTable caption={t('Variant data', 'Данные варианта')} columns={[{label: t('Field', 'Поле')}, {label: t('Value', 'Значение')}]} rows={[
        {key: 'ids', cells: [t('Raid / variant ID', 'Raid / variant ID'), `${raid.id} · ${variant.id}`]},
        {key: 'target', cells: ['TargetName', variant.targetName]},
        {key: 'score', cells: [t('ProposedScore (base)', 'ProposedScore (base)'), stat(variant.recommendedScore?.baseValue)]},
        {key: 'regional-score', cells: ['ProposedScore · Region_Oversea / NormalServer', stat(globalScore?.value)]},
        {key: 'team', cells: [t('Team size', 'Размер команды'), teamFacts(variant.team, text)[0].value]},
        {key: 'level', cells: [t('Level range · Region_Oversea / NormalServer', 'Level range · Region_Oversea / NormalServer'), rangeText(globalLevel?.range, text)]},
        {key: 'base-level', cells: [t('Level range (base)', 'Level range (base)'), rangeText(variant.requiredLevel?.baseRange, text)]},
        {key: 'time', cells: ['ChallengeTime (raw)', stat(variant.challengeTimeRaw?.value)]},
        {key: 'roles', cells: [t('Role slots · Attack / Fortitude / Benediction', 'Слоты ролей · Атака / Стойкость / Благословение'),
          variant.team ? ['attack', 'defense', 'assist'].map(role => stat(variant.team?.roleCounts[role])).join(' / ') : '—']},
        {key: 'bosses', cells: [t('Boss IDs', 'Boss IDs'), variant.bossIds.join(', ') || '—']},
        {key: 'packs', cells: [t('Reward pack IDs', 'Reward pack IDs'), Object.values(variant.rewardPackIds ?? {}).flatMap(value => Array.isArray(value) ? value : [value]).filter(value => typeof value === 'string' && value).join(', ') || '—']},
        {key: 'source', cells: [t('Config row', 'Config row'), `${String(variant.source?.configPath ?? '—')} · ${String(variant.source?.configRow ?? variant.id)} · ${String(variant.source?.configSelection ?? '')}`]},
      ]} />
      {statRows.length > 0 && <HandbookTable caption={t('Boss stats · DT_MonsterStaticData', 'Статы боссов · DT_MonsterStaticData')}
        columns={[{label: t('Field', 'Поле')}, ...statRows.map(row => ({label: row.rowId}))]}
        rows={statFields.map(field => ({key: field, cells: [field, ...statRows.map(row => {
          const value = row.fields[field];
          return typeof value === 'number' ? num(value) : value ?? '—';
        })]}))} />}
      {data.catalogCoverage.unsupportedTeam8pIds.length > 0 && <p className={styles.note}>{t('Unclassified Team8P keys', 'Не классифицированные ключи Team8P')}: {data.catalogCoverage.unsupportedTeam8pIds.join(', ')}</p>}
    </details>
    </>}
  </div>;
}
