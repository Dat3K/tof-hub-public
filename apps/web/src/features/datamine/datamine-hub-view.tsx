'use client';

import { localizedUi, translateUiText } from '@tof-hub/i18n';
import React, { useMemo } from 'react';
import { gameAsset } from '@tof-hub/game-assets';
import { useI18n } from '@/lib/i18n';
import { intlLocale } from '@/lib/i18n/format';
import { HubFrame, HubSparkline, SectionHubCard, SectionHubLayout } from '@/components/section-hub';
import { hubText, type HubCurve, type HubSummary } from '@/lib/hub-summary';
import { DATAMINE_HUB_COPY } from './hub-copy';
import { OowCard } from './cards/oow-card';
import { FceCard } from './cards/fce-card';
import { RaidsCard } from './cards/raids-card';
import { formatHpG } from './bygone/bygone-domain';
import { formatCompact } from './seq/seq-domain';
import styles from './datamine-hub.module.css';

export interface DatamineHubViewProps {
  /** game-data/hub-summary.json; null leaves the cards without previews. */
  summary: HubSummary | null;
  /** Server date (YYYY-MM-DD) used to mark the running Origin of War season. */
  today: string;
}

/** First, middle and last point as `F1 · 203`, formatted like the section page. */
function curveLabels(curve: HubCurve, prefix: string, format: (value: number) => string): string[] {
  if (curve.length < 2) return [];
  const middle = curve[Math.floor((curve.length - 1) / 2)]!;
  return [curve[0]!, middle, curve.at(-1)!].map(([x, y]) => `${prefix}${x} · ${format(y)}`);
}

export function DatamineHubView({ summary, today }: DatamineHubViewProps) {
  const { locale } = useI18n();
  const lang = locale;
  const copy = localizedUi(DATAMINE_HUB_COPY, lang);
  const numberLocale = intlLocale(lang);
  const plain = useMemo(() => new Intl.NumberFormat(numberLocale), [numberLocale]);
  const formatNumber = (value: number) => plain.format(value);
  const data = summary?.datamine;
  const count = (value: number | undefined, label: string) =>
    value === undefined ? undefined : { value: formatNumber(value), label };

  const bygone = data?.bygone.curve ?? [];
  const seq = data?.seq.curve ?? [];
  const modules = data?.multype.modules ?? [];
  const moduleMax = Math.max(1, ...modules.map((module) => module.count));
  const items = data?.items.sample ?? [];

  return (
    <SectionHubLayout title={copy.title} gridLabel={copy.datasetsAria}>
      <OowCard modes={data?.oow ?? null} today={today} copy={copy} locale={lang} formatNumber={formatNumber} />

      <FceCard bosses={data?.fce.bosses ?? []} count={count(data?.counts.fce, copy.bosses)} copy={copy} locale={lang} />

      <SectionHubCard
        id="bygone"
        href="/datamine/bygone/"
        title={copy.bygoneTitle}
        description={copy.bygoneBody}
        count={count(data?.counts.bygone, copy.floors)}
        actionLabel={copy.openPage}
      >
        {bygone.length > 1 ? (
          <HubSparkline
            points={bygone}
            logScale
            color="#f43f5e"
            label={copy.floorHpChart}
            labels={curveLabels(bygone, copy.floorShort, formatHpG)}
          />
        ) : null}
      </SectionHubCard>

      <SectionHubCard
        id="seq"
        href="/datamine/seq/"
        title={copy.seqTitle}
        description={copy.seqBody}
        count={count(data?.counts.seq, copy.stages)}
        actionLabel={copy.openPage}
      >
        {seq.length > 1 ? (
          <HubSparkline
            points={seq}
            color="#f5d97a"
            label={copy.stageHpChart}
            labels={curveLabels(seq, copy.stageShort, formatCompact)}
          />
        ) : null}
      </SectionHubCard>

      <RaidsCard raids={data?.raids?.entries ?? []} count={count(data?.counts.raids, copy.raids)} copy={copy} locale={lang} />

      <SectionHubCard
        id="multype"
        href="/datamine/multype/"
        title={copy.multypeTitle}
        description={copy.multypeBody}
        count={count(data?.counts.multype, copy.buffs)}
        actionLabel={copy.openPage}
      >
        {modules.length ? (
          <HubFrame>
            <ul className={styles.moduleBars}>
              {modules.map((module) => (
                <li key={module.key} className={styles.moduleBar}>
                  <span className={styles.moduleName} title={module.key}>{module.label ? translateUiText(module.label, lang) : module.key}</span>
                  <span className={styles.moduleTrack} aria-hidden="true">
                    <span style={{ width: `${(module.count / moduleMax) * 100}%` }} />
                  </span>
                  <span className={styles.moduleCount}>{formatNumber(module.count)}</span>
                </li>
              ))}
            </ul>
          </HubFrame>
        ) : null}
      </SectionHubCard>

      <SectionHubCard
        id="items"
        href="/datamine/items/"
        title={copy.itemsTitle}
        description={copy.itemsBody}
        count={count(data?.counts.items, copy.items)}
        actionLabel={copy.openPage}
      >
        {items.length ? (
          <HubFrame>
            <ul className={styles.itemRows}>
              {items.map((row) => (
                <li key={row.id} className={styles.itemRow}>
                  <span className={styles.itemIcon}>
                    {row.icon ? <img src={gameAsset(row.icon)} alt="" loading="lazy" decoding="async" /> : null}
                  </span>
                  <span className={styles.itemText}>
                    <span className={styles.itemId} title={row.id}>{row.id}</span>
                    <span className={styles.itemNames}>
                      {row.original ? <span lang="zh">{row.original}</span> : null}
                      {row.name ? <span>{row.name}</span> : null}
                    </span>
                  </span>
                  <span className={styles.itemOwner}>{hubText(row.owner.name, lang)}</span>
                </li>
              ))}
            </ul>
          </HubFrame>
        ) : null}
      </SectionHubCard>

    </SectionHubLayout>
  );
}
