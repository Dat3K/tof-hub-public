'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Button, CatalogControls, CatalogSearch, CatalogSort, EmptyState, FilterChip, FilterGroup, ModeSwitcher, Spinner, useBatchedList } from '@tof-hub/ui';
import { compareRaidDurations, displayRaidDuration, firstRaidResult, globalRaidPlaces, latestRaidBoards, preciseRaidDuration, projectRaidRanking, type RaidRankingBoard, type RaidRankingDataset, type RaidRankingEntry, type RaidRankingMember } from '@tof-hub/game-domain';
import { isBlankText, RaidCurrentNamesRequestSchema } from '@tof-hub/contracts';
import { Hint, NicknameLabel, RegionCode, RegionFilters } from '@/features/players/player-identity';
import { rankingRegions } from '@/features/players/regions';
import { gameAsset } from '@tof-hub/game-assets';
import { useEncounterSelection } from '../components/encounter-ui';
import { HandbookTable, useHandbookText } from '../handbook/sections/handbook-ui';
import type { HandbookTeamRaidData } from '../contracts/handbook';
import { withoutRaidDifficulty } from './raid-title';
import { latestRaidSeason, normalizeRaidSelection } from './raid-selection';
import {backToRaidRanking, openRaidPlayer, useRaidRankingReturn} from './raid-ranking-navigation';
import {raidPlayerKey as playerKey} from './raid-player-identity';
import {RaidPlayerShowcase, raidRoleLabels} from './raid-player-showcase';
import {useKnownRaidPlayer} from './use-known-raid-player';
import {loadRaidPlayers} from './raid-player-cache';
import {useRaidRankingData} from './use-raid-ranking-data';
import {LoadingState} from '@tof-hub/ui';
import css from './raid-rankings.module.css';

export interface RaidRankingSelection {
  tab?: string; season?: string; region?: string; subregion?: string;
  layout?: string; unique?: string; q?: string; player?: string; names?: string; sort?: string; places?: string;
}
type Text = ReturnType<typeof useHandbookText>;
type RaidCatalog = HandbookTeamRaidData['raids'];
const EMPTY_RAIDS: RaidCatalog = [];
const EMPTY_NAMES: Record<string, string> = {};
const EMPTY_IDENTIFIERS: string[] = [];
const ROLE_LIST_ORDER: Record<string, number> = {dps: 0, tank: 1, healer: 2};
const CurrentNames = createContext<Record<string, string>>({});
const Resonances = createContext<NonNullable<RaidRankingDataset['resonances']>>([]);
const nicknameLabel = (nickname: string, member: RaidRankingMember, text: Text) => {
  if (member.nicknameStatus === 'unreadable') return text.t('Unreadable nickname', 'Ник неразборчив');
  const verified = member.identifierEvidence === 'packet' || member.identifier && ['exact-name-once', 'normalized-name-once', 'owner-confirmed'].includes(member.identifierEvidence ?? '');
  return verified ? <NicknameLabel nickname={nickname}/> : isBlankText(nickname) ? text.t('Unresolved nickname', 'Ник не определён') : nickname;
};

function useCurrentNames(data: RaidRankingDataset | null, enabled: boolean) {
  const [result, setResult] = useState({available: true, names: {} as Record<string, string>, data: null as RaidRankingDataset | null});
  useEffect(() => {
    if (!enabled || !data) return;
    let active = true;
    const identifiers = [...new Set(data.boards.flatMap(board => board.entries.flatMap(entry => entry.members?.flatMap(member => member.identifier ? [member.identifier] : []) ?? [])))];
    const requests = Array.from({length: Math.ceil(identifiers.length / 500)}, (_, index) => identifiers.slice(index * 500, index * 500 + 500));
    void Promise.allSettled(requests.map(ids => loadRaidPlayers(ids))).then(results => {
      if (!active) return;
      setResult(previous => {
        const names = {...previous.names};
        results.forEach((result, index) => {
          if (result.status !== 'fulfilled') return;
          // Only an authoritative response can replace a batch. Failed batches keep their last known names.
          if (result.value.available) for (const identifier of requests[index]) delete names[identifier];
          for (const entry of result.value.entries) names[entry.identifier] = entry.nickname;
        });
        return {available: results.every(result => result.status === 'fulfilled' && result.value.available), names, data};
      });
    });
    return () => {active = false;};
  }, [data, enabled]);
  // Loading lasts until this dataset's lookup settles; re-enabling keeps the last names while the cache refreshes.
  return enabled && data ? {available: result.available, names: result.names, loading: result.data !== data} : {available: true, names: EMPTY_NAMES, loading: false};
}

