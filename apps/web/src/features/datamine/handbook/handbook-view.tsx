'use client';

import { localized } from '@tof-hub/i18n';
import { type Locale } from '@tof-hub/i18n';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, setStoredServerMode, Tabs, TabsContent, TabsList, TabsTrigger } from '@tof-hub/ui';
import { PillSwitcher } from '@/components/pill-switcher/pill-switcher';
import { RouteLoading } from '@/components/site-shell/route-loading';
import { useI18n } from '@/lib/i18n';
import type { HandbookMode, HandbookSectionId, HandbookSectionState, HandbookSectionsData } from '../contracts/handbook';
import { RandomStatsSection } from './sections/random-stats-section';
import { TitanSection } from './sections/titan-section';
import { EnhancementSection } from './sections/enhancement-section';
import { SupercomputerSection, SuppressorSection } from './sections/progression-sections';
import { SpaceSupportSection } from './sections/space-support-section';
import { CsSection, ServersSection } from './sections/reference-sections';
import { FormulasSection } from './sections/formulas-section';
import { MmoBrainfieldSection } from './sections/mmo-brainfield-section';
import { MmoExpansionSection } from './sections/mmo-expansion-section';
import { HandbookSectionProvider } from './sections/handbook-ui';
import { SourceInfo } from './handbook-sources';
import { HandbookStatPresentation } from './handbook-stat-presentation';
import { HANDBOOK_COPY, type HandbookCopy } from './handbook-copy';
import { handbookHref, handbookSectionFromHash, legacyHandbookDestination } from './handbook-sections';
import styles from './handbook.module.css';

export interface HandbookViewProps {
  mode: HandbookMode;
  /** Sections visible in `mode`, in page order. */
  sections: HandbookSectionState[];
  /** Section payloads for `mode`. */
  data: HandbookSectionsData;
}

function sectionContent(id: HandbookSectionId, data: HandbookSectionsData, sourceAction?: React.ReactNode): React.ReactNode {
  switch (id) {
    case 'random-stats': return data['random-stats'] && <RandomStatsSection data={data['random-stats']} />;
    case 'expansion': return data.expansion && <MmoExpansionSection data={data.expansion} sourceAction={sourceAction} />;
    case 'titan': return data.titan && <TitanSection data={data.titan} />;
    case 'cs': return data.cs && <CsSection data={data.cs} />;
    case 'enhancement': return data.enhancement && <EnhancementSection data={data.enhancement} />;
    case 'supercomputer': return data.supercomputer && <SupercomputerSection data={data.supercomputer} />;
    case 'suppressor': return data.suppressor && <SuppressorSection data={data.suppressor} />;
    case 'brainfield': return data.brainfield && <MmoBrainfieldSection data={data.brainfield} />;
    case 'space-support': return data['space-support'] && <SpaceSupportSection data={data['space-support']} />;
    case 'combat-formulas': return data['combat-formulas'] && <FormulasSection data={data['combat-formulas']} />;
    case 'servers': return data.servers && <ServersSection data={data.servers} />;
  }
}

function HandbookSection({ state, copy, locale, children }: { state: HandbookSectionState; copy: HandbookCopy; locale: Locale; children?: React.ReactNode }) {
  const text = copy.sections[state.id];
  const titleId = `${state.id}-title`;
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      {/* Titles live in the tab bar; headings stay for screen readers and the "?" sits in the corner. */}
      <h2 id={titleId} className="sr-only">{text.title}</h2>
      {state.id !== 'expansion' && <header className={styles.sectionHeader}>
        {state.available && state.sources.length > 0 && (
          <SourceInfo id={state.id} sources={state.sources} copy={copy} locale={locale} />
        )}
      </header>}
      {state.available
        ? children
        : <EmptyState title={copy.unavailableTitle} description={copy.unavailableBody} className={styles.empty} />}
    </section>
  );
}

