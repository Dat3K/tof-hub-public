'use client';

import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import React from 'react';
import type { WishAnalyticsDto } from '@tof-hub/contracts';
import { WISH_TRANSLATIONS, type WishLocale } from '../../wish-i18n';
import type { BannerKind } from '../../types';
import { getWinRateColor } from '../../wish-luck-color';

interface AnalyticsTabProps {
  analytics: WishAnalyticsDto;
  weaponAnalytics: WishAnalyticsDto;
  matrixAnalytics: WishAnalyticsDto;
  activeBannerId: string;
  activeKind: BannerKind;
  locale: WishLocale;
}

export function AnalyticsTab({
  analytics,
  weaponAnalytics,
  matrixAnalytics,
  activeBannerId,
  activeKind,
  locale,
}: AnalyticsTabProps) {
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;
  const isAllBanners = activeBannerId === 'all';

  const fmtPct = (val: number) => `${val.toFixed(2)}%`;

  const intervalEntries = Object.entries(analytics.interval_distribution ?? {});
  const lastIntervalStart = Math.max(
    0,
    ...intervalEntries.map(([bucket]) => Number(bucket.split('-')[0]) || 0),
  );
  const intervalBins = Array.from({ length: Math.ceil(lastIntervalStart / 10) }, (_, index) => {
    const start = index * 10 + 1;
    const end = start + 9;
    const label = `${start}-${end}`;
    return { label, count: analytics.interval_distribution?.[label] ?? 0 };
  });
  const maxIntervalCount = Math.max(...intervalBins.map((bin) => bin.count), 1);
  const chart = { left: 68, right: 934, top: 12, bottom: 96 };
  const chartHeight = chart.bottom - chart.top;
  const chartStep = intervalBins.length > 0 ? (chart.right - chart.left) / intervalBins.length : 0;

  return (
    <div className="space-y-6">
      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Pulls & SSRs */}
        <div className="p-4 rounded-[14px] bg-[var(--surface-panel)] border border-white/10">
          <span className="text-xs text-[#9ca3af] block mb-1">{t.statTotalPulls}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{analytics.total_pulls}</span>
            <span className="text-xs text-[#f59e0b] font-bold font-mono">({analytics.total_ssr} SSR)</span>
          </div>
          <span className="text-[11px] text-[#9ca3af] mt-1 block">
            {t.statSsrRate}: <strong className="text-white font-mono">{fmtPct(analytics.ssr_rate)}</strong>
          </span>
        </div>

        {/* Early vs Hard Pity */}
        <div className="p-4 rounded-[14px] bg-[var(--surface-panel)] border border-white/10">
          <span className="text-xs text-[#9ca3af] block mb-1">{t.statEarlyVsHard}</span>
          <div className="text-2xl font-black text-[#a855f7] font-mono">
            {analytics.early_ssr_count} <span className="text-sm text-[#6b7280]">/</span> {analytics.pity_ssr_count}
          </div>
          <span className="text-[11px] text-[#9ca3af] mt-1 block">
            {analytics.total_ssr > 0
              ? `${((analytics.early_ssr_count / analytics.total_ssr) * 100).toFixed(0)}% ${localeText(locale)('early')}`
              : '—'}
          </span>
        </div>

        {/* Intervals (Median & Average) */}
        <div className="p-4 rounded-[14px] bg-[var(--surface-panel)] border border-white/10">
          <span className="text-xs text-[#9ca3af] block mb-1">{t.statMedianInterval}</span>
          <div className="text-2xl font-black text-[#fbbf24] font-mono">
            {analytics.median_ssr_interval > 0 ? analytics.median_ssr_interval : '—'}
          </div>
          <span className="text-[11px] text-[#9ca3af] mt-1 block">
            {t.statAvgInterval}: <strong className="text-white font-mono">{analytics.avg_ssr_interval.toFixed(1)}</strong>
          </span>
        </div>

        {/* Pure 50/50 Win Rate */}
        <div className="p-4 rounded-[14px] bg-[var(--surface-panel)] border border-white/10">
          <span className="text-xs text-[#9ca3af] block mb-1">{t.statPureWinRate}</span>
          <div
            className="text-2xl font-black font-mono transition-colors duration-300"
            style={analytics.wins_count + analytics.losses_count > 0
              ? { color: getWinRateColor(analytics.neutral_50_50_rate) }
              : undefined}
          >
            {fmtPct(analytics.neutral_50_50_rate)}
          </div>
          <span className="text-[10px] text-[#9ca3af] mt-1 block leading-tight">
            {t.statPureWinRateHint}
          </span>
        </div>
      </div>

      {/* Interval Distribution Chart & Breakdown */}
      <div className="p-4 rounded-[14px] bg-[var(--surface-panel)] border border-white/10 shadow-lg">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
          <h3 className="text-base font-bold text-white">
            {t.distributionTitle}
          </h3>
          <span className="text-xs text-[#9ca3af]">
            {analytics.total_ssr} {localeText(locale)('total SSR drops')}
          </span>
        </div>

        {intervalEntries.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#6b7280] italic">
            {localeText(locale)('Insufficient data for interval histogram', 'Недостаточно данных для построения интервалов')}
          </div>
        ) : (
          <div>
            <div className="mb-1 flex items-center justify-center text-[10px] text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-3 rounded-sm bg-[#f5ad3b]" aria-hidden="true" />
                {t.distributionCount}
              </span>
            </div>
            <svg
              viewBox="0 0 1000 132"
              className="h-32 w-full"
              role="img"
              aria-label={t.distributionTitle}
            >
              {([0, 0.5, 1] as const).map((fraction) => {
                const y = chart.bottom - chartHeight * fraction;
                return (
                  <g key={fraction}>
                    <line x1={chart.left} x2={chart.right} y1={y} y2={y} stroke="rgba(148,163,184,0.12)" />
                    <text x={chart.left - 10} y={y + 3} fill="#94a3b8" fontSize="10" textAnchor="end">
                      {Math.round(maxIntervalCount * fraction)}
                    </text>
                  </g>
                );
              })}
              {intervalBins.map((bin, index) => {
                const step = chartStep;
                const barWidth = Math.min(70, step * 0.52);
                const barHeight = bin.count / maxIntervalCount * chartHeight;
                const x = chart.left + step * (index + 0.5);
                const y = chart.bottom - barHeight;
                return (
                  <g key={bin.label}>
                    <rect
                      x={x - barWidth / 2}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="3"
                      fill="#f5ad3b"
                      opacity="0.92"
                    >
                      <title>{`${bin.label}: ${bin.count} · ${t.distributionCount}`}</title>
                    </rect>
                    <text x={x} y="119" fill="#cbd5e1" fontSize="10" textAnchor="middle">
                      {bin.label.replace('-', '–')}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Currency Yield Breakdown & Matrix 4-Slot Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Currency Yield */}
        <div className="p-5 rounded-[14px] bg-[var(--surface-panel)] border border-white/10 shadow-lg">
          <h3 className="text-base font-bold text-white mb-3 pb-2 border-b border-white/5">
            {t.statCurrencyBreakdown}
          </h3>

          <div className="space-y-3 text-xs">
            {isAllBanners ? (
              <>
                <div className="flex justify-between items-center p-2.5 rounded bg-[var(--surface-inset)] border border-white/5">
                  <span className="text-[#9ca3af]">{localeText(locale)('Weapon currency:', 'Оружейная валюта:')}</span>
                  <span className="font-mono font-bold text-white">
                    +{weaponAnalytics.cashback_breakdown.base_currency + weaponAnalytics.cashback_breakdown.extra_duplicate_currency}
                    <span className="ml-2 text-[10px] font-normal text-[#9ca3af]">
                      ({localeText(locale)('base')} +{weaponAnalytics.cashback_breakdown.base_currency}, {localeText(locale)('duplicates')} +{weaponAnalytics.cashback_breakdown.extra_duplicate_currency})
                    </span>
                  </span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded bg-[var(--surface-inset)] border border-white/5">
                  <span className="text-[#9ca3af]">{localeText(locale)('Matrix fragments:', 'Фрагменты матриц:')}</span>
                  <span className="font-mono font-bold text-white">+{matrixAnalytics.cashback_breakdown.base_currency + matrixAnalytics.cashback_breakdown.extra_duplicate_currency}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center p-2.5 rounded bg-[var(--surface-inset)] border border-white/5">
                  <span className="text-[#9ca3af]">{t.statBaseCurrency}:</span>
                  <span className="font-mono font-bold text-white">+{analytics.cashback_breakdown.base_currency}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded bg-[var(--surface-inset)] border border-white/5">
                  <span className="text-[#9ca3af]">{t.statExtraCurrency}:</span>
                  <span className="font-mono font-bold text-[#fbbf24]">+{analytics.cashback_breakdown.extra_duplicate_currency}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded bg-[var(--surface-panel)] border border-[#fbbf24]/30">
                  <span className="font-bold text-white">{localeText(locale)('Total Yield:')}</span>
                  <span className="font-mono font-black text-lg text-[#fbbf24]">
                    {analytics.cashback_breakdown.base_currency + analytics.cashback_breakdown.extra_duplicate_currency}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Matrix Slot Distribution */}
        {(activeKind === 'matrix' || isAllBanners) && analytics.matrix_distribution ? (
          <div className="p-5 rounded-[14px] bg-[var(--surface-panel)] border border-white/10 shadow-lg">
            <h3 className="text-base font-bold text-white mb-3 pb-2 border-b border-white/5">
              {t.slotDistributionTitle}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {[
                { slot: 'mind' as const, name: localeText(locale)('Slot 1 (Mind)', 'Мозг (Mind)') },
                { slot: 'memory' as const, name: localeText(locale)('Slot 2 (Memory)') },
                { slot: 'belief' as const, name: localeText(locale)('Slot 3 (Belief)') },
                { slot: 'emotion' as const, name: localeText(locale)('Slot 4 (Emotion)', 'Эмоция (Emotion)') },
              ].map((s) => {
                const count = analytics.matrix_distribution?.[s.slot] ?? 0;
                return (
                  <div key={s.slot} className="p-3 rounded-lg bg-[var(--surface-inset)] border border-white/5 text-center">
                    <span className="text-[11px] text-[#9ca3af] block">{s.name}</span>
                    <span className="text-xl font-mono font-bold text-[#fbbf24] mt-1 block">
                      {count}x
                    </span>
                  </div>
                );
              })}
            </div>
            {isAllBanners && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/5 pt-3 text-xs">
                <div className="flex justify-between rounded bg-[var(--surface-inset)] p-2.5">
                  <span className="text-[#9ca3af]">{localeText(locale)('Wins:', 'Побед (Win):')}</span>
                  <span className="font-mono font-bold text-[#10b981]">{analytics.wins_count}</span>
                </div>
                <div className="flex justify-between rounded bg-[var(--surface-inset)] p-2.5">
                  <span className="text-[#9ca3af]">{localeText(locale)('Losses:')}</span>
                  <span className="font-mono font-bold text-[#ef4444]">{analytics.losses_count}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 rounded-[14px] bg-[var(--surface-panel)] border border-white/10 shadow-lg">
            <h3 className="text-base font-bold text-white mb-3 pb-2 border-b border-white/5">
              {localeText(locale)('50/50 Outcomes Ratio')}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2.5 rounded bg-[var(--surface-inset)] border border-white/5">
                <span className="text-[#9ca3af]">{localeText(locale)('Wins:', 'Побед (Win):')}</span>
                <span className="font-mono font-bold text-[#10b981]">{analytics.wins_count}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded bg-[var(--surface-inset)] border border-white/5">
                <span className="text-[#9ca3af]">{localeText(locale)('Losses:')}</span>
                <span className="font-mono font-bold text-[#ef4444]">{analytics.losses_count}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
