'use client';

import {useMemo, useState} from 'react';
import {displayRaidDuration, globalRaidPlaces, latestRaidBoards, preciseRaidDuration, raidNicknameStats, raidSeasonPlaceCounts, type RaidRankingDataset, type RaidRankingEntry, type RaidRankingMember} from '@tof-hub/game-domain';
import {gameAsset} from '@tof-hub/game-assets';
import {isBlankText} from '@tof-hub/contracts';
import {Button, CatalogSort, useBatchedList} from '@tof-hub/ui';
import {Hint, Nickname, RegionCode} from '@/features/players/player-identity';
import {HandbookTable, useHandbookText} from '../handbook/sections/handbook-ui';
import {useEncounterSelection} from '../components/encounter-ui';
import {latestRaidSeason, normalizeRaidSelection} from './raid-selection';
import {raidPlayerKey} from './raid-player-identity';
import {useKnownRaidPlayer} from './use-known-raid-player';
import css from './raid-player-showcase.module.css';

type Season = RaidRankingDataset['seasons'][number];
const ROLE_ORDER = ['dps', 'tank', 'healer', 'balance'];

export function raidRoleLabels(t: (en: string, ru: string) => string): Record<string, string> {
  return {dps: t('DPS', 'ДД'), tank: t('Tank', 'Танк'), healer: t('Healer', 'Хил'), balance: t('Balance', 'Баланс')};
}

