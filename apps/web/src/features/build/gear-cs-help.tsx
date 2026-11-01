import {localeText} from '@/lib/i18n/text';
import type {BuildLocale} from './types';
import styles from './build.module.css';

/** Equipment CS explanation shared by Build and both Optimizer formula dialogs. */
export function GearCSHelp({locale,className}:{locale:BuildLocale;className?:string}) {
  const t=localeText(locale);
  return <section className={className??styles.rollValueFormulaBlock} aria-label={t('Equipment CS')}>
    <h3>{t('Equipment CS')}</h3>
    <p>{t('CS is the calculated combat score of one item on the current build. It counts its base and enhancement stats, random stats, Titan-added stats and rare Titan property. All elements count independently, including stats with zero GRV/PRV weight. Crit is not capped for CS. This subtotal does not reconstruct the character’s complete CS.')}</p>
    <div className={styles.rollValueFormula}>
      <code>CS(item) = trunc(Σ CS(stat) + CS(Titan property))</code>
      <code>CS(flat stat) = value × w</code>
      <code>CS% = p × B × w</code>
    </div>
    <p>{t('p is the stat as a fraction (5% = 0.05), B is its base before percentages, w is its CS weight. ATK% uses the stored base ATK directly. HP% and RES% use final HP or RES divided by their full percentage multiplier. Crit Rate and DMG% use fixed weights. The full pool includes the item being scored and selected stat bonuses; it is not the item-free PRV profile.')}</p>
    <p>{t('The capture does not provide full HP% or RES%. Unless entered explicitly, HP% comes from equipped gear; RES% comes from gear, active weapon resonance, Supercomputing and captured account relic passives. That sum may omit another buff. Unknown extra percentages can overestimate the restored base and percentage CS. Missing required bases or coefficients produce —. The model truncates the total once; native per-component rounding is not fully established.')}</p>
    <p>{t('Before Titan, current and forecast item values use the same current build for their percentage pools. Their CS can change with that build’s base stats. Replacement decisions also need PRV and the modeled output gain.')}</p>
  </section>;
}
