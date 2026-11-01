'use client';

import { localizedUi } from '@tof-hub/i18n';
import React from 'react';
import { INFO_NAV_ITEMS, TOOLS_NAV_ITEMS, DATAMINE_NAV_ITEMS } from '@/components/site-shell/site-navigation';
import { useI18n } from '@/lib/i18n';
import { en, ru } from '@tof-hub/i18n';
import { HubCard } from './hub-card';
import { MAIN_HUB_CARDS } from './constants';
import type { HubSectionId } from './types';
import type { VersionTracker as TrackerData } from '@tof-hub/contracts';
import { MAIN_COPY } from './copy';
import { VersionTracker } from './version-tracker';
import styles from './main-hub.module.css';

export interface MainHubArt { art: Record<HubSectionId, string | null> }

const SHORTCUTS = {info: INFO_NAV_ITEMS, tools: TOOLS_NAV_ITEMS, datamine: DATAMINE_NAV_ITEMS};

export function MainHubView({art, tracker}: {art?: MainHubArt | null; tracker?: TrackerData | null}) {
  const { locale, t } = useI18n();
  const currentLocale = locale;
  const dict = currentLocale === 'ru' ? ru.hub : en.hub;

  const copy = localizedUi(MAIN_COPY, currentLocale);

  return (
    <div className={styles.layout}>
      <h1 className="sr-only">{t('hub.heroTitle', { defaultValue: dict.heroTitle })}</h1>

      <div className={styles.columns}>
      <section
        className={styles.hubs}
        aria-label={t('hub.sectionsAria', { defaultValue: dict.sectionsAria })}
      >
        {MAIN_HUB_CARDS.map((config) => <HubCard key={config.id} card={{
          ...config, code: copy[config.id].title, badge: '', title: copy[config.id].title,
          description: copy[config.id].description, actionText: copy.open,
        }} art={art?.art[config.id]} shortcuts={SHORTCUTS[config.id].map((item) => ({href: `${item.href}/`, label: localizedUi(item.label, currentLocale)}))} />)}
      </section>
      <aside className={styles.rail}>
        <VersionTracker initial={tracker ?? null} locale={currentLocale} />
      </aside>
      </div>
    </div>
  );
}