export function RaidPlayerShowcase({data, player, current, initialSeason, titleForSeason}: {
  data: RaidRankingDataset; player: string; current: boolean; initialSeason?: string;
  titleForSeason: (season: Season | undefined) => string;
}) {
  const text = useHandbookText(), {t} = text;
  const nicknameCopy = {blankName: 'blank', blankNameHint: t('Invisible characters:', 'Невидимые символы:'), nicknameCopied: t('Nickname copied', 'Ник скопирован')};
  const [seasonId] = useEncounterSelection('season', latestRaidSeason(data.seasons)?.id ?? '', initialSeason);
  const boards = useMemo(() => latestRaidBoards(data.boards), [data.boards]);
  const selected = useMemo(() => {
    const matches = (member: RaidRankingMember) => raidPlayerKey(member) === player || member.nickname === player;
    const ordered = [...boards].sort((a, b) => Number(b.seasonId === seasonId) - Number(a.seasonId === seasonId) || (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''));
    return ordered.flatMap(board => board.entries.flatMap(entry => entry.members ?? [])).find(matches);
  }, [boards, player, seasonId]);
  const {player: known} = useKnownRaidPlayer(selected?.identifier);
  const stats = useMemo(() => raidNicknameStats(boards, selected?.nickname ?? player, selected?.identifier, selected?.observationId)
    .sort((a, b) => a.seasonId.localeCompare(b.seasonId, undefined, {numeric: true}) || a.scope.region.localeCompare(b.scope.region)), [boards, selected, player]);
  const globalBest = useMemo(() => {
    const places = globalRaidPlaces(boards.filter(board => board.scope.kind === 'region'));
    const best = new Map<string, {place: number; boardId: string; entry: RaidRankingEntry}>();
    for (const board of boards) for (const entry of board.entries) {
      if (!entry.members?.some(member => selected?.identifier ? member.identifier === selected.identifier : selected?.observationId ? member.observationId === selected.observationId : member.nickname === selected?.nickname)) continue;
      const place = places.get(entry.id);
      if (place !== undefined && place < (best.get(board.seasonId)?.place ?? Infinity)) best.set(board.seasonId, {place, boardId: board.id, entry});
    }
    return best;
  }, [boards, selected]);
  const orderedSeasons = useMemo(() => [...data.seasons].sort((a, b) => a.label.localeCompare(b.label, undefined, {numeric: true})), [data.seasons]);
  const ranges = Array.from({length: Math.ceil(orderedSeasons.length / 20)}, (_, index) => orderedSeasons.slice(index * 20, index * 20 + 20));
  const [range, setRange] = useState(() => Math.max(0, Math.floor(orderedSeasons.findIndex(season => season.id === seasonId) / 20)));
  const rangeIndex = Math.min(range, Math.max(0, ranges.length - 1));
  const shownSeasons = ranges[rangeIndex] ?? [];
  const detailRows = useBatchedList(stats, {batchSize: 25, resetKey: stats});
  const roleLabels = raidRoleLabels(t);
  const roles = [...(data.resonances ?? [])].sort((a, b) => ROLE_ORDER.indexOf(a.roleId) - ROLE_ORDER.indexOf(b.roleId));
  const rolesByValue = new Map(roles.map(role => [role.value, role.roleId]));
  // Members without a resonance (old seasons 1–7) played Balance; the ranking table uses the same fallback.
  const balanceRole = roles.find(role => role.roleId === 'balance');
  const roleIdFor = (value: string) => rolesByValue.get(value) ?? (balanceRole ? 'balance' : 'unknown');
  const countsFor = (row: typeof stats[number]) => {
    const counts: Record<string, number> = {};
    for (const [label, count] of Object.entries(row.resonanceCounts)) {
      const role = roleIdFor(label);
      counts[role] = (counts[role] ?? 0) + count;
    }
    return counts;
  };
  const totals: Record<string, number> = {};
  for (const row of stats) for (const [role, count] of Object.entries(countsFor(row))) totals[role] = (totals[role] ?? 0) + count;
  const unknown = (totals.unknown ?? 0) > 0;
  const seasonBands = raidSeasonPlaceCounts(stats);
  const bestBySeason = new Map<string, typeof stats[number]>();
  for (const row of stats) if (!bestBySeason.has(row.seasonId) || row.bestRank < bestBySeason.get(row.seasonId)!.bestRank) bestBySeason.set(row.seasonId, row);
  const bestRoles: Record<string, number> = {};
  for (const row of bestBySeason.values()) {
    const role = roleIdFor(row.bestResonance);
    bestRoles[role] = (bestRoles[role] ?? 0) + 1;
  }
  const regions = [...new Set(stats.map(row => row.scope.region))];
  const historical = selected?.nicknameStatus === 'unreadable' ? t('Unreadable nickname', 'Ник неразборчив')
    : selected && !selected.identifier && isBlankText(selected.nickname) ? t('Unresolved nickname', 'Ник не определён')
    : selected?.nickname ?? t('Player not found', 'Игрок не найден');
  const currentName = known ? known.nickname : null;
  const nickname = current && currentName !== null ? currentName : historical;
  const alias = !current && known && known.nickname !== selected?.nickname ? currentName : null;
  const appearances = stats.reduce((sum, row) => sum + row.appearances, 0);
  const hrefFor = (row: typeof stats[number], overall = false) => {
    const observed = boards.find(board => board.id === row.boardId)?.entries.flatMap(entry => entry.members ?? [])
      .find(member => selected?.identifier ? member.identifier === selected.identifier : selected?.observationId ? member.observationId === selected.observationId : member.nickname === selected?.nickname);
    const query = new URLSearchParams({tab: 'ranking', season: row.seasonId, region: overall ? 'all' : row.scope.region});
    const search = known?.uid || (current && known ? known.nickname : observed?.nickname);
    if (search) query.set('q', search);
    if (current) query.set('names', 'current');
    normalizeRaidSelection(query, data.seasons);
    return `?${query}`;
  };
  const roleLabel = (role: typeof roles[number]) => <span className={css.roleLabel} title={text.name(role.name)}>
    {role.icon && <img src={gameAsset(role.icon)} alt=""/>}<span>{roleLabels[role.roleId] ?? text.name(role.name)}</span>
  </span>;
  const placeHint = (place: number, entry: RaidRankingEntry | undefined, overall: boolean, region?: string) => <div className={css.placeHint}>
    <span>{overall ? t('Overall', 'Общий топ') : region} <b>#{place}</b></span>
    {entry && <strong aria-label={preciseRaidDuration(entry.duration)}>{displayRaidDuration(entry.duration)}</strong>}
  </div>;
  return <div className={css.showcase} id="raid-nickname-statistics">
    <section className={css.summary} aria-label={t('Player raid showcase', 'Рейдовая карточка игрока')}>
      <div className={css.identity}>
        <span className={css.regions}>{regions.map(region => <RegionCode key={region} region={region}/>)}</span>
        <h3 className={css.nickname}><Nickname nickname={nickname} uid={known?.uid} copy={nicknameCopy}/>{alias !== null && <small> (<Nickname nickname={alias} uid={known?.uid} copy={nicknameCopy}/>)</small>}</h3>
        <span className={css.uid}>UID <b>{known?.uid ?? '—'}</b></span>
        <p className={css.total}>{t('Seasons', 'Сезоны')}: <b>{bestBySeason.size}</b> · {t('Leaderboard appearances', 'Появления в списке рейтинга')}: <b>{appearances}</b></p>
      </div>
      {!stats.length ? <p className={css.empty}>{t('No results', 'Нет результатов')}</p> : <>
        <div className={css.seasonHeader}><p className={css.caption}>{t('Best places by season', 'Лучшие места по сезонам')}</p>
          {ranges.length > 1 && <div className={css.rangeControls}>
            <Button variant="secondary" size="sm" disabled={rangeIndex === 0} aria-label={t('Previous seasons', 'Предыдущие сезоны')} onClick={() => setRange(rangeIndex - 1)}>‹</Button>
            <CatalogSort label={t('Seasons', 'Сезоны')} value={String(rangeIndex)} onChange={value => setRange(Number(value))}
              options={ranges.map((seasons, index) => ({value: String(index), label: `${seasons[0]!.label}–${seasons.at(-1)!.label}`}))}/>
            <Button variant="secondary" size="sm" disabled={rangeIndex === ranges.length - 1} aria-label={t('Next seasons', 'Следующие сезоны')} onClick={() => setRange(rangeIndex + 1)}>›</Button>
          </div>}
        </div>
        <nav className={css.seasonScroll} aria-label={t('Best regional places by season', 'Лучшие места по сезонам')}>
          <table className={css.seasonMatrix} aria-label={t('Best regional and overall places', 'Лучшие региональные и общие места')}>
            <thead><tr><th scope="col">{t('Season', 'Сезон')}</th>{shownSeasons.map(season => <th key={season.id} scope="col">{season.label}</th>)}</tr></thead>
            <tbody>
              <tr><th scope="row">{t('Role played', 'Резонанс')}</th>{shownSeasons.map(season => {
                const row = bestBySeason.get(season.id), role = row && (roles.find(role => role.value === row.bestResonance) ?? balanceRole);
                const entry = row && boards.find(board => board.id === row.boardId)?.entries.find(entry => entry.id === row.bestEntryId);
                return <td key={season.id}>{row && role?.icon ? <Hint title={`${season.label} · ${roleLabels[role.roleId] ?? text.name(role.name)}`} body={placeHint(row.bestRank, entry, false, row.scope.region)}>
                  <a className={css.playedRole} href={hrefFor(row)} aria-label={`${season.label} · ${t('Role played', 'Резонанс')} · ${roleLabels[role.roleId] ?? text.name(role.name)}`}>
                    <img src={gameAsset(role.icon)} alt={roleLabels[role.roleId] ?? text.name(role.name)}/>
                  </a>
                </Hint> : <span className={css.absent}>—</span>}</td>;
              })}</tr>
              <tr><th scope="row">{regions.length === 1 ? <RegionCode region={regions[0]!}/> : t('Regional', 'Регион')}</th>{shownSeasons.map(season => {
                const row = bestBySeason.get(season.id);
                const entry = row && boards.find(board => board.id === row.boardId)?.entries.find(entry => entry.id === row.bestEntryId);
                return <td key={season.id}>{row ? <Hint title={`${season.label} · ${titleForSeason(season)}`} body={placeHint(row.bestRank, entry, false, row.scope.region)}><a href={hrefFor(row)} aria-label={`${season.label} · ${titleForSeason(season)} · ${row.scope.region} #${row.bestRank}`} data-podium={row.bestRank <= 3 ? row.bestRank : undefined}>#{row.bestRank}</a></Hint> : <span className={css.absent}>—</span>}</td>;
              })}</tr>
              <tr><th scope="row">{t('Overall', 'Общий топ')}</th>{shownSeasons.map(season => {
                const best = globalBest.get(season.id), row = best && stats.find(item => item.boardId === best.boardId);
                return <td key={season.id}>{best && row ? <Hint title={`${season.label} · ${titleForSeason(season)}`} body={placeHint(best.place, best.entry, true)}><a href={hrefFor(row, true)} aria-label={`${season.label} · ${t('Overall', 'Общий топ')} #${best.place}`} data-podium={best.place <= 3 ? best.place : undefined}>#{best.place}</a></Hint> : <span className={css.absent}>—</span>}</td>;
              })}</tr>
            </tbody>
          </table>
        </nav>
      </>}
    </section>
    {!!stats.length && <>
      <div className={css.metrics}>
        <div className={css.roles} aria-label={t('Resonances in best regional results', 'Резонансы лучших результатов в регионе')}>
          {roles.map(role => <span key={role.roleId}>{roleLabel(role)} <b>{bestRoles[role.roleId] ?? 0}</b></span>)}
          {(bestRoles.unknown ?? 0) > 0 && <span>{t('Unknown', 'Не определён')} <b>{bestRoles.unknown}</b></span>}
        </div>
        <div className={css.bands} aria-label={t('Seasons by best regional place', 'Сезоны по лучшему региональному месту')} title={t('Each season belongs to one range according to its best regional place.', 'Каждый сезон входит только в одну группу по своему лучшему месту в регионе.')}>
          <span className={css.bandCaption}>{t('Seasons', 'Сезоны')}</span><span className={css.band}><span>1–8</span> <b>{seasonBands.places1To8}</b></span><span className={css.band}><span>9–24</span> <b>{seasonBands.places9To24}</b></span><span className={css.band}><span>25–100</span> <b>{seasonBands.places25To100}</b></span>
        </div>
      </div>
      <details className={css.details}>
        <summary>{t('Season details', 'Подробно по сезонам')}<span>{t('Leaderboard appearances', 'Появления в списке рейтинга')}</span></summary>
        <HandbookTable stickyHeader={false} compact caption={t('Nickname statistics', 'Статистика по нику')} columns={[
          {label: t('Season', 'Сезон'), width: 70, align: 'start'}, {label: t('Raid', 'Рейд'), width: 210, align: 'start'},
          ...(regions.length > 1 ? [{label: t('Region', 'Регион'), width: 65}] : []),
          {label: t('Appearances', 'Появления'), width: 85},
          ...roles.map(role => ({label: roleLabel(role), width: role.roleId === 'balance' ? 85 : 70})),
          ...(unknown ? [{label: t('Unknown', 'Не определён'), width: 85}] : []),
          {label: '1–8', width: 65}, {label: '9–24', width: 65}, {label: '25–100', width: 70},
        ]} rows={[
          ...detailRows.visibleItems.map(row => {
            const season = data.seasons.find(item => item.id === row.seasonId), counts = countsFor(row);
            return {key: row.boardId, cells: [<a key="season" className={css.seasonLink} href={hrefFor(row)}>{season?.label ?? row.seasonId} <span aria-hidden="true">↗</span></a>, titleForSeason(season),
              ...(regions.length > 1 ? [<RegionCode key="region" region={row.scope.region}/>] : []), row.appearances,
              ...roles.map(role => counts[role.roleId] ?? 0), ...(unknown ? [counts.unknown ?? 0] : []), row.places1To8, row.places9To24, row.places25To100]};
          }),
          {key: 'total', highlight: true, cells: [t('Total', 'Итого'), '', ...(regions.length > 1 ? [''] : []), appearances,
            ...roles.map(role => totals[role.roleId] ?? 0), ...(unknown ? [totals.unknown] : []),
            ...(['places1To8', 'places9To24', 'places25To100'] as const).map(key => stats.reduce((sum, row) => sum + row[key], 0))]},
        ]}/>
        {detailRows.hasMore && <div className={css.more} ref={detailRows.sentinelRef}><Button variant="secondary" size="sm" onClick={detailRows.loadMore}>{t('Show more', 'Показать ещё')}</Button></div>}
      </details>
    </>}
  </div>;
}
