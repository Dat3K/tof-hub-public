'use client';

import { type Locale } from '@tof-hub/i18n';
import React, { useState } from 'react';
import Link from 'next/link';
import { ModeSwitcher } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import { HubFacts, HubStack, SectionHubCard, useHubHover } from '@/components/section-hub';
import { hubText, type HubOowMode, type HubOowSeason } from '@/lib/hub-summary';
import { formatHpValue } from '../oow/oow-domain';
import type { DatamineHubCopy } from '../hub-types';
import styles from '../datamine-hub.module.css';

type OowMode = 'gacha' | 'mmo';

export interface OowCardProps {
  modes: Record<OowMode, HubOowMode> | null;
  /** Server date (YYYY-MM-DD) that marks the running season. */
  today: string;
  copy: DatamineHubCopy;
  locale: Locale;
  formatNumber: (value: number) => string;
}

/** `2026-09-12` → `12.09`. */
function shortDate(value: string): string {
  const [, month, day] = value.split('-');
  return day && month ? `${day}.${month}` : value;
}

const isRunning = (season: HubOowSeason, today: string) => season.startDate <= today && today <= season.endDate;

/** HP in the OOW page unit (G, or T from 1e12). */
function hp(value: number): string {
  const { value: number, unitLabel } = formatHpValue(value, 'G');
  return `${number} ${unitLabel}`;
}

export function OowCard({ modes, today, copy, locale, formatNumber }: OowCardProps) {
  const [mode, setMode] = useState<OowMode>('gacha');
  // A first click on a season previews it in the card; a click on the previewed season opens the OOW page.
  const [picked, setPicked] = useState<number | null>(null);
  // Hovered or focused season: its boss art crossfades in behind the card (as the Info roster).
  const hover = useHubHover<number>();
  const active = modes?.[mode];
  const seasons = active?.seasons ?? [];
  const current = seasons.find((season) => isRunning(season, today));
  const focus = seasons.find((season) => season.season === picked) ?? current ?? seasons.at(-1);
  const modeQuery = mode === 'mmo' ? 'mode=mmo&' : '';
  // Season tiles compare final boss HP within the shown seasons (bar length relative to the strongest).
  const maxBossHp = Math.max(0, ...seasons.map((season) => season.finalBossHp ?? 0));
  const changeMode = (next: OowMode) => {
    setMode(next);
    setPicked(null);
    hover.reset();
  };
  const artSeason = seasons.find((season) => season.season === hover.hovered) ?? focus;

  const seasonLabel = focus === current ? copy.currentSeason : picked === null ? copy.latestSeason : copy.season;
  const facts = focus
    ? [
        { key: 'season', value: `S${focus.displayNumber ?? focus.season}`, label: seasonLabel },
        ...(focus.floorCount ? [{ key: 'floors', value: formatNumber(focus.floorCount), label: copy.floors }] : []),
        ...(focus.boss ? [{ key: 'boss', value: hubText(focus.boss.name, locale), label: copy.seasonBoss }] : []),
      ]
    : [];
  const hpFacts = focus
    ? [
        ...(focus.finalBossHp ? [{ key: 'boss-hp', value: hp(focus.finalBossHp), label: copy.bossHp }] : []),
        ...(focus.finalBossEffectiveHp
          ? [{ key: 'boss-ehp', value: hp(focus.finalBossEffectiveHp), label: copy.bossEffectiveHp }]
          : []),
        ...(focus.finalFloor?.effectiveHp
          ? [{
              key: 'floor-ehp',
              value: hp(focus.finalFloor.effectiveHp),
              label: copy.floorEffectiveHp.replace('{floor}', String(focus.finalFloor.floor)),
            }]
          : []),
      ]
    : [];

  const aside = (
    <div className={styles.oowAside}>
      {modes?.mmo.seasons.length ? (
        <ModeSwitcher
          presentation="standalone"
          value={mode}
          onChange={changeMode}
          ariaLabel={copy.serverMode}
          options={[
            { value: 'gacha', label: copy.gacha, tone: 'orange' },
            { value: 'mmo', label: copy.mmo, tone: 'rose' },
          ]}
        />
      ) : null}
      <ul className={styles.oowSeasonList} {...hover.list}>
        {seasons.map((season) => {
          const running = season === current;
          const shown = season === focus;
          return (
            <li key={season.season}>
              <Link
                href={`/datamine/oow/?${modeQuery}s=${season.season}`}
                className={`${styles.oowSeason} ${running ? styles.oowSeasonCurrent : ''}`}
                data-shown={shown || undefined}
                aria-current={shown ? 'true' : undefined}
                {...hover.item(season.season)}
                onClick={(event) => {
                  if (shown) return;
                  event.preventDefault();
                  setPicked(season.season);
                }}
              >
                <span className={styles.oowSeasonBoss} aria-hidden="true">
                  {season.boss?.image ? <img src={gameAsset(season.boss.image)} alt="" loading="lazy" decoding="async" /> : null}
                </span>
                <span className={styles.oowSeasonText}>
                  <span className={styles.oowSeasonHead}>
                    <span className={styles.oowSeasonCode}>S{season.displayNumber ?? season.season}</span>
                    <span className={styles.oowSeasonDates}>
                      {`${shortDate(season.startDate)} → ${shortDate(season.endDate)}`}
                    </span>
                  </span>
                  {season.boss ? <span className={styles.oowSeasonName}>{hubText(season.boss.name, locale)}</span> : null}
                  {season.finalBossHp && maxBossHp ? (
                    <span className={styles.oowSeasonHp} title={`${copy.bossHp}: ${hp(season.finalBossHp)}`}>
                      <span className={styles.oowSeasonHpTrack} aria-hidden="true">
                        <span style={{ width: `${(season.finalBossHp / maxBossHp) * 100}%` }} />
                      </span>
                      <span className={styles.oowSeasonHpValue}>{hp(season.finalBossHp)}</span>
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <SectionHubCard
      id="oow"
      href="/datamine/oow/"
      title={copy.oowTitle}
      description={copy.oowBody}
      count={active ? { value: formatNumber(active.total), label: copy.seasons } : undefined}
      actionLabel={copy.openPage}
      featured
      backgroundArt={artSeason?.boss?.image ? gameAsset(artSeason.boss.image) : null}
      backgroundArtPlacement="feature"
      aside={aside}
    >
      <HubStack>
        <HubFacts facts={facts} />
        <HubFacts facts={hpFacts} />
      </HubStack>
    </SectionHubCard>
  );
}
