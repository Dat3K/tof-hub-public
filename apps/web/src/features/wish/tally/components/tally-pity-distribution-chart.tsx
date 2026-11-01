'use client';

import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import React, { useState, useMemo } from 'react';
import type { WishTallyPityPoint, WishBannerType } from '@tof-hub/game-domain';
import { WISH_TRANSLATIONS, type WishLocale } from '../../wish-i18n';
import { formatNumber } from '@/lib/i18n/format';

interface TallyPityDistributionChartProps {
  distribution: WishTallyPityPoint[];
  bannerType: WishBannerType;
  totalSsr: number;
  locale: WishLocale;
}

export function TallyPityDistributionChart({
  distribution,
  bannerType,
  totalSsr,
  locale,
}: TallyPityDistributionChartProps) {
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;
  const isLimited = bannerType.includes('limited');
  const [hoveredPoint, setHoveredPoint] = useState<WishTallyPityPoint | null>(null);
  const [scaleMode, setScaleMode] = useState<'linear' | 'sqrt'>('sqrt');

  const maxTotalSsr = useMemo(() => {
    return Math.max(...distribution.map((p) => p.total_ssr), 1);
  }, [distribution]);

  // Scaler function: sqrt scale allows seeing early flat rate (0.75%) clearly alongside the huge 80-pity spike
  const getHeightPct = (val: number) => {
    if (scaleMode === 'linear') {
      return (val / maxTotalSsr) * 100;
    }
    // Sqrt scale dampens the spike so 1..79 remain clearly visible and readable
    return (Math.sqrt(val) / Math.sqrt(maxTotalSsr)) * 100;
  };

  // Build SVG path for the cumulative line
  const svgWidth = 1000;
  const svgHeight = 260;
  const pointWidth = svgWidth / distribution.length;

  const cumulativePath = useMemo(() => {
    if (distribution.length === 0) return '';
    const points = distribution.map((pt, i) => {
      const x = i * pointWidth + pointWidth / 2;
      const y = svgHeight - (pt.cumulative_rate / 100) * (svgHeight - 20) - 10;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }, [distribution, pointWidth]);

  if (totalSsr === 0 || distribution.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[var(--surface-panel)] p-6 text-sm text-[#9ca3af]">
        {localeText(locale)('There are not enough observed SSR drops to build this distribution yet.', 'Пока недостаточно реальных выпадений SSR, чтобы построить распределение.')}
      </section>
    );
  }

  return (
    <div className="bg-[var(--surface-panel)] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl relative">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h3 className="text-lg sm:text-xl font-extrabold text-white font-sans flex items-center gap-2.5">
            <span>{t.tallyDistributionTitle}</span>
          </h3>
          <p className="mt-1 text-xs text-[#9ca3af]">
            {t.tallyDistributionSubtitle}
          </p>
        </div>

        {/* Scale Switcher & Legend */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            {isLimited ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block shadow-sm" />
                  <span className="text-[#d1d5db] font-medium">{t.tallyPityLegendWon}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-purple-500 inline-block shadow-sm" />
                  <span className="text-[#d1d5db] font-medium">{t.tallyPityLegendLost}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block shadow-sm" />
                <span className="text-[#d1d5db] font-medium">{t.tallyPityLegendAll}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 bg-cyan-400 inline-block" />
              <span className="text-[#d1d5db] font-medium">{t.tallyCumulativeRate}</span>
            </div>
          </div>

          {/* Scale mode toggle */}
          <div className="flex items-center rounded-lg bg-black/40 p-0.5 border border-white/10 text-[11px] font-semibold">
            <button
              onClick={() => setScaleMode('sqrt')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                scaleMode === 'sqrt'
                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                  : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              {localeText(locale)('Balanced', 'Взвешенный')}
            </button>
            <button
              onClick={() => setScaleMode('linear')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                scaleMode === 'linear'
                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                  : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              {localeText(locale)('Linear', 'Линейный')}
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart Canvas Area */}
      <div className="mt-6 relative h-64 sm:h-72 w-full pt-4">
        {/* Background Grid Lines (0%, 25%, 50%, 75%, 100% cumulative) */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
          <div className="border-b border-cyan-400/50 w-full flex justify-between text-[10px] text-cyan-300">
            <span>100%</span>
          </div>
          <div className="border-b border-white/20 w-full flex justify-between text-[10px] text-[#9ca3af]">
            <span>75%</span>
          </div>
          <div className="border-b border-white/20 w-full flex justify-between text-[10px] text-[#9ca3af]">
            <span>50%</span>
          </div>
          <div className="border-b border-white/20 w-full flex justify-between text-[10px] text-[#9ca3af]">
            <span>25%</span>
          </div>
          <div className="border-b border-white/30 w-full flex justify-between text-[10px] text-[#9ca3af]">
            <span>0%</span>
          </div>
        </div>

        {/* SVG Cumulative Line Overlay */}
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10"
          preserveAspectRatio="none"
        >
          <path
            d={cumulativePath}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.5"
            strokeDasharray="4 4"
            className="filter drop-shadow-md"
          />
        </svg>

        {/* Histogram Columns Container */}
        <div className="absolute inset-0 flex items-end justify-between gap-[1px] sm:gap-[2px] z-20">
          {distribution.map((pt) => {
            const isHovered = hoveredPoint?.pity === pt.pity;
            const barHeightPct = Math.max(getHeightPct(pt.total_ssr), 2);
            const wonHeightPct = pt.total_ssr > 0 ? (pt.won_ssr / pt.total_ssr) * 100 : 0;
            const lostHeightPct = 100 - wonHeightPct;

            const isHardPity =
              (distribution.length === 80 && pt.pity === 80) ||
              (distribution.length === 40 && pt.pity === 40);

            return (
              <div
                key={pt.pity}
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
                className="relative flex-1 h-full flex items-end cursor-pointer group"
              >
                {/* Visual Bar */}
                <div
                  style={{ height: `${barHeightPct}%` }}
                  className={`w-full rounded-t-sm flex flex-col justify-end overflow-hidden transition-all duration-150 ${
                    isHovered
                      ? 'ring-2 ring-white scale-105 z-30 brightness-125'
                      : isHardPity
                      ? 'ring-1 ring-amber-400'
                      : ''
                  }`}
                >
                  {isLimited ? (
                    <>
                      {/* Lost 50/50 segment (top) */}
                      <div
                        style={{ height: `${lostHeightPct}%` }}
                        className="w-full bg-purple-500 hover:bg-purple-400 transition-colors"
                      />
                      {/* Won 50/50 segment (bottom) */}
                      <div
                        style={{ height: `${wonHeightPct}%` }}
                        className="w-full bg-amber-400 hover:bg-amber-300 transition-colors"
                      />
                    </>
                  ) : (
                    <div className="w-full h-full bg-amber-400 hover:bg-amber-300 transition-colors" />
                  )}
                </div>

                {/* Hard Pity Marker Indicator */}
                {isHardPity && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-black text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/40 pointer-events-none whitespace-nowrap shadow-md">
                    {pt.pity} ★
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* X-Axis Ticks */}
      <div className="relative mt-2 flex justify-between text-[11px] font-mono text-[#9ca3af] px-1 border-t border-white/10 pt-2">
        <span>1</span>
        {distribution.length >= 80 ? (
          <>
            <span>10</span>
            <span>20</span>
            <span>30</span>
            <span>40</span>
            <span>50</span>
            <span>60</span>
            <span>70</span>
            <span className="text-amber-400 font-bold">80 ({localeText(locale)('Max')})</span>
          </>
        ) : distribution.length === 40 ? (
          <>
            <span>10</span>
            <span>20</span>
            <span>30</span>
            <span className="text-amber-400 font-bold">40 ({localeText(locale)('Max')})</span>
          </>
        ) : (
          <>
            <span>30</span>
            <span>60</span>
            <span>90</span>
            <span>120</span>
          </>
        )}
      </div>

      {/* Interactive Tooltip Card */}
      <div className="mt-4 p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
        {hoveredPoint ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-amber-300">
                {t.tallyTooltipPity.replace('{{pity}}', String(hoveredPoint.pity))}
              </span>
              <span className="text-[#9ca3af]">
                {formatNumber(hoveredPoint.total_ssr, locale)} {localeText(locale)('drops')} (
                {((hoveredPoint.total_ssr / totalSsr) * 100).toFixed(2)}%)
              </span>
            </div>

            {isLimited && (
              <div className="flex items-center gap-4">
                <span className="text-emerald-400 font-semibold">
                  {t.tallyTooltipWon}: {formatNumber(hoveredPoint.won_ssr, locale)} (
                  {hoveredPoint.total_ssr > 0
                    ? ((hoveredPoint.won_ssr / hoveredPoint.total_ssr) * 100).toFixed(1)
                    : 0}
                  %)
                </span>
                <span className="text-purple-400 font-semibold">
                  {t.tallyTooltipLost}: {formatNumber(hoveredPoint.lost_ssr, locale)} (
                  {hoveredPoint.total_ssr > 0
                    ? ((hoveredPoint.lost_ssr / hoveredPoint.total_ssr) * 100).toFixed(1)
                    : 0}
                  %)
                </span>
              </div>
            )}

            <div className="text-cyan-300 font-bold flex items-center gap-1">
              <span>{t.tallyTooltipCumulative}:</span>
              <span>{hoveredPoint.cumulative_rate}%</span>
            </div>
          </>
        ) : (
          <div className="text-[#9ca3af] italic text-center w-full py-0.5">
            {localeText(locale)('Hover over any pity bar to inspect drops and 50/50 win rate breakdown', 'Наведите курсор на столбец крутки для детальной информации')}
          </div>
        )}
      </div>
    </div>
  );
}
