'use client';

import { localeText } from '@/lib/i18n/text';

import React, { useEffect, useState } from 'react';
import { useLocale } from '@/lib/i18n';
import type { WishTallyData } from '@tof-hub/game-domain';
import { EmptyState, LoadingState } from '@tof-hub/ui';
import { ErrorState } from '@/components/site-shell';
import { WishHeader } from '../components/wish-header';
import { TallyBannerSelector } from './components/tally-banner-selector';
import { TallyKpiCards } from './components/tally-kpi-cards';
import { TallyPityDistributionChart } from './components/tally-pity-distribution-chart';
import { TallyItemBreakdownTable } from './components/tally-item-breakdown-table';
import { TallyComparisonTable } from './components/tally-comparison-table';

export function WishTallyView() {
  const { locale } = useLocale();

  const [tallyBanners, setTallyBanners] = useState<WishTallyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedBannerId, setSelectedBannerId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(false);
    fetch('/api/v1/wish/tally', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Community tally request failed');
        return response.json() as Promise<{ success: boolean; data: { banners: WishTallyData[] } }>;
      })
      .then(({ data }) => {
        if (cancelled) return;
        const banners = Array.isArray(data?.banners) ? data.banners : [];
        setTallyBanners(banners);
        setSelectedBannerId((current) => banners.some((banner) => banner.banner.id === current)
          ? current
          : banners[0]?.banner.id ?? '');
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [attempt]);

  const tallyData = tallyBanners.find((item) => item.banner.id === selectedBannerId) ?? tallyBanners[0] ?? null;

  const handleSelectBanner = (bannerId: string) => {
    setSelectedBannerId(bannerId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className="info-ui min-h-screen bg-[#0b0d13] text-[#d7d0dd] px-4 py-6 md:px-8 max-w-7xl mx-auto space-y-8"
      suppressHydrationWarning
    >
      <WishHeader locale={locale} page="tally" />
      
      {isLoading ? (
        <LoadingState message={localeText(locale)('Loading real community data…', 'Загружаем реальные данные сообщества…')} />
      ) : loadError ? (
        <ErrorState
          title={localeText(locale)('Statistics unavailable', 'Статистика недоступна')}
          message={localeText(locale)('Could not load community statistics.', 'Не удалось загрузить статистику сообщества.')}
          onRetry={() => setAttempt((value) => value + 1)}
          retryLabel={localeText(locale)('Try again', 'Повторить')}
          homeHref="/tools/wish/"
          homeLabel={localeText(locale)('Back to Wish Tracker')}
        />
      ) : !tallyData ? (
        <EmptyState
          title={localeText(locale)('No real data yet')}
          description={localeText(locale)('Community summaries will appear after players upload their wish histories.', 'Здесь появятся сводки после загрузки игроками своих историй круток.')}
        />
      ) : (
      <>
      {/* 1. Category Filter, Banner Cards, and Hero Card */}
      <TallyBannerSelector
        selectedBannerId={selectedBannerId}
        onSelectBannerId={handleSelectBanner}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        banner={tallyData.banner}
        summary={tallyData.summary}
        allSummaries={tallyData.all_banner_summaries}
        locale={locale}
      />

      {/* 2. Global KPIs (Total Wishes, Total SSR & Rate, Avg Pity, 50/50 Win Rate, Total SR, Avg SR Pity) */}
      <TallyKpiCards
        summary={tallyData.summary}
        locale={locale}
      />

      {/* 3. The Iconic Pity Distribution Bar Chart (1..80 / 1..40) */}
      <TallyPityDistributionChart
        distribution={tallyData.pity_distribution}
        bannerType={tallyData.summary.banner_type}
        totalSsr={tallyData.summary.total_ssr}
        locale={locale}
      />

      {/* 4. Item Breakdown Table (SSRs & SRs) */}
      <TallyItemBreakdownTable
        ssrDrops={tallyData.ssr_drops}
        srDrops={tallyData.sr_drops}
        locale={locale}
      />

      {/* 5. All Banners Comparison Table */}
      <TallyComparisonTable
        banners={tallyData.all_banner_summaries}
        activeBannerId={selectedBannerId}
        onSelectBanner={handleSelectBanner}
        locale={locale}
      />
      </>
      )}
    </div>
  );
}
