'use client';

import { type Locale } from '@tof-hub/i18n';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { gameAsset } from '@tof-hub/game-assets';
import { getServerById } from '@tof-hub/contracts';
import { HubChipLinks, HubFacts, HubStack, SectionHubCard, type HubChipLink } from '@/components/section-hub';
import { formatFixed } from '@/lib/i18n/format';
import type { HubSummaryStripItem } from '@/lib/hub-summary';
import { ELEMENT_FILTER_OPTIONS } from '@/features/simulacra/constants';
import { getSimulacraStrings } from '@/features/simulacra/copy';
import { rollValueQuality } from '@/features/build/presentation';
import { NicknameLabel, RegionCode } from '@/features/players/player-label';
import { isVerifiedPlayer } from '@/features/ranking/verification';
import type { PlayerTopEntry, RankingResponse } from '@/features/ranking/types';
import type { ToolsHubCopy } from './copy';
import styles from './tools-hub.module.css';

/**
 * The first page the Ranking page opens (DPS, every element, 100 rows): the API serves this board from its Redis
 * cache and warms it at startup (docs/tools/ranking-redis.md); smaller limits would bypass the cache.
 */
const TOP_URL = '/api/v1/ranking/players?track=all&role=dps&limit=100';
const TOP_ROWS = 5;

type TopState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; entries: PlayerTopEntry[]; total: number | null };

export interface RankingCardProps {
  /** Element icons from the hub summary (ids as the Ranking tracks: Physical, Flame, …). */
  elements: readonly HubSummaryStripItem[];
  copy: ToolsHubCopy;
  locale: Locale;
  formatNumber: (value: number) => string;
}

/** Ranking hub card: element boards on the left, the live top five of the players board on the right. */
export function RankingCard({ elements, copy, locale, formatNumber }: RankingCardProps) {
  const [top, setTop] = useState<TopState>({ status: 'loading' });
  const strings = getSimulacraStrings(locale);
  const text = copy.ranking;

  useEffect(() => {
    const controller = new AbortController();
    fetch(TOP_URL, { signal: controller.signal, cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Ranking API returned ${response.status}`);
        return response.json() as Promise<RankingResponse<PlayerTopEntry>>;
      })
      .then((response) => {
        // An unavailable board is an error state, not an empty database.
        if (!response.available) throw new Error('Ranking unavailable');
        setTop({ status: 'ready', entries: response.entries.slice(0, TOP_ROWS), total: response.overall ?? response.total ?? null });
      })
      .catch(() => {
        if (!controller.signal.aborted) setTop({ status: 'error' });
      });
    return () => controller.abort();
  }, []);

  const elementIcon = (track: string | undefined) => {
    // A pair track (`Physical-Flame`) shows the icon of its first element.
    const element = track?.split('-')[0];
    return elements.find((item) => item.id === element)?.image ?? null;
  };
  const chips: HubChipLink[] = elements.flatMap((element) => {
    const option = ELEMENT_FILTER_OPTIONS.find((item) => item.id === element.id.toLowerCase());
    return option ? [{
      id: element.id,
      href: `/tools/ranking/?track=${encodeURIComponent(element.id)}`,
      label: strings[option.copyKey],
      icon: element.image,
      tone: option.variant as HubChipLink['tone'],
    }] : [];
  });

  // The page's role switch and the gear board (ranking page query parameters `role` and `board`).
  const boards: HubChipLink[] = [
    { id: 'dps', href: '/tools/ranking/', label: copy.roles.dps },
    { id: 'healer', href: '/tools/ranking/?role=healer', label: copy.roles.healer },
    { id: 'tank', href: '/tools/ranking/?role=tank', label: copy.roles.tank },
    { id: 'gear', href: '/tools/ranking/?board=gear', label: text.gearBoard },
  ];

  const aside = (
    <div className={styles.leaderboard}>
      <div className={styles.leaderboardHead}>
        <span className={styles.leaderboardTitle}>{text.topLabel}</span>
        <span className={styles.leaderboardColumns} aria-hidden="true">GRV</span>
      </div>
      {top.status === 'ready' && top.entries.length ? (
        <ol className={styles.leaderboardRows}>
          {top.entries.map((entry) => {
            const server = entry.player.serverId ? getServerById(entry.player.serverId) : null;
            const icon = elementIcon(entry.track);
            const { grade } = rollValueQuality(entry.score, 100);
            return (
              <li key={`${entry.rank}-${entry.player.uid ?? entry.player.nickname}`}>
                <Link
                  href={`/tools/ranking/?q=${encodeURIComponent(entry.player.uid ?? entry.player.nickname ?? '')}`}
                  className={styles.leaderRow}
                  data-place={entry.rank <= 3 ? entry.rank : undefined}
                >
                  <span className={styles.leaderRank}>{entry.rank}</span>
                  <span className={styles.leaderRegion}>
                    <RegionCode region={entry.player.region ?? server?.regionCode} />
                    <small>{server?.name ?? entry.player.serverId ?? ''}</small>
                  </span>
                  <span className={styles.leaderName}>
                    {/* Seal slot before the element icon, as on the Ranking page: always reserved so icons and names align. */}
                    <span className={styles.leaderVerified} {...(isVerifiedPlayer(entry) ? { title: text.verified, 'aria-label': text.verified } : {})}>
                      {isVerifiedPlayer(entry) ? '✓' : null}
                    </span>
                    {icon ? <img src={gameAsset(icon)} alt="" /> : null}
                    <span className={styles.leaderNick}>
                      <NicknameLabel nickname={entry.player.nickname} />
                    </span>
                  </span>
                  <span className={styles.leaderScore} data-grade={grade}>
                    {/* GRV points = share of the board ceiling (the page's points for this row). */}
                    <span className={styles.leaderScoreValues}>
                      <span className={styles.leaderPoints}>{formatFixed((entry.score * entry.maxScore) / 100, locale, 1)} <small>GRV</small></span>
                      <b>{`${formatFixed(entry.score, locale, 1)}%`}</b>
                    </span>
                    <span className={styles.leaderMeter} aria-hidden="true">
                      <span style={{ width: `${Math.max(0, Math.min(100, entry.score))}%` }} />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : top.status === 'loading' ? (
        <ol className={styles.leaderboardRows} aria-busy="true" aria-label={text.loading}>
          {Array.from({ length: TOP_ROWS }, (_, index) => (
            <li key={index} className={`${styles.leaderRow} ${styles.leaderSkeleton}`} aria-hidden="true">
              <span className={styles.leaderRank}>{index + 1}</span>
              <span className={styles.skeletonLine} />
              <span className={styles.skeletonLine} />
              <span className={styles.skeletonLine} />
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.leaderboardNote} role="status">{top.status === 'error' ? text.error : text.empty}</p>
      )}
    </div>
  );

  return (
    <SectionHubCard
      id="ranking"
      href="/tools/ranking/"
      title={text.title}
      description={text.description}
      count={top.status === 'ready' && top.total !== null ? { value: formatNumber(top.total), label: text.players } : undefined}
      actionLabel={copy.openPage}
      featured
      aside={aside}
    >
      <HubStack>
        {top.status === 'ready' && top.total !== null ? (
          <HubFacts facts={[{ key: 'players', value: formatNumber(top.total), label: text.players }]} />
        ) : null}
        <HubChipLinks items={chips} label={text.elementsLabel} />
        <HubChipLinks items={boards} label={text.boardsLabel} />
      </HubStack>
    </SectionHubCard>
  );
}
