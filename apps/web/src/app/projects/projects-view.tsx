"use client";

import { localizedUi } from '@tof-hub/i18n';
import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
import { EditorialHeader } from "@tof-hub/ui";
import React from "react";
import { useI18n } from "@/lib/i18n";
import { PROJECTS_DATA } from "./projects-data";
import styles from "./projects.module.css";

export interface ProjectsViewProps {
  initialLocale: Locale;
}

const UI_COPY = createLocaleCopies({
  en: {
    heroTitle: "Tower of Fantasy resources",
    heroSubtitle:
      "A curated directory of community databases, wikis, maps, spreadsheets and calculators that pair well with ToF Hub.",
    externalLinkAria: "opens in a new tab",
    categoriesAria: "Resource categories",
    disclaimer:
      "All external projects belong to their respective creators. Links are provided for community convenience.",
  },
  ru: {
    heroTitle: "Ресурсы по Tower of Fantasy",
    heroSubtitle:
      "Подборка баз данных, вики, карт, таблиц и калькуляторов сообщества, которые хорошо дополняют ToF Hub.",
    externalLinkAria: "откроется в новой вкладке",
    categoriesAria: "Категории ресурсов",
    disclaimer:
      "Все сторонние проекты принадлежат их создателям. Ссылки предоставлены для удобства сообщества.",
  },
});

export function ProjectsView({ initialLocale }: ProjectsViewProps) {
  const { locale: activeLocale } = useI18n();
  const lang = activeLocale === "ru" || activeLocale === "en" ? activeLocale : initialLocale;
  const t = localizedUi(UI_COPY, lang) || UI_COPY.en;

  return (
    <div className="editorial-page editorial-layout editorial-layout--hero">
      <EditorialHeader title={t.heroTitle} description={t.heroSubtitle}>
        <nav aria-label={t.categoriesAria} className={styles.jump}>
          <ul className="editorial-chips">
            {PROJECTS_DATA.map((category) => (
              <li key={category.id}>
                <a
                  href={`#${category.id}`}
                  className={`editorial-chip ${styles.categoryChip}`}
                  style={{ "--accent": category.color } as React.CSSProperties}
                >
                  {localizedUi(category.title, lang)}
                  <span className={styles.count}>{category.resources.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </EditorialHeader>

      <div className={styles.categories}>
        {PROJECTS_DATA.map((category) => (
          <section
            key={category.id}
            id={category.id}
            aria-labelledby={`${category.id}-title`}
            className={styles.category}
            style={{ "--accent": category.color } as React.CSSProperties}
          >
            <h2 id={`${category.id}-title`} className={styles.categoryTitle}>
              {localizedUi(category.title, lang)}
              <span className={styles.count}>{category.resources.length}</span>
            </h2>
            <ul className={styles.list}>
              {category.resources.map((item) => (
                <li key={item.url}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${item.name} (${t.externalLinkAria})`}
                    className={`editorial-resource ${styles.resource}`}
                  >
                    <span className={styles.head}>
                      <h3 className={styles.name}>{item.name}</h3>
                      <span className="editorial-tag">{item.type}</span>
                    </span>
                    <p className={styles.description}>{localizedUi(item.description, lang)}</p>
                    <span className={styles.url}>
                      <span>{item.displayUrl}</span>
                      <span aria-hidden="true" className={styles.arrow}>↗</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className={`editorial-callout ${styles.disclaimer}`}>{t.disclaimer}</p>
    </div>
  );
}
