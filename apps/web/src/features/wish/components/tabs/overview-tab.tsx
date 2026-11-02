'use client';

import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import React, { useState } from 'react';
import { Lightbox } from '@tof-hub/ui';
import { replayPityChain } from '@tof-hub/game-domain';
import type { WishRecordDto, WishMatrixSlot } from '@tof-hub/contracts';
import { WISH_TRANSLATIONS, type WishLocale } from '../../wish-i18n';
import type { BannerTrack } from '../../types';
import { useWishMediaMap, resolvePullMedia } from '../../pull-media';
import { getMatrixSlotVisual } from '../../matrix-slot-visual';

interface OverviewTabProps {
  summary: {
    totalPulls: number;
    currentPity: number;
    maxPity: number;
    pityRemaining: number;
    ssrCount: number;
    hardPityCount: number;
    earlySsrCount: number;
    recentSsrFeed: Array<{
      item_id: string;
      item_name: string;
      rarity: number;
      pity_at_drop: number;
      is_guaranteed: boolean;
      streak_outcome: 'win' | 'loss' | 'unknown' | null;
      slot?: WishMatrixSlot;
      pulls_since_last_ssr: number;
      timestamp: string;
    }>;
  };
  allPulls: WishRecordDto[];
  weaponPulls: WishRecordDto[];
  matrixPulls: WishRecordDto[];
  activeBannerId: string;
  activeTrack: BannerTrack;
  locale: WishLocale;
}

