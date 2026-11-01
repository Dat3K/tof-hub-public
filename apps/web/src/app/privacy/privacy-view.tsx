"use client";

import { localizedUi } from '@tof-hub/i18n';
import { type Locale } from '@tof-hub/i18n';
import { EditorialHeader, EditorialSectionHeading } from "@tof-hub/ui";
import React from "react";
import { useI18n } from "@/lib/i18n";
import { GITHUB_ISSUES_URL } from "@/lib/project-links";
import { PRIVACY_COPY } from "./privacy-copy";
import styles from "./privacy.module.css";

export interface PrivacyViewProps {
  initialLocale: Locale;
}

export function PrivacyView({ initialLocale }: PrivacyViewProps) {
  const { locale: activeLocale } = useI18n();
  const lang = activeLocale === "ru" || activeLocale === "en" ? activeLocale : initialLocale;
  const t = localizedUi(PRIVACY_COPY, lang) || PRIVACY_COPY.en;
  const inventory = [
    [t.invAnalyticsTitle, t.invAnalyticsDesc],
    [t.invCookiesTitle, t.invCookiesDesc],
    [t.invSessionTitle, t.invSessionDesc],
    [t.invLogsTitle, t.invLogsDesc],
  ];
  const glance = [
    { key: "device", title: t.glanceDeviceTitle, items: t.glanceDevice },
    { key: "server", title: t.glanceServerTitle, items: t.glanceServer },
  ];

  return (
    <div className="editorial-page editorial-layout editorial-layout--hero">
      <EditorialHeader title={t.heroTitle} description={t.heroSubtitle}>
        <p className={styles.updated}>{t.lastUpdated}</p>
      </EditorialHeader>

      <section aria-label={t.glanceTitle} className={styles.glance}>
        {glance.map((column) => (
          <div key={column.key} className="editorial-card" data-glance={column.key}>
            <h2 className={styles.glanceTitle}>{column.title}</h2>
            <ul className={styles.glanceList}>
              {column.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <aside className="editorial-callout" aria-label={t.secSummaryTitle}>
        <strong>{t.secSummaryTitle}.</strong> {t.summaryIntro}
      </aside>

      <section className="editorial-section" aria-labelledby="privacy-inventory">
        <EditorialSectionHeading id="privacy-inventory" index="01" title={t.secInventoryTitle} />
        <div className="editorial-grid editorial-grid--2">
          {inventory.map(([title, text], index) => (
            <article key={title} className="editorial-card">
              <span className="editorial-card__kicker">{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="editorial-section" aria-labelledby="privacy-contact">
        <EditorialSectionHeading id="privacy-contact" index="02" title={t.secContactTitle} />
        <div className="editorial-grid editorial-grid--2">
          <article className="editorial-card">
            <h3>{t.secExternalTitle}</h3>
            <p>{t.externalDesc}</p>
          </article>
          <article className="editorial-card">
            <h3>{t.secContactTitle}</h3>
            <p>{t.contactDesc}</p>
            <div className="editorial-actions">
              <a
                href={GITHUB_ISSUES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="editorial-button editorial-button--primary"
              >
                {t.contactButton} <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
