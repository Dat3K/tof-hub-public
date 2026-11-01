'use client';

import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import React from 'react';
import Image from 'next/image';
import { Badge, Button } from '@tof-hub/ui';
import type { WishBannerDto, WishTallyBannerSummary } from '@tof-hub/game-domain';
import { WISH_TRANSLATIONS, type WishLocale } from '../../wish-i18n';
import { getWinRateColor } from '../../wish-luck-color';
import { formatNumber } from '@/lib/i18n/format';
import { formatBannerDate } from '../../format-pull-date';

interface TallyBannerSelectorProps {
  selectedBannerId: string;
  onSelectBannerId: (id: string) => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  banner: WishBannerDto;
  summary: WishTallyBannerSummary;
  allSummaries: WishTallyBannerSummary[];
  locale: WishLocale;
}

export function TallyBannerSelector({
  selectedBannerId,
  onSelectBannerId,
  selectedCategory,
  onSelectCategory,
  banner,
  summary,
  allSummaries,
  locale,
}: TallyBannerSelectorProps) {
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;

  const categories = [
    { id: 'all', label: localeText(locale)('All Banners', 'Все баннеры') },
    { id: 'weapon_limited', label: t.tallyCategoryLimitedWeapon },
    { id: 'matrix_limited', label: t.tallyCategoryLimitedMatrix },
    { id: 'standard_weapon', label: t.tallyCategoryStandardWeapon },
    { id: 'standard_matrix', label: t.tallyCategoryStandardMatrix },
    { id: 'black_nucleus', label: t.tallyCategoryBlackNucleus },
  ];

  const filteredBanners = allSummaries.filter((b) => {
    if (selectedCategory === 'all') return true;
    return b.banner_type === selectedCategory;
  });

  const bannerName = locale === 'ru' ? summary.banner_name_ru : summary.banner_name;
  const characterName = locale === 'ru' ? summary.featured_character_ru : summary.featured_character;

  return (
    <div className="space-y-6">
      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                isActive
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20'
                  : 'bg-[#151926] text-[#9ca3af] border-white/5 hover:text-white hover:border-white/20'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Banner Cards Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {filteredBanners.map((item) => {
          const isSelected = item.banner_id === selectedBannerId;
          const itemTitle = locale === 'ru' ? item.banner_name_ru : item.banner_name;
          const itemChar = locale === 'ru' ? item.featured_character_ru : item.featured_character;

          return (
            <button
              key={item.banner_id}
              onClick={() => onSelectBannerId(item.banner_id)}
              className={`relative text-left p-3 rounded-xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-b from-amber-500/20 via-[var(--surface-raised)] to-[var(--surface-panel)] border-amber-500/60 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30'
                  : 'bg-[var(--surface-panel)]/80 hover:bg-[#181e2e] border-white/10 hover:border-white/25 text-[#9ca3af]'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex-shrink-0">
                  {item.icon ? (
                    <Image src={item.icon} alt={itemChar} fill sizes="40px" className="object-cover" unoptimized />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-bold truncate ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                    {itemChar}
                  </div>
                  <div className="text-[10px] text-[#9ca3af] truncate">
                    {formatNumber(item.total_pulls, locale)} {localeText(locale)('wishes')}
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-[#6b7280] line-clamp-1">
                {itemTitle}
              </div>
            </button>
          );
        })}
      </div>

      {/* Featured Banner Hero Card */}
      <div className="relative isolate min-h-[270px] rounded-2xl border border-white/10 bg-[var(--surface-panel)] overflow-hidden shadow-xl">
        {summary.splash ? (
          <div className="absolute inset-y-0 right-0 w-full md:w-[70%] pointer-events-none" aria-hidden="true">
            <Image
              src={summary.splash}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 70vw"
              className="object-cover object-[72%_center] opacity-75 md:opacity-90"
              priority
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-panel)] via-[var(--surface-panel)]/70 to-[var(--surface-panel)]/15 md:bg-gradient-to-r md:from-[var(--surface-panel)] md:via-[var(--surface-panel)]/75 md:to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--surface-panel)]/20 via-transparent to-[var(--surface-panel)]/35" />
          </div>
        ) : null}

        <div className="relative z-10 flex min-h-[270px] flex-col md:flex-row items-start md:items-center justify-between p-6 sm:p-8 gap-6">
          {/* Banner Meta Info */}
          <div className="w-full space-y-4 md:max-w-[68%]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning" size="sm" className="font-semibold uppercase tracking-wider">
                {banner.banner_type === 'weapon_limited'
                  ? (localeText(locale)('Limited Weapon', 'Ивентовое оружие'))
                  : banner.banner_type === 'matrix_limited'
                  ? (localeText(locale)('Limited Matrices'))
                  : banner.banner_type === 'black_nucleus'
                  ? (localeText(locale)('Black Nucleus', 'Фиолетовые крутки'))
                  : (localeText(locale)('Standard Order', 'Стандартный заказ'))}
              </Badge>
              {banner.pity_target > 0 && (
                <Badge variant="info" size="sm">
                  {banner.pity_target} {localeText(locale)('Pity Target')}
                </Badge>
              )}

            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
                {bannerName}
              </h2>
              <p className="mt-1 text-sm text-[#9ca3af]">
                {characterName} • {formatBannerDate(summary.start_date, locale)} — {formatBannerDate(summary.end_date, locale)}
              </p>
            </div>

            {/* Quick Community Stats Chips */}
            <div className="flex flex-wrap gap-3 pt-2">
              <div className="bg-black/30 border border-white/10 rounded-lg px-3.5 py-2">
                <div className="text-[10px] text-[#9ca3af] uppercase font-semibold">
                  {t.tallyTotalWishes}
                </div>
                <div className="text-base font-bold text-white">
                  {formatNumber(summary.total_pulls, locale)}
                </div>
              </div>

              <div className="bg-black/30 border border-white/10 rounded-lg px-3.5 py-2">
                <div className="text-[10px] text-[#9ca3af] uppercase font-semibold">
                  {t.tallyAvgSsrPity}
                </div>
                <div className="text-base font-bold text-amber-400">
                  {summary.total_ssr ? summary.avg_ssr_pity : '—'} {localeText(locale)('pulls')}
                </div>
              </div>

              {banner.banner_type.includes('limited') && (
                <div className="bg-black/30 border border-white/10 rounded-lg px-3.5 py-2">
                  <div className="text-[10px] text-[#9ca3af] uppercase font-semibold">
                    {t.tallyWinRate5050}
                  </div>
                  <div
                    className="text-base font-bold transition-colors duration-300"
                    style={summary.won_count + summary.lost_count > 0
                      ? { color: getWinRateColor(summary.win_rate) }
                      : undefined}
                  >
                    {summary.won_count + summary.lost_count > 0 ? `${summary.win_rate}%` : '—'}
                  </div>
                </div>
              )}

              <div className="bg-black/30 border border-white/10 rounded-lg px-3.5 py-2">
                <div className="text-[10px] text-[#9ca3af] uppercase font-semibold">
                  {t.tallySubmissions}
                </div>
                <div className="text-base font-bold text-cyan-400">
                  {formatNumber(summary.total_users, locale)}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
