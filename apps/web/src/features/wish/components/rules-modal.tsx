'use client';

import { localized } from '@tof-hub/i18n';
import React from 'react';
import type { WishMatrixSlot } from '@tof-hub/contracts';
import {
  BASE_RATES,
  CASHBACK,
  EXPECTED_SSR_RATES,
  PITY_MAX_MATRIX,
  PITY_MAX_WEAPON,
  SR_PITY_INTERVAL,
} from '@tof-hub/game-domain';
import { ToolInfoModal, InfoCard, SectionHeading, InfoNote, InfoRows, InfoRow } from '@/components/tool-rail/tool-info-modal';
import { getMatrixSlotVisual } from '../matrix-slot-visual';
import { WISH_TRANSLATIONS, type WishLocale } from '../wish-i18n';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: WishLocale;
}

const percent = (rate: number) => `${(rate * 100).toFixed(2)}%`;

export function RulesModal({ isOpen, onClose, locale }: RulesModalProps) {
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;
  const pityRows = [
    {
      name: t.rulesWeapon,
      ssr: percent(BASE_RATES.WEAPON_SSR),
      sr: percent(BASE_RATES.WEAPON_SR),
      cycle: PITY_MAX_WEAPON,
      average: percent(EXPECTED_SSR_RATES.WEAPON),
    },
    {
      name: t.rulesMatrix,
      ssr: percent(BASE_RATES.MATRIX_SSR),
      sr: percent(BASE_RATES.MATRIX_SR),
      cycle: PITY_MAX_MATRIX,
      average: percent(EXPECTED_SSR_RATES.MATRIX),
    },
  ];
  const matrixSlots: Array<{ id: WishMatrixSlot; label: string }> = [
    { id: 'mind', label: t.rulesSlotMind },
    { id: 'memory', label: t.rulesSlotMemory },
    { id: 'belief', label: t.rulesSlotBelief },
    { id: 'emotion', label: t.rulesSlotEmotion },
  ];

  return (
    <ToolInfoModal isOpen={isOpen} onClose={onClose} eyebrow={t.rulesEyebrow} title={t.rulesModalTitle} intro={t.rulesIntro} closeLabel={t.modalClose}>
          <section aria-labelledby="rules-rates-title">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 id="rules-rates-title" className="text-sm font-bold text-white">{t.rulesRatesTitle}</h3>
                <p className="mt-1 text-xs text-slate-400">{t.rulesRatesIntro}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-slate-400">
                {t.rulesRateLegend}
              </span>
            </div>

            {/* One panel per order type, rows like the Build "Rules" list (shared InfoRows). */}
            <div className="grid gap-3 md:grid-cols-2">
              {pityRows.map((row, index) => (
                <InfoCard key={row.name}>
                  <div className="flex items-center justify-between gap-2">
                    <SectionHeading>{row.name}</SectionHeading>
                    <span className="rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-2 py-0.5 font-mono text-[0.6875rem] font-bold text-amber-200">{t.rulesEvery} {row.cycle}</span>
                  </div>
                  <InfoRows>
                    <InfoRow title={t.rulesBaseSsr} value={row.ssr} valueClassName="text-amber-300" />
                    <InfoRow title={t.rulesBaseSr} value={row.sr} valueClassName="text-violet-300" />
                    <InfoRow title={t.rulesSsrGuarantee} value={t.rulesPullNumber.replace('{{count}}', String(row.cycle))} />
                    <InfoRow title={t.rulesAverageSsr} value={row.average} valueClassName="text-emerald-300" />
                  </InfoRows>
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">{index === 0 ? t.rulesWeaponNote : t.rulesMatrixNote}</p>
                </InfoCard>
              ))}
            </div>
            <div className="mt-3"><InfoNote tone="sky" label={t.rulesRateNoteLabel}>{t.rulesRateNote}</InfoNote></div>
          </section>

          <section className="grid gap-3 lg:grid-cols-[1.1fr_.9fr]">
            <InfoCard>
              <SectionHeading>{t.rulesPityTitle}</SectionHeading>
              <InfoRows>
                <InfoRow title={t.rulesPityFixedTitle}>{t.rulesPityFixed.replaceAll('{{srPity}}', String(SR_PITY_INTERVAL))}</InfoRow>
                <InfoRow title={t.rulesPityCarryTitle}>{t.rulesPityCarry}</InfoRow>
                <InfoRow title={t.rulesPityIndependenceTitle}>{t.rulesPityIndependence}</InfoRow>
                <InfoRow title={t.rulesEarlySsrTitle}>{t.rulesEarlySsr}</InfoRow>
              </InfoRows>
            </InfoCard>

            <InfoCard>
              <SectionHeading>{t.rulesFeaturedTitle}</SectionHeading>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
                  <div className="text-[0.625rem] font-bold uppercase tracking-wider text-emerald-300">{t.rulesWin}</div>
                  <div className="mt-1 font-mono text-xl font-bold text-emerald-300">50%</div>
                </div>
                <div className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] p-3">
                  <div className="text-[0.625rem] font-bold uppercase tracking-wider text-rose-300">{t.rulesLoss}</div>
                  <div className="mt-1 font-mono text-xl font-bold text-rose-300">50%</div>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">{t.rulesFeaturedDesc}</p>
              <InfoRows>
                <InfoRow title="W-W" value={t.rulesForcedLoss} valueClassName="text-rose-300" />
                <InfoRow title="L-L" value={t.rulesForcedWin} valueClassName="text-emerald-300" />
                <InfoRow title="W-L / L-W" value={t.rulesNeutral} valueClassName="text-amber-200" />
              </InfoRows>
              <p className="mt-3 border-t border-white/[0.07] pt-3 text-[0.6875rem] leading-relaxed text-slate-500">{t.rulesStreakDisclaimer}</p>
            </InfoCard>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <InfoCard>
              <SectionHeading>{t.rulesMatrixSlotsTitle}</SectionHeading>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{t.rulesMatrixSlotsDesc}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{t.rulesMatrixAutoBlockDesc}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {matrixSlots.map((slot) => {
                  const visual = getMatrixSlotVisual(slot.id, locale);
                  return (
                    <span key={slot.id} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2.5 py-1.5 text-[0.6875rem] font-medium text-slate-200">
                      {visual && <img src={visual.image} alt="" className="h-4 w-4 object-contain" />}
                      {slot.label}
                    </span>
                  );
                })}
              </div>
            </InfoCard>
            <InfoCard>
              <SectionHeading>{t.rulesCashbackTitle}</SectionHeading>
              <InfoRows>
                <InfoRow title={t.rulesWeaponCurrency}>{t.rulesWeaponCashback.replaceAll('{{base}}', String(CASHBACK.PULL_BASE)).replaceAll('{{srBonus}}', String(CASHBACK.SR_DUPLICATE_BONUS)).replaceAll('{{ssrBonus}}', String(CASHBACK.STANDARD_SSR_BONUS))}</InfoRow>
                <InfoRow title={t.rulesMatrixCurrency}>{t.rulesMatrixCashback.replace('{{base}}', String(CASHBACK.PULL_BASE))}</InfoRow>
                <InfoRow title={t.rulesShopTitle}>{t.rulesShop.replace('{{weaponCost}}', String(CASHBACK.FLAME_GOLD_WEAPON_COST)).replace('{{boxCost}}', String(CASHBACK.FLAME_GOLD_MATRIX_BOX_COST)).replace('{{matrixCost}}', String(CASHBACK.OVERCLOCKING_CHIP_MATRIX_COST))}</InfoRow>
              </InfoRows>
            </InfoCard>
          </section>

          <InfoNote label={t.rulesImportantLabel}>{t.ruleClarification}</InfoNote>
    </ToolInfoModal>
  );
}


