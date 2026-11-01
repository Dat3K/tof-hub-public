"use client";

import { type Locale } from '@tof-hub/i18n';
import { EditorialHeader } from "@tof-hub/ui";
import Link from "next/link";
import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { EXPORTER_DOWNLOAD_URL, GITHUB_ISSUES_URL } from "@/lib/project-links";
import { CONTRIBUTE_COPY } from "./contribute-copy";
import styles from "./contribute.module.css";

export interface ContributeViewProps {
  initialLocale: Locale;
}

type TabType = "regular" | "multype" | "corrections";

const FEEDBACK_HREF = "/feedback/";

export function ContributeView({ initialLocale }: ContributeViewProps) {
  const { locale: activeLocale } = useI18n();
  const lang = activeLocale === "ru" || activeLocale === "en" ? activeLocale : initialLocale;
  const t = CONTRIBUTE_COPY[lang] || CONTRIBUTE_COPY.en;

  const [activeTab, setActiveTab] = useState<TabType>("regular");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const syncHashToTab = useCallback(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.toLowerCase();
    if (hash === "#multype") {
      setActiveTab("multype");
    } else if (hash === "#corrections" || hash === "#builder") {
      setActiveTab("corrections");
    } else if (hash === "#regular") {
      setActiveTab("regular");
    }
  }, []);

  useEffect(() => {
    syncHashToTab();
    window.addEventListener("hashchange", syncHashToTab);
    return () => window.removeEventListener("hashchange", syncHashToTab);
  }, [syncHashToTab]);

  const selectTab = (tab: TabType) => {
    setActiveTab(tab);
    if (typeof window !== "undefined" && window.history?.replaceState) {
      window.history.replaceState(null, "", `#${tab}`);
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const tabs: { id: TabType; label: string; sub: string }[] = [
    { id: "regular", label: t.tabRegular, sub: t.tabRegularSub },
    { id: "multype", label: t.tabMultype, sub: t.tabMultypeSub },
    { id: "corrections", label: t.tabCorrections, sub: t.tabCorrectionsSub },
  ];

  const codeLine = (code: string, key: string, label?: string) => (
    <div className="editorial-code">
      <code>
        {label && <span className="editorial-code__label">{label}</span>}
        {code}
      </code>
      <button type="button" onClick={() => handleCopy(code, key)} className="editorial-copy">
        {copiedKey === key ? `✓ ${t.copied}` : t.copy}
      </button>
    </div>
  );

  const panelHead = (title: string, badge: string, intro: string) => (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-text-strong">{title}</h2>
        <span className="editorial-tag">{badge}</span>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-text-body">{intro}</p>
    </>
  );

  return (
    <div className="editorial-page editorial-layout editorial-layout--hero">
      <EditorialHeader title={t.heroTitle} description={t.heroSubtitle}>
        {/* Workflow Tabs */}
        <div className={`editorial-tabs ${styles.tabs}`} role="tablist" aria-label={t.tabsAria}>
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`contribute-${tab.id}-tab`}
              aria-controls={tab.id}
              aria-selected={activeTab === tab.id}
              onClick={() => selectTab(tab.id)}
              className={`editorial-tab ${styles.tab}`}
            >
              <span className={styles.tabIndex} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={styles.tabLabel}>{tab.label}</span>
              <span className={styles.tabSub}>{tab.sub}</span>
            </button>
          ))}
        </div>
      </EditorialHeader>

      {activeTab === "regular" && (
        <section
          id="regular"
          role="tabpanel"
          aria-labelledby="contribute-regular-tab"
          className={`editorial-panel ${styles.panel}`}
        >
          {panelHead(t.regularTitle, t.regularBadge, t.regularIntro)}
          <ol className={`editorial-steps ${styles.steps}`}>
            <li>
              <h3>{t.regularStep1Title}</h3>
              <p>{t.regularStep1Desc}</p>
              {EXPORTER_DOWNLOAD_URL ? (
                <div className="editorial-actions">
                  <a
                    href={EXPORTER_DOWNLOAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="editorial-button editorial-button--primary"
                  >
                    {t.regularStep1Download} <span aria-hidden="true">↗</span>
                  </a>
                </div>
              ) : (
                <span className={`editorial-chip ${styles.pending}`}>{t.regularStep1Link}</span>
              )}
            </li>
            <li>
              <h3>{t.regularStep2Title}</h3>
              <p>{t.regularStep2Desc}</p>
              {codeLine(t.regularStep2Code, "regular")}
            </li>
            <li>
              <h3>{t.regularStep3Title}</h3>
              <p>{t.regularStep3Desc}</p>
            </li>
          </ol>
        </section>
      )}

      {activeTab === "multype" && (
        <section
          id="multype"
          role="tabpanel"
          aria-labelledby="contribute-multype-tab"
          className={`editorial-panel ${styles.panel}`}
        >
          {panelHead(t.multypeTitle, t.multypeBadge, t.multypeIntro)}
          <ol className={`editorial-steps ${styles.steps}`}>
            <li>
              <h3>{t.multypeStep1Title}</h3>
              <p>{t.multypeStep1Desc}</p>
              {t.multypeAesKey ? codeLine(t.multypeAesKey, "aes", t.aesLabel) : null}
            </li>
            <li>
              <h3>{t.multypeStep2Title}</h3>
              <p>{t.multypeStep2Desc}</p>
              <div className="editorial-actions">
                <a
                  href="https://github.com/smilekritik/Tower-of-fantasy-exporter-scanner"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="editorial-button"
                >
                  {t.multypeStep2Link} <span aria-hidden="true">↗</span>
                </a>
              </div>
            </li>
            <li>
              <h3>{t.multypeStep3Title}</h3>
              <p>{t.multypeStep3Desc}</p>
              {codeLine(t.multypeStep3Code, "scanner")}
            </li>
            <li>
              <h3>{t.multypeStep4Title}</h3>
              <p>{t.multypeStep4Desc}</p>
            </li>
          </ol>
        </section>
      )}

      {activeTab === "corrections" && (
        <section
          id="corrections"
          role="tabpanel"
          aria-labelledby="contribute-corrections-tab"
          className={`editorial-panel ${styles.panel}`}
        >
          {panelHead(t.correctionsTitle, t.correctionsBadge, t.correctionsIntro)}
          <div className="editorial-grid editorial-grid--2 mt-6">
            <article className="editorial-card">
              <span className="editorial-card__kicker">{t.channelFeedbackKicker}</span>
              <h3>{t.channelFeedbackTitle}</h3>
              <p>{t.channelFeedbackDesc}</p>
              <div className="editorial-actions">
                <Link href={FEEDBACK_HREF} className="editorial-button editorial-button--primary">
                  {t.channelFeedbackButton}
                </Link>
              </div>
            </article>
            <article className="editorial-card">
              <span className="editorial-card__kicker">{t.channelGithubKicker}</span>
              <h3>{t.channelGithubTitle}</h3>
              <p>{t.channelGithubDesc}</p>
              <div className="editorial-actions">
                <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer" className="editorial-button">
                  {t.submitButton} <span aria-hidden="true">↗</span>
                </a>
              </div>
            </article>
          </div>
          <h3 className="mt-8 text-sm font-semibold text-gold">{t.guidanceTitle}</h3>
          <div className="editorial-grid mt-4">
            {[
              [t.guidance1Q, t.guidance1A],
              [t.guidance2Q, t.guidance2A],
              [t.guidance3Q, t.guidance3A],
            ].map(([question, answer]) => (
              <article key={question} className="editorial-card">
                <h3>{question}</h3>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Reporting Checklist (Visible across all tabs) */}
      <section
        className={`editorial-section ${styles.checklist}`}
        aria-labelledby="contribute-checklist"
      >
        <div>
          <h2 id="contribute-checklist" className="text-lg font-semibold text-text-strong">
            {t.checklistTitle}
          </h2>
          <p className="mt-1 text-sm text-text-muted">{t.checklistSubtitle}</p>
        </div>
        <ul className={styles.checklistItems}>
          {t.checklistItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {/* The Fix data panel already shows both report channels. */}
        {activeTab !== "corrections" && (
          <div className={styles.submit}>
            <span>{t.submitText}</span>
            <div className="editorial-actions">
              <Link href={FEEDBACK_HREF} className="editorial-button editorial-button--primary">
                {t.channelFeedbackButton}
              </Link>
              <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer" className="editorial-button">
                {t.submitButton} <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
