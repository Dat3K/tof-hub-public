'use client';

import React, { useState, useMemo } from 'react';
import type { WishRecordDto, WishBannerDto, WishLuckSummary, WishLuckTier, WishLuckScope } from '@tof-hub/contracts';
import { calculateLuckSummary } from '@tof-hub/game-domain';
import type { BannerTrack } from '../types';
import { WISH_TRANSLATIONS, type WishLocale } from '../wish-i18n';
import luckStyles from './wish-luck.module.css';
import { getLuckMultiplierPresentation } from '../wish-luck-color';

interface WishLuckSectionProps {
  weaponPulls: readonly WishRecordDto[];
  matrixPulls: readonly WishRecordDto[];
  allPulls?: readonly WishRecordDto[];
  currentPulls?: readonly WishRecordDto[];
  currentTrackPulls?: readonly WishRecordDto[];
  activeTrack?: BannerTrack;
  activeBannerId?: string;
  banner?: WishBannerDto;
  availableBanners?: WishBannerDto[];
  locale: WishLocale;
  initialScope?: WishLuckScope;
}

function getTierText(tier: WishLuckTier, t: (typeof WISH_TRANSLATIONS)['ru'] | (typeof WISH_TRANSLATIONS)['en']): string {
  switch (tier) {
    case 'very_lucky':
      return t.luckTierVeryLucky;
    case 'lucky':
      return t.luckTierLucky;
    case 'expected':
      return t.luckTierExpected;
    case 'unlucky':
      return t.luckTierUnlucky;
    case 'very_unlucky':
      return t.luckTierVeryUnlucky;
  }
}

