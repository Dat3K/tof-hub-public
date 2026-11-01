import type {ReactNode} from 'react';
import {localeText} from '@/lib/i18n/text';
import {InfoDisclosure} from '@/components/tool-rail/tool-info-modal';
import {ElementAttackFormula,RollValueFormula,RollValueProfile} from '../build/gear-roll-value';
import {rollValueContext} from '../build/model';
import {standardRVProfile,STANDARD_RV_PROFILE} from '../build/rv-profile';
import type {BuildCatalog,BuildDraft,BuildLocale} from '../build/types';
import {ComparisonFormula} from './comparison-formula';
import type {OutputComparison} from './model';
import groupStyles from '../build/build-info.module.css';
import styles from './optimizer-calculation-help.module.css';

/** The same scoped explanation in the rail and the selected-item comparison. */
export function OptimizerCalculationHelp({catalog,draft,locale,referenceWeights,result,scenario}:{catalog:BuildCatalog;draft:BuildDraft;locale:BuildLocale;referenceWeights?:ReactNode;result?:OutputComparison|null;scenario?:string}) {
  const t=localeText(locale);
  const context=rollValueContext(draft,catalog);
  return <div className={styles.body}>
    <ComparisonFormula locale={locale} role={context.role} inherited={!!context.inheritFrom} result={result} scenario={scenario}/>
    <div className={groupStyles.calcGroups}>
    <section className={groupStyles.calcGroup}><h3 className={groupStyles.groupTitle}>{t('Comparison and baseline')}</h3>
    <InfoDisclosure title={t('How comparison works')}>
      <p>{t('The weights above the inventory describe the complete effective build, including selected recognized consumables. Replacement PRV removes the equipped item once: base/enhancement, random and Titan-added stats, and any lost enhancement resonance. Both candidates in that slot use the same item-free baseline. Missing required combat totals leave the personal comparison unavailable.')}</p>
      <p>{t('PRV / slot ceiling × 100 measures rated roll potential, including initial values. The ceiling follows legal stats and integer roll allocations, with Crit and Crit Rate sharing the remaining chance below 100%. Different slots have different profiles, Q and ceilings. PRV points and percentages do not equal replacement output gain.')}</p>
    </InfoDisclosure>
    <InfoDisclosure title={t('Replacement output: DMG, ATK or EHP')}>
      <p>{t('DPS: O = [B × (1 + a) + P] × (1 + d) × [1 + min(1, c) × k]. Healer uses only the ATK factor. Tank: O = H × (1 + h) × [1 + R × (1 + r) / K]. Percentages are fractions; B/H/R are bases before percentages, a/d/h/r their bonuses, c is Crit chance, k is the Crit DMG bonus, K is the character-level defence constant, and P is a separate post-percentage ATK addition.')}</p>
      <p>{t('Each state recalculates the complete loadout: enhancement resonance, whole-gear ATK% and DMG% winners, the duo base and the 100% Crit cap. Altered inherits one native element’s own final ATK, adds own Altered ATK after native percentages, and can change its source on replacement. Tank has no native resistance inheritance. The result is exact for these model factors, not measured DPS, healing or a rotation simulation. A positive result favors the candidate.')}</p>
    </InfoDisclosure>
    </section>
    <section className={groupStyles.calcGroup}><h3 className={groupStyles.groupTitle}>{t('Combat inputs and inheritance')}</h3>
    <InfoDisclosure title={t('Element ATK and Space Support')}><ElementAttackFormula locale={locale}/></InfoDisclosure>
    <InfoDisclosure title={t('Consumables and captured stats')}>
      <p>{t('Both pages derive the effective build through the same model. Recognized selected consumables affect personal totals and weights: Enhancement Shot flat bonuses enter before HP%, RES% and native ATK%; recognized ATK% bonuses enter the native percentage. Already-applied gains are tracked so they are not added twice. Changing equipment recalculates these gains; removing a consumable removes its recorded contribution.')}</p>
      <p>{t('Enemy level changes the Crit rating-to-chance coefficient. A displayed chance above 100% is allowed, while the effective output factor is capped at 100%. The comparison removes the equipped item first, so Crit may still matter if the item-free build falls below the cap. Conditional buffs, rotations and unrecognized effects are not simulated.')}</p>
    </InfoDisclosure>
    </section>
    <section className={groupStyles.calcGroup}><h3 className={groupStyles.groupTitle}>{t('Personal rating and roll weights')}</h3>
    <InfoDisclosure title={t('PRV formula and slot ceiling')}><RollValueFormula mode="PRV" locale={locale} role={context.role}/></InfoDisclosure>
    </section>
    <section className={groupStyles.calcGroup}><h3 className={groupStyles.groupTitle}>{t('Upgrade scenarios')}</h3>
    <InfoDisclosure title={t('Titan forecast and its limits')}>
      <p>{t('The main-stat maximum preserves each row’s own Titan growth and uses family pull-up only when it raises that ceiling. Equal original elemental values cannot lower one another’s maximum. Corrected ceilings affect the forecast and its replacement gain; current comparisons still use actual stats.')}</p>
      <p>{t('The target scales the recipient’s own modeled main and added stat maxima; transferring augmentation does not transfer the donor’s rolled values. Current item scores use actual stats. Forecast added stats use the generated observed-share calibration, not a confirmed game maximum or random distribution. The added stat is not multiplied by Titan again.')}</p>
      <p>{t('For mature Titan gear (Aug > 120), main values remain actual; the forecast can change legal lower-stat types. Other forecasts require known pre-Titan values, a valid fully rolled item and an unambiguous primary stat and lower-stat pool. Enhancement changes can affect replacement gain. Rare Titan properties are excluded from GRV/PRV and output gain. The forecast does not predict the number or probability of upgrade attempts.')}</p>
    </InfoDisclosure>
    </section>
    <section className={groupStyles.calcGroup}><h3 className={groupStyles.groupTitle}>{t('Common reference')}</h3>
    <InfoDisclosure title={t('GRV · common reference for all players')}>
      <p>{t('GRV uses the fixed role/element reference, independently of your combat stats. Switching badges to GRV changes the rating scale; replacement gains remain personal. It rates gear stats, excluding fixed base/enhancement stats and rare Titan properties.')}</p>
      <RollValueFormula mode="GRV" locale={locale} role={context.role}/>
      <RollValueProfile profile={standardRVProfile(catalog,context.element)} enemyLevel={STANDARD_RV_PROFILE.enemyLevel} locale={locale} role={context.role}/>
      {referenceWeights}
    </InfoDisclosure>
    </section>
    </div>
  </div>;
}