function useUidMatches(query: string) {
  const candidate = query.trim();
  const uid = RaidCurrentNamesRequestSchema.safeParse({identifiers: [], uids: [candidate]}).success ? candidate : '';
  const [result, setResult] = useState({uid: '', identifiers: EMPTY_IDENTIFIERS});
  useEffect(() => {
    if (!uid) return;
    let active = true;
    const timer = setTimeout(() => void loadRaidPlayers([], [uid])
      .then(data => {if (active) setResult({uid, identifiers: data.entries.map(entry => entry.identifier)});})
      .catch(() => {if (active) setResult({uid, identifiers: EMPTY_IDENTIFIERS});}), 200);
    return () => {active = false; clearTimeout(timer);};
  }, [uid]);
  return {identifiers: result.uid === uid ? result.identifiers : EMPTY_IDENTIFIERS, loading: !!uid && result.uid !== uid};
}

function usePresentation(initial: RaidRankingSelection) {
  const read = (params: URLSearchParams) => ({layout: params.get('layout') === 'list' ? 'list' : 'teams', unique: params.get('unique') === '1', current: params.get('names') === 'current'});
  const [value, setValue] = useState(() => typeof window === 'undefined'
    ? {layout: initial.layout === 'list' ? 'list' : 'teams', unique: initial.unique === '1', current: initial.names === 'current'}
    : read(new URL(window.location.href).searchParams));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => {
      const params = new URL(window.location.href).searchParams;
      setValue({layout: params.get('layout') === 'list' ? 'list' : 'teams', unique: params.get('unique') === '1', current: params.get('names') === 'current'});
      setReady(true);
    };
    sync(); window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const update = (next: typeof value) => {
    setValue(next);
    const url = new URL(window.location.href);
    for (const [key, selected] of Object.entries({layout: next.layout === 'list' ? 'list' : '', unique: next.unique ? '1' : '', names: next.current ? 'current' : ''})) {
      if (selected) url.searchParams.set(key, selected); else url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, '', url);
  };
  return {value, update, ready};
}

function Member({member, entryId, text, onInspect}: {member: RaidRankingMember; entryId: string; text: Text; onInspect?: (player: string, trigger: HTMLButtonElement) => void}) {
  const [inspectUid, setInspectUid] = useState(0);
  const {player: known, status} = useKnownRaidPlayer(member.identifier, inspectUid > 0, inspectUid);
  // UID is resolved from the member's role ID; only a settled lookup may claim it is unknown.
  const uidTitle = `UID: ${known?.uid || (member.identifier && status === 'idle' || status === 'loading' ? '…' : status === 'error' ? text.t('Unavailable', 'Недоступен') : text.t('Unknown', 'Неизвестно'))}`;
  const names = useContext(CurrentNames);
  const resonances = useContext(Resonances);
  const resonance = resonances.find(item => item.value === member.resonance?.label) ?? resonances.find(item => item.roleId === 'balance');
  const resonanceLabel = resonance ? raidRoleLabels(text.t)[resonance.roleId] ?? text.name(resonance.name) : text.t('Unknown resonance', 'Неизвестный резонанс');
  const nickname = member.identifier && names[member.identifier] || member.nickname;
  return <span className={css.member}>
    <span className={css.resonance} role="img" aria-label={resonanceLabel} title={resonanceLabel}>
      {resonance?.icon || member.resonance?.icon ? <img src={gameAsset(resonance?.icon ?? member.resonance!.icon!)} alt="" /> : <span aria-hidden="true">?</span>}
    </span><Hint title={uidTitle}>{onInspect
      ? <button className={css.nickname} type="button" data-raid-player={playerKey(member)} data-raid-entry={entryId} onPointerEnter={() => setInspectUid(value => value + 1)} onFocus={() => setInspectUid(value => value + 1)} onClick={event => onInspect(playerKey(member), event.currentTarget)}>{nicknameLabel(nickname, member, text)}</button>
      : <span className={css.nickname} tabIndex={0} onPointerEnter={() => setInspectUid(value => value + 1)} onFocus={() => setInspectUid(value => value + 1)}>{nicknameLabel(nickname, member, text)}</span>}</Hint>
  </span>;
}

