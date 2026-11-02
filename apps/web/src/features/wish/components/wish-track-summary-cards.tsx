'use client';
import { localized, translateUiText} from '@tof-hub/i18n';
import { formatWishPosition } from '../format-wish-position';

import React from 'react';
import { Tooltip } from '@tof-hub/ui';
import type { BannerTrack } from '../types';
import type { TrackCardSummary, ConsolidatedAccountSummary } from '../use-wish-data';
import { WISH_TRANSLATIONS, type WishLocale } from '../wish-i18n';
import { useWishMediaMap } from '../pull-media';
import { getMatrixSlotVisual } from '../matrix-slot-visual';
import { formatPullDate } from '../format-pull-date';
import { getWinRateColor } from '../wish-luck-color';
import { formatNumber } from '@/lib/i18n/format';

interface WishTrackSummaryCardsProps {
  trackSummaries: Record<BannerTrack, TrackCardSummary>;
  consolidatedAccountSummary: ConsolidatedAccountSummary;
  locale: WishLocale;
}

interface CardConfig {
  track: BannerTrack | 'all';
  titleKey: string;
  iconKey: string;
  isConsolidated?: boolean;
}

export function WishTrackSummaryCards({
  trackSummaries,
  consolidatedAccountSummary,
  locale,
}: WishTrackSummaryCardsProps) {
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;
  const mediaMap = useWishMediaMap();
  const blackGoldIcon = mediaMap?.byKey.black_gold?.image;
  const baseChipIcon = mediaMap?.byKey.base_chip?.image;
  const regularSsrCount = consolidatedAccountSummary.eventSsrCount + consolidatedAccountSummary.standardSsrCount;
  const eventShare = consolidatedAccountSummary.totalPulls > 0
    ? consolidatedAccountSummary.eventPulls / consolidatedAccountSummary.totalPulls * 100
    : 0;
  const renderLimitedSsrBreakdown = (summary: TrackCardSummary) => (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.5625rem] leading-tight">
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-slate-300">
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-emerald-400" />
        {t.featuredSsrLabel}
        <strong className="font-mono font-bold text-emerald-300">{summary.featuredSsrCount ?? 0}</strong>
      </span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-slate-300">
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-rose-400" />
        {t.offBannerSsrLabel}
        <strong className="font-mono font-bold text-rose-300">{summary.offBannerSsrCount ?? 0}</strong>
      </span>
      {(summary.unclassifiedSsrCount ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-slate-400">
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-slate-500" />
          {t.unclassifiedSsrLabel}
          <strong className="font-mono font-semibold text-slate-300">{summary.unclassifiedSsrCount}</strong>
        </span>
      )}
    </div>
  );

  const cards: CardConfig[] = [
    {
      track: 'weapon_limited',
      titleKey: t.trackLimitedWeapon,
      iconKey: 'characters',
    },
    {
      track: 'matrix_limited',
      titleKey: t.trackLimitedMatrix,
      iconKey: 'matrices',
    },
    {
      track: 'black_nucleus',
      titleKey: t.trackBlackNucleus,
      iconKey: 'black_nucleus',
    },
    {
      track: 'standard_weapon',
      titleKey: t.trackStandardWeapon,
      iconKey: 'gold_nucleus',
    },
    {
      track: 'standard_matrix',
      titleKey: t.trackStandardMatrix,
      iconKey: 'proof_of_purchase',
    },
    {
      track: 'all',
      titleKey: t.totalAccountOrders,
      iconKey: 'all_banners',
      isConsolidated: true,
    },
  ];
  return (
    <div className="w-full mb-6">
      {/* 3x2 Grid on desktop, 2 cols on tablet, 1 col on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {cards.map((config) => {
          const icon = mediaMap?.currencyIcons?.[config.iconKey];
          if (config.isConsolidated) {
            return (
              <div
                key="all"
                className="relative flex flex-col rounded-[0.875rem] border border-white/10 bg-[var(--surface-panel)] p-4 shadow-lg sm:p-5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {icon && <img src={icon} alt="" className="h-8 w-8 shrink-0 object-contain" />}
                  <h3 className="min-w-0 text-sm font-extrabold tracking-wide text-white">
                    {config.titleKey}
                  </h3>
                </div>

                <div className="flex items-end justify-between gap-3 pt-1.5">
                  <div className="font-mono text-4xl font-black leading-none tracking-tight text-white">
                    {formatNumber(consolidatedAccountSummary.totalPulls, locale)}
                  </div>
                  <span className="pb-0.5 text-right text-[0.6875rem] leading-4 text-slate-400">{t.regularPullsNote}</span>
                </div>

                <div className={`mt-2 flex h-1 overflow-hidden rounded-full ${consolidatedAccountSummary.totalPulls > 0 ? 'bg-amber-200/70' : 'bg-white/10'}`} aria-hidden="true">
                  <div className="h-full bg-sky-400/85" style={{ width: `${eventShare}%` }} />
                </div>

                <div className="mt-2 grid grid-cols-2 gap-4">
                  <div className="min-w-0 border-r border-white/10 pr-3">
                    <div className="flex flex-col items-start gap-1 lg:flex-row lg:items-baseline lg:justify-between">
                      <span className="text-xs font-semibold text-sky-200">{t.eventPulls}</span>
                      <strong className="font-mono text-lg leading-none text-white">{formatNumber(consolidatedAccountSummary.eventPulls, locale)}</strong>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[0.6875rem] font-mono text-sky-300">
                      <img src="/game-assets/webp/Hotta/Content/Resources/Icon/huobi/fakediamonds.webp" alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                      {formatNumber(consolidatedAccountSummary.eventDcEquivalent, locale)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-col items-start gap-1 lg:flex-row lg:items-baseline lg:justify-between">
                      <span className="text-xs font-semibold text-amber-100">{t.standardPulls}</span>
                      <strong className="font-mono text-lg leading-none text-white">{formatNumber(consolidatedAccountSummary.standardPulls, locale)}</strong>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[0.6875rem] font-mono text-slate-400">
                      <span className="inline-flex items-center gap-1" title={t.currencyBlackGold}>
                        {blackGoldIcon && <img src={blackGoldIcon} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />}
                        {consolidatedAccountSummary.standardWeaponCount > 0 ? formatNumber(consolidatedAccountSummary.standardWeaponCashback, locale) : '—'}
                      </span>
                      <span className="inline-flex items-center gap-1" title={t.currencyBaseChip}>
                        {baseChipIcon && <img src={baseChipIcon} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />}
                        {consolidatedAccountSummary.standardMatrixCount > 0 ? formatNumber(consolidatedAccountSummary.standardMatrixCashback, locale) : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 border-t border-white/10 pt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">5★ SSR</span>
                    <strong className={`font-mono text-lg leading-none ${regularSsrCount > 0 ? 'text-amber-200' : 'text-slate-400'}`}>{formatNumber(regularSsrCount, locale)}</strong>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-4 text-[0.6875rem]">
                    <div className="border-r border-white/10 pr-3">
                      <div className="mb-1 font-semibold text-sky-200">{t.categoryLimited}</div>
                      <div>
                        <div className="flex justify-between gap-1 text-slate-400"><span>{t.bannerWeapon}</span><span className="font-mono text-white">{trackSummaries.weapon_limited.ssrCount}</span></div>
                        {renderLimitedSsrBreakdown(trackSummaries.weapon_limited)}
                      </div>
                      <div className="mt-1.5">
                        <div className="flex justify-between gap-1 text-slate-400"><span>{t.bannerMatrix}</span><span className="font-mono text-white">{trackSummaries.matrix_limited.ssrCount}</span></div>
                        {renderLimitedSsrBreakdown(trackSummaries.matrix_limited)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 font-semibold text-amber-100">{t.categoryStandard}</div>
                      <div className="flex justify-between gap-1 text-slate-400"><span>{t.bannerWeapon}</span><span className="font-mono text-white">{trackSummaries.standard_weapon.ssrCount}</span></div>
                      <div className="flex justify-between gap-1 text-slate-400"><span>{t.bannerMatrix}</span><span className="font-mono text-white">{trackSummaries.standard_matrix.ssrCount}</span></div>
                      <div className="mt-1.5 border-t border-white/5 pt-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-violet-300">{t.trackBlackNucleus}</div>
                            <div className="mt-0.5 text-[0.625rem] leading-tight text-slate-400">{t.separateFromTotal} · {consolidatedAccountSummary.blackNucleusSsrCount} SSR</div>
                          </div>
                          <strong className="shrink-0 font-mono text-base text-white">{formatNumber(consolidatedAccountSummary.blackNucleusCount, locale)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            );
          }

          const track = config.track as BannerTrack;
          const summary = trackSummaries[track];
          return (
            <div
              key={track}
              className="relative rounded-[0.875rem] p-4 sm:p-5 flex flex-col gap-2 bg-[var(--surface-panel)] border border-white/10 shadow-lg"
            >
              {/* Header */}
                <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex items-center gap-2 min-w-0">
                  {icon && <img src={icon} alt="" className="h-8 w-8 shrink-0 object-contain" />}
                  <h3 className="text-sm font-extrabold text-white tracking-wide truncate">
                    {config.titleKey}
                  </h3>
                </div>
                  {(track === 'weapon_limited' || track === 'matrix_limited') && (
                    <div className="shrink-0 text-right leading-tight">
                      <div className="text-[0.5625rem] font-bold uppercase tracking-wide text-[#9ca3af]">{t.bannerWinRate}</div>
                      <div
                        className="font-mono text-sm font-bold transition-colors duration-300"
                        style={summary.featuredWinRate == null ? undefined : { color: getWinRateColor(summary.featuredWinRate) }}
                      >
                        {summary.featuredWinRate == null ? '—' : `${summary.featuredWinRate.toFixed(1)}%`}
                      </div>
                    </div>
                  )}
              </div>

              {/* Metric 1: Lifetime Pulls */}
              <div className="flex items-baseline justify-between gap-2 py-2 border-b border-white/5 w-full">
                <div>
                  <div className="text-xs font-semibold text-[#9ca3af]">
                    {t.lifetimePulls}
                  </div>
                  <div className="text-xs font-mono text-[#38bdf8] flex items-center gap-1 mt-0.5 font-bold">
                    <img
                      src="/game-assets/webp/Hotta/Content/Resources/Icon/huobi/fakediamonds.webp"
                      alt=""
                      className="h-3.5 w-3.5 shrink-0 object-contain"
                    />
                    <span>
                      {summary.dcEquivalent > 0
                        ? formatNumber(summary.dcEquivalent, locale)
                        : track === 'black_nucleus'
                        ? '0'
                        : '0'}
                    </span>
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                  {formatNumber(summary.totalPulls, locale)}
                </div>
              </div>

              {/* Metric 2: 5★ Pity */}
              <div className="flex items-center justify-between gap-2 py-2 border-b border-white/5 w-full">
                <div>
                  <div className="text-xs sm:text-sm font-bold text-[#e5e7eb]">
                    {t.pity5Title}
                  </div>
                  <div className="text-[0.6875rem] text-[#9ca3af] mt-0.5">
                    {summary.hasGuaranteed5
                      ? t.guaranteedAt.replace('{{count}}', String(summary.maxPity5))
                      : t.noGuaranteeCap}
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#fbbf24] font-mono">
                  {formatWishPosition(summary.pity5)}
                </div>
              </div>

              {/* Metric 3: 4★ Pity */}
              <div className="flex items-center justify-between gap-2 py-2 border-b border-white/5 w-full">
                <div>
                  <div className="text-xs sm:text-sm font-bold text-[#e5e7eb]">
                    {t.pity4Title}
                  </div>
                  <div className="text-[0.6875rem] text-[#9ca3af] mt-0.5">
                    {summary.hasGuaranteed4
                      ? t.guaranteedAt.replace('{{count}}', String(summary.maxPity4))
                      : t.noGuaranteeCap}
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#c084fc] font-mono">
                  {formatWishPosition(summary.pity4)}
                </div>
              </div>

              {/* Metric 4: 50/50 Telemetry (for Limited Banners) or Pool Clarification (Standard / Black Nucleus) */}
              {track === 'weapon_limited' || track === 'matrix_limited' ? (
                <div className="pt-2 pb-1 w-full">
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <span className="text-[0.6875rem] font-bold text-[#e5e7eb] tracking-wide">
                      {t.cardStreakHistory}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[0.6875rem] text-[#9ca3af]">{t.cardStreakNext}</span>
                      {summary.nextPrediction === 'forced_win' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.625rem] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10">
                          {t.cardPredictionForcedWin}
                        </span>
                      ) : summary.nextPrediction === 'forced_loss' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.625rem] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm shadow-rose-500/10">
                          {t.cardPredictionForcedLoss}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.625rem] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10">
                          {t.cardPredictionNeutral}
                        </span>
                      )}
                    </div>
                  </div>

                  {summary.recentOutcomes && summary.recentOutcomes.length > 0 ? (
                    <div className="grid w-full grid-cols-[repeat(3,minmax(0,1fr))] gap-1">
                      {summary.recentOutcomes.map((item, idx) => {
                        const isWin = item.outcome === 'win';
                        const displayName = locale === 'ru' ? item.shortNameRu : translateUiText(item.shortNameEn, locale);
                        const bannerName = locale === 'ru' ? item.bannerNameRu : translateUiText(item.bannerNameEn, locale);
                        const slotVisual = track === 'matrix_limited' ? getMatrixSlotVisual(item.slot, locale) : null;
                        return (
                          <Tooltip
                            key={`${item.itemId}-${idx}`}
                            placement="top"
                            content={(
                              <div className="min-w-36 max-w-56 space-y-1 whitespace-normal">
                                <p className="text-[0.625rem] font-bold uppercase tracking-wide text-sky-300">{bannerName}</p>
                                <p className="text-xs font-semibold text-white">{item.itemName}</p>
                                {slotVisual && <p className="flex items-center gap-1.5 text-[0.625rem] text-white/75"><img src={slotVisual.image} alt="" className="h-5 w-5 object-contain" />{slotVisual.label}</p>}
                                <p className="text-[0.625rem] text-white/70">{t.bannerDropDate} {formatPullDate(item.pullDate, locale)}</p>
                                <div className="flex items-center gap-2 text-[0.625rem]">
                                  <span className={isWin ? 'font-bold text-emerald-300' : 'font-bold text-rose-300'}>{isWin ? translateUiText('WIN', locale) : translateUiText('LOSS', locale)}</span>
                                  <span className="text-white/70">{formatWishPosition(item.pityAtDrop)} {t.pullDistance}</span>
                                </div>
                              </div>
                            )}
                          >
                            <div
                              tabIndex={0}
                              className={`flex w-full min-w-0 items-center justify-between gap-1 px-1.5 py-1 rounded-md text-[0.6875rem] font-medium border transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${
                                isWin
                                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200 hover:border-emerald-400/60'
                                  : 'bg-rose-950/40 border-rose-500/30 text-rose-200 hover:border-rose-400/60'
                              }`}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-1">
                                {slotVisual && <img src={slotVisual.image} alt="" className="h-4 w-4 shrink-0 object-contain" />}
                                <span className="min-w-0 flex-1 truncate text-white text-[0.6875rem] font-semibold">{displayName}</span>
                              </div>
                              <span className="text-[0.625rem] font-mono text-amber-200 ml-0.5 shrink-0">{formatWishPosition(item.pityAtDrop)}</span>
                            </div>
                          </Tooltip>
                        );
                      })}
                      {summary.recentOutcomes.length < 3 &&
                        Array.from({ length: 3 - summary.recentOutcomes.length }).map((_, i) => (
                          <div
                            key={`empty-${i}`}
                            className="flex items-center justify-center px-2 py-1 rounded-lg text-[0.6875rem] border border-dashed border-white/10 text-white/30"
                          >
                            <span>—</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-[0.6875rem] text-[#9ca3af] italic py-1 text-center bg-white/[0.02] rounded-lg border border-white/5">
                      {t.cardStreakNoData}
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-2 pb-1 w-full">
                  <div className="mb-2 text-[0.6875rem] font-bold text-[#e5e7eb]">{t.cardRecentLegendary}</div>
                  {summary.recentOutcomes && summary.recentOutcomes.length > 0 ? (
                    <div className="grid w-full grid-cols-[repeat(3,minmax(0,1fr))] gap-1">
                      {summary.recentOutcomes.map((item, idx) => {
                        const slotVisual = track === 'standard_matrix' ? getMatrixSlotVisual(item.slot, locale) : null;
                        return <Tooltip
                          key={`${item.itemId}-${idx}`}
                          placement="top"
                          content={(
                            <div className="min-w-36 max-w-56 space-y-1 whitespace-normal">
                              <p className="text-xs font-semibold text-white">{item.itemName}</p>
                              {slotVisual && <p className="flex items-center gap-1.5 text-[0.625rem] text-white/75"><img src={slotVisual.image} alt="" className="h-5 w-5 object-contain" />{slotVisual.label}</p>}
                              <p className="text-[0.625rem] text-white/70">{t.bannerDropDate} {formatPullDate(item.pullDate, locale)}</p>
                              <p className="text-[0.625rem] text-white/70">{formatWishPosition(item.pityAtDrop)} {t.pullDistance}</p>
                            </div>
                          )}
                        >
                          <div
                            tabIndex={0}
                            className="flex w-full min-w-0 items-center justify-between gap-1 rounded-md border border-amber-500/20 bg-amber-950/20 px-1.5 py-1 text-[0.625rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                          >
                            {slotVisual && <img src={slotVisual.image} alt="" className="h-4 w-4 shrink-0 object-contain" />}
                            <span className="min-w-0 flex-1 truncate font-semibold text-white">
                              {locale === 'ru' ? item.shortNameRu : translateUiText(item.shortNameEn, locale)}
                            </span>
                            <span className="shrink-0 font-mono text-amber-200">{formatWishPosition(item.pityAtDrop)}</span>
                          </div>
                        </Tooltip>;
                      })}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-2 py-1.5 text-center text-[0.6875rem] italic text-[#9ca3af]">
                      {t.cardStreakNoData}
                    </div>
                  )}
                </div>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
}
