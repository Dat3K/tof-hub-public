'use client';

import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import React, { useState, useMemo, useCallback, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { PULL_DC_COST } from '@tof-hub/game-domain';
import { formatServerDisplay, resolvePlayerServer } from '@tof-hub/contracts';
import { Button, EmptyState, type ProfileAvatarImage } from '@tof-hub/ui';
import { useLocale } from '@/lib/i18n';
import type { PlayerRegion } from '../dev-players-data';
import { readImportedProfileIds } from '../import/imported-profiles';
import { WISH_TRANSLATIONS } from '../wish-i18n';
import { WishHeader } from '../components/wish-header';
import { formatNumber } from '@/lib/i18n/format';

type PullsByTrack = {
  weapon_limited: number;
  matrix_limited: number;
  standard_weapon: number;
  standard_matrix: number;
  black_nucleus: number;
};

/** One row of `GET /api/v1/wish/players` (admin key): aggregates only, no pull records. */
interface CommunityPlayerResponse {
  id: string;
  uid: string;
  name: string;
  region: string;
  server: string;
  updated_at: string;
  avatar_cosmetic?: ProfileAvatarImage;
  total_pulls: number;
  pulls_by_track: PullsByTrack;
  ssr_count: number;
  event_wins: number;
  event_outcomes: number;
  unresolved_pulls: number;
}

interface WishPlayerRow {
  id: string;
  uid: string;
  nickname: string;
  server: string;
  serverRegion: PlayerRegion;
  avatar: string;
  totalPulls: number;
  pullsByTrack: PullsByTrack;
  ssrCount: number;
  /** Event 50/50 win rate in percent; null without a known outcome. */
  winRate5050: number | null;
  unresolvedPulls: number;
  /** This browser holds the profile's access grant, so its history can open. */
  canOpen: boolean;
}

function toPlayerRow(player: CommunityPlayerResponse, accessible: ReadonlySet<string>): WishPlayerRow {
  const { server } = resolvePlayerServer({ uid: player.uid, serverId: player.server });
  return {
    id: player.id, uid: player.uid, nickname: player.name,
    server: server ? formatServerDisplay(server) : player.server,
    serverRegion: server?.region ?? 'Global',
    avatar: player.avatar_cosmetic?.icon ?? '',
    totalPulls: player.total_pulls, pullsByTrack: player.pulls_by_track, ssrCount: player.ssr_count,
    winRate5050: player.event_outcomes ? player.event_wins / player.event_outcomes * 100 : null,
    unresolvedPulls: player.unresolved_pulls,
    canOpen: accessible.has(player.id),
  };
}

type SortColumn =
  | 'nickname'
  | 'server'
  | 'uid'
  | 'weapon_limited'
  | 'matrix_limited'
  | 'standard_weapon'
  | 'standard_matrix'
  | 'black_nucleus'
  | 'winRate5050';

type SortDirection = 'ascending' | 'descending';

type WishUiIconName = 'copy' | 'search' | 'sparkle';

function WishUiIcon({ name, className = 'h-4 w-4' }: { name: WishUiIconName; className?: string }) {
  const paths: Record<WishUiIconName, React.ReactNode> = {
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    sparkle: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></>,
  };

  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

/**
 * Splits string by search needle for safe text highlighting (matches /datamine/items/ buildHighlightedParts)
 */
function buildHighlightedParts(
  text: string,
  query: string
): Array<{ text: string; match: boolean }> {
  if (!query || !text) return [{ text: text || '', match: false }];
  const loweredSource = text.toLocaleLowerCase();
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [{ text, match: false }];

  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = loweredSource.indexOf(needle, cursor);
    if (matchIndex === -1) {
      parts.push({ text: text.slice(cursor), match: false });
      break;
    }

    if (matchIndex > cursor) {
      parts.push({ text: text.slice(cursor, matchIndex), match: false });
    }

    parts.push({ text: text.slice(matchIndex, matchIndex + needle.length), match: true });
    cursor = matchIndex + needle.length;
  }

  return parts;
}

export function WishPlayersView() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;
  const text = useMemo(() => localeText(locale), [locale]);

  // The admin key stays in memory only, like the feedback dev page.
  const credential = useRef('');
  const request = useRef<AbortController | null>(null);
  const [players, setPlayers] = useState<WishPlayerRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => () => { credential.current = ''; request.current?.abort(); }, []);

  const lock = useCallback(() => {
    request.current?.abort(); request.current = null; credential.current = '';
    setPlayers(null); setBusy(false);
  }, []);

  const loadPlayers = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setLoadError(null);
    try {
      const response = await fetch('/api/v1/wish/players', {
        headers: { 'x-admin-key': credential.current }, cache: 'no-store', credentials: 'omit', redirect: 'error',
        referrerPolicy: 'no-referrer', signal: controller.signal,
      });
      if (request.current !== controller) return;
      if (response.status === 401 || response.status === 403) {
        lock(); setLoadError(text('Access denied: check the admin key.', 'Доступ запрещён: проверьте ключ администратора.')); return;
      }
      if (!response.ok) throw new Error('Wish players unavailable');
      const body = await response.json() as { data: CommunityPlayerResponse[] };
      if (request.current !== controller) return;
      const accessible = new Set(readImportedProfileIds());
      setPlayers(body.data.map((player) => toPlayerRow(player, accessible)));
    } catch {
      if (request.current === controller) setLoadError(text('Could not load players.', 'Не удалось загрузить игроков.'));
    } finally {
      if (request.current === controller) setBusy(false);
    }
  }, [lock, text]);

  const unlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    credential.current = String(new FormData(form).get('credential') ?? '');
    form.reset();
    void loadPlayers();
  };

  const allPlayers = useMemo(() => players ?? [], [players]);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<'all' | PlayerRegion>('all');
  const [sortState, setSortState] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: 'weapon_limited',
    direction: 'descending',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Copy UID Handler with toast notification
  const handleCopyUid = useCallback(
    async (e: React.MouseEvent, uid: string) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(uid);
        setToastMessage(`${t.devCopiedUid}: ${uid}`);
        setTimeout(() => setToastMessage(null), 2200);
      } catch {
        setToastMessage(t.devCopyFailed);
        setTimeout(() => setToastMessage(null), 2200);
      }
    },
    [t.devCopiedUid, t.devCopyFailed]
  );

  // Toggle Sorting
  const handleSort = useCallback((column: SortColumn) => {
    setSortState((prev) => {
      if (prev.column === column) {
        return {
          column,
          direction: prev.direction === 'ascending' ? 'descending' : 'ascending',
        };
      }
      return { column, direction: 'descending' };
    });
  }, []);

  // Filter Players
  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allPlayers.filter((player) => {
      if (regionFilter !== 'all' && player.serverRegion !== regionFilter) {
        return false;
      }
      if (q) {
        const matchesNick = player.nickname.toLowerCase().includes(q);
        const matchesServer = player.server.toLowerCase().includes(q);
        const matchesRegion = player.serverRegion.toLowerCase().includes(q);
        const matchesUid = player.uid.includes(q);
        if (!matchesNick && !matchesServer && !matchesRegion && !matchesUid) {
          return false;
        }
      }
      return true;
    });
  }, [allPlayers, search, regionFilter]);

  // Sort Players
  const sortedPlayers = useMemo(() => {
    const { column, direction } = sortState;
    const mult = direction === 'ascending' ? 1 : -1;
    const collator = new Intl.Collator(locale, {
      numeric: true,
      sensitivity: 'base',
    });

    return [...filteredPlayers].sort((a, b) => {
      let cmp = 0;
      switch (column) {
        case 'nickname':
          cmp = collator.compare(a.nickname, b.nickname);
          break;
        case 'server':
          cmp = collator.compare(a.server, b.server);
          break;
        case 'uid':
          cmp = collator.compare(a.uid, b.uid);
          break;
        case 'weapon_limited':
          cmp = a.pullsByTrack.weapon_limited - b.pullsByTrack.weapon_limited;
          break;
        case 'matrix_limited':
          cmp = a.pullsByTrack.matrix_limited - b.pullsByTrack.matrix_limited;
          break;
        case 'standard_weapon':
          cmp = a.pullsByTrack.standard_weapon - b.pullsByTrack.standard_weapon;
          break;
        case 'standard_matrix':
          cmp = a.pullsByTrack.standard_matrix - b.pullsByTrack.standard_matrix;
          break;
        case 'black_nucleus':
          cmp = a.pullsByTrack.black_nucleus - b.pullsByTrack.black_nucleus;
          break;
        case 'winRate5050':
          cmp = (a.winRate5050 ?? -1) - (b.winRate5050 ?? -1);
          break;
      }
      if (cmp === 0) {
        cmp = a.ssrCount - b.ssrCount;
      }
      if (cmp === 0) {
        cmp = a.totalPulls - b.totalPulls;
      }
      return cmp * mult;
    });
  }, [filteredPlayers, sortState, locale]);

  // Overall Statistics across all players
  const stats = useMemo(() => {
    const totalPlayers = allPlayers.length;
    const totalPulls = allPlayers.reduce((acc, p) => acc + p.totalPulls, 0);
    const totalSsr = allPlayers.reduce((acc, p) => acc + p.ssrCount, 0);
    const totalDc = allPlayers.reduce(
      (acc, p) =>
        acc +
        (p.pullsByTrack.weapon_limited +
          p.pullsByTrack.matrix_limited +
          p.pullsByTrack.standard_weapon +
          p.pullsByTrack.standard_matrix) *
          PULL_DC_COST,
      0
    );
    return { totalPlayers, totalPulls, totalSsr, totalDc };
  }, [allPlayers]);

  // The admin key lists players but does not grant history access: only profiles this
  // browser already holds a grant for can open.
  const handleOpenPlayerHistory = (player: WishPlayerRow, track?: string) => {
    if (!player.canOpen) return;
    router.push(`/tools/wish/?profileId=${player.id}&tab=history${track ? `&track=${track}` : ''}`);
  };
  const noAccessLabel = text('History is private: this browser has no access grant', 'История закрыта: у этого браузера нет доступа');

  // Highlight Text Helper
  const Highlighted = ({ text }: { text: string }) => {
    const parts = buildHighlightedParts(text, search);
    return (
      <>
        {parts.map((part, idx) =>
          part.match ? (
            <mark
              key={idx}
              className="bg-amber-400/25 text-amber-200 font-semibold px-0.5 rounded"
            >
              {part.text}
            </mark>
          ) : (
            <React.Fragment key={idx}>{part.text}</React.Fragment>
          )
        )}
      </>
    );
  };

  return (
    <div
      className="info-ui min-h-screen bg-[#0b0d13] text-[#d7d0dd] px-4 py-5 md:px-6 max-w-7xl mx-auto space-y-4"
      suppressHydrationWarning
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1e1927] border border-amber-400/40 text-amber-200 px-3.5 py-2 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <WishUiIcon name="copy" className="h-4 w-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <WishHeader locale={locale} page="players" />

      {players === null ? (
        <form onSubmit={unlock} className="max-w-md mx-auto p-5 rounded-lg bg-[var(--surface-inset)] border border-white/[0.09]">
          <fieldset disabled={busy} className="space-y-3">
            <label htmlFor="wish-players-admin-key" className="block text-xs font-semibold text-white/85">
              {text('Admin key', 'Ключ администратора')}
            </label>
            <input
              id="wish-players-admin-key"
              type="password"
              name="credential"
              autoComplete="off"
              required
              minLength={32}
              maxLength={512}
              spellCheck={false}
              aria-describedby="wish-players-admin-hint"
              className="w-full px-3 py-2 bg-[var(--surface-inset)] text-white border border-white/[0.12] rounded-md text-xs focus:outline-none focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/15"
            />
            <p id="wish-players-admin-hint" className="text-[0.6875rem] text-[#a5a7af]">
              {text('Imported players are listed with the dev admin key. The key is kept in this tab only.', 'Импортированные игроки показываются по ключу администратора. Ключ хранится только в этой вкладке.')}
            </p>
            {loadError && <p role="alert" className="text-[0.6875rem] text-rose-300">{loadError}</p>}
            <Button type="submit">{busy ? text('Loading…', 'Загрузка…') : text('Unlock', 'Открыть')}</Button>
          </fieldset>
        </form>
      ) : players.length === 0 ? (
        <EmptyState
          title={text('No imported players yet', 'Пока нет импортированных игроков')}
          description={text('Players appear here after they upload a wish history.', 'Игроки появятся здесь после загрузки истории круток.')}
        />
      ) : (
      <>
      
      {/* Overview Metric KPI Cards (Compact) */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-[var(--surface-inset)] border border-white/[0.09]">
          <span className="text-[0.625rem] font-semibold text-[#a5a7af] uppercase tracking-[0.08em]">
            {t.devKpiPlayersInDb}
          </span>
          <p className="text-lg sm:text-xl font-bold text-white mt-1 tabular-nums">
            {stats.totalPlayers}
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-[var(--surface-inset)] border border-white/[0.09]">
          <span className="text-[0.625rem] font-semibold text-[#a5a7af] uppercase tracking-[0.08em]">
            {t.devKpiTotalPulls}
          </span>
          <p className="text-lg sm:text-xl font-bold text-white mt-1 tabular-nums">
            {formatNumber(stats.totalPulls, locale)}
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-[var(--surface-inset)] border border-white/[0.09]">
          <span className="text-[0.625rem] font-semibold text-[#a5a7af] uppercase tracking-[0.08em]">
            {t.devKpiTotalSsr}
          </span>
          <p className="text-lg sm:text-xl font-bold text-amber-300 mt-1 tabular-nums inline-flex items-center gap-1.5">
            <WishUiIcon name="sparkle" className="h-4 w-4" /> {stats.totalSsr}
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-[var(--surface-inset)] border border-white/[0.09]">
          <span className="text-[0.625rem] font-semibold text-[#a5a7af] uppercase tracking-[0.08em]">
            {t.devKpiDarkCrystalsTurnover}
          </span>
          <p className="text-lg sm:text-xl font-bold text-cyan-200 mt-1 tabular-nums">
            {formatNumber(stats.totalDc, locale)} DC
          </p>
        </div>
      </section>

      {/* Main Table Panel (Compact Datamine Styling) */}
      <section className="bg-[var(--surface-inset)] border border-white/[0.09] rounded-lg overflow-hidden flex flex-col">
        {/* Sticky Toolbar */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 p-3 sm:px-4 bg-[var(--surface-panel)] border-b border-white/[0.08]">
          {/* Status text */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-mono tabular-nums px-2.5 py-0.5 rounded-md border ${
                filteredPlayers.length > 0
                ? 'bg-white/[0.04] text-[#d4d5db] border-white/[0.08]'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
              }`}
            >
              {formatNumber(filteredPlayers.length, locale)} {t.devStatusMatches} / {formatNumber(allPlayers.length, locale)} {t.devStatusPlayers}
            </span>
            <Button variant="secondary" disabled={busy} onClick={() => void loadPlayers()}>
              {text('Refresh', 'Обновить')}
            </Button>
            <Button variant="ghost" onClick={lock}>
              {text('Lock', 'Закрыть')}
            </Button>
            {loadError && <span role="alert" className="text-[0.6875rem] text-rose-300">{loadError}</span>}
          </div>

          {/* Controls: Region Filter, Tag Filter, Search Input */}
          <div className="flex flex-wrap items-center gap-2.5 ml-auto">
            {/* Region Filter Buttons */}
          <div role="group" aria-label={localeText(locale)('Filter by region', 'Фильтр по региону')} className="inline-flex bg-[var(--surface-inset)] p-0.5 rounded-md border border-white/[0.09] gap-0.5 text-xs">
              <button
                type="button"
                aria-pressed={regionFilter === 'all'}
                className={`px-2.5 py-1.5 rounded transition-colors ${
                  regionFilter === 'all'
                    ? 'bg-[#211a2a] text-amber-300 font-bold shadow-sm'
                    : 'text-[#918899] hover:text-white'
                }`}
                onClick={() => setRegionFilter('all')}
              >
                {t.devFilterAllRegions}
              </button>
              {(['Europe', 'North America', 'Asia-Pacific', 'South America'] as PlayerRegion[]).map((reg) => (
                <button
                  key={reg}
                  type="button"
                  aria-pressed={regionFilter === reg}
                  className={`px-2.5 py-1.5 rounded transition-colors ${
                    regionFilter === reg
                      ? 'bg-[#211a2a] text-amber-300 font-bold shadow-sm'
                      : 'text-[#918899] hover:text-white'
                  }`}
                  onClick={() => setRegionFilter(reg)}
                >
                  {reg === 'Europe' ? 'EU' : reg === 'North America' ? 'NA' : reg === 'Asia-Pacific' ? 'AP' : 'SA'}
                </button>
              ))}
            </div>

            {/* Search Input (Matching /datamine/items/) */}
            <div className="relative flex items-center min-w-[12.5rem] sm:min-w-[15rem]">
              <span className="absolute left-2.5 text-white/45 pointer-events-none">
                <WishUiIcon name="search" className="h-4 w-4" />
              </span>
              <input
                type="search"
                aria-label={t.devSearchPlaceholder}
                className="w-full pl-8 pr-8 py-2 bg-[var(--surface-inset)] text-white border border-white/[0.12] rounded-md text-xs placeholder:text-white/40 focus:outline-none focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/15 transition-colors"
                placeholder={t.devSearchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-2 text-xs text-white/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 rounded"
                  onClick={() => setSearch('')}
                  title={localeText(locale)('Clear search')}
                  aria-label={localeText(locale)('Clear search')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Table View - Compact Spacing */}
        <div className="overflow-x-auto max-h-[min(75vh,46.25rem)] overflow-y-auto">
          {sortedPlayers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-[#918899]">
              <WishUiIcon name="search" className="h-8 w-8 mb-2 text-white/35" />
              <p className="text-sm font-semibold text-white/80">{t.devNoPlayersFound}</p>
              <button
                type="button"
                className="mt-2 text-xs text-amber-400 hover:underline"
                onClick={() => {
                  setSearch('');
                  setRegionFilter('all');
                }}
              >
                {t.devResetFilters}
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-2 bg-[#17121c] border-b border-white/15 text-amber-300/90 uppercase text-[0.625rem] font-bold tracking-wider">
                <tr>
                  {/* # */}
                  <th scope="col" className="px-1.5 py-1.5 w-6 text-center text-[#918899]">
                    #
                  </th>

                  {/* Player / Nickname */}
                  <th scope="col" className="px-1.5 py-1.5 min-w-[8.125rem]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-white transition-colors"
                      onClick={() => handleSort('nickname')}
                    >
                      <span>{t.devColPlayer}</span>
                      <span className="text-[0.5625rem] text-white/40">
                        {sortState.column === 'nickname' ? (sortState.direction === 'ascending' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>

                  {/* Server / Region */}
                  <th scope="col" className="px-1.5 py-1.5 min-w-[6.25rem]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-white transition-colors"
                      onClick={() => handleSort('server')}
                    >
                      <span>{t.devColServer}</span>
                      <span className="text-[0.5625rem] text-white/40">
                        {sortState.column === 'server' ? (sortState.direction === 'ascending' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>

                  {/* UID */}
                  <th scope="col" className="px-1.5 py-1.5 min-w-[5.3125rem]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-white transition-colors"
                      onClick={() => handleSort('uid')}
                    >
                      <span>{t.devColUid}</span>
                      <span className="text-[0.5625rem] text-white/40">
                        {sortState.column === 'uid' ? (sortState.direction === 'ascending' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>

                  {/* Ltd Weapon */}
                  <th scope="col" className="px-1.5 py-1.5 text-right min-w-[4.5rem]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-white transition-colors ml-auto text-amber-300"
                      onClick={() => handleSort('weapon_limited')}
                      title={t.devTooltipLtdWeapon}
                    >
                      <span className="whitespace-nowrap">{t.devColWeaponLtd}</span>
                      <span className="text-[0.5625rem] text-white/40">
                        {sortState.column === 'weapon_limited' ? (sortState.direction === 'ascending' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>

                  {/* Ltd Matrix */}
                  <th scope="col" className="px-1.5 py-1.5 text-right min-w-[4.5rem]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-white transition-colors ml-auto text-cyan-300"
                      onClick={() => handleSort('matrix_limited')}
                      title={t.devTooltipLtdMatrix}
                    >
                      <span className="whitespace-nowrap">{t.devColMatrixLtd}</span>
                      <span className="text-[0.5625rem] text-white/40">
                        {sortState.column === 'matrix_limited' ? (sortState.direction === 'ascending' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>

                  {/* Standard Weapon */}
                  <th scope="col" className="px-1.5 py-1.5 text-right min-w-[4.5rem]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-white transition-colors ml-auto text-yellow-200/80"
                      onClick={() => handleSort('standard_weapon')}
                      title={t.devTooltipStdWeapon}
                    >
                      <span className="whitespace-nowrap">{t.devColStandardWeapon}</span>
                      <span className="text-[0.5625rem] text-white/40">
                        {sortState.column === 'standard_weapon' ? (sortState.direction === 'ascending' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>

                  {/* Standard Matrix */}
                  <th scope="col" className="px-1.5 py-1.5 text-right min-w-[4.5rem]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-white transition-colors ml-auto text-blue-300"
                      onClick={() => handleSort('standard_matrix')}
                      title={t.devTooltipStdMatrix}
                    >
                      <span className="whitespace-nowrap">{t.devColStandardMatrix}</span>
                      <span className="text-[0.5625rem] text-white/40">
                        {sortState.column === 'standard_matrix' ? (sortState.direction === 'ascending' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>

                  {/* Black Nucleus */}
                  <th scope="col" className="px-1.5 py-1.5 text-right min-w-[4.0625rem]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-white transition-colors ml-auto text-purple-300"
                      onClick={() => handleSort('black_nucleus')}
                      title={t.devTooltipBlackNucleus}
                    >
                      <span className="whitespace-nowrap">{t.devColBlackNucleus}</span>
                      <span className="text-[0.5625rem] text-white/40">
                        {sortState.column === 'black_nucleus' ? (sortState.direction === 'ascending' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>

                  {/* SSR / Win Rate */}
                  <th scope="col" className="px-1.5 py-1.5 text-right min-w-[4.5rem]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-white transition-colors ml-auto text-emerald-300"
                      onClick={() => handleSort('winRate5050')}
                      title={t.devTooltipSsrRate}
                    >
                      <span className="whitespace-nowrap">{t.devColSsrRate}</span>
                      <span className="text-[0.5625rem] text-white/40">
                        {sortState.column === 'winRate5050' ? (sortState.direction === 'ascending' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>

                  {/* Action */}
                  <th scope="col" className="px-1.5 py-1.5 text-center min-w-[4.375rem]">
                    {t.devColAction}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {sortedPlayers.map((player, index) => {
                  return (
                    <tr
                      key={player.id}
                      onClick={() => handleOpenPlayerHistory(player)}
                      className={`transition-colors duration-150 hover:bg-white/[0.04] ${player.canOpen ? 'cursor-pointer' : ''}`}
                    >
                      {/* # */}
                      <td className="px-1.5 py-1.5 text-center font-mono text-[0.625rem] text-[#918899]">
                        {index + 1}
                      </td>

                      {/* Player Info (Avatar + Nickname + Compact Tag) */}
                      <td className="px-1.5 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full overflow-hidden border border-white/20 bg-[#15121b] flex-shrink-0 relative">
                            {player.avatar && (
                              <img
                                src={player.avatar}
                                alt={player.nickname}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              className="font-bold text-white text-[0.71875rem] tracking-tight truncate max-w-[6.5625rem]"
                              title={player.nickname}
                            >
                              <Highlighted text={player.nickname} />
                            </span>
                            {player.unresolvedPulls > 0 && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[0.5625rem] font-semibold border whitespace-nowrap shrink-0 text-rose-200 bg-rose-400/[0.07] border-rose-300/20"
                                title={text('Pulls whose order code the banner catalog does not map yet', 'Крутки, код заказа которых ещё не сопоставлен с каталогом баннеров')}
                              >
                                {formatNumber(player.unresolvedPulls, locale)} {text('unresolved', 'не определено')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Server & Region */}
                      <td className="px-1.5 py-1.5">
                        <div className="flex flex-col leading-tight">
                          <span
                            className="text-[#f4f0f6] font-medium text-[0.6875rem] truncate max-w-[5.9375rem]"
                            title={player.server}
                          >
                            <Highlighted text={player.server} />
                          </span>
                          <span className="text-[0.5625rem] text-[#918899]">
                            <Highlighted text={player.serverRegion} />
                          </span>
                        </div>
                      </td>

                      {/* UID with Copy Button */}
                      <td className="px-1.5 py-1.5">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[0.65625rem] text-amber-200/90 font-medium">
                            <Highlighted text={player.uid} />
                          </span>
                          <button
                            type="button"
                            className="p-1 text-white/45 hover:text-amber-200 transition-colors rounded hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                            onClick={(e) => handleCopyUid(e, player.uid)}
                            title={t.devTooltipCopyUid}
                            aria-label={t.devTooltipCopyUid}
                          >
                            <WishUiIcon name="copy" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Limited Weapon Pulls + Total DC Cost */}
                      <td className="px-1.5 py-1.5 text-right font-mono tabular-nums">
                        <div className="flex flex-col items-end leading-tight">
                          <button
                            type="button"
                            className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 hover:bg-amber-500/25 border border-amber-500/20 font-bold transition-all text-[0.6875rem] disabled:cursor-default disabled:hover:bg-transparent"
                            disabled={!player.canOpen}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPlayerHistory(player, 'weapon_limited');
                            }}
                            title={t.devTooltipOpenWeaponLtd}
                          >
                            {formatNumber(player.pullsByTrack.weapon_limited, locale)}
                          </button>
                          <span className="text-[0.5625rem] text-[#8e8596] mt-0.5 font-mono">
                            {formatNumber(player.pullsByTrack.weapon_limited * PULL_DC_COST, locale)} DC
                          </span>
                        </div>
                      </td>

                      {/* Limited Matrix Pulls + Total DC Cost */}
                      <td className="px-1.5 py-1.5 text-right font-mono tabular-nums">
                        <div className="flex flex-col items-end leading-tight">
                          <button
                            type="button"
                            className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/20 font-bold transition-all text-[0.6875rem] disabled:cursor-default disabled:hover:bg-transparent"
                            disabled={!player.canOpen}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPlayerHistory(player, 'matrix_limited');
                            }}
                            title={t.devTooltipOpenMatrixLtd}
                          >
                            {formatNumber(player.pullsByTrack.matrix_limited, locale)}
                          </button>
                          <span className="text-[0.5625rem] text-[#8e8596] mt-0.5 font-mono">
                            {formatNumber(player.pullsByTrack.matrix_limited * PULL_DC_COST, locale)} DC
                          </span>
                        </div>
                      </td>

                      {/* Standard Weapon Pulls + Total DC Cost */}
                      <td className="px-1.5 py-1.5 text-right font-mono tabular-nums">
                        <div className="flex flex-col items-end leading-tight">
                          <button
                            type="button"
                            className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-200/90 hover:bg-yellow-500/25 border border-yellow-500/20 font-bold transition-all text-[0.6875rem] disabled:cursor-default disabled:hover:bg-transparent"
                            disabled={!player.canOpen}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPlayerHistory(player, 'standard_weapon');
                            }}
                            title={t.devTooltipOpenStdWeapon}
                          >
                            {formatNumber(player.pullsByTrack.standard_weapon, locale)}
                          </button>
                          <span className="text-[0.5625rem] text-[#8e8596] mt-0.5 font-mono">
                            {formatNumber(player.pullsByTrack.standard_weapon * PULL_DC_COST, locale)} DC
                          </span>
                        </div>
                      </td>

                      {/* Standard Matrix Pulls + Total DC Cost */}
                      <td className="px-1.5 py-1.5 text-right font-mono tabular-nums">
                        <div className="flex flex-col items-end leading-tight">
                          <button
                            type="button"
                            className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 hover:bg-blue-500/25 border border-blue-500/20 font-bold transition-all text-[0.6875rem] disabled:cursor-default disabled:hover:bg-transparent"
                            disabled={!player.canOpen}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPlayerHistory(player, 'standard_matrix');
                            }}
                            title={t.devTooltipOpenStdMatrix}
                          >
                            {formatNumber(player.pullsByTrack.standard_matrix, locale)}
                          </button>
                          <span className="text-[0.5625rem] text-[#8e8596] mt-0.5 font-mono">
                            {formatNumber(player.pullsByTrack.standard_matrix * PULL_DC_COST, locale)} DC
                          </span>
                        </div>
                      </td>

                      {/* Black Nucleus Pulls + Free Cost */}
                      <td className="px-1.5 py-1.5 text-right font-mono tabular-nums">
                        <div className="flex flex-col items-end leading-tight">
                          <button
                            type="button"
                            className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 hover:bg-purple-500/25 border border-purple-500/20 font-bold transition-all text-[0.6875rem] disabled:cursor-default disabled:hover:bg-transparent"
                            disabled={!player.canOpen}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPlayerHistory(player, 'black_nucleus');
                            }}
                            title={t.devTooltipOpenBlackNucleus}
                          >
                            {formatNumber(player.pullsByTrack.black_nucleus, locale)}
                          </button>
                          <span className="text-[0.5625rem] text-[#8e8596] mt-0.5 font-mono">
                            0 DC
                          </span>
                        </div>
                      </td>

                      {/* SSR Count & 50/50 Win Rate */}
                      <td className="px-1.5 py-1.5 text-right font-mono tabular-nums">
                        <div className="flex flex-col items-end leading-tight">
                          <span className="font-bold text-amber-200 text-[0.6875rem] inline-flex items-center gap-1">
                            <WishUiIcon name="sparkle" className="h-3 w-3" /> {player.ssrCount}
                          </span>
                          <span
                            className={`text-[0.5625rem] font-bold ${
                              player.winRate5050 === null
                                ? 'text-[#918899]'
                                : player.winRate5050 >= 60
                                ? 'text-emerald-400'
                                : player.winRate5050 <= 40
                                ? 'text-rose-400'
                                : 'text-[#918899]'
                            }`}
                          >
                            {player.winRate5050 === null ? '—' : `${player.winRate5050.toFixed(0)}%`} 50/50
                          </span>
                        </div>
                      </td>

                      {/* Action Button: Open History */}
                      <td className="px-1.5 py-1.5 text-center">
                        <button
                          type="button"
                          className="inline-flex items-center px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-black font-bold text-[0.65625rem] border border-amber-500/30 transition-all duration-150 shadow-sm whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-amber-500/15 disabled:hover:text-amber-300"
                          disabled={!player.canOpen}
                          title={player.canOpen ? undefined : noAccessLabel}
                          aria-label={player.canOpen ? undefined : `${t.devHistoryBtn} ${noAccessLabel}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPlayerHistory(player);
                          }}
                        >
                          <span>{t.devHistoryBtn}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
      </>
      )}
    </div>
  );
}