function scopeLabel(board: Pick<RaidRankingBoard, 'scope'>) {
  return board.scope.kind === 'server' ? board.scope.serverName ?? board.scope.serverId ?? board.scope.region : [board.scope.region, board.scope.subregion].filter(Boolean).join(' · ');
}

function listMembers(entry: RaidRankingEntry, roleOrder: ReadonlyMap<string, number>): (RaidRankingMember | null)[] {
  const order = (member: RaidRankingMember) => roleOrder.get(member.resonance?.label ?? '') ?? 3;
  return entry.members?.length ? [...entry.members].sort((a, b) => order(a) - order(b)) : [null];
}

function RepeatedRoster({text}: {text: Text}) {
  const label = text.t('No new participants', 'Нет новых участников');
  return <span className="sr-only">{label}</span>;
}

function EntryCard({entry, board, place, overall, text, onInspect}: {entry: RaidRankingEntry; board: RaidRankingBoard; place: number; overall: boolean; text: Text; onInspect: (player: string, trigger: HTMLButtonElement) => void}) {
  const empty = entry.members?.length === 0;
  return <article className={css.team} data-empty={empty || undefined} data-region={board.scope.region} data-place={place} data-source-rank={entry.rank} aria-label={`${overall ? `${text.t('Overall', 'Общий топ')} · ` : ''}${scopeLabel(board)} · #${place}`}>
    <div className={css.place} data-podium={place <= 3 ? place : undefined} title={overall ? text.t('Overall place', 'Место в общем топе') : text.t('Regional place', 'Место в регионе')}>#{place}</div>
    <div className={css.teamBody}>
      <header className={css.teamHeader}><span className={css.scope}><RegionCode region={board.scope.region}/>{board.scope.subregion && <small>{board.scope.subregion}</small>}</span>
        <span>{text.t('Time', 'Время')}: <b className={css.timer} title={preciseRaidDuration(entry.duration)}>{displayRaidDuration(entry.duration)}</b></span>
        {empty && <RepeatedRoster text={text}/>}
        <span className={css.logDate}>{text.t('Log date', 'Дата результата')}: <b>{entry.recordedAt?.replace('T', ' ') ?? '—'}</b></span>
      </header>
      {entry.members?.length ? <ul className={css.members}>{entry.members.map((member, index) => <li key={index}><Member member={member} entryId={entry.id} text={text} onInspect={onInspect} /></li>)}</ul>
        : !empty && <p className={css.rosterUnknown}>{text.t('Roster unavailable', 'Состав неизвестен')}</p>}
    </div>
  </article>;
}

function Unavailable({text, error, filtered = false}: {text: Text; error?: boolean; filtered?: boolean}) {
  return <EmptyState title={error ? text.t('Could not load rankings', 'Не удалось загрузить рейтинг') : filtered ? text.t('No results', 'Нет результатов') : text.t('No ranking data', 'Нет данных рейтинга')}
    description={error ? text.t('Try again', 'Попробуйте ещё раз') : filtered ? text.t('Try adjusting your search query or active filter selections.', 'Измените поисковый запрос или фильтры.') : text.t('Results will appear after a game capture is imported.', 'Результаты появятся после импорта игрового захвата.')}
    action={error ? <button type="button" onClick={() => window.location.reload()}>{text.t('Retry', 'Повторить')}</button> : undefined} />;
}

