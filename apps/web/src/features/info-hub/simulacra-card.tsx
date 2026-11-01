'use client';

import { type Locale } from '@tof-hub/i18n';
import React, { useState } from 'react';
import Link from 'next/link';
import { ModeSwitcher } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import { HubChipLinks, HubFacts, HubStack, SectionHubCard, useHubHover, type HubChipLink } from '@/components/section-hub';
import { hubText, type HubSimulacrumSlot } from '@/lib/hub-summary';
import { ELEMENT_FILTER_OPTIONS } from '@/features/simulacra/constants';
import { getSimulacraStrings } from '@/features/simulacra/copy';
import type { InfoHubStrings } from './types';
import styles from './info-hub.module.css';

type ServerMode = 'gacha' | 'mmo';

export interface SimulacraCardProps {
  slots: Record<ServerMode, HubSimulacrumSlot[]> | null;
  count: { value: string; label: string } | undefined;
  /** Formatted roster sizes per server. */
  serverCounts?: Record<ServerMode, string>;
  copy: InfoHubStrings;
  locale: Locale;
}

const SLOT_LABEL: Record<HubSimulacrumSlot['slot'], keyof InfoHubStrings> = {
  latest: 'slotLatest',
  previous: 'slotPrevious',
  altered: 'slotAltered',
  earlier: 'slotEarlier',
};

const ROLE_LABEL = { DPS: 'filterDps', Tank: 'filterTank', Benediction: 'filterBene' } as const;

const elementOption = (element: string | null) =>
  ELEMENT_FILTER_OPTIONS.find((option) => option.id === element?.toLowerCase());

export function SimulacraCard({ slots, count, serverCounts, copy, locale }: SimulacraCardProps) {
  const [mode, setMode] = useState<ServerMode>('gacha');
  // Roster tile under the pointer or keyboard focus; its art replaces the latest release behind the card.
  const hover = useHubHover<string>();
  const strings = getSimulacraStrings(locale);
  const roster = slots?.[mode] ?? [];
  const artEntry = roster.find((entry) => entry.slug === hover.hovered) ?? roster[0];
  const art = artEntry?.portrait ?? null;
  const serverQuery = mode === 'mmo' ? 'server=mmo&' : '';

  const aside = (
    <div className={styles.rosterAside}>
      {slots?.mmo.length ? (
        <ModeSwitcher
          presentation="standalone"
          value={mode}
          onChange={(next) => {
            setMode(next);
            hover.reset();
          }}
          ariaLabel={copy.serverMode}
          options={[
            { value: 'gacha', label: copy.gacha, tone: 'orange' },
            { value: 'mmo', label: copy.mmo, tone: 'rose' },
          ]}
        />
      ) : null}
      <ul className={styles.roster} {...hover.list}>
        {roster.map((entry) => {
          const element = elementOption(entry.element);
          const elementIcon = entry.elementIcon ?? element?.iconPath ?? null;
          const role = entry.role && entry.role in ROLE_LABEL ? strings[ROLE_LABEL[entry.role as keyof typeof ROLE_LABEL]] : entry.role;
          const when = entry.season ? `${copy.mmoSeason} ${entry.season}` : null;
          return (
            <li key={entry.slug}>
              <Link
                href={`/info/simulacra/?${serverQuery}char=${encodeURIComponent(entry.slug)}`}
                className={styles.rosterItem}
                data-slot={entry.slot}
                data-art={entry.slug === artEntry?.slug || undefined}
                {...hover.item(entry.slug)}
              >
                <span className={styles.rosterAvatar}>
                  {entry.avatar ? <img src={gameAsset(entry.avatar)} alt="" loading="lazy" decoding="async" /> : null}
                </span>
                <span className={styles.rosterInfo}>
                  <span className={styles.rosterSlot}>
                    {copy[SLOT_LABEL[entry.slot]] as string}
                    {when ? <span className={styles.rosterWhen}>{when}</span> : null}
                  </span>
                  <span className={styles.rosterName}>{hubText(entry.name, locale)}</span>
                  <span className={styles.rosterWeapon}>{hubText(entry.weapon, locale)}</span>
                  <span className={styles.rosterMeta}>
                    {elementIcon ? <img src={gameAsset(elementIcon)} alt="" /> : null}
                    <span>{element ? strings[element.copyKey] : entry.element}</span>
                    {role ? <span>· {role}</span> : null}
                  </span>
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
      id="simulacra"
      href="/info/simulacra/"
      title={copy.simulacraTitle}
      description={copy.simulacraDesc}
      count={count}
      actionLabel={copy.openPage}
      featured
      backgroundArt={art ? gameAsset(art) : null}
      backgroundArtPlacement="feature"
      aside={aside}
    >
      <HubStack>
      {serverCounts ? (
        <HubFacts
          facts={[
            { key: 'gacha', value: serverCounts.gacha, label: `${copy.gacha} · ${copy.characters}` },
            { key: 'mmo', value: serverCounts.mmo, label: `${copy.mmo} · ${copy.characters}` },
          ]}
        />
      ) : null}
      <HubChipLinks
        items={ELEMENT_FILTER_OPTIONS.filter((option) => option.iconPath).map((option) => ({
          id: option.id,
          href: `/info/simulacra/?${serverQuery}elem=${option.id}`,
          label: strings[option.copyKey],
          icon: option.iconPath,
          tone: option.variant as HubChipLink['tone'],
        }))}
      />
      </HubStack>
    </SectionHubCard>
  );
}
