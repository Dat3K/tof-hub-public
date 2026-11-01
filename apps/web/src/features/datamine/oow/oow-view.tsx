'use client';

import { localized, translateUiText} from '@tof-hub/i18n';
import { fillText, localeText } from '@/lib/i18n/text';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { intlLocale } from '@/lib/i18n/format';
import { gameAsset } from '@tof-hub/game-assets';
import { getElementLabel } from '@tof-hub/game-domain';
import { CatalogSearch, Collapsible, Lightbox, setStoredServerMode, SortListbox } from '@tof-hub/ui';
import { PillSwitcher } from '@/components/pill-switcher/pill-switcher';
import type {
  OowViewProps,
  OowMode,
  OowTab,
  OowHpUnit,
  OowFilter,
  OowChartMetric,
  OowChartMode,
  OowChartRange,
  OowChartTheme,
  OowEnemy,
  OowFloor,
  OowSeasonSummary,
} from './oow-types';
import { OOW_COPY, type OowCopyTable } from './oow-copy';
import {
  getSeasonsList,
  getBuffsDictionary,
  fetchSeasonFloors,
} from './oow-data';
import {
  resolveFceBoss,
  getEnemyPresentation,
  buildMainEnemiesList,
  getOowMobLinkId,
  formatHpValue,
  formatPercentDelta,
  formatResistancePercent,
  getSeasonColor,
  getLiveSeasonNumber,
} from './oow-domain';
import { getBaselineBosses } from '../fce/fce-data';
import { renderFceMechanicText } from '../fce/fce-rich-text';
import { downloadSvgAsPng, downloadCsv } from './oow-export';
import { DatamineTabs } from '../components';
import { EnemyLineupCard } from '../components/enemy-lineup-card';
import { EncounterBuffCard, EncounterRowChevron } from '../components/encounter-buff-card';
import { EncounterEffectCatalog } from '../components/encounter-effect-catalog';
import { EnemyCombatStatIcon as CombatStatIcon, EnemyDetailsHeader, EnemyElementStats, EnemyHealthSummary, EnemyPrimaryStats, EnemyStatBadges, type EnemyPrimaryStat } from '../components/enemy-combat-details';
import styles from './oow.module.css';
import {
  CHART_FONT_FAMILY,
  CHART_TITLE_FONT_WEIGHT,
  ChartWatermark,
} from '../components/chart-branding';
import resistanceIcons from '../../../../public/game-data/relic-resistance-icons.json';

/** Title band above each 920×300 chart (viewBox units); x mapping is unaffected. */
const OOW_TITLE_BAND = 34;

