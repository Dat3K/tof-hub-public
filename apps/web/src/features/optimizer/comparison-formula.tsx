import type {ReactNode} from 'react';
import type {BuildRVRole} from '@tof-hub/game-domain';
import {localeText} from '@/lib/i18n/text';
import {formatFixed} from '@/lib/i18n/format';
import {InfoCard,SectionHeading} from '@/components/tool-rail/tool-info-modal';
import {BuildTooltip} from '../build/build-inspection';
import type {BuildLocale} from '../build/types';
import type {OutputComparison} from './model';
import {InventoryGain} from './optimizer-inventory';
import styles from './optimizer-calculation-help.module.css';

function FormulaTerm({children,description}:{children:ReactNode;description:string}) {
  return <BuildTooltip portal content={description}><span className={styles.term} tabIndex={0} data-formula-term>{children}</span></BuildTooltip>;
}

/** One equation and factor explanation for both the rail help and an actual item comparison. */
export function ComparisonFormula({locale,role,inherited=false,result,scenario}:{locale:BuildLocale;role:BuildRVRole;inherited?:boolean;result?:OutputComparison|null;scenario?:string}) {
  const t=localeText(locale),metric=role==='tank'?t('EHP'):role==='healer'?t('ATK'):t('DMG');
  const candidate=t('Complete build with the candidate in this slot, in the selected scenario. All other equipment and settings are held fixed.');
  const equipped=t('Complete build with the currently equipped item in the same slot. This is the denominator and the reference for the gain.');
  const gain=t('The candidate output divided by the equipped output, minus one. Multiply by 100 to express the gain as a percentage. Positive favors the candidate; zero means equal modeled output.');
  const info=(id:string)=>{
    if(id==='attack')return {label:inherited?t('Inherited ATK'):t('Base ATK','Базовая АТК'),description:inherited
      ?t('Altered inherits the selected native source’s final ATK and adds its own ATK after native percentages. The source is recalculated for each replacement. Its ATK% factor is one because the percentage is already inside this value.')
      :t('ATK before the effective ATK% multiplier. In a duo, compare the bases after removing each element’s own Space Support; add the destination’s support once before ATK%. Any separate post-percentage addition is folded into this factor so the product remains exact.')};
    if(id==='attackPercent')return {label:'ATK%',description:t('1 + effective ATK%. The duo uses the higher whole-gear ATK% total; other recognized percentages remain on their own element. Inherited Altered ATK has already included the source percentage.')};
    if(id==='damagePercent')return {label:'DMG%',description:t('1 + effective DMG%. The duo independently chooses the higher whole-gear DMG% total. Recognized loadout bonuses remain included; the losing gear percentage is not summed.')};
    if(id==='crit')return {label:t('Crit'),description:t('1 + min(1, Crit chance) × Crit DMG bonus. Chance includes Crit rating divided by the selected enemy-level coefficient and extra Crit Rate. Effective chance is capped at 100%.')};
    if(id==='hp')return {label:'HP',description:t('HP before HP%. Fixed base/enhancement and recognized flat bonuses participate in the complete replacement output.')};
    if(id==='hpPercent')return {label:'HP%',description:t('1 + effective HP%. This multiplies the HP base in each candidate/equipped state.')};
    return {label:t('Resistance','Сопротивление'),description:t('1 + final RES / K, where final RES = base RES × (1 + RES%). General and selected-element resistance count; K is the character-level defence constant. This is an EHP factor, not damage reduction itself.')};
  };
  const factor=(id:string,expression?:string)=>{const value=info(id);return <FormulaTerm description={value.description}>{expression??value.label}</FormulaTerm>;};
  return <InfoCard><section className={styles.summary} aria-label={t('Exact replacement gain')}>
    <SectionHeading>{t('Replacement gain')}{scenario&&` · ${scenario}`}</SectionHeading>
    <code className={styles.equation}><FormulaTerm description={gain}>{t('gain')}</FormulaTerm>{' = '}<FormulaTerm description={candidate}>O(candidate)</FormulaTerm>{' / '}<FormulaTerm description={equipped}>O(equipped)</FormulaTerm>{' − 1'}</code>
    <code className={styles.equation}>Δ {metric}{' = '}<FormulaTerm description={gain}>{t('gain')}</FormulaTerm>{' × 100%'}</code>
    {result&&<div className={styles.numeric} data-comparison-numeric>
      <code className={styles.equation}>≈ ({result.factors.map((value,index)=><span className={styles.ratio} key={value.id}>
        {index>0&&' × '} {factor(value.id)}{' '}<FormulaTerm description={candidate}>{formatFixed(value.value,locale,4)}</FormulaTerm>{' / '}<FormulaTerm description={equipped}>{formatFixed(value.reference,locale,4)}</FormulaTerm>
      </span>)}{' − 1) × 100%'}</code><InventoryGain value={result.gain} locale={locale}/>
    </div>}
    <div className={styles.factorLine} role="group" aria-label={t('Output factors')}><span>{t('Output factors')} · {metric}</span><code className={styles.equation}>O = {role==='tank'?<>{factor('hp')}{' × '}{factor('hpPercent','(1 + HP%)')}{' × '}{factor('resistance','(1 + RESfinal / K)')}</>:<>{factor('attack')}{' × '}{factor('attackPercent',inherited?'1':'(1 + ATK%)')}{role==='dps'&&<>{' × '}{factor('damagePercent','(1 + DMG%)')}{' × '}{factor('crit','(1 + min(1, c) × k)')}</>}</>}</code></div>
    <p>{t('Hover or focus the terms to see what is counted and which state supplies the numerator or denominator. Displayed factors are rounded; the result uses full precision.')}</p>
  </section></InfoCard>;
}
