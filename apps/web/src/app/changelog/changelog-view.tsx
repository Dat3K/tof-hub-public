"use client";

import { localizedUi } from '@tof-hub/i18n';
import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
import React, { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { CHANGELOG_DATA, type ChangelogChange } from "./changelog-data";
import styles from "./changelog.module.css";

export interface ChangelogViewProps {
  initialLocale: Locale;
}

const UI_COPY = createLocaleCopies({
  en: {
    filterAll: "All Updates",
    filtersAria: "Filter by section",
    tagUi: "UI",
    tagFeature: "Feature",
    tagData: "Data",
    tagFix: "Fix",
    releasesTitle: "Update history",
    emptyNotice: "No changelog entries match the selected filter.",
  },
  ru: {
    filterAll: "Все обновления",
    filtersAria: "Фильтр по разделам",
    tagUi: "Интерфейс",
    tagFeature: "Нововведение",
    tagData: "Данные",
    tagFix: "Исправление",
    releasesTitle: "История обновлений",
    emptyNotice: "Нет записей, соответствующих выбранному фильтру.",
  },
});

const TAG_LABEL_KEYS: Record<ChangelogChange["tag"], "tagUi" | "tagFeature" | "tagData" | "tagFix"> = {
  UI: "tagUi",
  FEATURE: "tagFeature",
  DATA: "tagData",
  FIX: "tagFix",
};

export function ChangelogView({ initialLocale }: ChangelogViewProps) {
  const { locale: activeLocale } = useI18n();
  const lang = activeLocale === "ru" || activeLocale === "en" ? activeLocale : initialLocale;
  const t = UI_COPY[lang] || UI_COPY.en;
  const [selectedSection, setSelectedSection] = useState<string>("all");

  const allSections = useMemo(() => {
    const set = new Set<string>();
    CHANGELOG_DATA.forEach((rel) => {
      rel.changes.forEach((ch) => set.add(ch.section));
    });
    return Array.from(set).sort();
  }, []);

  const filteredReleases = useMemo(() => {
    if (selectedSection === "all") return CHANGELOG_DATA;
    return CHANGELOG_DATA.map((rel) => {
      const matchingChanges = rel.changes.filter((ch) => ch.section === selectedSection);
      if (matchingChanges.length === 0) return null;
      return { ...rel, changes: matchingChanges };
    }).filter(Boolean) as typeof CHANGELOG_DATA;
  }, [selectedSection]);

  return (
    <div className="editorial-page editorial-layout">
      <section className={styles.releases} aria-labelledby="changelog-releases">
        <div className="editorial-section__head">
          <h1 id="changelog-releases" className={styles.title}>{t.releasesTitle}</h1>
        </div>
        {/* Section Filter Pills */}
        <div className="editorial-filters" role="group" aria-label={t.filtersAria}>
          <button
            type="button"
            onClick={() => setSelectedSection("all")}
            aria-pressed={selectedSection === "all"}
            className="editorial-filter"
          >
            {t.filterAll}
          </button>
          {allSections.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setSelectedSection(sec)}
              aria-pressed={selectedSection === sec}
              className="editorial-filter"
            >
              {sec}
            </button>
          ))}
        </div>

        {filteredReleases.length === 0 ? (
          <div className="editorial-panel mt-8 p-8 text-center text-sm text-text-muted">
            {t.emptyNotice}
          </div>
        ) : (
          <ol className={styles.timeline}>
            {filteredReleases.map((release, index) => (
              <li key={release.version} className={styles.release} data-latest={index === 0 || undefined} data-history={release.label ? true : undefined}>
                <div className={styles.releaseMeta}>
                  <span className={styles.version}>{release.label ? localizedUi(release.label, lang) : `v${release.version}`}</span>
                  <time className={styles.date}>{release.date}</time>
                  <span className={styles.client}>{lang === "ru" ? release.clientRu : release.client}</span>
                </div>
                <article className={`editorial-panel ${styles.releaseBody}`}>
                  <p className={styles.summary}>{localizedUi(release.summary, lang) || release.summary.en}</p>
                  <ul className={styles.changes}>
                    {release.changes.map((item, idx) => (
                      <li key={idx} data-changelog-section={item.section} className="editorial-change">
                        <div className={styles.changeMeta}>
                          <span className={styles.tag} data-tag={item.tag}>
                            {t[TAG_LABEL_KEYS[item.tag]]}
                          </span>
                          <span className={styles.section}>{item.section}</span>
                        </div>
                        <p className={styles.changeText}>{localizedUi(item.text, lang) || item.text.en}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
