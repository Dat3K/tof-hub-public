'use client';

import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import React from 'react';
import type { WishTallyBannerSummary } from '@tof-hub/game-domain';
import { WISH_TRANSLATIONS, type WishLocale } from '../../wish-i18n';
import { getWinRateColor } from '../../wish-luck-color';
import { formatNumber } from '@/lib/i18n/format';

interface TallyKpiCardsProps {
  summary: WishTallyBannerSummary;
  locale: WishLocale;
}

export function TallyKpiCards({ summary, locale }: TallyKpiCardsProps) {
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;
  const isLimited = summary.banner_type.includes('limited');

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {/* 1. Total Wishes */}
      <div className="bg-[var(--surface-panel)] border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
        <div className="text-[0.6875rem] font-semibold text-[#9ca3af] uppercase tracking-wide">
          {t.tallyTotalWishes}
        </div>
        <div className="mt-2 text-2xl font-black text-white font-sans">
          {formatNumber(summary.total_pulls, locale)}
        </div>
        <div className="mt-1 text-[0.6875rem] text-[#6b7280]">
          {formatNumber(summary.total_users, locale)} {localeText(locale)('profiles')}
        </div>
      </div>

      {/* 2. Total 5★ SSR */}
      <div className="bg-[var(--surface-panel)] border border-amber-500/30 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden bg-gradient-to-b from-amber-500/5 to-transparent">
        <div className="text-[0.6875rem] font-semibold text-amber-300 uppercase tracking-wide">
          {t.tallyTotalSsr}
        </div>
        <div className="mt-2 text-2xl font-black text-amber-400 font-sans">
          {formatNumber(summary.total_ssr, locale)}
        </div>
        <div className="mt-1 text-[0.6875rem] font-semibold text-amber-300/80">
          {summary.ssr_rate}% {t.tallySsrRate}
        </div>
      </div>

      {/* 3. Average 5★ Pity */}
      <div className="bg-[var(--surface-panel)] border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
        <div className="text-[0.6875rem] font-semibold text-[#9ca3af] uppercase tracking-wide">
          {t.tallyAvgSsrPity}
        </div>
        <div className="mt-2 text-2xl font-black text-amber-300 font-sans">
          {summary.total_ssr ? summary.avg_ssr_pity : '—'}
        </div>
        <div className="mt-1 text-[0.6875rem] text-[#6b7280]">
          {localeText(locale)('pulls average')}
        </div>
      </div>

      {/* 4. 50/50 Win Rate (or Standard Notice) */}
      <div className="bg-[var(--surface-panel)] border border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden bg-gradient-to-b from-emerald-500/5 to-transparent">
        <div className="text-[0.6875rem] font-semibold text-emerald-300 uppercase tracking-wide">
          {t.tallyWinRate5050}
        </div>
        {isLimited ? (
          <>
            <div
              className="mt-2 text-2xl font-black font-sans transition-colors duration-300"
              style={summary.won_count + summary.lost_count > 0
                ? { color: getWinRateColor(summary.win_rate) }
                : undefined}
            >
              {summary.won_count + summary.lost_count > 0 ? `${summary.win_rate}%` : '—'}
            </div>
            <div className="mt-1 text-[0.6875rem] text-[#9ca3af] flex items-center justify-between">
              <span className="text-emerald-400 font-medium">
                {t.tallyWon5050}: {formatNumber(summary.won_count, locale)}
              </span>
              <span className="text-purple-400 font-medium">
                {t.tallyLost5050}: {formatNumber(summary.lost_count, locale)}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="mt-2 text-lg font-bold text-white font-sans">
              {localeText(locale)('Not applicable')}
            </div>
            <div className="mt-1 text-[0.6875rem] text-[#6b7280]">
              {localeText(locale)('No 50/50 loss mechanic', 'Без механики 50/50')}
            </div>
          </>
        )}
      </div>

      {/* 5. Total 4★ SR */}
      <div className="bg-[var(--surface-panel)] border border-purple-500/30 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden bg-gradient-to-b from-purple-500/5 to-transparent">
        <div className="text-[0.6875rem] font-semibold text-purple-300 uppercase tracking-wide">
          {t.tallyTotalSr}
        </div>
        <div className="mt-2 text-2xl font-black text-purple-400 font-sans">
          {formatNumber(summary.total_sr, locale)}
        </div>
        <div className="mt-1 text-[0.6875rem] font-semibold text-purple-300/80">
          {summary.sr_rate}% {t.tallySrRate}
        </div>
      </div>

      {/* 6. Average 4★ Pity */}
      <div className="bg-[var(--surface-panel)] border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
        <div className="text-[0.6875rem] font-semibold text-[#9ca3af] uppercase tracking-wide">
          {t.tallyAvgSrPity}
        </div>
        <div className="mt-2 text-2xl font-black text-purple-300 font-sans">
          {summary.total_sr ? summary.avg_sr_pity : '—'}
        </div>
        <div className="mt-1 text-[0.6875rem] text-[#6b7280]">
          {localeText(locale)('guaranteed every 10', 'гарант каждые 10')}
        </div>
      </div>
    </div>
  );
}