export function HandbookView({ mode, sections, data }: HandbookViewProps) {
  const { locale } = useI18n();
  const copy = localized(HANDBOOK_COPY, locale);
  const router = useRouter();
  const ids = React.useMemo(() => sections.map((section) => section.id), [sections]);
  // The server cannot see the hash. Keep its loading state until the browser selects the real section.
  const [active, setActive] = useState<HandbookSectionId | null>(null);
  const nav = useRef<HTMLDivElement>(null);
  const current = active && ids.includes(active) ? active : ids[0]!;

  // #section selects its tab; a tab missing in this mode (#titan with ?server=mmo) falls back to the first one.
  useEffect(() => {
    const select = () => {
      const destination = legacyHandbookDestination(window.location.hash);
      if (destination) {
        const url = new URL(destination, window.location.origin);
        const lang = new URL(window.location.href).searchParams.get('lang');
        if (lang) url.searchParams.set('lang', lang);
        router.replace(`${url.pathname}${url.search}`, { scroll: false });
        return;
      }
      const target = handbookSectionFromHash(window.location.hash);
      if (target && ids.includes(target.id)) setActive(target.id);
      else {
        if (target) window.history.replaceState(window.history.state, '', handbookHref(mode));
        setActive(ids[0]!);
      }
    };
    select();
    window.addEventListener('hashchange', select);
    return () => window.removeEventListener('hashchange', select);
  }, [ids, mode, router]);

  // Keep the selected tab inside the horizontally scrolling list (mobile) without scrolling the page.
  useEffect(() => {
    const scroller = nav.current;
    const tab = scroller?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!scroller || !tab) return;
    const left = tab.offsetLeft - scroller.offsetLeft;
    if (left < scroller.scrollLeft || left + tab.offsetWidth > scroller.scrollLeft + scroller.clientWidth)
      scroller.scrollTo({ left: Math.max(0, left - 16), behavior: 'auto' });
  }, [current]);

  const selectTab = (id: string) => {
    setActive(id as HandbookSectionId);
    window.history.replaceState(window.history.state, '', handbookHref(mode, `#${id}`));
  };

  const changeMode = (next: HandbookMode) => {
    setStoredServerMode(next);
    // Keeps the sub-tab (#section/sub) when the section exists in the new mode.
    if (next !== mode) router.replace(handbookHref(next, window.location.hash || `#${current}`), { scroll: false });
  };

  if (active === null) return <RouteLoading />;

  return (
    <HandbookStatPresentation data={data}><div className={styles.page}>
      <h1 className="sr-only">{copy.title}</h1>

      <Tabs value={current} onValueChange={selectTab}>
        <div className={styles.toolbar} data-handbook-toolbar>
          <div ref={nav} className={styles.nav}>
            <TabsList variant="pills" aria-label={copy.navAria} className={styles.tabList}>
              {sections.map((section) => (
                <TabsTrigger key={section.id} value={section.id} className={styles.tab}>
                  {copy.sections[section.id].nav}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <PillSwitcher
            mode={mode === 'mmo' ? 'mmo' : 'standard'}
            onChange={(next) => changeMode(next === 'mmo' ? 'mmo' : 'gacha')}
            originalLabel={copy.gachaLabel}
            mmoLabel={copy.mmoLabel}
            ariaLabel={copy.modeAria}
            className={styles.mode}
          />
        </div>

        {/* Keyed by mode so selections reset to the new mode's data. */}
        {sections.map((section) => (
          <TabsContent key={`${mode}-${section.id}`} value={section.id} className={styles.panel}>
            <HandbookSection state={section} copy={copy} locale={locale}>
              <HandbookSectionProvider value={section.id}>{sectionContent(section.id, data,
                section.id === 'expansion' && section.available && section.sources.length > 0
                  ? <SourceInfo id={section.id} sources={section.sources} copy={copy} locale={locale} portal /> : undefined
              )}</HandbookSectionProvider>
            </HandbookSection>
          </TabsContent>
        ))}
      </Tabs>
    </div></HandbookStatPresentation>
  );
}