export function RaidRankingPanel({data, error, raidId, initial = {}}: {data: RaidRankingDataset | null; error?: boolean; raidId: string; title: string; initial?: RaidRankingSelection}) {
  const text = useHandbookText(), {t} = text;
  const fallback = data?.seasons.find(season => season.raidId === raidId)?.id ?? '';
  const [seasonId, setSeason, seasonReady] = useEncounterSelection('season', fallback || latestRaidSeason(data?.seasons ?? [])?.id || '', initial.season);
  const [region, setRegion, regionReady] = useEncounterSelection('region', 'all', initial.region, 'all');
  const [subregion, setSubregion, subregionReady] = useEncounterSelection('subregion', '', initial.subregion, '');
  const [query, setQuery] = useEncounterSelection('q', '', initial.q, '');
  const {identifiers: uidMatches, loading: uidLoading} = useUidMatches(query);
  const [sort, setSort] = useEncounterSelection('sort', 'time', initial.sort, 'time');
  const [places, setPlaces] = useEncounterSelection('places', 'region', initial.places, 'region');
  const preferences = usePresentation(initial);
  const roleOrder = useMemo(() => new Map((data?.resonances ?? []).map(item => [item.value, ROLE_LIST_ORDER[item.roleId] ?? 3])), [data?.resonances]);
  const season = data?.seasons.find(item => item.id === seasonId);
  const seasonOptions = [...(data?.seasons ?? [])].sort((a, b) => a.label.localeCompare(b.label, undefined, {numeric: true}));
  const regions = rankingRegions();
  const latestBoards = useMemo(() => latestRaidBoards(data?.boards ?? []), [data]);
  const psSubregions = useMemo(() => [...new Set(latestBoards.flatMap(({scope}) =>
    scope.kind === 'region' && scope.region === 'PS' && scope.subregion ? [scope.subregion] : []))].sort(), [latestBoards]);
  const activeSubregion = region === 'PS' && psSubregions.includes(subregion) ? subregion : '';
  const overall = region === 'all' || places === 'global';
  const requestedBoards = useMemo(() => latestBoards.filter(({seasonId: boardSeason, scope}) => boardSeason === seasonId && scope.kind === 'region'
    && (overall || (scope.region === region && (!activeSubregion || scope.subregion === activeSubregion)))), [latestBoards, seasonId, overall, region, activeSubregion]);
  const details = useRaidRankingData(data, requestedBoards.map(board => board.id));
  const currentNames = useCurrentNames(details.data, preferences.value.current && !details.isLoading && !details.error);
  const seasonBoards = details.data?.boards ?? [];
  const globalPlaces = useMemo(() => globalRaidPlaces(seasonBoards), [seasonBoards]);
  const placeOf = (entry: RaidRankingEntry) => overall ? globalPlaces.get(entry.id) ?? entry.rank : entry.rank;
  const boards = useMemo(() => seasonBoards.filter(({scope}) => region === 'all' || (scope.region === region && (!activeSubregion || scope.subregion === activeSubregion))), [seasonBoards, region, activeSubregion]);
  const orderedEntries = useMemo(() => {
    const search = query.trim().normalize('NFKC').toLocaleLowerCase();
    const projected = boards.flatMap(board => {
      // Match historical/current names and UID aliases, then retain the entire matching roster.
      const matching = new Set([...uidMatches, ...(search ? board.entries.flatMap(entry => entry.members ?? []).filter(member => member.identifier && currentNames.names[member.identifier]?.normalize('NFKC').toLocaleLowerCase().includes(search)).map(member => member.identifier!) : [])]);
      return projectRaidRanking(board, preferences.value.unique, query, matching).map(entry => ({board, entry}));
    });
    const rank = (entry: RaidRankingEntry) => overall ? globalPlaces.get(entry.id) ?? entry.rank : entry.rank;
    return projected.sort((a, b) => (sort === 'time-desc' ? compareRaidDurations(b.entry.duration, a.entry.duration) : compareRaidDurations(a.entry.duration, b.entry.duration)) || rank(a.entry) - rank(b.entry) || a.board.id.localeCompare(b.board.id));
  }, [boards, query, uidMatches, currentNames.names, preferences.value.unique, sort, overall, globalPlaces]);
  const resetKey = useMemo(() => ({orderedEntries, layout: preferences.value.layout}), [orderedEntries, preferences.value.layout]);
  const {visibleItems: visibleEntries, hasMore, loadMore, sentinelRef} = useBatchedList(orderedEntries, {batchSize: 25, resetKey, rootMargin: '250px 0px'});
  const count = orderedEntries.length;
  const uniquePlayerCount = useMemo(() => new Set(orderedEntries.flatMap(({board, entry}) => entry.members?.map(member => member.identifier ? playerKey(member) : `${board.scope.region}:${board.scope.subregion ?? ''}:${playerKey(member)}`) ?? [])).size, [orderedEntries]);
  useRaidRankingReturn({visibleCount: visibleEntries.length, totalCount: count, hasMore, loadMore,
    ready: seasonReady && regionReady && subregionReady && preferences.ready && !details.isLoading && !details.error && !currentNames.loading && !uidLoading});
  const selectSeason = (id: string) => {
    setSeason(id);
    const url = new URL(window.location.href);
    url.searchParams.delete('raid');
    normalizeRaidSelection(url.searchParams, data?.seasons ?? []);
    window.history.replaceState(window.history.state, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const inspectPlayer = (player: string, trigger: HTMLButtonElement) => openRaidPlayer(player, trigger, visibleEntries.length);
  return <CurrentNames.Provider value={currentNames.names}><Resonances.Provider value={data?.resonances ?? []}><section className={`${css.panel} ${css.rankingPanel}`} aria-label={t('Raid rankings', 'Рейтинг рейдов')} data-ranking-ready={seasonReady && regionReady && subregionReady && preferences.ready && !details.isLoading}>
    <CatalogControls id="raid-ranking-controls" ariaLabel={t('Filters', 'Фильтры')} textSelectable>
      <CatalogControls.Top><CatalogSearch value={query} onChange={setQuery} placeholder={t('Search by nickname or UID', 'Поиск по нику или UID')} serverModeSlot={
        <ModeSwitcher value={preferences.value.layout} onChange={layout => preferences.update({...preferences.value, layout})} ariaLabel={t('Display', 'Вид')}
          options={[{value: 'teams', label: t('Teams', 'Команды'), tone: 'gold'}, {value: 'list', label: t('List', 'Список'), tone: 'sky'}]} />
      } /></CatalogControls.Top>
      <CatalogControls.Middle><CatalogControls.Left>
        <RegionFilters regions={regions} value={region === 'all' ? null : region} onChange={next => {
          if (next !== 'PS' && subregion) setSubregion('');
          setRegion(next ?? 'all');
        }} label={t('Region', 'Регион')} allLabel={t('All', 'Все')} />
        {region === 'PS' && psSubregions.length > 1 ? <FilterGroup label={t('PlayStation', 'PlayStation')}>
          <FilterChip value="" variant="defense" active={!activeSubregion} onClick={() => setSubregion('')}>PS · {t('All', 'Все')}</FilterChip>
          {psSubregions.map(value => <FilterChip key={value} value={value} variant="defense" active={activeSubregion === value} onClick={() => setSubregion(value)}>PS · {value}</FilterChip>)}
        </FilterGroup> : null}
        <FilterGroup label={t('Season', 'Сезон')}>{seasonOptions.map(item => <FilterChip key={item.id} value={item.id} variant="physical" active={season?.id === item.id} title={item.bossLabel ?? item.label} disabled={!seasonReady} onClick={() => selectSeason(item.id)}>{item.label}</FilterChip>)}</FilterGroup>
      </CatalogControls.Left></CatalogControls.Middle>
      <CatalogControls.Bottom className={css.options}>
      <span className={css.counter}>{t('Results', 'Результаты')}: {count} · {t('Unique players', 'Уникальные игроки')}: {uniquePlayerCount}</span>
      <div className={css.preferences}>
        <FilterChip value="unique" variant="physical" active={preferences.value.unique} disabled={!preferences.ready} onClick={() => preferences.update({...preferences.value, unique: !preferences.value.unique})} icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 8l3 3 7-7"/></svg>}>{t('Unique players only', 'Только уникальные игроки')}</FilterChip>
        <FilterChip value="names" variant="frost" active={preferences.value.current} disabled={!preferences.ready} onClick={() => preferences.update({...preferences.value, current: !preferences.value.current})}
          title={currentNames.loading ? t('Loading current nicknames…', 'Загрузка актуальных никнеймов…') : !currentNames.available ? t('Some current nicknames are unavailable', 'Часть актуальных никнеймов недоступна') : undefined}
          icon={currentNames.loading ? <Spinner size="sm" aria-label={t('Loading current nicknames…', 'Загрузка актуальных никнеймов…')}/> : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M13 6A5 5 0 103 12M13 2v4H9"/></svg>}>{t('Current nicknames', 'Актуальные никнеймы')}</FilterChip>
      </div>
      <CatalogSort label={t('Order', 'Порядок')} value={`${sort === 'time-desc' ? sort : 'time'}:${overall ? 'global' : 'region'}`}
        onChange={value => {const [order, scope] = value.split(':'); setSort(order!); setPlaces(scope!);}}
        options={[
          {value: 'time', label: t('Time: Low → High', 'Время: меньше → больше')},
          {value: 'time-desc', label: t('Time: High → Low', 'Время: больше → меньше')},
        ].flatMap(option => (region === 'all' ? ['global'] : ['region', 'global']).map(scope => ({
          value: `${option.value}:${scope}`, label: option.label + (region === 'all' ? '' : ` · ${scope === 'global' ? t('Overall places', 'Общие места') : t('Regional places', 'Места в регионе')}`),
        })))}/>
      </CatalogControls.Bottom>
    </CatalogControls>
    {details.isLoading ? <LoadingState message={t('Loading rankings…', 'Загрузка рейтинга…')} /> : details.error ? <Unavailable text={text} error /> : !count ? <Unavailable text={text} error={error} filtered={!!boards.length} /> : preferences.value.layout === 'teams'
      ? <div className={css.teams}>{visibleEntries.map(({board, entry}) => <EntryCard key={`${board.id}:${entry.id}`} entry={entry} board={board} place={placeOf(entry)} overall={overall} text={text} onInspect={inspectPlayer} />)}</div>
      : <HandbookTable stickyHeader={false} caption={t('Raid rankings', 'Рейтинг рейдов')} columns={[
        {label: overall ? t('Overall #', 'Общее №') : '#', width: 75}, {label: t('Region', 'Регион'), width: 85, align: 'start'},
        {label: t('Player', 'Игрок'), width: 285, align: 'start'}, {label: t('Time', 'Время'), width: 120}, {label: t('Log date', 'Дата результата'), width: 220},
      ]} rows={visibleEntries.flatMap(({board, entry}, teamIndex) => listMembers(entry, roleOrder).map((member, index) => ({
        key: `${board.id}:${entry.id}:${index}`, separatorBefore: teamIndex > 0 && index === 0,
        cells: [placeOf(entry), <span key="region" className={css.scope}><RegionCode region={board.scope.region}/>{board.scope.subregion && <small>{board.scope.subregion}</small>}</span>,
          member ? <Member key="member" member={member} entryId={entry.id} text={text} onInspect={inspectPlayer} /> : entry.members ? <RepeatedRoster key="empty" text={text}/> : t('Roster unavailable', 'Состав неизвестен'),
          <span key="time" title={preciseRaidDuration(entry.duration)}>{displayRaidDuration(entry.duration)}</span>, entry.recordedAt?.replace('T', ' ') ?? '—'],
      })))} />}
    {hasMore && <div className={css.loadMore} ref={sentinelRef}><Button variant="secondary" size="sm" onClick={loadMore}>{t('Show more', 'Показать ещё')}</Button></div>}
  </section></Resonances.Provider></CurrentNames.Provider>;
}

function seasonRaidTitle(season: RaidRankingDataset['seasons'][number] | undefined, raids: RaidCatalog, text: Text) {
  const raid = raids.find(item => item.id === season?.raidId);
  const variant = raid?.variants[0];
  return variant ? withoutRaidDifficulty(text.name(variant.name, variant.id)) : '—';
}

export function RaidRankingComparison({data, raids = EMPTY_RAIDS, error, initial = {}}: {data: RaidRankingDataset | null; raids?: RaidCatalog; error?: boolean; initial?: RaidRankingSelection}) {
  const text = useHandbookText(), {t} = text;
  const [player] = useEncounterSelection('player', '', initial.player, '');
  const details = useRaidRankingData(data, data?.boards.map(board => board.id) ?? [], !!player);
  const preferences = usePresentation(initial);
  const boards = latestRaidBoards(data?.boards ?? []).filter(board => board.scope.kind === 'region');
  const regionOrder = new Map<string, number>(rankingRegions().map((region, index) => [region.code, index]));
  const rows = [...new Map(boards.map(board => [JSON.stringify([board.scope.region, board.scope.subregion]), {label: scopeLabel(board), region: board.scope.region, subregion: board.scope.subregion, serverId: board.scope.serverId}])).entries()]
    .sort(([, a], [, b]) => (regionOrder.get(a.region) ?? regionOrder.size) - (regionOrder.get(b.region) ?? regionOrder.size) || (a.subregion ?? '').localeCompare(b.subregion ?? ''));
  const seasons = [...(data?.seasons ?? [])].sort((a, b) => a.label.localeCompare(b.label, undefined, {numeric: true}));
  const best = new Map(seasons.map(season => {
    const times = boards.filter(board => board.seasonId === season.id).flatMap(board => {const entry = firstRaidResult(board); return entry ? [entry.duration] : [];});
    return [season.id, times.sort(compareRaidDurations)[0] ?? null];
  }));
  return <section className={css.panel} aria-label={t('Raid comparison', 'Сравнение рейдов')}>
    {player && <div className={css.heading}><h2>{t('Nickname statistics', 'Статистика по нику')}</h2>
      <Button variant="secondary" size="sm" onClick={backToRaidRanking}>{t('Back to rankings', 'Назад к рейтингу')}</Button>
    </div>}
    {player && details.isLoading ? <LoadingState message={t('Loading player history…', 'Загрузка истории игрока…')} /> : player && details.error ? <Unavailable text={text} error /> : player && details.data ? <RaidPlayerShowcase data={details.data} player={player} current={preferences.value.current} initialSeason={initial.season} titleForSeason={season => seasonRaidTitle(season, raids, text)}/> : !rows.length ? <Unavailable text={text} error={error} /> : <HandbookTable caption={t('First place by season', 'Первые места по сезонам')} highlightColumnHeader highlightRowOnHover columns={[
      {label: t('Region', 'Регион'), pinned: true, width: 100},
      ...seasons.map(season => ({label: <span className={css.column}><b>{season.label}</b><span>{seasonRaidTitle(season, raids, text)}</span></span>, width: 180})),
    ]} rows={rows.map(([key, row]) => ({key, cells: [<span key="label" className={css.scope}><RegionCode region={row.region}/>{row.subregion && <small>{row.subregion}</small>}</span>, ...seasons.map(season => {
      const board = boards.find(board => board.seasonId === season.id && board.scope.region === row.region && board.scope.subregion === row.subregion && board.scope.serverId === row.serverId);
      const entry = board && firstRaidResult(board);
      if (!entry) return <span key={season.id} title={t('No data', 'Нет данных')}>—</span>;
      const query = new URLSearchParams({tab: 'ranking', season: season.id, region: row.region});
      if (row.subregion) query.set('subregion', row.subregion);
      if (season.raidId) query.set('raid', season.raidId);
      if (board.scope.serverId) query.set('realm', board.scope.serverId);
      normalizeRaidSelection(query, data!.seasons);
      const fastest = best.get(season.id), isBest = fastest && compareRaidDurations(entry.duration, fastest) === 0;
      return <a key={season.id} href={`?${query}`} className={css.timeLink} title={preciseRaidDuration(entry.duration)} data-best={isBest || undefined} aria-label={`${row.label} · ${season.label} · #1 · ${displayRaidDuration(entry.duration)}`}>
        {displayRaidDuration(entry.duration)}{isBest && <span className={css.best} title={t('Best known', 'Лучшее известное')}> ★</span>}
      </a>;
    })]}))} />}
  </section>;
}
