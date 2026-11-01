'use client';

import { localized } from '@tof-hub/i18n';
import { type Locale } from '@tof-hub/i18n';
import React, { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { intlLocale } from '@/lib/i18n/format';
import {
  HubFacts,
  HubMediaStrip,
  HubStack,
  SectionHubCard,
  SectionHubLayout,
  useHubPreview,
} from '@/components/section-hub';
import { hubText, type HubSummary, type HubSummaryPreview } from '@/lib/hub-summary';
import { SimulacraCard } from './simulacra-card';
import { INFO_SECTION_CARDS } from './constants';
import { INFO_HUB_COPY } from './copy';
import type { InfoCardConfig, InfoFactKey, InfoHubStrings } from './types';

export interface InfoHubViewProps {
  /** game-data/hub-summary.json; null leaves the cards without previews. */
  summary: HubSummary | null;
}

const NO_STRIP: HubSummaryPreview['strip'] = [];

function InfoSectionCard({
  card,
  preview,
  total,
  copy,
  lang,
  format,
}: {
  card: InfoCardConfig;
  preview: HubSummaryPreview | undefined;
  total: number | undefined;
  copy: InfoHubStrings;
  lang: Locale;
  format: (value: number) => string;
}) {
  const picked = useHubPreview(preview?.strip ?? NO_STRIP, card.stripPreview);
  const strip = picked.map((item) => ({ id: item.id, name: hubText(item.name, lang), image: item.image }));
  const facts = (preview?.facts ?? []).map((fact) => ({
    key: fact.key,
    value: format(fact.value),
    label: copy.facts[fact.key as InfoFactKey] ?? fact.key,
  }));
  return (
    <SectionHubCard
      id={card.id}
      href={card.href}
      title={copy[`${card.id}Title`]}
      description={copy[`${card.id}Desc`]}
      count={total === undefined ? undefined : { value: format(total), label: copy[card.countUnit] }}
      actionLabel={copy.openPage}
    >
      {strip.length || facts.length ? (
        <HubStack>
          <HubMediaStrip items={strip} variant={card.wideStrip ? 'wide' : undefined} />
          <HubFacts facts={facts} />
        </HubStack>
      ) : null}
    </SectionHubCard>
  );
}

export function InfoHubView({ summary }: InfoHubViewProps) {
  const { locale } = useI18n();
  const lang = locale;
  const copy = localized(INFO_HUB_COPY, lang);
  const plain = useMemo(() => new Intl.NumberFormat(intlLocale(lang)), [lang]);
  const format = (value: number) => plain.format(value);
  const info = summary?.info;

  return (
    <SectionHubLayout title={copy.heroTitle} gridLabel={copy.sectionsAria}>
      <SimulacraCard
        slots={info?.simulacra ?? null}
        count={info ? { value: format(info.counts.simulacra), label: copy.characters } : undefined}
        serverCounts={info ? { gacha: format(info.counts.simulacra), mmo: format(info.counts.simulacraMmo) } : undefined}
        copy={copy}
        locale={lang}
      />
      {INFO_SECTION_CARDS.map((card) => (
        <InfoSectionCard
          key={card.id}
          card={card}
          preview={info?.[card.id]}
          total={info?.counts[card.id]}
          copy={copy}
          lang={lang}
          format={format}
        />
      ))}
    </SectionHubLayout>
  );
}
