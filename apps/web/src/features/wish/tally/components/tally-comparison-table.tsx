'use client';

import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import React from 'react';
import Image from 'next/image';
import { Badge, Button } from '@tof-hub/ui';
import type { WishTallyBannerSummary } from '@tof-hub/game-domain';
import { WISH_TRANSLATIONS, type WishLocale } from '../../wish-i18n';
import { getWinRateColor } from '../../wish-luck-color';
import { formatNumber } from '@/lib/i18n/format';

interface TallyComparisonTableProps {
  banners: WishTallyBannerSummary[];
  activeBannerId: string;
  onSelectBanner: (bannerId: string) => void;
  locale: WishLocale;
}

export function TallyComparisonTable({
  banners,
  activeBannerId,
  onSelectBanner,
  locale,
}: TallyComparisonTableProps) {
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;

  return (
    <div className="bg-[var(--surface-panel)] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl">
      <div className="pb-4 border-b border-white/10">
        <h3 className="text-lg sm:text-xl font-extrabold text-white font-sans">
          {t.tallyAllBannersTitle}
        </h3>
        <p className="mt-1 text-xs text-[#9ca3af]">
          {t.tallyAllBannersSubtitle}
        </p>
      </div>

      <div className="mt-4 space-y-2.5 lg:hidden">
        {banners.map((item) => {
          const isSelected = item.banner_id === activeBannerId;
          const bannerName = locale === 'ru' ? item.banner_name_ru : item.banner_name;
          const charName = locale === 'ru' ? item.featured_character_ru : item.featured_character;
          const isLimited = item.banner_type.includes('limited');
          const typeName = item.banner_type === 'weapon_limited'
            ? (localeText(locale)('Limited weapon', 'Ивент оружие'))
            : item.banner_type === 'matrix_limited'
              ? (localeText(locale)('Limited matrices'))
              : item.banner_type === 'black_nucleus'
                ? (localeText(locale)('Black Nucleus', 'Фиолетовые крутки'))
                : (localeText(locale)('Standard', 'Стандарт'));
          const hasOutcomes = item.won_count + item.lost_count > 0;

          return (
            <button
              key={item.banner_id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectBanner(item.banner_id)}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${isSelected ? 'border-amber-400/45 bg-amber-500/[0.09]' : 'border-white/[0.08] bg-black/15 active:bg-white/[0.04]'}`}
            >
              <span className="flex min-w-0 items-start gap-3">
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                  {item.icon ? <Image src={item.icon} alt="" fill sizes="40px" className="object-cover" unoptimized /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block break-words text-sm font-bold leading-snug ${isSelected ? 'text-amber-300' : 'text-white'}`}>{charName}</span>
                  <span className="mt-0.5 block break-words text-[0.6875rem] leading-snug text-[#9ca3af]">{bannerName}</span>
                </span>
                <Badge variant={isLimited ? 'warning' : 'default'} size="sm" className="max-w-[42%] shrink-0 whitespace-normal text-center text-[0.5625rem] leading-tight uppercase font-semibold">
                  {typeName}
                </Badge>
              </span>

              <span className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/[0.07] pt-2.5 text-[0.625rem]">
                <span>
                  <span className="block text-[#9ca3af]">{t.tallyThWishes}</span>
                  <span className="mt-0.5 block font-mono text-xs font-bold text-white">{formatNumber(item.total_pulls, locale)}</span>
                </span>
                <span>
                  <span className="block text-[#9ca3af]">{t.tallyThSsrCount}</span>
                  <span className="mt-0.5 block font-mono text-xs font-bold text-amber-400">{formatNumber(item.total_ssr, locale)}</span>
                </span>
                <span>
                  <span className="block text-[#9ca3af]">{t.tallyThSsrRate}</span>
                  <span className="mt-0.5 block font-mono text-xs text-[#d1d5db]">{item.ssr_rate}%</span>
                </span>
                <span>
                  <span className="block text-[#9ca3af]">{t.tallyThAvgPityCol}</span>
                  <span className="mt-0.5 block font-mono text-xs text-amber-300">{item.total_ssr ? item.avg_ssr_pity : '—'}</span>
                </span>
                <span>
                  <span className="block text-[#9ca3af]">{t.tallyThWinRateCol}</span>
                  <span className="mt-0.5 block font-mono text-xs font-bold" style={isLimited && hasOutcomes ? { color: getWinRateColor(item.win_rate) } : undefined}>
                    {isLimited && hasOutcomes ? `${item.win_rate}%` : '—'}
                  </span>
                </span>
                <span>
                  <span className="block text-[#9ca3af]">{t.tallyThUsersCol}</span>
                  <span className="mt-0.5 block font-mono text-xs text-[#d1d5db]">{formatNumber(item.total_users, locale)}</span>
                </span>
              </span>
              <span className="mt-2.5 block text-right text-[0.625rem] font-bold text-amber-300">
                {isSelected ? (localeText(locale)('Selected')) : t.tallyViewBannerBtn}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 hidden overflow-x-auto lg:block">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[0.6875rem] text-[#9ca3af] uppercase font-semibold">
              <th className="py-3 px-4">{t.tallyThBanner}</th>
              <th className="py-3 px-4">{t.tallyThType}</th>
              <th className="py-3 px-4 text-right">{t.tallyThWishes}</th>
              <th className="py-3 px-4 text-right">{t.tallyThSsrCount}</th>
              <th className="py-3 px-4 text-right">{t.tallyThSsrRate}</th>
              <th className="py-3 px-4 text-right">{t.tallyThAvgPityCol}</th>
              <th className="py-3 px-4 text-right">{t.tallyThWinRateCol}</th>
              <th className="py-3 px-4 text-right">{t.tallyThUsersCol}</th>
              <th className="py-3 px-4 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {banners.map((item) => {
              const isSelected = item.banner_id === activeBannerId;
              const bannerName = locale === 'ru' ? item.banner_name_ru : item.banner_name;
              const charName = locale === 'ru' ? item.featured_character_ru : item.featured_character;
              const isLimited = item.banner_type.includes('limited');

              return (
                <tr
                  key={item.banner_id}
                  onClick={() => onSelectBanner(item.banner_id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-amber-500/10 hover:bg-amber-500/15'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  {/* Banner Image & Title */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 bg-black/40">
                        {item.icon ? (
                          <Image src={item.icon} alt={bannerName} fill sizes="36px" className="object-cover" unoptimized />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className={`font-bold truncate ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                          {charName}
                        </div>
                        <div className="text-[0.625rem] text-[#6b7280] truncate">
                          {bannerName}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Banner Type */}
                  <td className="py-3 px-4">
                    <Badge
                      variant={isLimited ? 'warning' : 'default'}
                      size="sm"
                      className="text-[0.5625rem] uppercase font-semibold"
                    >

                      {item.banner_type === 'weapon_limited'
                        ? (localeText(locale)('Limited Weapon', 'Ивент Оружие'))
                        : item.banner_type === 'matrix_limited'
                        ? (localeText(locale)('Limited Matrix'))
                        : item.banner_type === 'black_nucleus'
                        ? (localeText(locale)('Black Nucleus', 'Фиол крутки'))
                        : (localeText(locale)('Standard', 'Стандарт'))}
                    </Badge>
                  </td>

                  {/* Total Wishes */}
                  <td className="py-3 px-4 text-right font-mono font-bold text-white">
                    {formatNumber(item.total_pulls, locale)}
                  </td>

                  {/* Total 5★ SSR */}
                  <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                    {formatNumber(item.total_ssr, locale)}
                  </td>

                  {/* 5★ Rate */}
                  <td className="py-3 px-4 text-right font-mono text-[#d1d5db]">
                    {item.ssr_rate}%
                  </td>

                  {/* Avg 5★ Pity */}
                  <td className="py-3 px-4 text-right font-mono text-amber-300">
                    {item.total_ssr ? item.avg_ssr_pity : '—'}
                  </td>

                  {/* 50/50 Win Rate */}
                  <td className="py-3 px-4 text-right font-mono">
                    {isLimited ? (
                      <span
                        className="font-bold transition-colors duration-300"
                        style={item.won_count + item.lost_count > 0
                          ? { color: getWinRateColor(item.win_rate) }
                          : undefined}
                      >
                        {isLimited && item.won_count + item.lost_count > 0 ? `${item.win_rate}%` : '—'}
                      </span>
                    ) : (
                      <span className="text-[#6b7280]">—</span>
                    )}
                  </td>

                  {/* Users / Profiles */}
                  <td className="py-3 px-4 text-right font-mono text-[#9ca3af]">
                    {formatNumber(item.total_users, locale)}
                  </td>

                  {/* Action */}
                  <td className="py-3 px-4 text-center">
                    <Button
                      variant={isSelected ? 'primary' : 'outline'}
                      size="sm"
                      className="text-[0.625rem] py-1 px-2.5 h-auto font-bold"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectBanner(item.banner_id);
                      }}
                    >
                      {isSelected
                        ? (localeText(locale)('Selected'))
                        : t.tallyViewBannerBtn}
                    </Button>
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