export function WishLuckSection({
  weaponPulls,
  matrixPulls,
  allPulls,
  currentPulls,
  currentTrackPulls,
  activeTrack = 'weapon_limited',
  activeBannerId = 'all',
  banner,
  locale,
  initialScope = 'current',
}: WishLuckSectionProps) {
  const t = WISH_TRANSLATIONS[locale] ?? WISH_TRANSLATIONS.en;
  const scope: WishLuckScope = initialScope;
  const [viewMode, setViewMode] = useState<'both' | 'winrate' | 'droprate'>('both');

  // Adjust viewMode default when switching track
  React.useEffect(() => {
    if (activeTrack === 'standard_weapon' || activeTrack === 'standard_matrix' || activeTrack === 'black_nucleus') {
      setViewMode('droprate');
    } else {
      setViewMode('both');
    }
  }, [activeTrack]);

  const targetPulls = useMemo(() => {
    if (scope === 'current') {
      if (activeBannerId !== 'all') return currentPulls ?? [];
      if (currentPulls && currentPulls.length > 0) return currentPulls;
      if (currentTrackPulls && currentTrackPulls.length > 0) return currentTrackPulls;
      return activeTrack === 'matrix_limited' ? matrixPulls : weaponPulls;
    }
    if (allPulls && allPulls.length > 0) return allPulls;
    return [...weaponPulls, ...matrixPulls];
  }, [scope, activeBannerId, currentPulls, currentTrackPulls, activeTrack, matrixPulls, weaponPulls, allPulls]);

  const luckSummary: WishLuckSummary = useMemo(() => {
    return calculateLuckSummary(targetPulls, scope);
  }, [targetPulls, scope]);

  const { dropRateLuck, winRateLuck, overallScore, overallTier } = luckSummary;
  const overallPresentation = getLuckMultiplierPresentation(overallScore, luckStyles.luckShimmer);
  const winRatePresentation = getLuckMultiplierPresentation(winRateLuck.multiplier, luckStyles.luckShimmer);
  const dropRatePresentation = getLuckMultiplierPresentation(dropRateLuck.multiplier, luckStyles.luckShimmer);

  // Format strings for drop rate caption
  const dropAvgInterval = dropRateLuck.expectedRate > 0
    ? (100 / dropRateLuck.expectedRate).toFixed(1)
    : '50.0';
  const dropDiff = dropRateLuck.expectedRate > 0
    ? (((dropRateLuck.actualRate - dropRateLuck.expectedRate) / dropRateLuck.expectedRate) * 100).toFixed(1)
    : '0';
  const dropDiffFormatted = Number(dropDiff) >= 0 ? `+${dropDiff}` : dropDiff;

  const dropRateExplanation = dropRateLuck.hasReliableExposure === false ? t.importHistoryUnanchored : t.luckDropRateCaption
    .replace('{{actual}}', String(dropRateLuck.actualCount))
    .replace('{{pulls}}', String(dropRateLuck.totalPulls))
    .replace('{{rate}}', dropRateLuck.actualRate.toFixed(2))
    .replace('{{expectedCount}}', dropRateLuck.expectedCount.toFixed(1))
    .replace('{{expectedRate}}', dropRateLuck.expectedRate.toFixed(2))
    .replace('{{avgInterval}}', dropAvgInterval)
    .replace('{{diff}}', dropDiffFormatted);

  const winRateExplanation = t.luckWinRateCaption
    .replace('{{wins}}', String(winRateLuck.winsCount))
    .replace('{{total}}', String(winRateLuck.totalOutcomes))
    .replace('{{rate}}', winRateLuck.actualWinRate.toFixed(1));

  const isNo5050Track =
    activeTrack === 'standard_weapon' ||
    activeTrack === 'standard_matrix' ||
    activeTrack === 'black_nucleus';

  const hasNo5050 =
    scope === 'standard' ||
    scope === 'black_nucleus' ||
    (scope === 'current' && (isNo5050Track || winRateLuck.totalOutcomes === 0));

  return (
    <div className="border-t border-white/10 bg-[var(--surface-inset)]/90 px-4 sm:px-6 md:px-8 py-5">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]" />
            <h3 className="text-sm font-extrabold text-white tracking-wider uppercase">
              {t.luckSectionTitle}
            </h3>
            <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-mono font-bold">
              <span className={overallPresentation.className} style={overallPresentation.style}>
                {dropRateLuck.hasReliableExposure === false ? '?' : `${overallScore.toFixed(1)}x — ${getTierText(overallTier, t)}`}
              </span>
            </span>
          </div>
          <p className="text-[11px] text-[#9ca3af] mt-0.5">
            {t.luckSectionSubtitle}
          </p>
        </div>

        {/* Metric selector */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex rounded-md bg-[var(--surface-panel)] p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode('both')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                viewMode === 'both'
                  ? 'bg-white/20 text-white'
                  : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              {t.luckModeBoth}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('winrate')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                viewMode === 'winrate'
                  ? 'bg-white/20 text-white'
                  : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              {t.luckModeWinRate}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('droprate')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                viewMode === 'droprate'
                  ? 'bg-white/20 text-white'
                  : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              {t.luckModeDropRate}
            </button>
          </div>
        </div>
      </div>

      {/* Luck Bars Stack */}
      <div className="space-y-6">
        {/* Bar 1: Win Rate Luck (Screenshot 2 Match) */}
        {(viewMode === 'both' || viewMode === 'winrate') && (
          hasNo5050 ? (
            <div className="rounded-xl p-4 bg-[var(--surface-panel)]/60 border border-white/5 flex items-center gap-3">
              <span className="text-xl">ℹ️</span>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                {t.luckNo5050Notice}
              </p>
            </div>
          ) : (
            <div className="rounded-xl p-4 bg-[var(--surface-panel)]/60 border border-white/5 space-y-3">
              {/* Header Line */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold tracking-wider text-[#d1d5db] uppercase text-[11px] sm:text-xs">
                  {t.luckVsExpectedWinRate}
                </span>
                <span className="font-mono font-bold text-sm flex items-center gap-1.5">
                  <span className={winRatePresentation.className} style={winRatePresentation.style}>
                    {winRateLuck.multiplier.toFixed(2)}x
                  </span>
                  <span className="text-[#9ca3af]">—</span>
                  <span className={winRatePresentation.className} style={winRatePresentation.style}>
                    {getTierText(winRateLuck.tier, t)}
                  </span>
                </span>
              </div>

              {/* Slider Track */}
              <div className="relative pt-2 pb-1">
                <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#ef4444] via-[#78350f] via-[#fbbf24]/60 to-[#10b981] relative">
                  {/* Thumb Indicator (White circle with glow) */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)] border-2 border-[var(--surface-panel)] transition-all duration-500 ease-out z-10"
                    style={{ left: `${winRateLuck.positionPct}%` }}
                  />
                </div>

                {/* Scale Labels */}
                <div className="flex justify-between items-center text-[11px] font-semibold text-[#9ca3af] mt-2">
                  <span>{t.luckScaleUnlucky}</span>
                  <span className="text-[#d1d5db]">{t.luckScaleExpected}</span>
                  <span>{t.luckScaleVeryLucky}</span>
                </div>
              </div>

              {/* Explanatory Caption */}
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                {winRateLuck.totalOutcomes > 0 ? (
                  winRateExplanation
                ) : (
                  <span className="italic text-[#6b7280]">{t.luckNoData}</span>
                )}
              </p>
            </div>
          )
        )}

        {/* Bar 2: SSR Drop Rate Luck */}
        {(viewMode === 'both' || viewMode === 'droprate') && (
          <div className="rounded-xl p-4 bg-[var(--surface-panel)]/60 border border-white/5 space-y-3">
            {/* Header Line */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold tracking-wider text-[#d1d5db] uppercase text-[11px] sm:text-xs">
                {t.luckVsExpectedDropRate}
              </span>
              <span className="font-mono font-bold text-sm flex items-center gap-1.5">
                <span className={dropRatePresentation.className} style={dropRatePresentation.style}>
                  {dropRateLuck.hasReliableExposure === false ? '?' : `${dropRateLuck.multiplier.toFixed(2)}x`}
                </span>
                <span className="text-[#9ca3af]">—</span>
                <span className={dropRatePresentation.className} style={dropRatePresentation.style}>
                  {dropRateLuck.hasReliableExposure === false ? t.luckNoData : getTierText(dropRateLuck.tier, t)}
                </span>
              </span>
            </div>

            {/* Slider Track */}
            <div className="relative pt-2 pb-1">
              <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#ef4444] via-[#78350f] via-[#fbbf24]/60 to-[#10b981] relative">
                {/* Thumb Indicator (White circle with glow) */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)] border-2 border-[var(--surface-panel)] transition-all duration-500 ease-out z-10"
                  style={{ left: `${dropRateLuck.positionPct}%` }}
                />
              </div>

              {/* Scale Labels */}
              <div className="flex justify-between items-center text-[11px] font-semibold text-[#9ca3af] mt-2">
                <span>{t.luckScaleUnlucky}</span>
                <span className="text-[#d1d5db]">{t.luckScaleExpected}</span>
                <span>{t.luckScaleVeryLucky}</span>
              </div>
            </div>

            {/* Explanatory Caption */}
            <p className="text-xs text-[#9ca3af] leading-relaxed">
              {dropRateLuck.totalPulls > 0 ? (
                dropRateExplanation
              ) : (
                <span className="italic text-[#6b7280]">{t.luckNoData}</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
