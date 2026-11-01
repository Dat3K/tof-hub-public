'use client';

import { type Locale } from '@tof-hub/i18n';
import React, { useState } from 'react';
import Link from 'next/link';
import { gameAsset } from '@tof-hub/game-assets';
import { HubFrame, SectionHubCard, useHubPreview } from '@/components/section-hub';
import { hubText, type HubFceBoss } from '@/lib/hub-summary';
import type { DatamineHubCopy } from '../hub-types';
import styles from '../datamine-hub.module.css';

export interface FceCardProps {
  bosses: readonly HubFceBoss[];
  count: { value: string; label: string } | undefined;
  copy: DatamineHubCopy;
  locale: Locale;
}

/** First two and last two bosses of the ladder plus four random ones from the middle. */
const BOSS_PREVIEW = { head: 2, middle: 4, tail: 2 } as const;

/** Boss chips like the FCE page switcher: picking one previews its first mechanic. */
export function FceCard({ bosses: ladder, count, copy, locale }: FceCardProps) {
  const bosses = useHubPreview(ladder, BOSS_PREVIEW);
  const [selected, setSelected] = useState(0);
  const boss = bosses[selected] ?? bosses[0];

  return (
    <SectionHubCard
      id="fce"
      href="/datamine/fce/"
      title={copy.fceTitle}
      description={boss ? undefined : copy.fceBody}
      count={count}
      actionLabel={copy.openPage}
    >
      {boss ? (
        <div className={styles.fcePreview}>
          <HubFrame className={styles.fceShowcase}>
            <Link href={`/datamine/fce/?boss=${encodeURIComponent(boss.slug)}`} className={styles.bossThumb} aria-label={hubText(boss.name, locale)}>
              {boss.image ? <img src={gameAsset(boss.image)} alt="" loading="lazy" decoding="async" /> : null}
            </Link>
            <div className={styles.fceInfo}>
              <span className={styles.fceName} style={boss.nameColor ? {color: boss.nameColor} : undefined}>{hubText(boss.name, locale)}</span>
              <span className={styles.fceSub}>
                {[boss.ladderLevel ? `${copy.level} ${boss.ladderLevel}` : null, `${boss.mechanicsCount} ${copy.mechanics}`]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <span className={styles.fceEffect}>{hubText(boss.mechanic, locale)}</span>
            </div>
          </HubFrame>
          <div className={styles.bossChips} aria-label={copy.bossPicker}>
            {/* First click previews the boss; a click on the previewed boss opens its card. */}
            {bosses.map((entry, index) => (
              <Link
                key={entry.slug}
                href={`/datamine/fce/?boss=${encodeURIComponent(entry.slug)}`}
                className={styles.bossChip}
                aria-current={index === selected ? 'true' : undefined}
                title={hubText(entry.name, locale)}
                onClick={(event) => {
                  if (index === selected) return;
                  event.preventDefault();
                  setSelected(index);
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
