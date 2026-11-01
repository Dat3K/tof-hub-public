'use client';

import { type Locale } from '@tof-hub/i18n';
import React, { useState } from 'react';
import Link from 'next/link';
import { gameAsset } from '@tof-hub/game-assets';
import { HubFrame, SectionHubCard } from '@/components/section-hub';
import { hubText, type HubRaid } from '@/lib/hub-summary';
import { RAID_NAME_COLORS, DEFAULT_RAID_NAME_COLOR } from '../raids/raid-name-colors';
import type { DatamineHubCopy } from '../hub-types';
import styles from '../datamine-hub.module.css';

export interface RaidsCardProps {
  /** Oldest first; the last (newest) one is previewed first. */
  raids: readonly HubRaid[];
  count: { value: string; label: string } | undefined;
  copy: DatamineHubCopy;
  locale: Locale;
}

/** Raid chips like the Boss mechanics card: the newest raid is previewed, picking another previews its first mechanic. */
export function RaidsCard({ raids, count, copy, locale }: RaidsCardProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const selected = Math.min(picked ?? raids.length - 1, raids.length - 1);
  const raid = raids[selected];
  const href = (entry: HubRaid) => `/datamine/raids/?raid=${encodeURIComponent(entry.id)}`;

  return (
    <SectionHubCard
      id="raids"
      href="/datamine/raids/"
      title={copy.raidsTitle}
      description={raid ? undefined : copy.raidsBody}
      count={count}
      actionLabel={copy.openPage}
    >
      {raid ? (
        <div className={styles.fcePreview}>
          <HubFrame className={styles.fceShowcase}>
            <Link href={href(raid)} className={styles.bossThumb} aria-label={hubText(raid.name, locale)}>
              {raid.image ? <img src={gameAsset(raid.image)} alt="" loading="lazy" decoding="async" /> : null}
            </Link>
            <div className={styles.fceInfo}>
              <span className={styles.fceName} style={{ color: RAID_NAME_COLORS[raid.id] ?? DEFAULT_RAID_NAME_COLOR }}>{hubText(raid.name, locale)}</span>
              <span className={styles.fceSub}>{`#${raid.index} · ${raid.mechanicsCount} ${copy.mechanics}`}</span>
              {raid.mechanic ? <span className={styles.fceEffect}>{hubText(raid.mechanic, locale)}</span> : null}
            </div>
          </HubFrame>
          <div className={styles.bossChips} aria-label={copy.raidPicker}>
            {/* First click previews the raid; a click on the previewed raid opens its card. */}
            {raids.map((entry, index) => (
              <Link
                key={entry.id}
                href={href(entry)}
                className={styles.bossChip}
                aria-current={index === selected ? 'true' : undefined}
                title={hubText(entry.name, locale)}
                onClick={(event) => {
                  if (index === selected) return;
                  event.preventDefault();
                  setPicked(index);
                }}
              >
                {entry.image ? <img src={gameAsset(entry.image)} alt={hubText(entry.name, locale)} loading="lazy" decoding="async" /> : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </SectionHubCard>
  );
}
