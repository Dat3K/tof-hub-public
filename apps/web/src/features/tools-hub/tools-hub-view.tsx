'use client';

import { localizedUi } from '@tof-hub/i18n';
import React, { useMemo } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { intlLocale } from '@/lib/i18n/format';
import { SectionHubCard, SectionHubLayout } from '@/components/section-hub';
import { RailGlyph } from '@/components/tool-rail/tool-rail';
import { hubText, type HubSummary } from '@/lib/hub-summary';
import { resolveCompTraitIcon } from '@/features/comp/data';
import { TOOLS_HUB_COPY } from './copy';
import { RankingCard } from './ranking-card';
import { BuildPreview, CompPreview, OptimizerPreview } from './tool-previews';
import type { CompPreviewRow } from './comp-preview';
import styles from './tools-hub.module.css';

export interface ToolsHubViewProps {
  /** game-data/hub-summary.json; null leaves the cards without previews. */
  summary: HubSummary | null;
  /** Rows of the Comp page's default squad (comp-preview.ts); empty without the Comp catalog. */
  compPreview: CompPreviewRow[];
}

const WISH_SHORTCUTS = [
  { id: 'history', href: '/tools/wish/?tab=history', icon: 'history' },
  { id: 'overview', href: '/tools/wish/?tab=overview', icon: 'equipment' },
  { id: 'simulation', href: '/tools/wish/?tab=simulation', icon: 'simulation' },
] as const;

export function ToolsHubView({ summary, compPreview }: ToolsHubViewProps) {
  const { locale } = useI18n();
  const lang = locale;
  const copy = localizedUi(TOOLS_HUB_COPY, lang);
  const plain = useMemo(() => new Intl.NumberFormat(intlLocale(lang)), [lang]);
  const formatNumber = (value: number) => plain.format(value);
  const tools = summary?.tools;
  const banner = tools?.wish ?? null;
  const bannerName = hubText(banner?.name, lang);
  // Comp shows a simulacrum as its matrix portrait; reuse the Comp resolver for the same picture.
  const simulacra = useMemo(
    () => (tools?.comp.strip ?? []).map((item) => ({ ...item, image: resolveCompTraitIcon(item.id) || item.image })),
    [tools],
  );

  return (
    <SectionHubLayout title={copy.title} gridLabel={copy.sectionsAria}>
      <RankingCard elements={tools?.ranking.strip ?? []} copy={copy} locale={lang} formatNumber={formatNumber} />

      <SectionHubCard
        id="wish"
        href="/tools/wish/"
        title={copy.wish.title}
        description={copy.wish.description}
        actionLabel={copy.openPage}
        span="half"
      >
        <div className={styles.wishPreview}>
          {banner?.image || banner?.background ? (
            // Same composition as the Wish page banner: background, character from the bottom right, dark fade.
            <Link href="/tools/wish/" className={styles.banner} aria-label={bannerName}>
              {banner.background ? (
                <span className={styles.bannerBackground} style={{ backgroundImage: `url(${banner.background})` }} aria-hidden="true" />
              ) : null}
              {banner.image ? <img className={styles.bannerCharacter} src={banner.image} alt="" loading="lazy" decoding="async" /> : null}
              <span className={styles.bannerText}>
                <span className={styles.bannerLabel}>{copy.latestBanner}</span>
                <span className={styles.bannerName}>{bannerName}</span>
              </span>
            </Link>
          ) : null}
          <nav className={styles.wishShortcuts} aria-label={copy.wish.shortcutsLabel}>
            {WISH_SHORTCUTS.map((shortcut) => {
              const item = copy.wish.shortcuts[shortcut.id];
              return (
                <Link key={shortcut.id} href={shortcut.href} className={styles.wishShortcut}>
                  <span className={styles.wishShortcutIcon} aria-hidden="true">
                    <RailGlyph name={shortcut.icon} />
                  </span>
                  <span className={styles.wishShortcutText}>
                    <span className={styles.wishShortcutTitle}>{item.title}</span>
                    <span className={styles.wishShortcutDescription}>{item.description}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </SectionHubCard>

      <SectionHubCard
        id="build"
        href="/tools/build/"
        title={copy.build.title}
        description={copy.build.description}
        actionLabel={copy.openPage}
        span="half"
      >
        <BuildPreview gear={tools?.build.strip ?? []} simulacra={simulacra} copy={copy.build} />
      </SectionHubCard>

      <SectionHubCard
        id="optimizer"
        href="/tools/optimizer/"
        title={copy.optimizer.title}
        description={copy.optimizer.description}
        actionLabel={copy.openPage}
        span="half"
      >
        <OptimizerPreview stats={tools?.optimizer.strip ?? []} copy={copy.optimizer} />
      </SectionHubCard>

      <SectionHubCard
        id="comp"
        href="/tools/comp/"
        title={copy.comp.title}
        description={copy.comp.description}
        actionLabel={copy.openPage}
        span="half"
      >
        <CompPreview rows={compPreview} copy={copy} />
      </SectionHubCard>

      <SectionHubCard
        id="trade-station"
        href="/tools/trade-station/"
        title={copy.tradeStation.title}
        description={copy.tradeStation.description}
        actionLabel={copy.openPage}
        span="half"
      />
    </SectionHubLayout>
  );
}
