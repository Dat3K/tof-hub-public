'use client';

import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import React, { useState } from 'react';
import Image from 'next/image';
import { Badge } from '@tof-hub/ui';
import type { WishTallyItemDrop } from '@tof-hub/game-domain';
import { WISH_TRANSLATIONS, type WishLocale } from '../../wish-i18n';
import { useWishMediaMap } from '../../pull-media';
import { formatNumber } from '@/lib/i18n/format';

interface TallyItemBreakdownTableProps {
  ssrDrops: WishTallyItemDrop[];
  srDrops: WishTallyItemDrop[];
  locale: WishLocale;
}

export function TallyItemBreakdownTable({
  ssrDrops,
  srDrops,
  locale,
}: TallyItemBreakdownTableProps) {
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;
  const [activeTab, setActiveTab] = useState<'ssr' | 'sr'>('ssr');
  const wishMediaMap = useWishMediaMap();
  const activeDrops = activeTab === 'ssr' ? ssrDrops : srDrops;

  return (
    <div className="bg-[var(--surface-panel)] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl">
      {/* Header and Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h3 className="text-lg sm:text-xl font-extrabold text-white font-sans">
            {activeTab === 'ssr' ? t.tallySsrBreakdownTitle : t.tallySrBreakdownTitle}
          </h3>
          <p className="mt-1 text-xs text-[#9ca3af]">
            {localeText(locale)('Individual item drop counts, percentage share, average pity and range', 'Статистика выпадений предметов по отдельности, средний номер крутки и диапазон')}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center rounded-xl bg-black/40 p-1 border border-white/10 text-xs font-bold">
          <button
            onClick={() => setActiveTab('ssr')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'ssr'
                ? 'bg-amber-500/20 text-amber-300 shadow-sm border border-amber-500/30'
                : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            ★ 5★ SSR ({ssrDrops.length})
          </button>
          <button
            onClick={() => setActiveTab('sr')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'sr'
                ? 'bg-purple-500/20 text-purple-300 shadow-sm border border-purple-500/30'
                : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            ★ 4★ SR ({srDrops.length})
          </button>
        </div>
      </div>

      {/* Compact cards keep every metric readable on phones. */}
      <div className="mt-4 space-y-2.5 lg:hidden">
        {activeDrops.map((item) => {
          const media = wishMediaMap?.byKey[item.item_id.toLowerCase()];
          const itemName = locale === 'ru'
            ? media?.name_ru || item.item_name_ru
            : media?.name_en || item.item_name;
          const is5Star = item.rarity === 5;
          const icon = item.item_type === 'weapon'
            ? media?.weapon_icon ?? media?.image ?? item.icon
            : media?.image ?? item.icon;

          return (
            <article key={item.item_id} className="rounded-xl border border-white/[0.08] bg-black/15 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-black/40 ${is5Star ? 'border-amber-500/50' : 'border-purple-500/50'}`}>
                  {icon ? (
                    <Image src={icon} alt="" fill sizes="40px" className="object-contain p-1" unoptimized />
                  ) : (
                    <span className="flex h-full items-center justify-center text-lg text-[#9ca3af]" aria-hidden="true">
                      {item.item_type === 'matrix' ? '▧' : '◇'}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="break-words text-xs font-bold leading-snug text-white">{itemName}</span>
                    {item.is_featured && (
                      <Badge variant="warning" size="sm" className="shrink-0 text-[9px] py-0 px-1.5 font-bold">
                        {localeText(locale)('FEATURED')}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] uppercase text-[#6b7280]">
                    {item.item_type === 'matrix' ? (localeText(locale)('Matrix')) : (localeText(locale)('Weapon', 'Оружие'))}
                  </span>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/[0.07] pt-2.5 text-[10px]">
                <div>
                  <dt className="text-[#9ca3af]">{t.tallyThTotal}</dt>
                  <dd className="mt-0.5 font-mono text-xs font-bold text-white">{formatNumber(item.count, locale)}</dd>
                </div>
                <div>
                  <dt className="text-[#9ca3af]">{activeTab === 'ssr' ? t.tallyThShare : t.tallyThSrShare}</dt>
                  <dd className={`mt-0.5 font-mono text-xs font-bold ${item.is_featured ? 'text-amber-400' : 'text-slate-200'}`}>{item.share_pct}%</dd>
                </div>
                <div>
                  <dt className="text-[#9ca3af]">{t.tallyThAvgPity}</dt>
                  <dd className="mt-0.5 font-mono text-xs text-[#d1d5db]">{item.avg_pity.toFixed(1)}</dd>
                </div>
                <div>
                  <dt className="text-[#9ca3af]">{localeText(locale)('Pull range', 'Диапазон круток')}</dt>
                  <dd className="mt-0.5 font-mono text-xs text-[#d1d5db]">{item.min_pity}–{item.max_pity}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>

      {/* Full comparison table for wider screens */}
      <div className="mt-4 hidden overflow-x-auto lg:block">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[11px] text-[#9ca3af] uppercase font-semibold">
              <th className="py-3 px-4">{t.tallyThItem}</th>
              <th className="py-3 px-4 text-right">{t.tallyThTotal}</th>
              <th className="py-3 px-4 text-right">
                {activeTab === 'ssr' ? t.tallyThShare : t.tallyThSrShare}
              </th>
              <th className="py-3 px-4 text-right">{t.tallyThAvgPity}</th>
              <th className="py-3 px-4 text-right">{t.tallyThMinPity}</th>
              <th className="py-3 px-4 text-right">{t.tallyThMaxPity}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {activeDrops.map((item) => {
              const media = wishMediaMap?.byKey[item.item_id.toLowerCase()];
              const itemName = locale === 'ru'
                ? media?.name_ru || item.item_name_ru
                : media?.name_en || item.item_name;
              const is5Star = item.rarity === 5;
              const icon = item.item_type === 'weapon'
                ? media?.weapon_icon ?? media?.image ?? item.icon
                : media?.image ?? item.icon;

              return (
                <tr
                  key={item.item_id}
                  className="hover:bg-white/[0.02] transition-colors group"
                >
                  {/* Item Avatar & Name */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`relative w-10 h-10 rounded-lg overflow-hidden border flex-shrink-0 bg-black/40 ${
                          is5Star
                            ? 'border-amber-500/50 shadow-sm shadow-amber-500/10'
                            : 'border-purple-500/50 shadow-sm shadow-purple-500/10'
                        }`}
                      >
                        {icon ? (
                          <Image
                            src={icon}
                            alt={itemName}
                            fill
                            sizes="40px"
                            className="object-contain p-1"
                            unoptimized
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-lg text-[#9ca3af]" aria-hidden="true">
                            {item.item_type === 'matrix' ? '▧' : '◇'}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white group-hover:text-amber-300 transition-colors">
                            {itemName}
                          </span>
                          {item.is_featured && (
                            <Badge variant="warning" size="sm" className="text-[9px] py-0 px-1.5 font-bold">
                              {localeText(locale)('FEATURED')}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-[#6b7280] uppercase">
                          {item.item_type === 'matrix'
                            ? (localeText(locale)('Matrix'))
                            : (localeText(locale)('Weapon', 'Оружие'))}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Total Drops */}
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                    {formatNumber(item.count, locale)}
                  </td>

                  {/* Share % with Visual Bar */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden hidden sm:block">
                        <div
                          style={{ width: `${Math.min(item.share_pct * 1.8, 100)}%` }}
                          className={`h-full rounded-full ${
                            is5Star
                              ? item.is_featured
                                ? 'bg-amber-400'
                                : 'bg-purple-400'
                              : 'bg-purple-400'
                          }`}
                        />
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          item.is_featured ? 'text-amber-400' : 'text-[#d1d5db]'
                        }`}
                      >
                        {item.share_pct}%
                      </span>
                    </div>
                  </td>

                  {/* Average Pity */}
                  <td className="py-3.5 px-4 text-right font-mono text-[#d1d5db]">
                    {item.avg_pity.toFixed(1)}
                  </td>

                  {/* Min Pity */}
                  <td className="py-3.5 px-4 text-right font-mono text-emerald-400 font-medium">
                    {item.min_pity}
                  </td>

                  {/* Max Pity */}
                  <td className="py-3.5 px-4 text-right font-mono text-[#9ca3af]">
                    {item.max_pity}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
