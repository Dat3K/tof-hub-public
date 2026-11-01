'use client';

import { type Locale } from '@tof-hub/i18n';
import { InfoCard, InfoNote, InfoRow, InfoRows, SectionHeading, ToolInfoModal } from '@/components/tool-rail/tool-info-modal';
import {
  SEQ_REFERENCE_DAMAGE_PERCENT,
  seqDamageBonusMultiplier,
  seqResistanceHpMultiplier,
} from './seq-domain';

interface SeqFormulaInfoProps {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
  resistance: number | null;
  resistanceConstant: number | null;
  resistIgnore: number;
  damageBonus: number;
  supportLevel: number;
  supportMaxLevel: number;
}

const pct = (value: number, digits = 2) => `${Number((value * 100).toFixed(digits))}%`;
const mult = (value: number) => `×${value.toFixed(4)}`;

/** Explains the required cactus damage chart (Build-style calculations dialog). */
export function SeqFormulaInfo({
  isOpen,
  onClose,
  locale,
  resistance,
  resistanceConstant,
  resistIgnore,
  damageBonus,
  supportLevel,
  supportMaxLevel,
}: SeqFormulaInfoProps) {
  const t = (en: string, ru: string) => (locale === 'ru' ? ru : en);
  const R = resistance;
  const K = resistanceConstant;
  const known = R !== null && K !== null && K > 0;
  const base = SEQ_REFERENCE_DAMAGE_PERCENT;
  const resistMult = known ? seqResistanceHpMultiplier(R, K, resistIgnore) : null;
  const damageMult = seqDamageBonusMultiplier(damageBonus);
  const total = resistMult === null ? null : resistMult / damageMult;

  return (
    <ToolInfoModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow={t('Sequential · Calculation', 'Последовательность · Расчёт')}
      title={t('Sequential: required cactus damage in 150s', 'Последовательность: необходимый урон по кактусу за 150с')}
      intro={t(
        `The first chart converts each boss’s datamined HP into the damage a reference fighter must deal to a cactus in the same 150 seconds. It applies the Sequential base RES ${R ?? '—'} (${known ? pct(R / (R + K)) : '—'} damage reduction) and assumes the fighter already has ${pct(base, 0)} DMG%. Sequential mechanics are not included.`,
        `Первый график переводит HP босса из датамайна в урон, который эталонный боец должен нанести кактусу за те же 150 секунд. Учитывается базовое сопротивление Последовательности ${R ?? '—'} (${known ? pct(R / (R + K)) : '—'} снижения урона); принято, что у бойца уже есть ${pct(base, 0)} урона%. Механики Последовательности не учитываются.`
      )}
      closeLabel={t('Close', 'Закрыть')}
    >
      <InfoCard>
        <SectionHeading>{t('Formula', 'Формула')}</SectionHeading>
        <InfoRows>
          <InfoRow title={t('Required damage', 'Необходимый урон')} formula="HP × (1 + R × (1 − i) / K) × (1 + D) / (1 + D + d)">
            {t(
              'The cactus has no resistance, so its damage equals the raw damage of the rotation. The boss absorbs part of it with RES; the Space Support DMG% bonus works in Sequential but not on the cactus.',
              'У кактуса нет сопротивления, поэтому урон по нему равен чистому урону ротации. Босс поглощает часть урона сопротивлением; бонус урона% Space Support действует в Последовательности, но не на кактусе.'
            )}
          </InfoRow>
          <InfoRow
            title={t('Sequential base RES', 'Базовое сопротивление Последовательности')}
            formula={`R = ${R ?? '—'} → ${known ? pct(R / (R + K)) : '—'}`}
          >
            {t(
              `Every Sequential boss has ${R ?? '—'} RES of every element (PhyDefBase, FireDefBase, ThunderDefBase, IceDefBase, SuperpowerDefBase in DT_MonsterStaticData_Overseas.json). With the L100 defence constant K = ${K ?? '—'} from DefenceFormula, it reduces damage by R / (R + K) = ${known ? pct(R / (R + K)) : '—'}, which is the HP multiplier ${known ? mult(1 + R / K) : '—'} without ignore.`,
              `У всех боссов Последовательности ${R ?? '—'} сопротивления каждой стихии (PhyDefBase, FireDefBase, ThunderDefBase, IceDefBase, SuperpowerDefBase в DT_MonsterStaticData_Overseas.json). С константой защиты L100 K = ${K ?? '—'} из DefenceFormula это снижает урон на R / (R + K) = ${known ? pct(R / (R + K)) : '—'}, то есть множитель HP ${known ? mult(1 + R / K) : '—'} без игнора.`
            )}
          </InfoRow>
          <InfoRow title={t('Reference fighter', 'Эталонный боец')} formula={`D = ${pct(base, 0)} DMG%`}>
            {t(
              `The calculation assumes the player already has ${pct(base, 0)} DMG% in the same additive category, and the cactus test is measured with it. This is a fixed baseline for comparing stages, not a value read from your build.`,
              `Расчёт исходит из того, что у игрока уже есть ${pct(base, 0)} урона% в той же аддитивной категории и тест на кактусе снят с ним. Это фиксированная база для сравнения этапов, а не значение из вашего билда.`
            )}
          </InfoRow>
          <InfoRow title={t('Resistance ignore', 'Игнор сопротивления')} formula={`i = ${pct(resistIgnore, 0)} → ${resistMult === null ? '—' : mult(resistMult)}`}>
            {t(
              'Ignore lowers the numeric RES, not the reduction percentage. The remaining RES is recalculated with the same R / (R + K) curve, so each next 5% matters less than its label suggests.',
              'Игнор уменьшает числовое сопротивление, а не процент снижения урона. Оставшийся RES пересчитывается по той же кривой R / (R + K), поэтому каждые следующие 5% дают меньше, чем кажется по подписи.'
            )}
          </InfoRow>
          <InfoRow
            title={t('Space Support · Sequential', 'Space Support · Последовательность')}
            formula={`${t('Lv.', 'Ур.')} ${supportLevel}/${supportMaxLevel} → d = ${pct(damageBonus, 0)} → ÷${damageMult.toFixed(4)}`}
          >
            {t(
              `The Sequential Phantasm module of Space Support gives +1% DMG per level in Sequential (Physical, Flame, Frost and Volt modules are identical). DMG% is additive within its category. With D = ${pct(base, 0)}, +${pct(damageBonus, 0)} raises damage by ${pct(damageMult - 1)}, not by ${pct(damageBonus, 0)}. The higher D is, the smaller the gain.`,
              `Модуль «Последовательный фантом» Space Support даёт +1% урона за уровень в Последовательности (физ., огненный, ледяной и электро модули одинаковы). Урон% складывается внутри своей категории. При D = ${pct(base, 0)} +${pct(damageBonus, 0)} повышает урон на ${pct(damageMult - 1)}, а не на ${pct(damageBonus, 0)}. Чем выше D, тем меньше прирост.`
            )}
          </InfoRow>
          <InfoRow title={t('Total multiplier', 'Итоговый множитель')} value={total === null ? '—' : mult(total)}>
            {t('Applied to the pure HP of every stage.', 'Применяется к чистому HP каждого этапа.')}
          </InfoRow>
        </InfoRows>
      </InfoCard>
      <InfoNote label={t('Not included', 'Не учитывается')}>
        {t(
          'Initial invulnerability, damage-reduction shields, stage-specific mechanics and the 1–3% spread of cactus tests. Treat the value as a lower bound for a clean 150-second clear.',
          'Неуязвимость в начале боя, щиты со снижением урона, механики конкретных этапов и разброс 1–3% тестов на кактусе. Значение — нижняя граница для чистого прохождения за 150 секунд.'
        )}
      </InfoNote>
    </ToolInfoModal>
  );
}