function resolveAsset(path: string | undefined | null): string {
  if (!path) return '';
  // These are app-owned datamine UI assets, not game-export references.
  // Passing them through gameAsset() prepends /game-assets and produces a
  // broken URL such as /game-assets/webp/datamine/shared/assets/....
  if (/^\/?datamine\/shared\/assets\//i.test(path)) return path;
  if (/^\/?datamine\/shared\/media\//i.test(path) || /^\/?game-assets\//i.test(path) || /^\/?Game\//i.test(path)) {
    try {
      return gameAsset(path);
    } catch {
      return path;
    }
  }
  try {
    return path;
  } catch {
    return path;
  }
}

function formatLegacyDate(value: string | undefined): string {
  if (!value) return '';
  const match = value.match(/^\d{4}-(\d{2})-(\d{2})/);
  return match ? `${match[2]}.${match[1]}` : value;
}

function formatSeasonDayRange(startDate: string | undefined, startDay: number, endDay: number): string {
  if (!startDate) return '';
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00Z`);
  const end = new Date(start);
  start.setUTCDate(start.getUTCDate() + startDay - 1);
  end.setUTCDate(end.getUTCDate() + endDay - 1);
  const format = (date: Date) => `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${date.getUTCFullYear()}`;
  return startDay === endDay ? format(start) : `${format(start)} – ${format(end)}`;
}

function enemyKindClass(enemy: OowEnemy): 'boss' | 'elite' | 'normal' {
  const identity = `${enemy.codeName || ''} ${enemy.bossId || ''} ${enemy.monsterType || ''} ${enemy.normalizedMonsterClass || ''} ${enemy.monsterClass || ''} ${enemy.blueprint || ''}`;
  if (enemy.enemyKind === 'boss' || /boss/i.test(identity)) return 'boss';
  if (enemy.enemyKind === 'elite' || /elite/i.test(identity) || enemy.hp >= 50_000_000) return 'elite';
  return 'normal';
}

function enemySingleHp(enemy: OowEnemy): number {
  if (enemy.hp > 0) return enemy.hp;
  return enemy.count > 0 ? enemy.combinedHp / enemy.count : enemy.combinedHp;
}

function formatEnemyAtk(atk: number, numLocale: string = 'en-US'): string {
  const millions = atk / 1000;
  return millions >= 1000 ? Math.round(millions).toLocaleString(numLocale) : millions >= 100 ? millions.toFixed(1) : millions.toFixed(2);
}

function formatEnemyShield(value: unknown, numLocale: string = 'en-US'): string {
  const armor = typeof value === 'number' ? value : Number(value || 0);
  if (!Number.isFinite(armor) || armor <= 0) return '';
  if (armor >= 1e6) return `${(armor / 1e6).toFixed(1)}M`;
  if (armor >= 1000) return `${(armor / 1000).toLocaleString(numLocale)}K`;
  return Math.round(armor).toLocaleString(numLocale);
}

function formatEnemyDefense(enemy: OowEnemy, shieldPrefix: string, critResPrefix: string, numLocale: string = 'en-US'): string {
  const armor = formatEnemyShield(enemy.stats?.ArmorBase ?? enemy.stats?.Armor, numLocale);
  const crit = Number(enemy.stats?.FinalCritDef ?? enemy.stats?.CritDef ?? 0);
  const parts = [armor ? `${shieldPrefix} ${armor}` : '', crit > 0 ? `${critResPrefix} ${Math.round(crit * 100)}%` : ''].filter(Boolean);
  return parts.join(' · ');
}

function getEnemyStatBadges(enemy: OowEnemy, shieldPrefix: string, critResPrefix: string, numLocale: string = 'en-US'): Array<{ tone: 'atk' | 'armor' | 'crit'; text: string }> {
  const atk = formatEnemyAtk(enemy.atk, numLocale);
  const armor = formatEnemyShield(enemy.stats?.ArmorBase ?? enemy.stats?.Armor, numLocale);
  const crit = Number(enemy.stats?.FinalCritDef ?? enemy.stats?.CritDef ?? 0);
  const items: Array<{ tone: 'atk' | 'armor' | 'crit'; text: string }> = [{ tone: 'atk', text: `ATK ${atk}M` }];
  if (armor) items.push({ tone: 'armor', text: `${shieldPrefix} ${armor}` });
  if (crit > 0) items.push({ tone: 'crit', text: `${critResPrefix} ${Math.round(crit * 100)}%` });
  return items;
}

function buildWaveGroups(enemies: OowEnemy[]): Array<{ wave: number; enemies: OowEnemy[] }> {
  const waveMap = new Map<number, OowEnemy[]>();
  enemies.forEach((enemy) => {
    const wave = enemy.wave || 1;
    const list = waveMap.get(wave) || [];
    list.push(enemy);
    waveMap.set(wave, list);
  });
  return [...waveMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([wave, waveEnemies]) => ({
      wave,
      enemies: waveEnemies.slice().sort((a, b) => {
        const aBoss = enemyKindClass(a) === 'boss';
        const bBoss = enemyKindClass(b) === 'boss';
        if (aBoss !== bBoss) return aBoss ? -1 : 1;
        return enemySingleHp(b) - enemySingleHp(a);
      }),
    }));
}

type FloorBuffCard = {
  id: string;
  name: string;
  description: string;
  icon?: string | null;
  badge: string;
  kind: 'drop' | 'mutator' | 'affix';
  slot?: string;
  slotLabel?: string;
};

function buildFloorBuffCards(
  floor: OowFloor,
  dictionary: Map<string, { nameEn?: string; nameRu?: string; descEn?: string; descRu?: string; icon?: string | null; probabilityPercent?: number; slot?: string; slotLabelEn?: string; slotLabelRu?: string; buffType?: string }>,
  isRu: boolean,
  copy: OowCopyTable,
): FloorBuffCard[] {
  const cards: FloorBuffCard[] = [];
  const seen = new Set<string>();
  const dropInfo = new Map<string, { probabilityPercent?: number }>();
  const rawDropBuffs = Array.isArray(floor.dropBuffs) ? floor.dropBuffs : [];

  rawDropBuffs.forEach((raw) => {
    const record = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : null;
    const id = typeof raw === 'string' ? raw : String(record?.id || '');
    if (!id) return;
    dropInfo.set(id, {
      probabilityPercent: typeof record?.probabilityPercent === 'number' ? record.probabilityPercent : undefined,
    });
  });

  const add = (raw: unknown, kind: FloorBuffCard['kind']) => {
    if (!raw || typeof raw !== 'object') return;
    const record = raw as Record<string, unknown>;
    const id = String(record.id || '');
    if (!id || /immuneeverything/i.test(id) || seen.has(id)) return;
    seen.add(id);
    const fromDictionary = dictionary.get(id) || {};
    const name = String((isRu ? record.nameRu : record.nameEn) || (isRu ? fromDictionary.nameRu : fromDictionary.nameEn) || id);
    const description = String((isRu ? record.descRu : record.descEn) || (isRu ? fromDictionary.descRu : fromDictionary.descEn) || '');
    const icon = String(record.icon || fromDictionary.icon || '') || null;
    const slotSource = String(record.slot || fromDictionary.slot || record.buffType || fromDictionary.buffType || '');
    const slot = slotSource.match(/(?:type[_ ]?)([1-6])$/i)?.[1] || '';
    const slotLabel = String((isRu ? record.slotLabelRu : record.slotLabelEn) || (isRu ? fromDictionary.slotLabelRu : fromDictionary.slotLabelEn) || (slot ? copy.slotTypeFallback.replace('{slot}', slot) : ''));
    const probability = typeof record.probabilityPercent === 'number'
      ? record.probabilityPercent
      : dropInfo.get(id)?.probabilityPercent ?? fromDictionary.probabilityPercent;
    const badge = kind === 'drop'
      ? `${copy.badgeDrop}${probability != null ? `: ${probability.toFixed(2)}%` : ''}`
      : kind === 'mutator'
        ? copy.badgeMutator
        : copy.badgeAffix;
    cards.push({ id, name, description, icon, badge, kind, slot, slotLabel });
  };

  const stageMutators = Array.isArray((floor as Record<string, unknown>).stageMutators)
    ? (floor as Record<string, unknown>).stageMutators as unknown[]
    : [];
  stageMutators.forEach((item) => add(item, dropInfo.has(String((item as Record<string, unknown>)?.id || '')) ? 'drop' : 'mutator'));
  rawDropBuffs.forEach((item) => {
    if (typeof item === 'string') {
      const data = dictionary.get(item);
      add({ id: item, ...data }, 'drop');
    } else add(item, 'drop');
  });
  floor.enemies.forEach((enemy) => (enemy.inherentBuffs || []).forEach((item) => add(item, dropInfo.has(item.id) ? 'drop' : 'affix')));
  return cards;
}

export function OowView({ initialSummary, initialEffectCatalog, initialBossCards, initialMode, initialTab, initialSeason, initialFloor }: OowViewProps) {
  const { locale: activeLocale } = useI18n();
  const currentLocale = activeLocale;
  const copy = localized(OOW_COPY, currentLocale);
  const isRu = currentLocale === 'ru';
  const numLocale = intlLocale(currentLocale);
  const seasonCountLabel = (count: number) => {
    if (count === 1) return `${count} ${copy.seasonOne}`;
    if (!isRu) return `${count} ${copy.seasonMany}`;
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word = mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? copy.seasonFew : copy.seasonMany;
    return `${count} ${word}`;
  };

  // Navigation & Mode, seeded from the server-parsed URL (?mode=&s=&tab=
  // &floor=) so a shared link fetches the selected season immediately
  // instead of loading the latest standard season and refetching after mount.
  const [mode, setMode] = useState<OowMode>(initialMode ?? 'standard');
  const [tab, setTab] = useState<OowTab>(initialTab ?? 'table');
  const [seasonNum, setSeasonNum] = useState<number>(initialSeason ?? 0);
  const [railCollapsed, setRailCollapsed] = useState<boolean>(false);

  // Table Filters & Units
  const [filter, setFilter] = useState<OowFilter>('ramp');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hpUnit, setHpUnit] = useState<OowHpUnit>('G');
  const [expandedFloor, setExpandedFloor] = useState<number | null>(initialFloor ?? null);

  // Compare Drawer
  const [compareOpen, setCompareOpen] = useState<boolean>(false);
  const [compareSeasonNum, setCompareSeasonNum] = useState<number>(0);

  // Modals & Popups
  const [modalEnemy, setModalEnemy] = useState<OowEnemy | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const updateEnemyModal = useCallback((enemy: OowEnemy | null) => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mobId = enemy ? String(enemy.key || enemy.codeName || enemy.bossId || '') : '';
      if (mobId) params.set('mob', mobId);
      else params.delete('mob');
      const query = params.toString();
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
    }
    setModalEnemy(enemy);
  }, []);
  const closeEnemyModal = useCallback(() => updateEnemyModal(null), [updateEnemyModal]);

  // Charts
  const [chartMode, setChartMode] = useState<OowChartMode>('ehp');
  const [chartMetric, setChartMetric] = useState<OowChartMetric>('boss');
  const [chartRange, setChartRange] = useState<OowChartRange>('ramp');
  const [chartTheme, setChartTheme] = useState<OowChartTheme>('light');
  const [activeChartSeasons, setActiveChartSeasons] = useState<number[]>([]);
  const [promotedSub, setPromotedSub] = useState<'history' | 'jump' | null>(null);
  const [jumpMode, setJumpMode] = useState<'season' | 'floor'>('season');
  const [chartHoverFloor, setChartHoverFloor] = useState<number | null>(null);
  const [histHoverSeason, setHistHoverSeason] = useState<number | null>(null);
  const [jumpHoverFloor, setJumpHoverFloor] = useState<number | null>(null);
  const mainSvgRef = useRef<SVGSVGElement>(null);
  const historySvgRef = useRef<SVGSVGElement>(null);
  const jumpSvgRef = useRef<SVGSVGElement>(null);
  const seasonRailRef = useRef<HTMLDivElement>(null);

  // Difficulty View
  const [diffFloorSearch, setDiffFloorSearch] = useState<number | null>(null);
  const [diffFilter, setDiffFilter] = useState<OowFilter>('ramp');

  // Loaded Floors for the active season
  const [floors, setFloors] = useState<OowFloor[]>([]);
  const [chartFloors, setChartFloors] = useState<Record<string, OowFloor[]>>({});

  // Seasons list
  const seasons: OowSeasonSummary[] = useMemo(
    () => getSeasonsList(initialSummary, mode),
    [initialSummary, mode]
  );
  const displaySeasonNumber = useCallback((season: number) => {
    if (mode !== 'mmo') return season;
    const index = seasons.findIndex((item) => item.season === season);
    return index >= 0 ? index + 1 : season;
  }, [mode, seasons]);
  const seasonLabel = useCallback((season: number) => `S${displaySeasonNumber(season)}`, [displaySeasonNumber]);

  // Live season: the one whose date range contains today. Drives the green
  // pulse in the rail and the default selection on fresh opens.
  const liveSeason = useMemo(() => getLiveSeasonNumber(seasons), [seasons]);

  // OoW enemies use the shared FCE catalog for canonical boss names, colors,
  // artwork and the mechanics shown in the legacy full-card preview.
  const fceIndex = useMemo(
    () => ({
      mode,
      bosses: initialBossCards?.[mode === 'mmo' ? 'mmo' : 'standard'] ?? getBaselineBosses(mode === 'mmo' ? 'mmo' : 'standard'),
    }),
    [mode, initialBossCards]
  );

  // Keep the selected season visible inside the rail without moving the page.
  // This is especially important for deep links such as ?s=22: the current
  // season must remain visible at the end of the list as it is in legacy.
  const scrollRailToSeason = useCallback((targetSeason: number | null, comfortable = true) => {
    const list = seasonRailRef.current;
    if (!list || targetSeason == null) return;

    const target = list.querySelector<HTMLElement>(`[data-season-pill="${targetSeason}"]`);
    if (!target) return;

    const listRect = list.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const inset = 6;
    const isHorizontal = list.scrollWidth > list.clientWidth;

    if (isHorizontal) {
      const targetLeft = targetRect.left - listRect.left + list.scrollLeft;
      const centered = targetLeft - (list.clientWidth - target.offsetWidth) / 2;
      const maxScrollLeft = Math.max(0, list.scrollWidth - list.clientWidth);
      list.scrollLeft = Math.max(0, Math.min(centered, maxScrollLeft));
      return;
    }

    const targetTop = targetRect.top - listRect.top + list.scrollTop;
    const targetBottom = targetTop + target.offsetHeight;
    const maxScrollTop = Math.max(0, list.scrollHeight - list.clientHeight);

    if (comfortable) {
      const centered = targetTop - (list.clientHeight - target.offsetHeight) / 2;
      list.scrollTop = Math.max(0, Math.min(centered, maxScrollTop));
    } else {
      const visibleTop = list.scrollTop + inset;
      const visibleBottom = list.scrollTop + list.clientHeight - inset;
      if (targetTop < visibleTop) list.scrollTop = Math.max(0, targetTop - inset);
      else if (targetBottom > visibleBottom) list.scrollTop = Math.min(maxScrollTop, targetBottom - list.clientHeight + inset);
    }
  }, []);

  useEffect(() => {
    if (seasons.length === 0) {
      setSeasonNum(0);
      setCompareSeasonNum(0);
      setActiveChartSeasons([]);
      return;
    }

    const fallbackSeason = getLiveSeasonNumber(seasons) ?? seasons[seasons.length - 1].season;
    if (!seasons.some((season) => season.season === seasonNum)) {
      setSeasonNum(fallbackSeason);
    }
    if (!seasons.some((season) => season.season === compareSeasonNum)) {
      setCompareSeasonNum(seasons[Math.max(0, seasons.length - 2)].season);
    }
    setActiveChartSeasons((active) => {
      const valid = active.filter((season) => seasons.some((item) => item.season === season));
      return valid.length > 0 ? valid : seasons.slice(-4).map((season) => season.season);
    });
  }, [seasons, seasonNum, compareSeasonNum]);

  useEffect(() => {
    if (typeof window === 'undefined' || seasons.length === 0 || !seasonNum) return;
    const frame = window.requestAnimationFrame(() => scrollRailToSeason(seasonNum, true));
    return () => window.cancelAnimationFrame(frame);
  }, [railCollapsed, seasonNum, seasons, scrollRailToSeason]);

  // Read URL parameters on mount & on popstate, plus Escape key modal dismiss
  useEffect(() => {
    if (typeof window === 'undefined') return;

    function parseAndApplyParams() {
      // State is seeded from the server-parsed URL, so only correct when
      // the live URL disagrees (no extra season fetch for equal values).
      const p = new URLSearchParams(window.location.search);
      const m = p.get('mode');
      if (m === 'mmo') setMode((prev) => (prev === 'mmo' ? prev : 'mmo'));
      else setMode((prev) => (prev === 'standard' ? prev : 'standard'));

      const s = parseInt(p.get('s') || '', 10);
      if (!isNaN(s)) setSeasonNum((prev) => (prev === s ? prev : s));

      const t = p.get('tab');
      if (t === 'charts' || t === 'difficulty' || t === 'table') setTab((prev) => (prev === t ? prev : t));
      else setTab((prev) => (prev === 'table' ? prev : 'table'));

      const f = parseInt(p.get('floor') || '', 10);
      if (!isNaN(f)) setExpandedFloor((prev) => (prev === f ? prev : f));
      else setExpandedFloor((prev) => (prev === null ? prev : null));
      if (!getOowMobLinkId(window.location.search, window.location.hash)) {
        setModalEnemy((prev) => (prev ? null : prev));
      }
    }

    parseAndApplyParams();

    function onPopState() {
      parseAndApplyParams();
      syncEnemyFromLocation();
    }

    function syncEnemyFromLocation() {
      const mobId = getOowMobLinkId(window.location.search, window.location.hash);
      if (!mobId) {
        setModalEnemy(null);
        return;
      }
      const linkedEnemy = floors
        .flatMap((floor) => floor.enemies)
        .find((enemy) => [enemy.key, enemy.codeName, enemy.bossId].some((value) => value === mobId));
      if (linkedEnemy) setModalEnemy(linkedEnemy);
    }

    function onHashChange() { syncEnemyFromLocation(); }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (zoomImg) {
          e.preventDefault();
          setZoomImg(null);
        } else if (modalEnemy) {
          e.preventDefault();
          closeEnemyModal();
        } else if (compareOpen) {
          e.preventDefault();
          setCompareOpen(false);
        }
      }
    }

    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [zoomImg, modalEnemy, compareOpen, closeEnemyModal, floors]);

  // Sync URL params without full page reload
  const syncUrl = useCallback(
    (nextMode: OowMode, nextSeason: number, nextTab: OowTab, floor: number | null) => {
      if (typeof window === 'undefined') return;
      const p = new URLSearchParams(window.location.search);
      if (nextMode === 'mmo') p.set('mode', 'mmo');
      else p.delete('mode');

      p.set('s', String(nextSeason));
      if (nextTab !== 'table') p.set('tab', nextTab);
      else p.delete('tab');

      if (floor != null) p.set('floor', String(floor));
      else p.delete('floor');

      const q = p.toString() ? `?${p.toString()}` : '';
      window.history.replaceState(null, '', `${window.location.pathname}${q}${window.location.hash}`);
    },
    []
  );

  // When mode changes, switch seasons
  const handleModeChange = useCallback(
    (nextMode: OowMode) => {
      setMode(nextMode);
      const nextList = getSeasonsList(initialSummary, nextMode);
      const defaultS = getLiveSeasonNumber(nextList) ?? nextList[nextList.length - 1]?.season ?? 0;
      setSeasonNum(defaultS);
      setCompareSeasonNum(defaultS > 1 ? defaultS - 1 : defaultS);
      setActiveChartSeasons(nextList.slice(-4).map((s) => s.season));
      syncUrl(nextMode, defaultS, tab, expandedFloor);
    },
    [initialSummary, tab, expandedFloor, syncUrl]
  );

  // When season changes, load floor data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!seasonNum) {
        setFloors([]);
        return;
      }
      const data = await fetchSeasonFloors(mode, seasonNum, currentLocale);
      if (!cancelled) {
        setFloors(data);
        const mobParam = typeof window !== 'undefined'
          ? getOowMobLinkId(window.location.search, window.location.hash)
          : null;
        if (mobParam) {
          const linkedEnemy = data
            .flatMap((floor) => floor.enemies)
            .find((enemy) => [enemy.key, enemy.codeName, enemy.bossId].some((value) => value === mobParam));
          if (linkedEnemy) setModalEnemy(linkedEnemy);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentLocale, mode, seasonNum]);

  // Charts use the same real floor payload as the table. Load only the
  // selected seasons instead of inventing curves or scanning every season.
  useEffect(() => {
    let cancelled = false;
    async function loadChartFloors() {
      const seasonIds = activeChartSeasons.filter((season) =>
        seasons.some((item) => item.season === season),
      );
      const entries = await Promise.all(
        seasonIds.map(async (season) => [
          season,
          await fetchSeasonFloors(mode, season, currentLocale),
        ] as const),
      );
      if (!cancelled) {
        setChartFloors(Object.fromEntries(entries));
      }
    }
    if (activeChartSeasons.length > 0) void loadChartFloors();
    return () => {
      cancelled = true;
    };
  }, [activeChartSeasons, currentLocale, mode, seasons]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedTheme = window.localStorage.getItem('tof_oow_chart_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') setChartTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('tof_oow_chart_theme', chartTheme);
  }, [chartTheme]);

  // Current season summary
  const currentSeason = useMemo(() => {
    return seasons.find((s) => s.season === seasonNum) || seasons[seasons.length - 1];
  }, [seasons, seasonNum]);

  // Legacy OoW uses the late-season ramp as the default table view. The
  // challenge window starts at floor 26 for Original OoW and at 33 for MMO.
  const rampStartFloor = mode === 'mmo' ? 25 : 17;
  const challengeStartFloor = mode === 'mmo' ? 33 : 26;
  const finalFloor = currentSeason?.floorCount || (mode === 'mmo' ? 36 : 28);
  const rampLabel = `${rampStartFloor}–${finalFloor}`;
  const challengeLabel = `${challengeStartFloor}–${finalFloor}`;

  // Compare season summary
  const compareSeason = useMemo(() => {
    return seasons.find((s) => s.season === compareSeasonNum) || seasons[0];
  }, [seasons, compareSeasonNum]);

  // Toast trigger
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  // Filtered floors
  const filteredFloors = useMemo(() => {
    return floors.filter((f) => {
      if (filter === 'ramp' && f.floor < rampStartFloor) return false;
      if (filter === 'boss' && f.floor < challengeStartFloor) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesFloor =
          String(f.floor) === q ||
          `f${f.floor}` === q ||
          `floor ${f.floor}` === q ||
          `этаж ${f.floor}` === q;
        const matchesEnemy = f.enemies.some(
          (e) =>
            e.nameEn.toLowerCase().includes(q) ||
            e.nameRu.toLowerCase().includes(q) ||
            e.codeName?.toLowerCase().includes(q) ||
            e.bossId?.toLowerCase().includes(q) ||
            e.key?.toLowerCase().includes(q)
        );
        const matchesBuff = f.dropBuffs.some((buff) => {
          const names = typeof buff === 'string'
            ? [buff]
            : [(buff as { nameEn?: string }).nameEn, (buff as { nameRu?: string }).nameRu];
          return names.some((name) => name?.toLowerCase().includes(q));
        });
        if (!matchesFloor && !matchesEnemy && !matchesBuff) return false;
      }
      return true;
    });
  }, [floors, filter, searchQuery, rampStartFloor, challengeStartFloor]);

  // Compare metrics computation
  const comparisonStats = useMemo(() => {
    if (!currentSeason || !compareSeason) return [];
    const curTot = currentSeason.totalSeasonEffectiveHp;
    const cmpTot = compareSeason.totalSeasonEffectiveHp;
    const totDeltaPct = cmpTot > 0 ? ((curTot - cmpTot) / cmpTot) * 100 : 0;

    const curBoss = currentSeason.finalBossEffectiveHp || 0;
    const cmpBoss = compareSeason.finalBossEffectiveHp || 0;
    const bossDeltaPct = cmpBoss > 0 ? ((curBoss - cmpBoss) / cmpBoss) * 100 : 0;

    return [
      {
        label: copy.chartTotalSeasonEhp,
        value: `${formatHpValue(curTot, 'G').value} ${formatHpValue(curTot, 'G').unitLabel}`,
        delta: formatPercentDelta(totDeltaPct),
      },
      {
        label: copy.chartFinalBossEhp,
        value: `${formatHpValue(curBoss, 'G').value} ${formatHpValue(curBoss, 'G').unitLabel}`,
        delta: formatPercentDelta(bossDeltaPct),
      },
    ];
  }, [currentSeason, compareSeason, currentLocale]);

  // Floating boss artwork src
  const floatingBossImg = currentSeason?.bossImage
    ? resolveAsset(currentSeason.bossImage)
    : '';
  const zoomImagePng = modalEnemy ? getEnemyPresentation(modalEnemy, fceIndex).detailImagePng : null;

  const chartModel = useMemo(() => {
    const selected = activeChartSeasons
      .map((season) => ({
        summary: seasons.find((item) => item.season === season),
        floors: chartFloors[String(season)] || [],
      }))
      .filter((item): item is { summary: OowSeasonSummary; floors: OowFloor[] } => Boolean(item.summary))
      .sort((a, b) => a.summary.season - b.summary.season);
    const maxFloor = Math.max(
      ...selected.flatMap((item) => item.floors.map((floor) => floor.floor)),
      mode === 'mmo' ? 36 : 28,
    );
    const minFloor = chartRange === 'overtime'
      ? (mode === 'mmo' ? 33 : 26)
      : chartRange === 'ramp'
        ? (mode === 'mmo' ? 25 : 17)
        : 1;
    const values = selected.flatMap((item) => item.floors
      .filter((floor) => floor.floor >= minFloor && floor.floor <= maxFloor)
      .map((floor) => {
        const raw = chartMetric === 'boss' ? floor.maxHp : floor.totalHp;
        const multiplier = floor.resistanceInfo?.effectiveMultiplier
          ?? item.summary?.resistanceInfo?.effectiveMultiplier
          ?? 1;
        return chartMode === 'ehp' ? raw * multiplier : raw;
      }));
    const ymax = (Math.max(...values, 1) * 1.08) || 1;
    const W = 920, H = 300, L = 64, R = 24, T = 16, B = 30, pw = W - L - R, ph = H - T - B;
    const x = (f: number) => L + (maxFloor === minFloor ? 0 : ((f - minFloor) / (maxFloor - minFloor))) * pw;
    const y = (v: number) => T + ph - (v / ymax) * ph;

    const series = selected.map((item) => {
      const fls = item.floors.filter((floor) => floor.floor >= minFloor && floor.floor <= maxFloor);
      const points = fls.map((floor) => {
        const raw = chartMetric === 'boss' ? floor.maxHp : floor.totalHp;
        const multiplier = floor.resistanceInfo?.effectiveMultiplier
          ?? item.summary.resistanceInfo?.effectiveMultiplier
          ?? 1;
        const value = chartMode === 'ehp' ? raw * multiplier : raw;
        const cx = Number(x(floor.floor).toFixed(1));
        const cy = Number(y(value).toFixed(1));
        return {
          floor: floor.floor,
          value,
          x: cx,
          y: cy,
          r: floor.floor >= (mode === 'mmo' ? 33 : 26) ? 3.4 : 2.2,
        };
      });
      const area = points.length
        ? `M ${points[0].x} ${T + ph} ${points.map((p) => `L ${p.x} ${p.y}`).join(' ')} L ${points[points.length - 1].x} ${T + ph} Z`
        : '';
      return {
        season: item.summary.season,
        color: getSeasonColor(item.summary.season),
        points,
        area,
      };
    });

    const labelByPoint = new Map<string, { floor: number; value: number; x: number; y: number; color: string; season: number }>();
    series.forEach((s) => {
      s.points.forEach((p) => {
        const key = `${p.floor}:${p.value.toPrecision(12)}`;
        labelByPoint.set(key, { ...p, color: s.color, season: s.season });
      });
    });
    const labels = Array.from(labelByPoint.values()).map((p, index) => ({
      ...p,
      labelY: Math.max(14, p.y - (index % 2 ? 18 : 9)),
    }));

    const yticks: Array<{ y: number; label: string }> = [];
    for (let i = 0; i <= 4; i++) {
      const v = (ymax * i) / 4;
      const yy = Number(y(v).toFixed(1));
      const vG = v / 1e9;
      yticks.push({
        y: yy,
        label: `${vG >= 100 ? Math.round(vG) : vG.toFixed(1)}G`,
      });
    }

    const step = Math.max(1, Math.round((maxFloor - minFloor) / 7));
    const xticks: Array<{ x: number; label: string }> = [];
    for (let f = minFloor; f <= maxFloor; f += step) {
      xticks.push({
        x: Number(x(f).toFixed(1)),
        label: `F${f}`,
      });
    }
    if (xticks.length && xticks[xticks.length - 1].label !== `F${maxFloor}`) {
      xticks.push({
        x: Number(x(maxFloor).toFixed(1)),
        label: `F${maxFloor}`,
      });
    }

    return {
      minFloor,
      maxFloor,
      ymax,
      series,
      labels,
      yticks,
      xticks,
    };
  }, [activeChartSeasons, chartFloors, chartMetric, chartMode, chartRange, mode, seasons]);

  const difficultySteps = useMemo(() => {
    const floor = floors.find((item) => item.floor === (diffFloorSearch || finalFloor)) || floors[floors.length - 1];
    const unlockDay = currentSeason && currentSeason.season >= 21 ? (floor?.floor || 1) : 1;
    const seasonStart = currentSeason?.startDate
      ? new Date(`${currentSeason.startDate.slice(0, 10)}T00:00:00`)
      : null;
    const now = new Date();
    const dateForDay = (day: number) => {
      if (!seasonStart || Number.isNaN(seasonStart.getTime())) return null;
      const date = new Date(seasonStart);
      date.setDate(date.getDate() + day - 1);
      return date;
    };
    const steps = (floor?.difficultySchedule?.steps || [])
      .filter((step) => step.endDay >= unlockDay)
      .map((step) => {
        const startDay = Math.max(step.startDay, unlockDay);
        const start = dateForDay(startDay);
        const end = dateForDay(step.endDay);
        const live = Boolean(
          start &&
          end &&
          now >= start &&
          now <= new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999),
        );
        return {
          ...step,
          startDay,
          durationDays: Math.max(1, step.endDay - startDay + 1),
          live,
        };
      });
    const maxPct = Math.max(...steps.map((step) => step.pct), 100);
    return steps.map((step) => ({
      day: step.startDay === step.endDay
        ? copy.daySingle + ` ${step.startDay}`
        : copy.dayPlural + ` ${step.startDay}–${step.endDay}`,
      dur: `${step.durationDays}${copy.dayShort}`,
      pct: `${step.pct}%`,
      col: step.pct >= 1500 ? '#d98a99' : step.pct >= 600 ? '#d0b174' : step.pct > 100 ? '#cbb98a' : '#8fbdb2',
      barCol: step.pct >= 1500 ? 'rgba(217,138,153,.6)' : step.pct >= 600 ? 'rgba(208,177,116,.55)' : step.pct > 100 ? 'rgba(203,185,138,.5)' : 'rgba(143,189,178,.5)',
      barW: Math.max(8, Math.round((step.pct / maxPct) * 100)),
      date: formatSeasonDayRange(currentSeason?.startDate, step.startDay, step.endDay),
      live: step.live,
    }));
  }, [currentSeason, diffFloorSearch, finalFloor, floors, currentLocale]);

  const filteredDifficultyFloors = useMemo(() => {
    return floors.filter((floor) => {
      if (diffFilter === 'ramp') return floor.floor >= rampStartFloor;
      if (diffFilter === 'boss') return floor.floor >= challengeStartFloor;
      return true;
    });
  }, [challengeStartFloor, diffFilter, floors, rampStartFloor]);

  const visibleDifficultyRows = useMemo(() => {
    const rows = new Map<number, Array<{ startDay: number; endDay: number; durationDays: number; pct: number }>>();
    filteredDifficultyFloors.forEach((floor) => {
      const unlockDay = currentSeason && currentSeason.season >= 21 ? floor.floor : 1;
      rows.set(
        floor.floor,
        (floor.difficultySchedule?.steps || [])
          .filter((step) => step.endDay >= unlockDay)
          .map((step) => ({
            ...step,
            startDay: Math.max(step.startDay, unlockDay),
            durationDays: Math.max(1, step.endDay - Math.max(step.startDay, unlockDay) + 1),
            dateRange: formatSeasonDayRange(currentSeason?.startDate, Math.max(step.startDay, unlockDay), step.endDay),
          })),
      );
    });
    return rows;
  }, [currentSeason, filteredDifficultyFloors]);

  const historyModel = useMemo(() => {
    const values = seasons.map((season) => ({
      season: season.season,
      raw: season.finalBossHp || 0,
      ehp: season.finalBossEffectiveHp || 0,
    }));
    const max = Math.max(...values.map((item) => item.ehp), 1);
    const minLog = Math.log10(Math.max(0.01, Math.min(...values.map((item) => Math.max(item.raw, 0.01))) * 0.7));
    const maxLog = Math.log10(max * 1.3);
    const point = (value: number, index: number) => ({
      x: 58 + (index / Math.max(1, values.length - 1)) * (898 - 58),
      y: 22 + 236 - ((Math.log10(Math.max(value, 0.01)) - minLog) / Math.max(1, maxLog - minLog)) * 236,
    });
    const raw = values.map((item, index) => point(item.raw, index));
    const ehp = values.map((item, index) => point(item.ehp, index));
    const ehpArea = ehp.length
      ? `M ${ehp[0].x} 258 ${ehp.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')} L ${ehp[ehp.length - 1].x} 258 Z`
      : '';
    const NS = values.length;
    const histTickStep = Math.max(1, Math.round((NS - 1) / 6));
    const xticks: Array<{ x: number; label: string }> = [];
    if (NS > 0) {
      for (let s = 1; s <= NS; s += histTickStep) {
        const xx = Number((58 + ((s - 1) / Math.max(1, NS - 1)) * (898 - 58)).toFixed(1));
        xticks.push({ x: xx, label: `S${s}` });
      }
      if (xticks.length && xticks[xticks.length - 1].label !== `S${NS}`) {
        const xx = Number((58 + ((NS - 1) / Math.max(1, NS - 1)) * (898 - 58)).toFixed(1));
        xticks.push({ x: xx, label: `S${NS}` });
      }
    }
    return {
      raw,
      ehp,
      values,
      rawPath: raw.map((p, index) => `${index ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
      ehpPath: ehp.map((p, index) => `${index ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
      ehpArea,
      xticks,
    };
  }, [seasons]);

  const jumpModel = useMemo(() => chartModel.series.map((series) => {
    const points = series.points.map((point, index) => {
      const previous = jumpMode === 'floor'
        ? series.points[index - 1]
        : chartModel.series.find((item) => item.season === series.season - 1)?.points.find((p) => p.floor === point.floor);
      const growth = previous && previous.value > 0 ? ((point.value - previous.value) / previous.value) * 100 : 0;
      return { ...point, growth };
    });
    return { ...series, points };
  }), [chartModel.series, jumpMode]);

  const modalPrimaryStats = useMemo<EnemyPrimaryStat[]>(() => {
    if (!modalEnemy) return [];
    const stats = modalEnemy.stats || {};
    const number = (value: unknown, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const maxHealth = number(stats.MaxHealth, modalEnemy.hp);
    const atk = number(stats.CommonAtkBase, modalEnemy.atk);
    const armor = number(stats.ArmorBase ?? stats.Armor);
    const critDef = number(stats.FinalCritDef ?? stats.CritDef);
    return [
      { icon: initialSummary?.statIcons?.hp, label: copy.statMaxHealth, value: `${(maxHealth / 1e7).toFixed(2)} G`, sub: maxHealth.toLocaleString(numLocale), tone: 'hp' },
      { icon: initialSummary?.statIcons?.atk, label: copy.statBaseAtk, value: atk.toLocaleString(numLocale), sub: '', tone: 'atk' },
      { icon: initialSummary?.statIcons?.armor, label: copy.statShield, value: armor.toLocaleString(numLocale), sub: copy.statShieldSub, tone: 'armor' },
      { icon: initialSummary?.statIcons?.crit, label: copy.statCritRes, value: `${Math.round(critDef * 100)}%`, sub: copy.statCritResSub, tone: 'crit' },
    ];
  }, [currentLocale, modalEnemy, initialSummary?.statIcons]);

  const modalElements = useMemo(() => {
    if (!modalEnemy) return [];
    const stats = modalEnemy.stats || {};
    const resistance = formatResistancePercent(modalEnemy.resistanceInfo?.resistPercent);
    const number = (value: unknown, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    return [
      { icon: resistanceIcons.phys, element: 'Physical', name: getElementLabel('phys', currentLocale), def: number(stats.PhyDefBase, modalEnemy.def) },
      { icon: resistanceIcons.flame, element: 'Flame', name: getElementLabel('fire', currentLocale), def: number(stats.FireDefBase, modalEnemy.def) },
      { icon: resistanceIcons.frost, element: 'Frost', name: getElementLabel('frost', currentLocale), def: number(stats.IceDefBase, modalEnemy.def) },
      { icon: resistanceIcons.volt, element: 'Volt', name: getElementLabel('volt', currentLocale), def: number(stats.ThunderDefBase, modalEnemy.def) },
      { icon: resistanceIcons.altered, element: 'Altered', name: getElementLabel('altered', currentLocale), def: number(stats.SuperpowerDefBase, modalEnemy.def) },
    ].map((element) => ({ ...element, resistance }));
  }, [currentLocale, modalEnemy]);

  const modalOverrides = useMemo(() => {
    if (!modalEnemy) return [];
    const stats = modalEnemy.stats || {};
    const overrides: Array<{ key: string; label: string; value: string }> = [];
    const number = (value: unknown) => Number(value);
    const percent = (value: unknown) => `${Math.round(number(value) * 100)}%`;
    const add = (key: string, label: string, value: unknown, formatter: (value: unknown) => string) => {
      if (value === undefined || value === null || value === '' || value === '0' || value === 0 || value === 'None') return;
      overrides.push({ key, label, value: formatter(value) });
    };

    add('PhyDefIgnoreMult', copy.ovrPhysDefIgnore, stats.PhyDefIgnoreMult, percent);
    add('FireDefIgnoreMult', copy.ovrFireDefIgnore, stats.FireDefIgnoreMult, percent);
    add('IceDefIgnoreMult', copy.ovrIceDefIgnore, stats.IceDefIgnoreMult, percent);
    add('ThunderDefIgnoreMult', copy.ovrThunderDefIgnore, stats.ThunderDefIgnoreMult, percent);
    add('SuperpowerDefIgnoreMult', copy.ovrSuperpowerDefIgnore, stats.SuperpowerDefIgnoreMult, percent);

    const execute = stats.ExecuteMult;
    if (execute !== undefined && execute !== null && execute !== '' && execute !== 0 && execute !== '0' && execute !== 150 && execute !== '150' && execute !== 1.5 && execute !== '150%') {
      overrides.push({
        key: 'ExecuteMult',
        label: copy.ovrExecute,
        value: `${execute}%`,
      });
    }

    add('Crit', copy.ovrCrit, stats.Crit, percent);
    add('CritDef', copy.ovrCritDef, stats.CritDef, percent);
    add('FinalCrit', copy.ovrFinalCrit, stats.FinalCrit, percent);
    add('AbnormalState', copy.ovrAbnormal, stats.AbnormalState, percent);
    add('AbnormalStateResistance', copy.ovrAbnormalRes, stats.AbnormalStateResistance, percent);
    add('Rigidity', copy.ovrRigidity, stats.Rigidity, (value) => Number(value).toLocaleString(numLocale));
    add('RigidityResistance', copy.ovrRigidityRes, stats.RigidityResistance, (value) => Number(value).toLocaleString(numLocale));
    add('MaxRage', copy.ovrMaxRage, stats.MaxRage, (value) => Number(value).toLocaleString(numLocale));
    return overrides;
  }, [currentLocale, modalEnemy]);

  // In-chart titles (same typography as Sequential/Bygone) so PNG exports carry them.
  const mainChartTitle = isRu
    ? `${chartMetric === 'boss' ? 'HP босса по этажам' : 'Суммарное HP по этажам'} — ${chartRange === 'overtime' ? 'испытание' : chartRange === 'ramp' ? 'разгон' : 'все этажи'} OOW`
    : `${translateUiText(chartMetric === 'boss' ? 'Boss HP across floors' : 'Total floor HP across floors', currentLocale)} — ${translateUiText(`OOW ${chartRange === 'overtime' ? 'Challenge' : chartRange === 'ramp' ? 'Ramp' : 'All'}`, currentLocale)}`;
  const jumpChartTitle = jumpMode === 'season' ? copy.jumpTitleSeason : copy.jumpTitleFloor;

  return (
    <div className={styles.container}>
      {/* Floating Boss Artwork (in right margin on large screens) */}
      {floatingBossImg && (
        tab !== 'difficulty' &&
        <div className={styles.floatingBossArt} aria-hidden="true">
          <img src={floatingBossImg} alt="" />
        </div>
      )}

      <div className={styles.mainWrap}>
        {/* Hero & Mode Toggle */}
        <header className={styles.hero}>
          <div>
            <div className={styles.heroSubtitle}>{copy.heroSubtitle}</div>
            <h1 className={styles.heroTitle}>{copy.heroTitle}</h1>
          </div>

          <PillSwitcher
            mode={mode}
            onChange={(next) => {
              setStoredServerMode(next === 'mmo' ? 'mmo' : 'gacha');
              handleModeChange(next);
            }}
            originalLabel="Gacha"
            label={copy.gameModeLabel}
            mmoLabel={copy.mmoModeLabel}
            ariaLabel={copy.gameModeLabel}
          />
        </header>

        {/* 3 Main Navigation Tabs */}
        <DatamineTabs
          activeTab={tab}
          onChange={(nextTab) => {
            setTab(nextTab as OowTab);
            syncUrl(mode, seasonNum, nextTab as OowTab, nextTab === 'table' ? expandedFloor : null);
          }}
          tabs={[
            { id: 'table', label: copy.tableTabLabel },
            { id: 'charts', label: copy.chartsTabLabel },
            { id: 'difficulty', label: copy.difficultyTabLabel },
          ]}
          ariaLabel={translateUiText("Section Navigation", activeLocale)}
        />

        {/* Main Layout: Sticky Season Rail + Content Column */}
        <div className={styles.mainLayout}>
          {/* Season Rail (Left Aside) */}
          {!railCollapsed && (
            <aside className={styles.seasonAside} aria-label={translateUiText("Seasons List", activeLocale)}>
              <div className={styles.seasonHeader}>
                <button
                  type="button"
                  className={styles.toggleRailBtn}
                  title={copy.collapseSeasonsTitle}
                  onClick={() => setRailCollapsed(true)}
                >
                  {copy.seasonsLabel} <span>◀</span>
                </button>
                <span
                  style={{
                    font: '700 10px/1 var(--font-sans, system-ui)',
                    color: '#8fe6d4',
                  }}
                >
                  {seasonCountLabel(seasons.length)}
                </span>
              </div>

              <div ref={seasonRailRef} className={styles.seasonRailScroll}>
                {seasons.map((s) => {
                  const isSelected = s.season === seasonNum;
                  const sColor = getSeasonColor(s.season);
                  const bossImgSrc = resolveAsset(s.bossImageThumb || s.bossImage);
                  const sEhp = formatHpValue(s.finalBossEffectiveHp || s.totalSeasonEffectiveHp, 'G');

                  return (
                    <button
                      key={s.season}
                      type="button"
                      data-season-pill={s.season}
                      className={`${styles.seasonPill} ${isSelected ? styles.seasonPillActive : ''}`}
                      aria-current={isSelected}
                      onClick={() => {
                        setSeasonNum(s.season);
                        syncUrl(mode, s.season, tab, null);
                      }}
                    >
                      <div className={styles.seasonPillAvatar}>
                        {bossImgSrc ? (
                          <img
                            src={bossImgSrc}
                            alt=""
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : null}
                      </div>
                      <div className={styles.seasonPillHeader}>
                        <div className={styles.seasonPillTop}>
                          <span className={styles.seasonPillTitle}>
                            <span
                              className={styles.seasonPillDot}
                              style={{ background: sColor, boxShadow: `0 0 4px ${sColor}` }}
                            />
                            {seasonLabel(s.season)}
                          </span>
                          <span className={styles.seasonPillFloors}>{s.floorCount}F</span>
                        </div>
                        <div className={styles.seasonPillSub}>
                          <span className={styles.seasonPillStat}>
                            {sEhp.value} {sEhp.unitLabel}
                          </span>
                          <span className={styles.seasonPillDate}>
                            {formatLegacyDate(s.startDate)} → {formatLegacyDate(s.endDate)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>
          )}

          {/* Right Content Column */}
          <div className={styles.contentColumn}>
            {/* ================= TAB 1: STAGES & ENEMIES TABLE ================= */}
            {tab === 'table' && (
              <>
                {/* Toolbar */}
                <div className={styles.toolbar}>
                  <div className={styles.toolbarLeft}>
                    {railCollapsed && (
                      <button
                        type="button"
                        className={styles.toggleRailBtn}
                        title={copy.expandSeasonsTitle}
                        onClick={() => setRailCollapsed(false)}
                      >
                        <span>▶</span> {copy.seasonsLabel}
                      </button>
                    )}

                    <div className={`${styles.activeSeasonBadge} ${seasonNum === liveSeason ? '' : styles.activeSeasonBadgeIdle}`}>
                      <span className={seasonNum === liveSeason ? styles.pulsingDot : styles.idleDot} />
                      {copy.seasonWord} {displaySeasonNumber(seasonNum)} · {formatLegacyDate(currentSeason?.startDate)} → {formatLegacyDate(currentSeason?.endDate)}
                    </div>

                    <div className={styles.chipGroup} role="group" aria-label={translateUiText("Floor Filters", activeLocale)}>
                      <button
                        type="button"
                        className={`${styles.chip} ${filter === 'all' ? styles.chipActive : ''}`}
                        onClick={() => setFilter('all')}
                      >
                        {copy.allFloorsLabel}
                      </button>
                      <button
                        type="button"
                        className={`${styles.chip} ${filter === 'ramp' ? styles.chipActive : ''}`}
                        onClick={() => setFilter('ramp')}
                      >
                        {rampLabel}
                      </button>
                      <button
                        type="button"
                        className={`${styles.chip} ${filter === 'boss' ? styles.chipActive : ''}`}
                        onClick={() => setFilter('boss')}
                      >
                        {copy.challengeName.replace('{label}', challengeLabel)}
                      </button>
                    </div>

                    <div style={{ width: 220, maxWidth: '100%' }}>
                      <CatalogSearch
                        id="oow-search"
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder={copy.searchPlaceholder}
                        clearAriaLabel={copy.clearSearch}
                      />
                    </div>
                  </div>

                  <div className={styles.toolbarRight}>
                    <div className={styles.unitGroup} role="group" aria-label={translateUiText("HP Unit", activeLocale)}>
                      <button
                        type="button"
                        className={`${styles.unitBtn} ${hpUnit === 'G' ? styles.unitBtnActive : ''}`}
                        onClick={() => setHpUnit('G')}
                      >
                        G
                      </button>
                      <button
                        type="button"
                        className={`${styles.unitBtn} ${hpUnit === 'M' ? styles.unitBtnActive : ''}`}
                        onClick={() => setHpUnit('M')}
                      >
                        M
                      </button>
                      <button
                        type="button"
                        className={`${styles.unitBtn} ${hpUnit === 'RAW' ? styles.unitBtnActive : ''}`}
                        onClick={() => setHpUnit('RAW')}
                      >
                        {copy.exactLabel}
                      </button>
                    </div>

                    <button
                      type="button"
                      className={`${styles.actionBtn} ${compareOpen ? styles.actionBtnActive : ''}`}
                      onClick={() => setCompareOpen(!compareOpen)}
                    >
                      ⇆ {copy.compareLabelText}
                    </button>

                  </div>
                </div>

                {/* Compare Drawer */}
                {compareOpen && (
                  <section className={styles.compareDrawer} aria-label={copy.compareTitle}>
                    <div className={styles.compareHeader}>
                      <h2 className={styles.compareTitle}>
                        {copy.compareTitle} — {seasonLabel(seasonNum)} {copy.versusLabel} {seasonLabel(compareSeasonNum)}
                      </h2>

                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#948aa8' }}>{copy.compareWithLabel}</span>
                        <select
                          className={styles.compareSelect}
                          value={compareSeasonNum}
                          onChange={(e) => setCompareSeasonNum(Number(e.target.value))}
                        >
                          {seasons.map((s) => (
                            <option key={s.season} value={s.season}>
                              {seasonLabel(s.season)} ({s.floorCount}F)
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className={styles.compareGrid}>
                      {comparisonStats.map((item, idx) => (
                        <div key={idx} className={styles.compareCard}>
                          <div>
                            <div className={styles.compareCardLabel}>{item.label}</div>
                            <div className={styles.compareCardValue}>{item.value}</div>
                          </div>
                          <span
                            className={styles.compareDeltaBadge}
                            style={{ color: item.delta.color, background: item.delta.bg }}
                          >
                            {item.delta.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Floors Table */}
                <section className={styles.tablePanel} aria-label={translateUiText("Floors Lineup Table", activeLocale)}>
                  {/* Table Header */}
                  <div className={`${styles.floorGrid} ${styles.gridHeader}`}>
                    <div>{copy.floorLabel}</div>
                    <div>{copy.totalHpLabel}</div>
                    <div>{copy.maxMobLabel}</div>
                    <div>{copy.mobsLabel}</div>
                    <div>{copy.mainEnemiesLabel}</div>
                    <div className={styles.waveHeader}>{copy.waveDistributionLabel}</div>
                    <div />
                  </div>

                  {/* Table Rows */}
                  {filteredFloors.map((floor) => {
                    const isExpanded = expandedFloor === floor.floor;
                    const mainEnemiesList = buildMainEnemiesList(floor, fceIndex, isRu);
                    const totFormatted = formatHpValue(floor.effectiveHp, hpUnit);
                    const rawTotFormatted = formatHpValue(floor.totalHp, hpUnit);
                    const maxFormatted = formatHpValue(floor.maxMobEffectiveHp, hpUnit);
                    const rawMaxFormatted = formatHpValue(floor.maxHp, hpUnit);

                    return (
                      <div key={floor.floor}>
                        <div
                          className={`${styles.floorGrid} ${styles.gridRow} ${floor.floor >= challengeStartFloor ? styles.challengeRow : ''}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          aria-controls={`oow-floor-${seasonNum}-${floor.floor}`}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); }
                          }}
                          onClick={() => {
                            const next = isExpanded ? null : floor.floor;
                            setExpandedFloor(next);
                            syncUrl(mode, seasonNum, tab, next);
                          }}
                        >
                          {/* Floor Badge */}
                          <div style={{ textAlign: 'center', padding: '12px 6px' }}>
                            <span className={`${styles.floorBadge} ${floor.floor >= challengeStartFloor ? styles.challengeFloorBadge : ''}`}>F{floor.floor}</span>
                          </div>

                          {/* Total HP */}
                          <div className={styles.hpCell}>
                            <div>
                              {totFormatted.value}{' '}
                              <span style={{ fontSize: 10, color: '#8f7a3f' }}>
                                {totFormatted.unitLabel}
                              </span>
                            </div>
                            <div className={styles.hpSub}>
                              {rawTotFormatted.value} {rawTotFormatted.unitLabel} ({copy.rawHpTag})
                            </div>
                          </div>

                          {/* Max Mob HP */}
                          <div className={styles.maxHpCell}>
                            <div>
                              {maxFormatted.value}{' '}
                              <span style={{ fontSize: 9, color: '#5b5470' }}>
                                {maxFormatted.unitLabel}
                              </span>
                            </div>
                            <div className={styles.hpSub}>
                              {rawMaxFormatted.value} {rawMaxFormatted.unitLabel} ({copy.rawHpTag})
                            </div>
                          </div>

                          {/* Mobs Count */}
                          <div className={styles.mobsCell}>{floor.mobCount}</div>

                          {/* Main Enemies */}
                          <div className={styles.mainEnemiesCell}>
                            <div className={styles.mainEnemiesWrap}>
                              {mainEnemiesList.map((item, idx) => (
                                <React.Fragment key={idx}>
                                  {item.isBoss ? (
                                    <span className={styles.enemyChip}>
                                      {item.avatar && (
                                        <img
                                          className={styles.enemyChipAvatar}
                                          src={resolveAsset(item.avatar)}
                                          alt=""
                                          onError={(e) => {
                                            (e.currentTarget as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                      )}
                                      <span style={{ color: item.color || '#f6f1fb' }}>
                                        {item.name}
                                      </span>
                                    </span>
                                  ) : (
                                    <span style={{ color: '#948aa8', fontSize: 12 }}>
                                      {item.label}
                                    </span>
                                  )}
                                  {item.hasSeparator && (
                                    <span style={{ color: '#7a7290' }}>+</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>

                          {/* Wave Distribution Bar */}
                          <div className={styles.waveDistributionBar}>
                            {(() => {
                              const enemies = floor.enemies || [];
                              const waveMap = new Map<number, typeof enemies>();
                              enemies.forEach((enemy) => {
                                const wave = enemy.wave || 1;
                                const list = waveMap.get(wave) || [];
                                list.push(enemy);
                                waveMap.set(wave, list);
                              });
                              const waveColors = [
                                'linear-gradient(90deg, #4fe3c1, #38e0d0)',
                                'linear-gradient(90deg, #b57bff, #9d6bff)',
                                'linear-gradient(90deg, #f5d97a, #f0b94e)',
                                'linear-gradient(90deg, #ff8fa8, #ff6b8b)',
                              ];
                              const mobColors = [
                                'linear-gradient(90deg, #ff6b8b, #ff4d73)',
                                'linear-gradient(90deg, #f5a623, #f0b94e)',
                                'linear-gradient(90deg, #a855f7, #8b5cf6)',
                                'linear-gradient(90deg, #38bdf8, #0ea5e9)',
                                'linear-gradient(90deg, #34d399, #10b981)',
                              ];
                              const entries = waveMap.size > 1
                                ? [...waveMap.entries()].sort(([a], [b]) => a - b).map(([wave, items]) => ({
                                    key: `wave-${wave}`,
                                    hp: items.reduce((sum, item) => sum + (item.combinedHp || item.hp || 0), 0),
                                    label: copy.waveName.replace('{wave}', String(wave)),
                                    color: null,
                                  }))
                                : [...enemies]
                                    .sort((a, b) => (b.combinedHp || b.hp || 0) - (a.combinedHp || a.hp || 0))
                                    .map((enemy, index) => ({
                                      key: `mob-${index}`,
                                      hp: enemy.combinedHp || enemy.hp || 0,
                                      label: isRu ? enemy.nameRu : enemy.nameEn,
                                      color: null,
                                    }));
                              const totalHp = entries.reduce((sum, entry) => sum + entry.hp, 0);
                              const percentages = entries.map((entry) => totalHp > 0 ? Math.round((entry.hp / totalHp) * 100) : 0);
                              if (percentages.length > 0) {
                                percentages[percentages.length - 1] += 100 - percentages.reduce((sum, pct) => sum + pct, 0);
                              }
                              return entries.map((entry, index) => (
                                <div
                                  key={entry.key}
                                  className={styles.waveSegment}
                                  style={{
                                    width: `${Math.max(1, percentages[index] || 0)}%`,
                                    background: entry.color || (waveMap.size > 1 ? waveColors : mobColors)[index % (waveMap.size > 1 ? waveColors.length : mobColors.length)],
                                  }}
                                  title={`${entry.label} · F${floor.floor} (${percentages[index] || 0}%)`}
                                />
                              ));
                            })()}
                          </div>

                          {/* Chevron */}
                          <div className={styles.chevronCell} data-open={isExpanded || undefined}><EncounterRowChevron /></div>
                        </div>

                        {/* Floor Drawer (Opened) */}
                        <Collapsible open={isExpanded} id={`oow-floor-${seasonNum}-${floor.floor}`}>
                          {() => (
                          <div className={styles.floorDrawer}>
                            {/* Lineup Header */}
                            <div className={styles.lineupHeader}>
                              <div className={styles.lineupTitle}>
                                F{floor.floor} · {copy.waveLineup}
                              </div>

                              <div className={styles.resistsBadge}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="#4fe3c1">
                                  <path d="M12 2l8 3.2V11c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V5.2z" />
                                  <path
                                    d="M10.2 12.1l-1.6-1.6-1.15 1.15 2.75 2.75 4.5-4.5-1.15-1.15z"
                                    fill="#0c0812"
                                  />
                                </svg>
                                <div>
                                  <div className={styles.resistsBadgeLabel}>
                                    {copy.resistsLabel}
                                  </div>
                                  <div className={styles.resistsBadgeVal}>
                                    {formatResistancePercent(floor.resistPercent)}%
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Wave groups and mob cards */}
                            {buildWaveGroups(floor.enemies).map((group, groupIndex, groups) => {
                              const isFinalWave = groupIndex === groups.length - 1;
                              return (
                                <section key={group.wave} className={styles.waveGroup}>
                                  <div className={styles.waveGroupTitle}>
                                    {copy.waveHeader} {group.wave}
                                    <span>·</span>
                                    {isFinalWave ? copy.waveFinalBoss : group.wave === 1 ? copy.waveVanguard : copy.waveAssault}
                                  </div>
                                  <div className={styles.mobsGrid}>
                              {group.enemies.map((enemy, eIdx) => {
                                const presentation = getEnemyPresentation(enemy, fceIndex);
                                const enemyName = isRu ? presentation.nameRu : presentation.nameEn;
                                const avatarUrl = resolveAsset(
                                  presentation.avatar || enemy.lineupPortraitThumb || enemy.imageThumb || enemy.image
                                );
                                const ehpVal = formatHpValue(enemy.effectiveHp, hpUnit);
                                const rawVal = formatHpValue(enemy.hp, hpUnit);
                                const kind = enemyKindClass(enemy);
                                const kindLabel = kind === 'boss' ? copy.kindBoss : kind === 'elite' ? copy.kindElite : copy.kindCreep;

                                return (
                                  <EnemyLineupCard
                                    key={eIdx}
                                    name={enemyName} nameColor={presentation.color ?? undefined}
                                    portrait={avatarUrl} quantity={enemy.count > 1 ? String(enemy.count) : undefined}
                                    kind={kind} kindLabel={kindLabel}
                                    onInspect={() => updateEnemyModal(enemy)} hint={copy.deepStatsHint}
                                    badges={typeof enemy.level === 'number' && enemy.level > 0 ? (
                                          <span className={styles.mobLevelTag}>
                                            {translateUiText('Lv.', activeLocale)} {enemy.level}
                                          </span>
                                    ) : null}
                                    aside={<EnemyHealthSummary label={copy.effectiveHpLabel} value={ehpVal.value} unit={ehpVal.unitLabel} icon={initialSummary?.statIcons?.hp}>
                                      <span style={{ fontSize: 10, color: '#8a8398', marginRight: 4, fontWeight: 500 }}>({copy.rawHpTag})</span>
                                      {rawVal.value}<span style={{ fontSize: 10, color: '#8a8398', marginLeft: 2 }}>{rawVal.unitLabel}</span>
                                    </EnemyHealthSummary>}>
                                    <EnemyStatBadges items={getEnemyStatBadges(enemy, copy.defenseShieldPrefix, copy.defenseCritResPrefix, numLocale)} icons={initialSummary?.statIcons} />
                                  </EnemyLineupCard>
                                );
                              })}
                                  </div>
                                </section>
                              );
                            })}

                            {/* Mutators & Affixes */}
                            {(() => {
                              const buffCards = buildFloorBuffCards(floor, getBuffsDictionary(initialSummary?.buffs), isRu, copy);
                              if (buffCards.length === 0) return null;
                              return (
                              <div className={styles.affixesSection}>
                                <div className={styles.affixesTitle}>{copy.affixesLabel}</div>
                                <div className={styles.affixesGrid}>
                                  {buffCards.map((buff) => {
                                    const bIcon = resolveAsset(buff.icon);
                                    const accent = buff.kind === 'drop' ? '#f5d97a' : '#ff6b8b';

                                    return (
                                      <EncounterBuffCard key={buff.id} name={buff.name} icon={bIcon} accent={accent} badge={buff.badge}
                                        marker={buff.slot && (
                                          <span
                                            className={`${styles.slotMark} ${styles[`slotMarkType${buff.slot}`] || ''}`}
                                            role="img"
                                            aria-label={buff.slotLabel}
                                            title={buff.slotLabel}
                                          >
                                            {Array.from({ length: 6 }, (_, index) => (
                                              <span key={index} className={`${styles.slotMarkDot} ${styles[`slotMarkDot${index + 1}`] || ''}`} />
                                            ))}
                                          </span>
                                        )} description={buff.description} />
                                    );
                                  })}
                                </div>
                              </div>
                              );
                            })()}
                          </div>
                          )}
                        </Collapsible>
                      </div>
                    );
                  })}
                </section>
              </>
            )}

            {/* ================= TAB 2: SCALING CHARTS ================= */}
            {tab === 'charts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Controls */}
                <div className={styles.chartControls}>
                  <div className={styles.chartControlsTop}>
                    {/* HP Mode */}
                    <div className={styles.controlCard}>
                      <div className={styles.controlCardTitle}>{copy.hpModeLabel}</div>
                      <div className={styles.controlCardOptions}>
                        <button
                          type="button"
                          className={`${styles.chip} ${chartMode === 'ehp' ? styles.chipActive : ''}`}
                          onClick={() => setChartMode('ehp')}
                        >
                          {copy.effectiveHpLabel}
                        </button>
                        <button
                          type="button"
                          className={`${styles.chip} ${chartMode === 'raw' ? styles.chipActive : ''}`}
                          onClick={() => setChartMode('raw')}
                        >
                          {copy.rawHpLabel}
                        </button>
                      </div>
                    </div>

                    {/* Metric */}
                    <div className={styles.controlCard}>
                      <div className={styles.controlCardTitle}>{copy.metricLabel}</div>
                      <div className={styles.controlCardOptions}>
                        <button
                          type="button"
                          className={`${styles.chip} ${chartMetric === 'boss' ? styles.chipActive : ''}`}
                          onClick={() => setChartMetric('boss')}
                        >
                          {copy.bossHpLabel}
                        </button>
                        <button
                          type="button"
                          className={`${styles.chip} ${chartMetric === 'total' ? styles.chipActive : ''}`}
                          onClick={() => setChartMetric('total')}
                        >
                          {copy.totalFloorLabel}
                        </button>
                      </div>
                    </div>

                    {/* Floor Range */}
                    <div className={styles.controlCard}>
                      <div className={styles.controlCardTitle}>{copy.floorRangeLabel}</div>
                      <div className={styles.controlCardOptions}>
                        <button
                          type="button"
                          className={`${styles.chip} ${chartRange === 'ramp' ? styles.chipActive : ''}`}
                          onClick={() => setChartRange('ramp')}
                        >
                          {fillText(localeText(currentLocale)('Ramp {0}', 'Разгон {0}'), [rampLabel])}
                        </button>
                        <button
                          type="button"
                          className={`${styles.chip} ${chartRange === 'overtime' ? styles.chipActive : ''}`}
                          onClick={() => setChartRange('overtime')}
                        >
                          {fillText(localeText(currentLocale)('Challenge {0}', 'Испытание {0}'), [challengeLabel])}
                        </button>
                        <button
                          type="button"
                          className={`${styles.chip} ${chartRange === 'all' ? styles.chipActive : ''}`}
                          onClick={() => setChartRange('all')}
                        >
                          {copy.allLabel}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Presets & Theme */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                      borderTop: '1px solid rgba(255,255,255,.06)',
                      paddingTop: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ font: '700 9px/1 var(--font-sans, system-ui)', textTransform: 'uppercase', color: '#948aa8' }}>
                        {copy.presetsLabel}
                      </span>
                      <button
                        type="button"
                        className={`${styles.chartPresetBtn} ${activeChartSeasons.length === 1 && activeChartSeasons[0] === seasonNum ? styles.chartPresetBtnActive : ''}`}
                        onClick={() => setActiveChartSeasons([seasonNum])}
                      >
                        {copy.rangeCurrent}
                      </button>
                      <button
                        type="button"
                        className={`${styles.chartPresetBtn} ${activeChartSeasons.length === Math.min(4, seasons.length) && activeChartSeasons.every((season) => seasons.slice(-4).some((item) => item.season === season)) ? styles.chartPresetBtnActive : ''}`}
                        onClick={() => setActiveChartSeasons(seasons.slice(-4).map((s) => s.season))}
                      >
                        {copy.rangeLast4}
                      </button>
                      <button
                        type="button"
                        className={`${styles.chartPresetBtn} ${activeChartSeasons.length === Math.min(10, seasons.length) && activeChartSeasons.every((season) => seasons.slice(-10).some((item) => item.season === season)) ? styles.chartPresetBtnActive : ''}`}
                        onClick={() => setActiveChartSeasons(seasons.slice(-10).map((s) => s.season))}
                      >
                        {copy.rangeLast10}
                      </button>
                      <button
                        type="button"
                        className={`${styles.chartPresetBtn} ${activeChartSeasons.length === seasons.length ? styles.chartPresetBtnActive : ''}`}
                        onClick={() => setActiveChartSeasons(seasons.map((s) => s.season))}
                      >
                        {copy.allLabel}
                      </button>
                    </div>

                    <div className={styles.controlItem}>
                      <span className={styles.controlLabel}>{copy.chartPaletteLabel}</span>
                      <div className={styles.segmentedSwitch} role="group" aria-label={copy.chartPaletteAria}>
                        <button
                          type="button"
                          className={`${styles.switchBtn} ${chartTheme === 'light' ? styles.switchBtnActive : ''}`}
                          onClick={() => setChartTheme('light')}
                          aria-pressed={chartTheme === 'light'}
                        >
                          <svg className={styles.paletteIcon} viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
                          </svg>
                          <span>{copy.lightLabel}</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.switchBtn} ${chartTheme === 'dark' ? styles.switchBtnActive : ''}`}
                          onClick={() => setChartTheme('dark')}
                          aria-pressed={chartTheme === 'dark'}
                        >
                          <svg className={styles.paletteIcon} viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
                          </svg>
                          <span>{copy.darkLabel}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Season Multi-select Chips */}
                  <div>
                    <div
                      style={{
                        font: '700 9px/1 var(--font-sans, system-ui)',
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                        color: '#948aa8',
                        marginBottom: 8,
                      }}
                    >
                      {copy.seasonsOnChartLabel}
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {seasons.map((s) => {
                        const isChartActive = activeChartSeasons.includes(s.season);
                        const sColor = getSeasonColor(s.season);
                        return (
                          <button
                            key={s.season}
                            type="button"
                            className={`${styles.chartSeasonChip} ${isChartActive ? styles.chartSeasonChipActive : ''}`}
                            onClick={() => {
                              if (isChartActive) {
                                if (activeChartSeasons.length > 1) {
                                  setActiveChartSeasons(activeChartSeasons.filter((num) => num !== s.season));
                                }
                              } else {
                                setActiveChartSeasons([...activeChartSeasons, s.season]);
                              }
                            }}
                          >
                            <span
                              className={styles.chartSeasonChipColor}
                              style={{ background: sColor }}
                            />
                            {seasonLabel(s.season)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className={styles.chartsGrid} data-chart-theme={chartTheme}>
                {/* Main Interactive SVG Line Chart */}
                <div
                  className={styles.chartCard}
                  data-chart-card="main"
                  data-theme={chartTheme}
                  onDoubleClick={() => setPromotedSub(null)}
                  style={{
                    gridColumn: promotedSub ? '1' : '1 / -1',
                    gridRow: promotedSub ? '2' : '1',
                    padding: '16px 20px',
                  }}
                >
                  <div className={styles.chartHeader}>
                    <div className={styles.chartHeaderContent}>
                      <h2 className={styles.chartTitle}>
                        {mainChartTitle}
                      </h2>
                    </div>

                    <div className={styles.chartActions}>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                        onClick={() => {
                          if (mainSvgRef.current) {
                            downloadSvgAsPng(mainSvgRef.current, `oow-${mode}-scaling-curves.png`);
                          }
                        }}
                      >
                        {copy.downloadPngLabel}
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => {
                          const csvRows = [
                            ['Floor', ...chartModel.series.map((series) => `${seasonLabel(series.season)} (G)`)],
                            ...Array.from({ length: chartModel.maxFloor - chartModel.minFloor + 1 }, (_, i) => chartModel.minFloor + i).map((floor) => [
                              `F${floor}`,
                              ...chartModel.series.map((series) => {
                                const pt = series.points.find((p) => p.floor === floor);
                                return pt ? formatHpValue(pt.value, 'G').value : '';
                              }),
                            ]),
                          ];
                          downloadCsv(csvRows, `oow-${mode}-chart.csv`);
                        }}
                      >
                        {copy.downloadCsvLabel}
                      </button>
                      <span className={styles.modeBadge}>
                        {chartMode === 'ehp' ? (isRu ? '🛡 Эффективное HP' : translateUiText('🛡 Effective HP', currentLocale)) : (isRu ? '❤ Номинальное HP' : translateUiText('❤ Raw HP', currentLocale))}
                      </span>
                      {promotedSub && (
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => setPromotedSub(null)}
                          title={copy.moveToTop}
                          aria-label={copy.moveToTop}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 19V5M5 12l7-7 7 7"/>
                          </svg>
                          <span>{copy.moveToTop}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SVG Chart Plot */}
                  <div
                    style={{ position: 'relative' }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      if (rect.width <= 0) return;
                      const vx = ((e.clientX - rect.left) / rect.width) * 920;
                      const floor = Math.round(chartModel.minFloor + ((vx - 64) / Math.max(1, 896 - 64)) * (chartModel.maxFloor - chartModel.minFloor));
                      setChartHoverFloor(Math.max(chartModel.minFloor, Math.min(chartModel.maxFloor, floor)));
                    }}
                    onPointerMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      if (rect.width <= 0) return;
                      const vx = ((e.clientX - rect.left) / rect.width) * 920;
                      const floor = Math.round(chartModel.minFloor + ((vx - 64) / Math.max(1, 896 - 64)) * (chartModel.maxFloor - chartModel.minFloor));
                      setChartHoverFloor(Math.max(chartModel.minFloor, Math.min(chartModel.maxFloor, floor)));
                    }}
                    onMouseLeave={() => setChartHoverFloor(null)}
                    onPointerLeave={() => setChartHoverFloor(null)}
                  >
                    <svg
                      ref={mainSvgRef}
                      viewBox={`0 ${-OOW_TITLE_BAND} 920 ${300 + OOW_TITLE_BAND}`}
                      style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair', overflow: 'visible' }}
                      role="img"
                      aria-label={translateUiText("OoW Floor Scaling Chart", activeLocale)}
                    >
                      <rect
                        x="0"
                        y={-OOW_TITLE_BAND}
                        width="920"
                        height={300 + OOW_TITLE_BAND}
                        rx="8"
                        fill={chartTheme === 'light' ? '#ffffff' : '#0f0b15'}
                      />
                      <text
                        x="460"
                        y={-OOW_TITLE_BAND / 2 + 5}
                        textAnchor="middle"
                        fontFamily={CHART_FONT_FAMILY}
                        fontSize="14"
                        fontWeight={CHART_TITLE_FONT_WEIGHT}
                        fill={chartTheme === 'light' ? '#1f2937' : '#f4f0f6'}
                      >
                        {mainChartTitle}
                      </text>

                      {/* Y-axis Ticks & Grid Lines */}
                      {chartModel.yticks.map((tick, idx) => (
                        <g key={idx}>
                          <line
                            x1="64"
                            y1={tick.y}
                            x2="896"
                            y2={tick.y}
                            stroke={chartTheme === 'light' ? '#e8e5eb' : 'rgba(255,255,255,.06)'}
                            strokeWidth="1"
                          />
                          <text
                            x="58"
                            y={tick.y + 3.5}
                            fill={chartTheme === 'light' ? '#665e6d' : '#6b6480'}
                            fontSize="10"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="end"
                          >
                            {tick.label}
                          </text>
                        </g>
                      ))}

                      {/* X-axis Ticks */}
                      {chartModel.xticks.map((tick, idx) => (
                        <text
                          key={idx}
                          x={tick.x}
                          y="288"
                          fill={chartTheme === 'light' ? '#665e6d' : '#6b6480'}
                          fontSize="10"
                          fontFamily="'JetBrains Mono', monospace"
                          textAnchor="middle"
                        >
                          {tick.label}
                        </text>
                      ))}

                      {/* Series Lines & Translucent Area Fills */}
                      {chartModel.series.map((series) => {
                        const points = series.points.map((point) => `${point.x},${point.y}`);
                        return (
                          <g key={series.season}>
                            {series.area && (
                              <path d={series.area} fill={series.color} opacity={0.12} />
                            )}
                            <polyline
                              fill="none"
                              stroke={series.color}
                              strokeWidth="2.2"
                              strokeLinejoin="round"
                              points={points.join(' ')}
                            />
                            {series.points.map((point, pIdx) => (
                              <circle
                                key={pIdx}
                                cx={point.x}
                                cy={point.y}
                                r={point.r}
                                fill={series.color}
                              />
                            ))}
                          </g>
                        );
                      })}

                      {/* Deduplicated Value Labels on top */}
                      {chartModel.labels.map((p, lIdx) => (
                        <text
                          key={lIdx}
                          x={p.x}
                          y={p.labelY}
                          fill={p.color}
                          fontSize="9"
                          fontWeight="700"
                          fontFamily="'JetBrains Mono', monospace"
                          textAnchor="middle"
                          style={{
                            paintOrder: 'stroke fill',
                            stroke: chartTheme === 'light' ? '#ffffff' : '#0f0b15',
                            strokeWidth: 3,
                            strokeLinejoin: 'round',
                            pointerEvents: 'none',
                          }}
                        >
                          {formatHpValue(p.value, 'G').value}G
                        </text>
                      ))}

                      {/* Hover Guide Crosshair Line (Dashed) */}
                      {chartHoverFloor != null && (
                        <line
                          x1={64 + (chartModel.maxFloor === chartModel.minFloor ? 0 : ((chartHoverFloor - chartModel.minFloor) / (chartModel.maxFloor - chartModel.minFloor)) * (896 - 64))}
                          y1="16"
                          x2={64 + (chartModel.maxFloor === chartModel.minFloor ? 0 : ((chartHoverFloor - chartModel.minFloor) / (chartModel.maxFloor - chartModel.minFloor)) * (896 - 64))}
                          y2="270"
                          stroke="rgba(245,217,122,.5)"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      )}
                      <rect
                        x="0"
                        y="0"
                        width="920"
                        height="300"
                        fill="transparent"
                        style={{ pointerEvents: 'none' }}
                      />
                      <ChartWatermark x={8} y={295} fontSize={9} fill={chartTheme === 'light' ? '#665e6d' : '#8a8398'} />
                    </svg>

                    {/* Tooltip on Hover matching Legacy (Screen 1) */}
                    {chartHoverFloor != null && (() => {
                      const guideX = 64 + (chartModel.maxFloor === chartModel.minFloor ? 0 : ((chartHoverFloor - chartModel.minFloor) / (chartModel.maxFloor - chartModel.minFloor)) * (896 - 64));
                      const guideLeftPct = (guideX / 920) * 100;
                      const guideShift = guideLeftPct > 70 ? '-100%' : (guideLeftPct < 14 ? '0%' : '-50%');
                      const isChallenge = chartHoverFloor >= (mode === 'mmo' ? 33 : 26);
                      const floorLabel = (isRu ? 'Этаж F' : translateUiText('Floor F', currentLocale)) + chartHoverFloor + (isChallenge ? (isRu ? ' · Испытание' : translateUiText(' · Challenge', currentLocale)) : '');

                      return (
                        <div
                          className={styles.chartGuideTooltip}
                          style={{
                            left: `${guideLeftPct}%`,
                            transform: `translateX(${guideShift})`,
                          }}
                        >
                          <div className={styles.chartGuideTooltipTitle}>{floorLabel}</div>
                          {chartModel.series.map((series) => {
                            const pt = series.points.find((p) => p.floor === chartHoverFloor);
                            if (!pt) return null;
                            const formatted = formatHpValue(pt.value, 'G');
                            return (
                              <div key={series.season} className={styles.chartGuideTooltipRow}>
                                <span className={styles.chartGuideTooltipSeries}>
                                  <span
                                    className={styles.chartGuideTooltipColor}
                                    style={{ background: series.color }}
                                  />
                                  {seasonLabel(series.season)}
                                </span>
                                <span className={styles.chartGuideTooltipValue}>
                                  {formatted.value} G
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Subchart: Final Floor HP History */}
                <div
                  className={styles.chartCard}
                  data-chart-card="history"
                  data-theme={chartTheme}
                  title={promotedSub === 'history' ? copy.dblClickRestore : copy.dblClickEnlarge}
                  onDoubleClick={(event) => {
                    if ((event.target as HTMLElement).closest('button, a, input, select')) return;
                    setPromotedSub(promotedSub === 'history' ? null : 'history');
                  }}
                  style={{
                    gridColumn: promotedSub === 'history' ? '1 / -1' : promotedSub === 'jump' ? '2' : '1',
                    gridRow: promotedSub === 'history' ? '1' : promotedSub === 'jump' ? '2' : '2',
                    padding: '16px 20px',
                  }}
                >
                  <div className={styles.chartHeader}>
                    <div className={styles.chartHeaderContent}>
                      <h3 className={styles.chartTitle}>
                        {copy.historyChartTitle}
                      </h3>
                      <p className={styles.chartSubtitle}>
                        {copy.historyChartDescription}
                      </p>
                    </div>

                    <div className={styles.chartActions}>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                        onClick={() => {
                          if (historySvgRef.current) {
                            downloadSvgAsPng(historySvgRef.current, `oow-${mode}-final-floor-history.png`);
                          }
                        }}
                      >
                        PNG
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => {
                          const csvRows = [
                            [translateUiText('Season', currentLocale), `${translateUiText('Raw HP', currentLocale)} (G)`, `${translateUiText('Effective HP', currentLocale)} (G)`],
                            ...historyModel.values.map((item) => [
                              seasonLabel(item.season),
                              `${formatHpValue(item.raw, 'G').value}G`,
                              `${formatHpValue(item.ehp, 'G').value}G`,
                            ]),
                          ];
                          downloadCsv(csvRows, `oow-${mode}-final-floor-history.csv`);
                        }}
                      >
                        CSV
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => setPromotedSub(promotedSub === 'history' ? null : 'history')}
                        title={promotedSub === 'history' ? copy.moveDown : copy.moveToTop}
                        aria-label={promotedSub === 'history' ? copy.moveDown : copy.moveToTop}
                      >
                        {promotedSub === 'history' ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 5v14M19 12l-7 7-7-7"/>
                            </svg>
                            <span>{copy.moveDown}</span>
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 19V5M5 12l7-7 7 7"/>
                            </svg>
                            <span>{copy.moveToTop}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Legend matching Screen 2 */}
                  <div className={styles.chartLegendRow}>
                    <span className={styles.chartLegendItem} style={{ color: '#f5d97a' }}>
                      <span className={styles.chartLegendBar} style={{ background: '#f5d97a' }} />
                      {copy.rawHpLabel}
                    </span>
                    <span className={styles.chartLegendItem} style={{ color: '#c79dff' }}>
                      <span className={styles.chartLegendBar} style={{ background: '#c79dff' }} />
                      {copy.effectiveHpLabel}
                    </span>
                  </div>

                  <div
                    style={{ position: 'relative' }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      if (rect.width <= 0) return;
                      const vx = ((e.clientX - rect.left) / rect.width) * 920;
                      const NS = historyModel.values.length;
                      if (NS <= 0) return;
                      const sIdx = Math.round(((vx - 58) / Math.max(1, 898 - 58)) * (NS - 1));
                      const boundedIdx = Math.max(0, Math.min(NS - 1, sIdx));
                      setHistHoverSeason(historyModel.values[boundedIdx]?.season ?? null);
                    }}
                    onPointerMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      if (rect.width <= 0) return;
                      const vx = ((e.clientX - rect.left) / rect.width) * 920;
                      const NS = historyModel.values.length;
                      if (NS <= 0) return;
                      const sIdx = Math.round(((vx - 58) / Math.max(1, 898 - 58)) * (NS - 1));
                      const boundedIdx = Math.max(0, Math.min(NS - 1, sIdx));
                      setHistHoverSeason(historyModel.values[boundedIdx]?.season ?? null);
                    }}
                    onMouseLeave={() => setHistHoverSeason(null)}
                    onPointerLeave={() => setHistHoverSeason(null)}
                  >
                    <svg
                      ref={historySvgRef}
                      viewBox={`0 ${-OOW_TITLE_BAND} 920 ${300 + OOW_TITLE_BAND}`}
                      style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
                      role="img"
                      aria-label={translateUiText("OoW Floor History Chart", activeLocale)}
                    >
                      <rect
                        x="0"
                        y={-OOW_TITLE_BAND}
                        width="920"
                        height={300 + OOW_TITLE_BAND}
                        rx="8"
                        fill={chartTheme === 'light' ? '#ffffff' : '#0f0b15'}
                      />
                      <text
                        x="460"
                        y={-OOW_TITLE_BAND / 2 + 5}
                        textAnchor="middle"
                        fontFamily={CHART_FONT_FAMILY}
                        fontSize="14"
                        fontWeight={CHART_TITLE_FONT_WEIGHT}
                        fill={chartTheme === 'light' ? '#1f2937' : '#f4f0f6'}
                      >
                        {copy.historyChartTitle}
                      </text>

                      {/* Logarithmic Y Ticks & Grid */}
                      {[
                        { val: '1000G', y: 62 },
                        { val: '100G', y: 101 },
                        { val: '10G', y: 140 },
                        { val: '1G', y: 180 },
                        { val: '0.1G', y: 219 },
                        { val: '0.01G', y: 258 },
                      ].map((tick) => (
                        <g key={tick.y}>
                          <line
                            x1="58"
                            y1={tick.y}
                            x2="898"
                            y2={tick.y}
                            stroke={chartTheme === 'light' ? '#e8e5eb' : 'rgba(255,255,255,.06)'}
                            strokeWidth="1"
                          />
                          <text
                            x="52"
                            y={tick.y + 3.5}
                            fill={chartTheme === 'light' ? '#665e6d' : '#6b6480'}
                            fontSize="10"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="end"
                          >
                            {tick.val}
                          </text>
                        </g>
                      ))}

                      {/* Area under EHP line */}
                      {historyModel.ehpArea && (
                        <path
                          d={historyModel.ehpArea}
                          fill="#c79dff"
                          opacity={0.13}
                        />
                      )}
                      <path d={historyModel.ehpPath} fill="none" stroke="#c79dff" strokeWidth="2.4" strokeLinejoin="round" />
                      <path d={historyModel.rawPath} fill="none" stroke="#f5d97a" strokeWidth="2.4" strokeLinejoin="round" />

                      {/* Hover Guide Line */}
                      {histHoverSeason != null && (() => {
                        const sIdx = historyModel.values.findIndex((v) => v.season === histHoverSeason);
                        const pt = historyModel.raw[sIdx];
                        if (!pt) return null;
                        return (
                          <line
                            x1={pt.x}
                            y1="14"
                            x2={pt.x}
                            y2="258"
                            stroke="rgba(245,217,122,.5)"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                        );
                      })()}

                      {/* Dots */}
                      {historyModel.ehp.map((point, index) => (
                        <circle key={`ehp-d-${index}`} cx={point.x} cy={point.y} r={index === historyModel.ehp.length - 1 ? 4.2 : 2.6} fill="#c79dff" />
                      ))}
                      {historyModel.raw.map((point, index) => (
                        <circle key={`raw-d-${index}`} cx={point.x} cy={point.y} r={index === historyModel.raw.length - 1 ? 4.2 : 2.6} fill="#f5d97a" />
                      ))}

                      {/* Value labels with alternating offset */}
                      {historyModel.ehp.map((point, index) => {
                        const show = historyModel.ehp.length <= 16 || index % 2 === 0 || index === historyModel.ehp.length - 1;
                        if (!show) return null;
                        return (
                          <text
                            key={`ehp-t-${index}`}
                            x={point.x}
                            y={Math.max(14, point.y - (index % 2 ? 18 : 9))}
                            fill="#c79dff"
                            fontSize="9"
                            fontWeight="700"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="middle"
                            style={{
                              paintOrder: 'stroke fill',
                              stroke: chartTheme === 'light' ? '#ffffff' : '#0f0b15',
                              strokeWidth: 3,
                              strokeLinejoin: 'round',
                              pointerEvents: 'none',
                            }}
                          >
                            {formatHpValue(historyModel.values[index].ehp, 'G').value}G
                          </text>
                        );
                      })}
                      {historyModel.raw.map((point, index) => {
                        const show = historyModel.raw.length <= 16 || index % 2 === 1 || index === historyModel.raw.length - 1;
                        if (!show) return null;
                        return (
                          <text
                            key={`raw-t-${index}`}
                            x={point.x}
                            y={Math.min(270, point.y + 16)}
                            fill="#f5d97a"
                            fontSize="9"
                            fontWeight="700"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="middle"
                            style={{
                              paintOrder: 'stroke fill',
                              stroke: chartTheme === 'light' ? '#ffffff' : '#0f0b15',
                              strokeWidth: 3,
                              strokeLinejoin: 'round',
                              pointerEvents: 'none',
                            }}
                          >
                            {formatHpValue(historyModel.values[index].raw, 'G').value}G
                          </text>
                        );
                      })}

                      {/* X-axis Ticks */}
                      {historyModel.xticks.map((tick, index) => (
                        <text
                          key={index}
                          x={tick.x}
                          y="288"
                          fill={chartTheme === 'light' ? '#665e6d' : '#6b6480'}
                          fontSize="10"
                          fontFamily="'JetBrains Mono', monospace"
                          textAnchor="middle"
                        >
                          {tick.label}
                        </text>
                      ))}
                      <rect
                        x="0"
                        y="0"
                        width="920"
                        height="300"
                        fill="transparent"
                        style={{ pointerEvents: 'none' }}
                      />
                      <ChartWatermark x={8} y={295} fontSize={9} fill={chartTheme === 'light' ? '#665e6d' : '#8a8398'} />
                    </svg>

                    {/* Tooltip on Hover matching Legacy */}
                    {histHoverSeason != null && (() => {
                      const sIdx = historyModel.values.findIndex((v) => v.season === histHoverSeason);
                      const val = historyModel.values[sIdx];
                      const pt = historyModel.raw[sIdx];
                      if (!val || !pt) return null;
                      const guideLeftPct = (pt.x / 920) * 100;
                      const guideShift = guideLeftPct > 70 ? '-100%' : (guideLeftPct < 14 ? '0%' : '-50%');
                      const targetSeason = seasons.find((s) => s.season === val.season);
                      const subText = targetSeason?.finalBossName ? `${targetSeason.finalBossName} (F${targetSeason.finalFloor})` : `F${targetSeason?.finalFloor || 28}`;

                      return (
                        <div
                          className={styles.chartGuideTooltip}
                          style={{
                            left: `${guideLeftPct}%`,
                            transform: `translateX(${guideShift})`,
                          }}
                        >
                          <div className={styles.chartGuideTooltipTitle}>{fillText(localeText(currentLocale)('Season {0}', 'Сезон {0}'), [seasonLabel(val.season)])}</div>
                          <div className={styles.chartGuideTooltipSub}>{subText}</div>
                          <div className={styles.chartGuideTooltipRow}>
                            <span className={styles.chartGuideTooltipSeries}>
                              <span className={styles.chartGuideTooltipColor} style={{ background: '#f5d97a' }} />
                              {copy.rawHpLabel}
                            </span>
                            <span className={styles.chartGuideTooltipValue} style={{ color: '#f5d97a' }}>
                              {formatHpValue(val.raw, 'G').value} G
                            </span>
                          </div>
                          <div className={styles.chartGuideTooltipRow}>
                            <span className={styles.chartGuideTooltipSeries}>
                              <span className={styles.chartGuideTooltipColor} style={{ background: '#c79dff' }} />
                              {copy.effectiveHpLabel}
                            </span>
                            <span className={styles.chartGuideTooltipValue} style={{ color: '#c79dff' }}>
                              {formatHpValue(val.ehp, 'G').value} G
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Subchart: Season-over-season HP Growth */}
                <div
                  className={styles.chartCard}
                  data-chart-card="jump"
                  data-theme={chartTheme}
                  title={promotedSub === 'jump' ? copy.dblClickRestore : copy.dblClickEnlarge}
                  onDoubleClick={(event) => {
                    if ((event.target as HTMLElement).closest('button, a, input, select')) return;
                    setPromotedSub(promotedSub === 'jump' ? null : 'jump');
                  }}
                  style={{
                    gridColumn: promotedSub === 'jump' ? '1 / -1' : '2',
                    gridRow: promotedSub === 'jump' ? '1' : '2',
                    padding: '16px 20px',
                  }}
                >
                  <div className={styles.chartHeader}>
                    <div className={styles.chartHeaderContent}>
                      <h3 className={styles.chartTitle}>
                        {jumpChartTitle}
                      </h3>
                      <p className={styles.chartSubtitle}>
                        {jumpMode === 'season' ? copy.jumpSubSeason : copy.jumpSubFloor}
                      </p>
                    </div>

                    <div className={styles.chartActions}>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                        onClick={() => {
                          if (jumpSvgRef.current) {
                            downloadSvgAsPng(jumpSvgRef.current, `oow-${mode}-${jumpMode}-growth.png`);
                          }
                        }}
                      >
                        PNG
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => {
                          const floorsOnChart = Array.from(new Set(jumpModel.flatMap((series) => series.points.map((point) => point.floor)))).sort((a, b) => a - b);
                          const csvRows = [
                            ['Floor', ...jumpModel.map((series) => `${seasonLabel(series.season)} (%)`)],
                            ...floorsOnChart.map((floor) => [
                              `F${floor}`,
                              ...jumpModel.map((series) => {
                                const point = series.points.find((item) => item.floor === floor);
                                return point ? `${point.growth.toFixed(2)}%` : '';
                              }),
                            ]),
                          ];
                          downloadCsv(csvRows, `oow-${mode}-${jumpMode}-growth.csv`);
                        }}
                      >
                        CSV
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => setPromotedSub(promotedSub === 'jump' ? null : 'jump')}
                        title={promotedSub === 'jump' ? copy.moveDown : copy.moveToTop}
                        aria-label={promotedSub === 'jump' ? copy.moveDown : copy.moveToTop}
                      >
                        {promotedSub === 'jump' ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 5v14M19 12l-7 7-7-7"/>
                            </svg>
                            <span>{copy.moveDown}</span>
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 19V5M5 12l7-7 7 7"/>
                            </svg>
                            <span>{copy.moveToTop}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Mode Toggle Bar for Season <-> Floor */}
                  <div className={styles.subchartToggleBar}>
                    <div className={styles.subchartToggleGroup}>
                      <button
                        type="button"
                        className={`${styles.subchartToggleBtn} ${jumpMode === 'season' ? styles.subchartToggleBtnActiveSeason : ''}`}
                        onClick={() => setJumpMode('season')}
                      >
                        {copy.jumpSeasonButton}
                      </button>
                      <button
                        type="button"
                        className={`${styles.subchartToggleBtn} ${jumpMode === 'floor' ? styles.subchartToggleBtnActiveFloor : ''}`}
                        onClick={() => setJumpMode('floor')}
                      >
                        {copy.jumpFloorButton}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{ position: 'relative' }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      if (rect.width <= 0) return;
                      const vx = ((e.clientX - rect.left) / rect.width) * 920;
                      const floor = Math.round(chartModel.minFloor + ((vx - 56) / Math.max(1, 900 - 56)) * (chartModel.maxFloor - chartModel.minFloor));
                      setJumpHoverFloor(Math.max(chartModel.minFloor, Math.min(chartModel.maxFloor, floor)));
                    }}
                    onPointerMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      if (rect.width <= 0) return;
                      const vx = ((e.clientX - rect.left) / rect.width) * 920;
                      const floor = Math.round(chartModel.minFloor + ((vx - 56) / Math.max(1, 900 - 56)) * (chartModel.maxFloor - chartModel.minFloor));
                      setJumpHoverFloor(Math.max(chartModel.minFloor, Math.min(chartModel.maxFloor, floor)));
                    }}
                    onMouseLeave={() => setJumpHoverFloor(null)}
                    onPointerLeave={() => setJumpHoverFloor(null)}
                  >
                    <svg
                      ref={jumpSvgRef}
                      viewBox={`0 ${-OOW_TITLE_BAND} 920 ${300 + OOW_TITLE_BAND}`}
                      style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
                      role="img"
                      aria-label={translateUiText("OoW HP growth chart", activeLocale)}
                    >
                      <rect
                        x="0"
                        y={-OOW_TITLE_BAND}
                        width="920"
                        height={300 + OOW_TITLE_BAND}
                        rx="8"
                        fill={chartTheme === 'light' ? '#ffffff' : '#0f0b15'}
                      />
                      <text
                        x="460"
                        y={-OOW_TITLE_BAND / 2 + 5}
                        textAnchor="middle"
                        fontFamily={CHART_FONT_FAMILY}
                        fontSize="14"
                        fontWeight={CHART_TITLE_FONT_WEIGHT}
                        fill={chartTheme === 'light' ? '#1f2937' : '#f4f0f6'}
                      >
                        {jumpChartTitle}
                      </text>

                      {/* Y-axis Ticks and Horizontal Lines */}
                      {[
                        { label: '+300%', y: 30 },
                        { label: '+200%', y: 70 },
                        { label: '+100%', y: 110 },
                        { label: '0%', y: 150 },
                        { label: '-50%', y: 190 },
                      ].map((tick) => (
                        <g key={tick.y}>
                          <line
                            x1="56"
                            y1={tick.y}
                            x2="900"
                            y2={tick.y}
                            stroke={tick.y === 150 ? (chartTheme === 'light' ? '#b8b1bf' : 'rgba(255,255,255,.24)') : (chartTheme === 'light' ? '#e8e5eb' : 'rgba(255,255,255,.06)')}
                            strokeWidth="1"
                            strokeDasharray={tick.y === 150 ? '4 4' : undefined}
                          />
                          <text
                            x="50"
                            y={tick.y + 3.5}
                            fill={chartTheme === 'light' ? '#665e6d' : '#6b6480'}
                            fontSize="10"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="end"
                          >
                            {tick.label}
                          </text>
                        </g>
                      ))}

                      {/* X-axis Ticks */}
                      {chartModel.xticks.map((tick, idx) => (
                        <text
                          key={idx}
                          x={tick.x}
                          y="288"
                          fill={chartTheme === 'light' ? '#665e6d' : '#6b6480'}
                          fontSize="10"
                          fontFamily="'JetBrains Mono', monospace"
                          textAnchor="middle"
                        >
                          {tick.label}
                        </text>
                      ))}

                      {/* Hover Guide Line */}
                      {jumpHoverFloor != null && (() => {
                        const gx = 56 + (chartModel.maxFloor === chartModel.minFloor ? 0 : ((jumpHoverFloor - chartModel.minFloor) / (chartModel.maxFloor - chartModel.minFloor)) * (900 - 56));
                        return (
                          <line
                            x1={gx}
                            y1="14"
                            x2={gx}
                            y2="258"
                            stroke="rgba(245,217,122,.5)"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                        );
                      })()}

                      {jumpModel.map((series) => {
                        const maxGrowth = Math.max(...jumpModel.flatMap((item) => item.points.map((point) => Math.abs(point.growth))), 1);
                        const plotted = series.points.map((point) => ({ ...point, y: 150 - (point.growth / maxGrowth) * 120 }));
                        const points = plotted.map((point) => `${point.x},${point.y}`).join(' ');
                        return (
                          <g key={series.season}>
                            <polyline points={points} fill="none" stroke={series.color} strokeWidth="2.2" strokeLinejoin="round" />
                            {plotted.map((point, index) => (
                              <circle key={index} cx={point.x} cy={point.y} r="2.4" fill={series.color} />
                            ))}
                            {plotted.map((point, index) => {
                              const show = plotted.length <= 14 || index % 2 === 0 || index === plotted.length - 1;
                              if (!show) return null;
                              return (
                                <text
                                  key={`jlbl-${index}`}
                                  x={point.x}
                                  y={Math.max(14, point.y - 10)}
                                  fill={series.color}
                                  fontSize="9"
                                  fontWeight="700"
                                  fontFamily="'JetBrains Mono', monospace"
                                  textAnchor="middle"
                                  style={{
                                    paintOrder: 'stroke fill',
                                    stroke: chartTheme === 'light' ? '#ffffff' : '#0f0b15',
                                    strokeWidth: 3,
                                    strokeLinejoin: 'round',
                                    pointerEvents: 'none',
                                  }}
                                >
                                  {point.growth > 0 ? '+' : ''}{Math.round(point.growth)}%
                                </text>
                              );
                            })}
                          </g>
                        );
                      })}
                      {/* Hover Guide Line */}
                      {jumpHoverFloor != null && (() => {
                        const gx = 56 + (chartModel.maxFloor === chartModel.minFloor ? 0 : ((jumpHoverFloor - chartModel.minFloor) / (chartModel.maxFloor - chartModel.minFloor)) * (900 - 56));
                        return (
                          <line
                            x1={gx}
                            y1="14"
                            x2={gx}
                            y2="274"
                            stroke="rgba(245,217,122,.55)"
                            strokeWidth="1.2"
                            strokeDasharray="4 4"
                          />
                        );
                      })()}

                      <rect
                        x="0"
                        y="0"
                        width="920"
                        height="300"
                        fill="transparent"
                        style={{ pointerEvents: 'none' }}
                      />
                      <ChartWatermark x={8} y={295} fontSize={9} fill={chartTheme === 'light' ? '#665e6d' : '#8a8398'} />
                    </svg>

                    {/* Tooltip on Hover matching Legacy */}
                    {jumpHoverFloor != null && (() => {
                      const gx = 56 + (chartModel.maxFloor === chartModel.minFloor ? 0 : ((jumpHoverFloor - chartModel.minFloor) / (chartModel.maxFloor - chartModel.minFloor)) * (900 - 56));
                      const guideLeftPct = (gx / 920) * 100;
                      const guideShift = guideLeftPct > 70 ? '-100%' : (guideLeftPct < 14 ? '0%' : '-50%');

                      return (
                        <div
                          className={styles.chartGuideTooltip}
                          style={{
                            left: `${guideLeftPct}%`,
                            transform: `translateX(${guideShift})`,
                          }}
                        >
                          <div className={styles.chartGuideTooltipTitle}>{(isRu ? 'Этаж F' : translateUiText('Floor F', currentLocale)) + jumpHoverFloor}</div>
                          {jumpModel.map((series) => {
                            const pt = series.points.find((p) => p.floor === jumpHoverFloor);
                            if (!pt) return null;
                            const isPos = pt.growth >= 0;
                            return (
                              <div key={series.season} className={styles.chartGuideTooltipRow}>
                                <span className={styles.chartGuideTooltipSeries}>
                                  <span className={styles.chartGuideTooltipColor} style={{ background: series.color }} />
                                  {seasonLabel(series.season)}
                                </span>
                                <span
                                  className={styles.chartGuideTooltipValue}
                                  style={{ color: isPos ? '#4fe3c1' : '#ff9bb2' }}
                                >
                                  {isPos ? '+' : ''}{Math.round(pt.growth)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                </div>
              </div>
            )}

            {/* ================= TAB 3: DIFFICULTY DECAY ================= */}
            {tab === 'difficulty' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className={styles.difficultyPageHeader}>
                  <h2>{copy.seasonWord} {displaySeasonNumber(seasonNum)} · {formatLegacyDate(currentSeason?.startDate)} ~ {formatLegacyDate(currentSeason?.endDate)} · {copy.difficultyTabLabel}</h2>
                </div>

                <div className={styles.difficultyToolbar}>
                  <div className={styles.difficultyFilterGroup} role="group" aria-label={copy.floorRangeLabel}>
                    {[
                      ['all', copy.allFloorsLabel],
                      ['ramp', isRu ? `Разгон ${rampLabel}` : `Ramp ${rampLabel}`],
                      ['boss', isRu ? `Испытание ${challengeLabel}` : `Challenge ${challengeLabel}`],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`${styles.diffFilterButton} ${diffFilter === value ? styles.diffFilterButtonActive : ''}`}
                        onClick={() => setDiffFilter(value as OowFilter)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={finalFloor}
                    value={diffFloorSearch ?? ''}
                    placeholder={copy.goToFloorPlaceholder}
                    aria-label={copy.goToFloorPlaceholder}
                    className={styles.diffFloorInput}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setDiffFloorSearch(Number.isFinite(value) && value > 0 ? Math.min(finalFloor, value) : null);
                    }}
                  />
                </div>

                {/* Step Progression */}
                <section className={styles.chartCard} aria-label={copy.diffFloorTitle}>
                  <h2 style={{ font: '600 17px/1.2 var(--font-sans)', color: '#e9e3f2', margin: '0 0 4px' }}>
                    F{diffFloorSearch || finalFloor} · {copy.diffFloorTitle}
                  </h2>
                  <p style={{ font: '500 12px/1.5 var(--font-sans)', color: '#8a8398', margin: '0 0 16px' }}>
                    {copy.difficultyDescription}
                  </p>

                  <div className={styles.diffStepGrid}>
                    {difficultySteps.map((step, sIdx) => (
                      <div key={sIdx} className={styles.diffStepCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ font: '700 12px/1 var(--font-sans)', color: '#cbc2de' }}>
                            {step.day}
                          </span>
                          <span
                            style={{
                              font: '700 12px/1 var(--font-sans)',
                              color: '#f5d97a',
                              background: 'rgba(245,217,122,.12)',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {step.dur}
                          </span>
                        </div>
                        <div className={styles.diffStepPct} style={{ color: step.col }}>
                          {step.pct}
                        </div>
                        <div className={styles.diffStepBar}>
                          <div className={styles.diffStepBarFill} style={{ width: `${step.barW}%`, background: step.barCol }} />
                        </div>
                        <div className={styles.diffStepDate}>{step.date}</div>
                        {step.live && <div className={styles.diffLiveBadge}>● {copy.liveNowLabel}</div>}
                      </div>
                    ))}
                  </div>
                </section>

                {/* All Floors Difficulty Schedule Table */}
                <section className={styles.tablePanel} aria-label={copy.allFloorsDifficultyTitle}>
                  <div style={{ padding: '16px 20px 12px' }}>
                    <h3 style={{ font: '600 17px/1.2 var(--font-sans)', color: '#f6f1fb', margin: 0 }}>
                      {copy.allFloorsDifficultyTitle}
                    </h3>
                  </div>

                  <div
                    className={styles.difficultyTableHeader}
                    style={{
                      background: 'rgba(255,255,255,.03)',
                      borderTop: '1px solid rgba(255,255,255,.07)',
                      borderBottom: '1px solid rgba(255,255,255,.07)',
                      font: '700 10px/1 var(--font-sans)',
                      letterSpacing: '.04em',
                      textTransform: 'uppercase',
                      color: '#7a7290',
                    }}
                  >
                    <div>{copy.floorLabel}</div>
                    <div>{copy.peakLabel}</div>
                    <div>{copy.peakWindowLabel}</div>
                    <div>{copy.baselineFromLabel}</div>
                    <div>{copy.stepsLabel}</div>
                    <div>{copy.timelineLabel}</div>
                  </div>

                  {filteredDifficultyFloors.map((floor) => (
                    <div
                      key={floor.floor}
                        className={styles.difficultyTableRow}
                      onClick={() => setDiffFloorSearch(floor.floor)}
                      style={{
                        alignItems: 'center',
                        borderBottom: '1px solid rgba(255,255,255,.05)',
                        background: floor.floor === (diffFloorSearch || finalFloor) ? 'rgba(245,217,122,.06)' : 'transparent',
                        padding: 0,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {(() => {
                        const visibleSteps = visibleDifficultyRows.get(floor.floor) || [];
                        const firstStep = visibleSteps[0];
                        return (
                          <>
                      <div>
                        <span className={styles.floorBadge}>F{floor.floor}</span>
                      </div>
                      <div
                        className={styles.difficultyPeakValue}
                        style={{
                          color: (firstStep?.pct ?? Number(floor.difficultySchedule?.initialPct || 100)) >= 1500
                            ? '#d98a99'
                            : (firstStep?.pct ?? Number(floor.difficultySchedule?.initialPct || 100)) >= 600
                              ? '#d0b174'
                              : (firstStep?.pct ?? Number(floor.difficultySchedule?.initialPct || 100)) > 100
                                ? '#cbb98a'
                                : '#8fbdb2',
                        }}
                      >
                        {firstStep?.pct ?? floor.difficultySchedule?.initialPct ?? '—'}%
                      </div>
                      <div className={styles.difficultyPeakWindow}>
                        {firstStep
                          ? <>
                              <strong>{firstStep.startDay === firstStep.endDay ? copy.daySingle + ` ${firstStep.startDay}` : copy.dayPlural + ` ${firstStep.startDay}–${firstStep.endDay}`}</strong>
                              <small style={{ display: 'block', color: '#948aa8', marginTop: 3 }}>{formatSeasonDayRange(currentSeason?.startDate, firstStep.startDay, firstStep.endDay)}</small>
                            </>
                          : '—'}
                      </div>
                      <div className={styles.difficultyBaseline}>
                        {floor.difficultySchedule?.daysToMin
                          ? <><strong>{copy.daySingle} {floor.difficultySchedule.daysToMin}</strong><small style={{ display: 'block', color: '#948aa8', marginTop: 3 }}>{formatSeasonDayRange(currentSeason?.startDate, floor.difficultySchedule.daysToMin, floor.difficultySchedule.daysToMin)}</small></>
                          : '—'}
                      </div>
                      <div className={styles.difficultyStepCount}>{visibleSteps.length || 1}</div>
                      <div className={styles.difficultyTimeline}>
                        {visibleSteps.map((step, pIdx) => (
                          <span
                            key={pIdx}
                            className={styles.difficultyTimelinePill}
                            style={{
                              color: step.pct <= 100 ? '#4fe3c1' : '#cbc2de',
                            }}
                          >
                            D{step.startDay}{step.startDay === step.endDay ? '' : `-${step.endDay}`} · {step.pct}%
                          </span>
                        ))}
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </section>
              </div>
            )}
            <EncounterEffectCatalog effects={initialEffectCatalog?.modes[mode === 'mmo' ? 'mmo' : 'standard'] || []} />
          </div>
        </div>
      </div>

      {/* Deep Intel Boss Modal */}
      {modalEnemy && (
        <div
          className={styles.modalOverlay}
          onClick={closeEnemyModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="oow-boss-dialog-title"
        >
          <div
            className={`${styles.modalCard} ${enemyKindClass(modalEnemy) === 'boss' ? styles.modalCardBoss : enemyKindClass(modalEnemy) === 'elite' ? styles.modalCardElite : styles.modalCardNormal}`}
            onClick={(e) => e.stopPropagation()}
          >
            <EnemyDetailsHeader
              name={isRu ? getEnemyPresentation(modalEnemy, fceIndex).nameRu : getEnemyPresentation(modalEnemy, fceIndex).nameEn}
              titleId="oow-boss-dialog-title" kind={enemyKindClass(modalEnemy)} kindLabel={enemyKindClass(modalEnemy)}
              portrait={<img
                className={styles.modalBossImg}
                src={resolveAsset(getEnemyPresentation(modalEnemy, fceIndex).detailImage || modalEnemy.detailImageFull || modalEnemy.image)}
                alt={isRu ? getEnemyPresentation(modalEnemy, fceIndex).nameRu : getEnemyPresentation(modalEnemy, fceIndex).nameEn}
                role="button"
                tabIndex={0}
                onClick={() => setZoomImg(getEnemyPresentation(modalEnemy, fceIndex).detailImage || modalEnemy.detailImageFull || modalEnemy.image || '')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setZoomImg(getEnemyPresentation(modalEnemy, fceIndex).detailImage || modalEnemy.detailImageFull || modalEnemy.image || '');
                  }
                }}
                title={copy.zoomImageTitle}
              />}
              badges={typeof modalEnemy.level === 'number' && modalEnemy.level > 0 ? <span className={styles.modalLevelTag}>{translateUiText('Lv.', activeLocale)} {modalEnemy.level}</span> : null}
              context={<>{copy.blueprintId} · {modalEnemy.codeName || modalEnemy.key} · {seasonLabel(seasonNum)} / F{modalEnemy.floor || 1}</>}
              stats={[
                {label: 'HP', value: formatHpValue(modalEnemy.hp, 'G').value + 'G', tone: 'hp'},
                {label: copy.effectiveHpLabel, value: formatHpValue(modalEnemy.effectiveHp, 'G').value + 'G', tone: 'effective'},
                {label: 'ATK', value: modalEnemy.atk.toLocaleString()},
                {label: copy.resistsLabel, value: formatResistancePercent(modalEnemy.resistanceInfo?.resistPercent) + '%', tone: 'resistance'},
              ]}
              onClose={closeEnemyModal} closeLabel={copy.closeLabel}
            />

            {/* Modal Body */}
            <div className={styles.modalBody}>
              <EnemyPrimaryStats heading={copy.primaryStatsLabel} stats={modalPrimaryStats} />

              <EnemyElementStats heading={copy.elementalResistancesLabel} context={copy.difficultyContextLabel}
                stats={modalElements.map(element => ({name: element.name, element: element.element, icon: element.icon,
                  value: element.resistance + '%', sub: element.def.toLocaleString(numLocale) + ' DEF'}))} />

              {/* Joined Boss Mechanics (FCE Join) */}
              {(() => {
                const fce = resolveFceBoss(modalEnemy, fceIndex);
                const mechanics = isRu && Array.isArray(fce?.ru_mechanics) && fce.ru_mechanics.length > 0
                  ? fce.ru_mechanics
                  : fce?.mechanics;
                if (!fce || !Array.isArray(mechanics) || mechanics.length === 0) return null;
                return (
                  <div className={styles.modalMechanicsSection}>
                    <div className={styles.modalMechanicsHeader}>
                      <div className={styles.modalMechanicsTitleGroup}>
                        <div className={styles.modalMechanicsTitle}>{copy.mechanicsTitleLabel}</div>
                        <span className={styles.modalMechanicsBadge}>{mechanics.length}</span>
                      </div>
                    </div>

                    <div className={styles.modalMechanicsList}>
                      {mechanics.map((m: any, mIdx: number) => (
                        <div key={mIdx} className={styles.modalMechanicsItem}>
                          <span className={styles.modalMechanicsNum}>{m.index || mIdx + 1}.</span>
                          <span className={styles.modalMechanicsText}>
                            {renderFceMechanicText(m.html || m.text || '')}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className={styles.modalMechanicsFooter}>
                      <a
                        href={`/datamine/fce/?mode=${mode}&boss=${encodeURIComponent(fce.slug)}`}
                        className={styles.modalFceLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {copy.viewFullFceLabel} →
                      </a>
                    </div>
                  </div>
                );
              })()}

              {/* Notable overrides, matching legacy modalStats() rules */}
              {modalOverrides.length > 0 && (
                <div>
                  <div style={{ font: '700 11px/1 var(--font-sans, system-ui)', textTransform: 'uppercase', color: '#ff9bb2', marginBottom: 12 }}>
                    {copy.overridesLabel}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {modalOverrides.map((override) => (
                      <div
                        key={override.key}
                        style={{
                          background: 'rgba(255,107,139,.06)',
                          border: '1px solid rgba(255,107,139,.4)',
                          borderRadius: 10,
                          padding: '10px 14px',
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#ff9bb2', fontSize: 12 }}>
                          {override.key}
                        </div>
                        <div style={{ color: '#cbc2de', fontSize: 11, marginTop: 4 }}>
                          {override.label}
                        </div>
                        <div style={{ color: '#ff6b8b', fontWeight: 800, fontFamily: 'var(--font-sans), system-ui', fontSize: 15 }}>
                          {override.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Lightbox
        isOpen={Boolean(zoomImg)}
        onClose={() => setZoomImg(null)}
        src={zoomImg ? (zoomImagePng ? gameAsset(zoomImagePng, 'png') : resolveAsset(zoomImg)) : ''}
        webpSrc={zoomImg ? resolveAsset(zoomImg) : undefined}
        showPngDownload={Boolean(zoomImagePng)}
        alt={modalEnemy ? (isRu ? getEnemyPresentation(modalEnemy, fceIndex).nameRu : getEnemyPresentation(modalEnemy, fceIndex).nameEn) : ''}
        title={modalEnemy ? (isRu ? getEnemyPresentation(modalEnemy, fceIndex).nameRu : getEnemyPresentation(modalEnemy, fceIndex).nameEn) : ''}
        caption={modalEnemy ? (isRu ? getEnemyPresentation(modalEnemy, fceIndex).nameRu : getEnemyPresentation(modalEnemy, fceIndex).nameEn) : ''}
        downloadName={modalEnemy ? (isRu ? getEnemyPresentation(modalEnemy, fceIndex).nameRu : getEnemyPresentation(modalEnemy, fceIndex).nameEn) : undefined}
        locale={currentLocale}
        closeLabel={copy.closeImageLabel}
      />

      {/* Toast Notification */}
      {toastMessage && <div className={styles.toast}>{toastMessage}</div>}
    </div>
  );
}
