"use client";

import { type Locale } from '@tof-hub/i18n';
import Link from "next/link";
import { useEffect } from "react";
import {
  EditorialHeader,
  EditorialMetadata,
  EditorialSectionHeading,
  type EditorialMetadataItem,
} from "@tof-hub/ui";
import { useI18n } from "@/lib/i18n";
import { useVersionStatus } from "@/lib/version-status";
import { scrollToSection } from "@/lib/scroll-to-section";
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from "@/lib/project-links";
import { ABOUT_COPY } from "./about-copy";
import styles from "./about.module.css";

export interface AboutViewProps {
  initialLocale: Locale;
}

export function AboutView({ initialLocale }: AboutViewProps) {
  const { locale } = useI18n();
  const lang = locale === "ru" || locale === "en" ? locale : initialLocale;
  const t = ABOUT_COPY[lang];
  const { status, isLoading } = useVersionStatus();
  useEffect(() => {
    if (isLoading || !window.location.hash) return;
    // Streaming can reveal the page after the browser's initial anchor jump.
    const frame = requestAnimationFrame(() => {
      scrollToSection(document.getElementById(window.location.hash.slice(1)));
    });
    return () => cancelAnimationFrame(frame);
  }, [isLoading]);
  const fallback = isLoading ? "…" : t.unavailable;
  const snapshot: EditorialMetadataItem[] = [
    {
      label: t.version,
      value: status.datasetVersion || fallback,
      emphasis: status.datasetVersion ? "primary" : undefined,
    },
    { label: t.client, value: status.sources.length ? status.sourceBranch[lang] : fallback },
    { label: t.exported, value: status.exportedAt ? status.formattedExportDate[lang] : fallback },
    { label: t.live, value: status.globalVersion || fallback },
  ];
  const navigation = Object.entries(t.navLinks);

  return (
    <article className="editorial-page editorial-layout editorial-layout--hero">
      <EditorialHeader title={t.title} description={t.subtitle}>
        <nav aria-label={t.nav} className={styles.navigation}>
          <span className={styles.navigationLabel}>{t.nav}</span>
          <div className={styles.navigationLinks}>
            {navigation.map(([id, title]) => (
              <a key={id} href={`#${id}`}>
                <span>{title}</span>
                <span aria-hidden="true">↘</span>
              </a>
            ))}
          </div>
        </nav>
      </EditorialHeader>
      <EditorialMetadata id="snapshot" title={t.snapshot} items={snapshot} note={t.snapshotNote} />
      <section id="overview" className="editorial-section">
        <EditorialSectionHeading index="01" title={t.overview} lead={t.intro} />
        <dl className="editorial-grid">
          {t.origins.map((item, index) => (
            <div key={item.title} className="editorial-card">
              <span className="editorial-card__kicker">{String(index + 1).padStart(2, "0")}</span>
              <dt>{item.title}</dt>
              <dd>{item.text}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section id="datasets" className="editorial-section">
        <EditorialSectionHeading index="02" title={t.sectionsTitle} lead={t.sectionsIntro} />
        <div className={styles.groups}>
          {t.groups.map((group) => (
            <section key={group.href} className={styles.group}>
              <h3 className={styles.groupTitle}>
                <Link href={group.href}>
                  {group.title} <span aria-hidden="true">↗</span>
                </Link>
              </h3>
              <div className="editorial-grid editorial-grid--2">
                {group.entries.map((entry) => (
                  <div id={entry.id} key={entry.id} className={`editorial-card ${styles.entry}`}>
                    {entry.id === "bygone" && <span id="seq" className={styles.anchor} />}
                    <h4>
                      <Link href={entry.href}>{entry.title}</Link>
                    </h4>
                    <p>{entry.text}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
      <section id="pipeline" className="editorial-section">
        <span id="discovery" className={styles.anchor} />
        <EditorialSectionHeading index="03" title={t.pipelineTitle} lead={t.pipelineIntro} />
        <ol className="editorial-steps editorial-steps--columns">
          {t.steps.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <section id="live-capture" className="editorial-section">
        <EditorialSectionHeading index="04" title={t.captureTitle} lead={t.captureIntro} />
        <div className={styles.capture}>
          <ol className="editorial-steps">
            {t.captureSteps.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
          <aside className={`editorial-card ${styles.captureFiles}`} aria-label={t.captureFilesTitle}>
            <span className="editorial-card__kicker">{t.captureFilesTitle}</span>
            <ul>
              {t.captureFiles.map((file) => (
                <li key={file.ext}>
                  <code>{file.ext}</code>
                  <Link href={file.href}>{file.text}</Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
        <p className="editorial-callout">{t.captureNote}</p>
      </section>
      <section id="validation" className="editorial-section">
        <span id="principles" className={styles.anchor} />
        <EditorialSectionHeading index="05" title={t.principlesTitle} />
        <dl className="editorial-grid">
          {t.principles.map((item) => (
            <div key={item.title} className="editorial-card">
              <dt>{item.title}</dt>
              <dd>{item.text}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section id="terminology" className="editorial-section">
        <EditorialSectionHeading index="06" title={t.glossaryTitle} />
        <dl className={styles.glossary}>
          {t.glossary.map((item) => (
            <div key={item.title}>
              <dt>
                <code>{item.title}</code>
              </dt>
              <dd>{item.text}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section id="sources" className={`editorial-section ${styles.cta}`}>
        <span id="reproduce" className={styles.anchor} />
        <h2>{t.reproduceTitle}</h2>
        <p>{t.reproduceText}</p>
        <div className="editorial-actions">
          <Link href="/contribute/" className="editorial-button editorial-button--primary">
            {t.help} <span aria-hidden="true">→</span>
          </Link>
          <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="editorial-button">
            {t.code} <span aria-hidden="true">↗</span>
          </a>
          <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer" className="editorial-button">
            {t.source} <span aria-hidden="true">↗</span>
          </a>
        </div>
        <p className={styles.disclaimer}>{t.disclaimer}</p>
      </section>
    </article>
  );
}