export function OverviewTab({
  summary,
  allPulls,
  weaponPulls,
  matrixPulls,
  activeBannerId,
  activeTrack,
  locale,
}: OverviewTabProps) {
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;
  const mediaMap = useWishMediaMap();
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    src: string;
    caption?: string;
  }>({
    isOpen: false,
    src: '',
  });

  const isMatrix = activeTrack === 'matrix_limited' || activeTrack === 'standard_matrix';
  const isBlackNucleus = activeTrack === 'black_nucleus';
  const isAllBanners = activeBannerId === 'all';
  const timelineFeed = isAllBanners
    ? [
        ...replayPityChain(weaponPulls, 'weapon_limited').ssrFeed.map((record) => ({ ...record, itemType: 'weapon' as const, pityTarget: 80 })),
        ...replayPityChain(matrixPulls, 'matrix_limited').ssrFeed.map((record) => ({ ...record, itemType: 'matrix' as const, pityTarget: 40 })),
      ].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    : [...summary.recentSsrFeed]
        .reverse()
        .map((record) => ({ ...record, itemType: isMatrix ? 'matrix' as const : 'weapon' as const, pityTarget: summary.maxPity }));

  // Matrix slot tracking
  const slotLabels: Record<WishMatrixSlot, string> = {
    mind: localeText(locale)('Slot 1 (Mind)', 'Мозг (Mind)'),
    memory: localeText(locale)('Slot 2 (Memory)'),
    belief: localeText(locale)('Slot 3 (Belief)'),
    emotion: localeText(locale)('Slot 4 (Emotion)', 'Эмоция (Emotion)'),
  };

  const slotOrder: WishMatrixSlot[] = ['mind', 'memory', 'belief', 'emotion'];
  const matrixHistory = isAllBanners ? matrixPulls : allPulls;
  const slotCounts = slotOrder.map((s) => {
    return matrixHistory.filter((p) => p.rarity === 5 && p.slot === s).length;
  });
  const acquiredSlotCount = slotCounts.filter((c) => c > 0).length;

  return (
    <div className="space-y-3">
      {/* Matrix 4-Slot Progress (shown for matrix tracks and the event aggregate) */}
      {(isMatrix || isAllBanners) && (
        <div className="rounded-[0.875rem] border border-white/10 bg-[var(--surface-panel)] p-3.5 shadow-lg sm:p-4">
          <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-sm font-bold text-white">
              {t.matrixSlotProgress}
            </h3>
            <span className="text-xs font-bold text-[#fbbf24] font-mono">
              {acquiredSlotCount} / 4 {t.matrixSlotAcquired}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {slotOrder.map((slotKey, i) => {
              const count = slotCounts[i];
              const isAcquired = count > 0;
              const slotVisual = getMatrixSlotVisual(slotKey, locale);
              return (
                <div
                  key={slotKey}
                  className={`rounded-lg border p-2 text-center transition-all ${
                    isAcquired
                      ? 'bg-[#fbbf24]/10 border-[#fbbf24]/40 shadow-[0_0_0.75rem_rgba(251,191,36,0.1)]'
                      : 'bg-[var(--surface-inset)]/60 border-white/5 opacity-60'
                  }`}
                >
                  {slotVisual && <img src={slotVisual.image} alt="" className="mx-auto mb-1 h-8 w-8 object-contain" />}
                  <div className="text-xs font-bold text-white mb-1">
                    {slotLabels[slotKey]}
                  </div>
                  <div className="text-base font-black font-mono text-[#fcd34d]">
                    {count}x
                  </div>
                  <div className="text-[0.625rem] mt-1 text-[#9ca3af]">
                    {isAcquired ? t.matrixSlotAcquired : t.matrixSlotMissing}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-[0.6875rem] italic text-[#6b7280]">
            {t.matrixProgressNote}
          </p>
        </div>
      )}

      {/* SSR Timeline Feed */}
      <div className="rounded-[0.875rem] border border-white/10 bg-[var(--surface-panel)] p-3.5 shadow-lg sm:p-4">
        <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
          <h3 className="text-sm font-bold text-white">
            {t.ssrTimelineTitle}
          </h3>
          <span className="text-xs text-[#9ca3af] font-mono">
            {timelineFeed.length} {localeText(locale)('drops')}
          </span>
        </div>

        {timelineFeed.length === 0 ? (
          <div className="py-5 text-center text-xs italic text-[#6b7280]">
            {t.ssrTimelineEmpty}
          </div>
        ) : (
          <div className="space-y-2">
            {timelineFeed.map((record, index) => {
              const isGuaranteed = record.is_guaranteed;
              const isWon = record.streak_outcome === 'win';
              const isLost = record.streak_outcome === 'loss';
              const media = resolvePullMedia(
                mediaMap,
                {
                  item_id: record.item_id,
                  item_name: record.item_name,
                  item_type: record.itemType,
                  rarity: 5,
                } as WishRecordDto,
                locale,
              );

              return (
                <div
                  key={index}
                  className="flex flex-col justify-between gap-2 rounded-lg border border-white/5 bg-[var(--surface-inset)]/80 p-2 hover:border-white/15 transition-all sm:flex-row sm:items-center"
                >
                    <div className="flex min-w-0 items-center gap-2.5">
                    {/* Item Avatar / Icon (Large, crisp, click to zoom) */}
                    <div
                      role="button"
                      tabIndex={media.image ? 0 : -1}
                      onClick={() => {
                        if (media.image) {
                          setLightboxState({
                            isOpen: true,
                            src: media.image,
                            caption: media.displayName,
                          });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (!media.image) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setLightboxState({
                            isOpen: true,
                            src: media.image,
                            caption: media.displayName,
                          });
                        }
                      }}
                      title={localeText(locale)('Click to zoom')}
                      className="group relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-[#fbbf24]/60 bg-gradient-to-b from-[var(--surface-raised)] to-[var(--surface-inset)] p-1.5 flex items-center justify-center cursor-zoom-in transition-all group-hover:border-[#fbbf24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fbbf24] sm:h-16 sm:w-16"
                    >
                      {media.image ? (
                        <img
                          src={media.image}
                          alt={media.name}
                          className="w-full h-full object-contain filter drop-shadow-[0_0.125rem_0.5rem_rgba(0,0,0,0.8)] group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <span className="text-2xl font-black text-[#4b5563]">
                          {media.name.slice(0, 1)}
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl pointer-events-none">
                        <svg className="w-5 h-5 text-white/90 drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="11" cy="11" r="7" strokeWidth="2" />
                          <path strokeLinecap="round" strokeWidth="2" d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
                        </svg>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-white">
                          {media.primaryName}
                        </span>
                        {media.secondaryName && (
                          <span className="text-xs text-[#9ca3af] font-normal">
                            • {media.secondaryName}
                          </span>
                        )}
                        {record.slot && (
                          <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-white/10 text-[#d1d5db] font-mono uppercase">
                            {record.slot}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#9ca3af] mt-0.5 flex items-center gap-2">
                        <span className="text-[#fbbf24] font-mono font-medium">
                          +{record.pulls_since_last_ssr} {t.pullDistance}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[#6b7280]">
                          {isBlackNucleus
                            ? `${localeText(locale)('pull')} #${record.pity_at_drop}`
                            : `${localeText(locale)('pity')}: ${record.pity_at_drop}/${record.pityTarget}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    {/* Guarantee badge */}
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[0.625rem] font-bold font-mono ${
                        isGuaranteed
                          ? 'bg-[#fbbf24]/20 text-[#fbbf24] border-[#fbbf24]/40'
                          : isBlackNucleus
                          ? 'bg-purple-900/30 text-purple-300 border-purple-500/40'
                          : 'bg-[#a855f7]/20 text-[#c084fc] border-[#a855f7]/40'
                      }`}
                    >
                      {isGuaranteed
                          ? `${t.hardPityBadge} ${record.pityTarget}`
                        : isBlackNucleus
                        ? '0.3% SSR'
                        : t.earlyPityBadge}
                    </span>

                    {/* Outcome badge */}
                    {(isWon || isLost) && (
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[0.625rem] font-bold ${
                          isWon
                            ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40'
                            : 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40'
                        }`}
                      >
                        {isWon ? t.outcomeWon : t.outcomeLost}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox for full-size inspection */}
      <Lightbox
        isOpen={lightboxState.isOpen}
        src={lightboxState.src}
        alt={lightboxState.caption || localeText(locale)('Preview')}
        caption={lightboxState.caption}
        downloadPngLabel={localeText(locale)('Download PNG', 'Скачать PNG')}
        downloadWebpLabel={localeText(locale)('Download WebP', 'Скачать WebP')}
        onClose={() => setLightboxState({ isOpen: false, src: '' })}
      />
    </div>
  );
}
