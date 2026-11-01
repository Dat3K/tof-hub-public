'use client';

import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import React, { useState } from 'react';
import { ToolRail, RailGlyph } from '@/components/tool-rail/tool-rail';
import { CaptureAppModal } from '@/components/tool-rail/capture-app-modal';
import { WISH_TRANSLATIONS, type WishLocale } from '../wish-i18n';
import { RulesModal } from './rules-modal';
import type { WishTab } from '../types';

type WishHeaderProps = {
  locale: WishLocale;
  appRequest?: number;
  onImport?: () => void;
  importing?: boolean;
} & (
  { page: 'tracker'; activeTab: WishTab; onTabChange: (tab: WishTab) => void; onFocusBanner?: () => void }
  | { page: 'tally' | 'players'; activeTab?: never; onTabChange?: never }
);

export function WishHeader(props: WishHeaderProps) {
  const { locale, page, onImport, importing } = props;
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isAppOpen, setIsAppOpen] = useState(false);
  React.useEffect(()=>{if(props.appRequest)setIsAppOpen(true);},[props.appRequest]);
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;
  const isTrackerActive = page === 'tracker' && props.activeTab !== 'simulation';
  const isSimulationActive = page === 'tracker' && props.activeTab === 'simulation';
  const tracker = page === 'tracker' ? props : null;

  return (
    <>
      <ToolRail
        label={t.pageTitle}
        title={page === 'tally' ? t.navWishTally : page === 'players' ? t.tabDevPanel : t.pageTitle}
        items={[
          {
            id: 'import',
            label: importing
              ? (localeText(locale)('Importing…', 'Импорт…'))
              : (localeText(locale)('Import pulls')),
            icon: <RailGlyph name="import" />,
            onClick: onImport,
            tone: 'accent',
            disabled: importing,
          },
          { id: 'app', label: localeText(locale)('Capture app'), icon: <RailGlyph name="download" />, onClick: () => setIsAppOpen(true) },
          ...(tracker?.onFocusBanner && isTrackerActive
            ? [{ id: 'banner-focus', label: localeText(locale)('Go to banner', 'К баннеру'), icon: <RailGlyph name="equipment" />, onClick: tracker.onFocusBanner }]
            : []),
          tracker
            ? { id: 'history', label: t.navWishCounter, icon: <RailGlyph name="history" />, onClick: () => tracker.onTabChange('overview'), active: isTrackerActive, tone: 'gold' }
            : { id: 'history', label: t.navWishCounter, icon: <RailGlyph name="history" />, href: '/tools/wish/' },
          tracker
            ? { id: 'simulation', label: t.tabSimulation, icon: <RailGlyph name="simulation" />, onClick: () => tracker.onTabChange('simulation'), active: isSimulationActive, tone: 'sky' }
            : { id: 'simulation', label: t.tabSimulation, icon: <RailGlyph name="simulation" />, href: '/tools/wish/?tab=simulation' },
          { id: 'rules', label: t.rulesBtn, icon: <RailGlyph name="rules" />, onClick: () => setIsRulesOpen(true) },
        ]}
      />
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} locale={locale} />
      <CaptureAppModal
        isOpen={isAppOpen}
        onClose={() => setIsAppOpen(false)}
        locale={locale}
        upload={{
          label: localeText(locale)('Import .tofwish'),
          onClick: onImport
            ? () => {
                setIsAppOpen(false);
                onImport();
              }
            : undefined,
        }}
      />
    </>
  );
}
