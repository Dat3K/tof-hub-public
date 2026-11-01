import { localized } from '@tof-hub/i18n';
import {localeText} from '@/lib/i18n/text';
import {Inspect} from './build-inspection';
import {gearCurrentRollValue,gearRollValue} from './model';
import {STANDARD_RV_PROFILE} from './rv-profile';
import {elementLabel,statLabel,rollValueQuality,rollValueGradeLabels,rollValueStatElement,rollValueStatGroup,formatValue,statIcon} from './presentation';
import type {BuildCatalog,BuildDraft,BuildLocale,GearDraft} from './types';
import styles from './build.module.css';
import type {ReactNode} from 'react';
import {formatNumber} from '@/lib/i18n/format';
import tableStyles from './roll-weight-table.module.css';

type RollValueScore=ReturnType<typeof gearRollValue>;

/** Shared explanation for Build/Ranking help and both Optimizer formula dialogs. */
export function ElementAttackFormula({locale}:{locale:BuildLocale}) {
  const t=localeText(locale);
  return <section className={styles.rollValueFormulaBlock} aria-label={t('Element ATK and Space Support')}>
    <p>{t('The base shown in the game already includes its own Space Support. A solo element uses that base × (1 + its ATK%). For a duo, compare both bases without their own support, then add the selected element’s support once before ATK%. The partner’s support is not copied.')}</p>
    <div className={styles.rollValueFormula}>
      <code>B = max(B₁ − S₁, B₂ − S₂) + S₁</code>
      <code>a = a₁ − g₁ + max(g₁, g₂)</code>
      <code>ATK = B × (1 + a)</code>
      <span>{t('1 is the selected element, 2 is its partner. B₁/B₂ are displayed bases; S₁/S₂ are their Space Support ATK; a₁ is own ATK% and g₁/g₂ are each element’s total gear ATK%. Percentages use fractions.')}</span>
    </div>
    <p>{t('On import, own ATK% comes from native final ATK / displayed base − 1, with known temporary percentages removed separately. Do not subtract Space Support from native final ATK or add it again after ATK%. Build and Optimizer use the same calculation; only displayed values are rounded.')}</p>
  </section>;
}
export function RollValueColor({entry,children}:{entry:RollValueScore['entries'][number]|undefined;children:ReactNode}) {
  if(!entry)return children;
  const {ratio,grade}=rollValueQuality(entry.rv,entry.maximumRV);
  return <span className={`${styles.rollValueTheme} ${styles.rollValueContribution}`} data-grade={grade} data-rv-stat={entry.type} data-rv-source={entry.source} data-rv-stat-quality={ratio??undefined} data-rv-stat-ceiling={entry.maximumRV}>{children}</span>;
}

function RollValueStat({type,catalog,locale}:{type:string;catalog:BuildCatalog;locale:BuildLocale}) {
  return <span className={styles.rollValueStatLabel}><img className={styles.computingEffectIcon} src={statIcon(type,catalog)} alt=""/><span>{statLabel(type,locale)}</span></span>;
}

/** Legend dot in the colour of a stat's group (rollValueStatGroup). */
export function RollValueDot({type}:{type:string}) {
  return <i className={styles.rollValueDot} data-rv-group={rollValueStatGroup(type)} data-rv-element={rollValueStatElement(type)} aria-hidden="true"/>;
}
/**
 * Score bar: one segment per counted stat (its points / the ceiling) in the stat's group colour, or a single
 * grade-gradient bar when no per-stat split is known (build total).
 */
export function RollValueMeter({ratio,label,maximum,segments,className=''}:{ratio:number;label:string;maximum?:number;segments?:{type:string;rv:number}[];className?:string}) {
  const split=segments&&maximum&&maximum>0?segments.filter(segment=>segment.rv>0):null;
  return <div className={`${styles.rollValueMeter} ${className}`} data-segmented={split?'':undefined} role="progressbar" aria-label={label} aria-valuenow={Number((ratio*100).toFixed(1))} aria-valuemin={0} aria-valuemax={100}>
    {split?split.map((segment,index)=><span key={index} data-rv-group={rollValueStatGroup(segment.type)} data-rv-element={rollValueStatElement(segment.type)} style={{width:`${segment.rv/maximum!*100}%`}}/>):<span style={{width:`${ratio*100}%`}}/>}
  </div>;
}

/**
 * Maximum-roll weights: one maximum roll before and after the Titan multiplier and its rating contribution
 * (the strongest weighted roll is 100). Shared by the item GRV/PRV dialog and the Tools · Ranking GRV help.
 */
export function RollWeightList({weights,catalog,locale,mode,presentation='list',density='normal',showMinimum=false}:{weights:RollValueScore['rollWeights'];catalog:BuildCatalog;locale:BuildLocale;mode:string;presentation?:'list'|'table';density?:'normal'|'compact';/** Table only: also the weakest roll after Titan and its weight (Optimizer). */showMinimum?:boolean}) {
  const t=localeText(locale);
  const number=(value:number)=>formatNumber(value,locale,{maximumFractionDigits:1});
  const measure=(type:string,value:number)=>catalog.reference.statTypes[type]?.isPercentageBased?formatValue(value,true,locale,4):number(value);
  if(presentation==='table')return <div className={tableStyles.scroll}><table className={tableStyles.table} data-density={density} data-rv-roll-weights>
    <caption className="sr-only">{t('Stat weights')} · {mode}</caption>
    <thead><tr><th>{t('Stat')}</th>{showMinimum&&<><th>{t('Min. roll · Titan')}</th><th data-weight>{mode}</th></>}<th>{t('Max. roll · Titan')}</th><th data-weight>{mode}</th></tr></thead>
    <tbody>{weights.map(item=><tr key={item.type} data-rv-roll-type={item.type} data-rv-roll-weight={item.value??undefined}><th><RollValueStat type={item.type} catalog={catalog} locale={locale}/></th>{showMinimum&&<><td>{measure(item.type,item.minAfterTitan)}</td><td data-weight data-minimum>{item.minValue===null?'—':number(item.minValue)}</td></>}<td>{measure(item.type,item.afterTitan)}</td><td data-weight>{item.value===null?'—':number(item.value)}</td></tr>)}</tbody>
  </table></div>;
  const row=(item:RollValueScore['rollWeights'][number],weight:number|null)=><div key={item.type} data-rv-roll-type={item.type} data-rv-roll-weight={weight??undefined}><span><RollValueStat type={item.type} catalog={catalog} locale={locale}/><small>{measure(item.type,item.beforeTitan)} → {measure(item.type,item.afterTitan)} · Titan</small></span><strong>{weight===null?'—':number(weight)} {mode}</strong></div>;
  return <>
    <p className={styles.rollValueNote}>{t('One maximum roll, before and after the Titan multiplier, and its rating contribution. The strongest weighted roll in the reference catalog is 100. These are rating units, not damage percentages; fixed Titan gains are excluded from a single roll.')}</p>
    <div className={styles.rollValueRows} data-rv-roll-weights>{weights.filter(item=>item.value!==0).map(item=>row(item,item.value))}</div>
    {weights.some(item=>item.value===0)&&<details><summary>{t('Stats with zero weight')}</summary><div className={styles.rollValueRows}>{weights.filter(item=>item.value===0).map(item=>row(item,0))}</div></details>}
  </>;
}

/** Reference player behind the weights: the GRV baseline or the item-free PRV profile. */
export function RollValueProfile({profile,enemyLevel,locale,role='dps',showPostPercentAttack=true}:{profile:{flatAttack:number;attackPercent:number;damagePercent:number;critChance:number;critDamageBonus:number;resistance?:number;resistancePercent?:number;hp?:number;hpPercent?:number;resistanceConstant?:number;postPercentAttack?:number};enemyLevel:number|string;locale:BuildLocale;role?:'dps'|'healer'|'tank';showPostPercentAttack?:boolean}) {
  const t=localeText(locale);
  const number=(value:number)=>formatNumber(value,locale,{maximumFractionDigits:1});
  // Only the values the role is rated by: tank resistance, healer ATK, DPS the full damage profile.
  const optional=(value:number|undefined,percent=false)=>value===undefined?'—':percent?`${number(value*100)}%`:number(value);
  const support=showPostPercentAttack&&profile.postPercentAttack? <div><span>{t('Added ATK · after ATK%')}</span><b>+{number(profile.postPercentAttack)}</b></div>:null;
  if(role==='tank')return <div className={styles.rollValueProfile}>
    <div><span>{t('HP before HP%')}</span><b>{optional(profile.hp)}</b></div>
    <div><span>HP%</span><b>{optional(profile.hpPercent,true)}</b></div>
    <div><span>{t('Resistance before RES%')}</span><b>{optional(profile.resistance)}</b></div>
    <div><span>{t('RES%')}</span><b>{optional(profile.resistancePercent,true)}</b></div>
    <div><span>{t('Defence constant K')}</span><b>{optional(profile.resistanceConstant)}</b></div>
  </div>;
  if(role==='healer')return <div className={styles.rollValueProfile}>
    <div><span>{t('Flat ATK before ATK%')}</span><b>{number(profile.flatAttack)}</b></div>
    <div><span>{t('ATK%')}</span><b>{number(profile.attackPercent*100)}%</b></div>
    {support}
  </div>;
  return <div className={styles.rollValueProfile}>
    <div><span>{t('Flat ATK before ATK%')}</span><b>{number(profile.flatAttack)}</b></div>
    <div><span>{t('ATK%')}</span><b>{number(profile.attackPercent*100)}%</b></div>
    {support}
    <div><span>{t('DMG%')}</span><b>{number(profile.damagePercent*100)}%</b></div>
    <div><span>{t('Crit chance')}</span><b>{number(profile.critChance*100)}%</b></div>
    <div><span>{t('Crit DMG bonus')}</span><b>{number(profile.critDamageBonus*100)}%</b></div>
    <div><span>{t('Enemy level','Уровень врага')}</span><b>{enemyLevel}</b></div>
  </div>;
}

/** Roll Value formula and its local damage weights (shared by the build item dialog and the Tools · Ranking help). */
/** Grade legend from ROLL_VALUE_GRADES: the colour bands by share of the max GRV (item dialog and RV help). */
export function RollValueScale() {
  return <div className={styles.rollValueScale}>{rollValueGradeLabels().map(({grade,label})=><span className={styles.rollValueTheme} data-grade={grade} key={grade}>{label}</span>)}</div>;
}
export function RollValueFormula({mode,locale,role='dps'}:{mode:string;locale:BuildLocale;role?:'dps'|'healer'|'tank'}) {
  const t=localeText(locale);
  const scope=<section className={styles.rollValueFormulaBlock} aria-label={t('Weapon and matrix damage in gear comparisons')}>
    <p><strong>{t('Why weapon and matrix damage multipliers are separate')}</strong></p>
    <p>{t('Additional damage multipliers from weapons and matrices are separate from gear stats. Multiplication order does not change the result. When the same multiplier M applies to both gear options, it cancels out of their damage ratio, so it does not affect which option is better.')}</p>
    <div className={styles.rollValueFormula}><code>(M × D₂) / (M × D₁) = D₂ / D₁</code></div>
    <p>{t('The calculator and showcase focus on gear comparison, rather than full combat DPS. Common multipliers that stay unchanged with the same weapons, matrices and combat conditions can therefore be omitted from the rating. Bonuses that change ATK, Crit or other rated stats still matter through the calculation inputs and PRV weights; effects that change with the gear cannot be discarded on this basis.')}</p>
  </section>;
  const q=role==='dps'
    ?t('Q: largest weighted maximum roll after the Titan multiplier, across the generated stat catalog.')
    :t('Q: largest weighted maximum roll after the Titan multiplier among the stats this role rates.');
  const titan=<details><summary>{t('Titan-added stats: why equal rolls can give different HP')}</summary>
    <p>{t('Titan forecasts keep each original stat’s own growth ceiling. For elemental ATK, ATK% and DMG%, pull-up can raise that ceiling but cannot lower it, including when pre-Titan values are equal. This affects forecast stats and gains; current GRV/PRV and ranking use actual stats. Missing or unconfirmed pull-up factors leave the forecast unknown.')}</p>
    <p>{t('Current GRV and PRV use the actual added stats of the item. Perfect items and Titan forecasts estimate them from the primary stat after Titan, not just from the number of original rolls. The primary’s fixed Titan gain and multiplier can differ between flat and percentage stats, so five maximum rolls can produce different added HP or resistance.')}</p>
    <div className={styles.rollValueFormula}><code>{t('Equivalent rolls = (primary after Titan − primary initial value) / primary maximum roll')}</code><code>{t('Added stat = its initial value + observed share × equivalent rolls × its maximum roll')}</code></div>
    <p>{t('The forecast share comes from captured-item observations; the exact game maximum and random distribution are not confirmed. The added stat is not increased by Titan again. Only the primary’s allowed pools can supply additions: unused priority stats fill the slots first, then fallback stats. A missing universal RES above does not guarantee universal RES below.')}</p>
    <p>{t('Single-roll weights compare one upgrade, excluding fixed Titan gains. Perfect compares the entire legal item, including initial values, fixed gains and permitted additions. Its best primary can therefore differ from the highest-weight single roll.')}</p>
  </details>;
  const altered=<p>{mode==='GRV'?t('GRV rates gear only. Altered DPS and healer use one native gear ATK source for the whole set, plus applicable universal ATK and own Altered ATK after native percentages. DPS also counts crit; gear DMG% adds zero. Tank rates HP, HP%, universal / Altered RES and Altered RES%, without native resistance inheritance. The fixed reference for the selected role is shown separately. Weapons, matrices and other combat bonuses do not supply gear rating points.'):t('GRV and PRV rate gear only. Altered DPS uses one native element’s ATK and ATK% plus universal ATK and crit; gear DMG% adds zero. Altered healer uses the same ATK without crit. Own Altered ATK is added after percentages. GRV chooses one source for the whole set; personal comparisons can change the source on replacement. Altered tank uses HP, HP%, universal RES, Altered RES and Altered RES%, with no native resistance inheritance. Its GRV reference is 2,500,000 HP, 15,000 RES before +20% RES (18,000 effective RES), K at level 100. Matrices, weapons and other bonuses are not gear rating contributions; personal totals only set the PRV weights.')}</p>;
  const head=<>{scope}<div className={styles.rollValueFormula}><code>{mode} = 100 × Σ(T × w) / Q</code><code>Q = maxⱼ[maximum rollⱼ × (1 + Titan multiplierⱼ) × wⱼ,norm × λⱼ]</code><span>{t('T: the counted stat’s current value, including its initial value. w: local weight of the role and element. Fixed equipment base/enhancement stats and rare Titan properties are excluded.')} {q} {mode==='GRV'?t('DPS normalization uses the catalog-wide damage derivatives; healer/tank use only their rated families. λ = 1. Fixed Titan gains are excluded from a single roll. Q is shared across slots; each slot has its own legal ceiling.'):t('DPS normalization weights use the catalog-wide damage derivatives; healer/tank use only their rated families. λ is 1 except for finite Crit contributions capped in PRV. Fixed Titan gains are excluded from a single roll. GRV shares Q across slots; PRV recalculates Q and the ceiling for each item-free profile.')}</span></div>{altered}</>;
  // Tank: effective HP against the selected element; resistance has diminishing returns through K + R(1+r).
  if(role==='tank')return <div className={styles.rollValueFormulaBlock}>{head}
    <p>{t('Weights are derivatives of log EHP, EHP = H(1 + h) × (1 + R(1 + r) / K): H is HP before HP%, h is HP%, R is the element’s resistance before RES% (general RES counts the same), r is its RES%, K is the game’s defence constant of the level (damage reduction = R(1 + r) / (R(1 + r) + K)). Each further point of resistance gives less.')}</p>
    <div className={styles.rollValueFormula}><code>w(HP) = 1 / H</code><code>w(HP%) = 1 / (1 + h)</code><code>w(RES) = (1 + r) / (K + R(1 + r))</code><code>w(RES%) = R / (K + R(1 + r))</code></div>
    {titan}
  </div>;
  if(role==='healer')return <div className={styles.rollValueFormulaBlock}>{head}
    <p>{t('A healer gathers one ATK: weights are derivatives of log[B × (1 + a) + P]. B is the used base including Space Support once before ATK%; a is effective ATK%. P represents any separate post-percentage addition, not this support bonus (P = 0 for ordinary elemental profiles). Crit and DMG% are not rated.')}</p>
    <div className={styles.rollValueFormula}><code>w(ATK) = (1 + a) / (B(1 + a) + P)</code><code>w(ATK%) = B / (B(1 + a) + P)</code></div>
    {titan}
  </div>;
  return <div className={styles.rollValueFormulaBlock}>{head}
    {mode.includes('PRV')&&<><p>{t('PRV counts Crit and Crit Rate together only up to 100% chance. Both contributions are multiplied by the same remaining-chance fraction λ. A finite roll also uses this cap when Q and the ceiling are computed. The enemy level changes rating-to-chance conversion. The item-free profile can fall below 100%, so Crit may still have value even when the equipped panel is capped.')}</p><div className={styles.rollValueFormula}><code>Δc = Crit(item) / D(enemy level) + Crit Rate(item)</code><code>λ = Δc &gt; 0 ? min(1, max(0, 1 − c) / Δc) : 1</code><code>RV(Crit + Crit Rate) = λ × 100 × Σ(T × w) / Q</code></div></>}
    <p>{t('Weights are derivatives of log[(B × (1 + a) + P) × (1 + d) × (1 + c × k)]. B is the used base including Space Support once before ATK%, a is effective ATK%, P is a separate post-percentage addition (zero in ordinary elemental profiles and the GRV reference), d is DMG%, c is capped Crit chance, and k is the Crit damage bonus. Percentages use fractions. The score uses local weights and is not an exact DPS change.')}</p>
    <div className={styles.rollValueFormula}><code>w(ATK) = (1 + a) / (B(1 + a) + P)</code><code>w(ATK%) = B / (B(1 + a) + P)</code><code>w(DMG%) = 1 / (1 + d)</code><code>w(Crit Rate%) = k / (1 + c × k)</code><code>w(Crit) = w(Crit Rate%) / {t('enemy-level denominator')}</code><span>{t('Both Crit weights are zero when c ≥ 1.')}</span></div>
    {titan}
  </div>;
}

function RollValueSummary({value,maximum,locale,caption,ceilingLabel,qualityLabel,ratioLabel,mode,segments,children}:{mode:string;value:number|null;maximum:number;locale:BuildLocale;caption:string;ceilingLabel:string;qualityLabel:string;ratioLabel?:string;segments?:{type:string;rv:number}[];children?:ReactNode}) {
  const {ratio,grade}=rollValueQuality(value,maximum);
  const number=(amount:number)=>formatNumber(amount,locale,{maximumFractionDigits:1});
  return <div className={`${styles.rollValueDetails} ${styles.rollValueTheme}`} data-grade={grade}>
    {value===null?<div className={styles.rollValueEmpty}><span>{caption}</span><b>{localeText(locale)('Not calculated')}</b></div>:<div className={styles.rollValueHero}><div><strong>{number(value)} <small>{mode}</small></strong><span>{caption}</span></div><div><b>{ratio===null?'—':number(ratio*100)+'%'}</b><span>{ratioLabel??(localeText(locale)('of maximum'))}</span></div></div>}
    {ratio!==null&&<RollValueMeter ratio={ratio} label={qualityLabel} maximum={maximum} segments={segments}/>}
    <div className={styles.rollValueCeiling}><span>{ceilingLabel}</span><b>{number(maximum)} {mode}</b></div>
    {children}
  </div>;
}

/** `empty`: no slot holds an item, so there is no build to compare and the line shows only a dash. */
export function TotalRollValue({value,maximum,locale,mode,empty=false}:{value:number|null;maximum:number;locale:BuildLocale;mode:'grv'|'prv';empty?:boolean}) {
  const {ratio,grade}=rollValueQuality(value,maximum);
  const number=(amount:number)=>formatNumber(amount,locale,{maximumFractionDigits:1});
  const t=localeText(locale);
  const summary=<RollValueSummary value={value} maximum={maximum} locale={locale} mode={mode.toUpperCase()} caption={t('Equipped gear','Надетая экипировка')} ceilingLabel={t('Build maximum')} qualityLabel={t('Build roll quality')}>
    {value===null&&<p className={styles.rollValueNote}>{t('Equip at least one item and provide valid rating inputs for every equipped slot. Empty slots add no points; their ceilings remain part of the build maximum.')}</p>}
  </RollValueSummary>;
  const details=<div className={styles.rollValueDialog} data-rv-mode={mode}>
    <div className={styles.rollValueIntro}><p>{mode==='grv'?t('Total of the equipped items’ GRV against the total of their slot ceilings, using one reference profile for everyone.'):t('Total of the equipped items’ PRV against the total of their slot ceilings, using your current panel stats.')}</p></div>
    {summary}
    <div className={styles.rollValueMethod}>
      <dl className={styles.rollValueMeaning}>
        <div><dt>{t('Score','Оценка')}</dt><dd>{t('Sum of the slot scores. Open the RV of an item for its own breakdown.')}</dd></div>
        <div><dt>{t('Percentage')}</dt><dd>{t('Share of the build maximum. It is not a damage bonus or a ranking among players.')}</dd></div>
        {mode==='prv'&&<div><dt>PRV</dt><dd>{t('Each item is rated after removing only that item, so the total is not the effect of removing or adding the whole set at once.')}</dd></div>}
      </dl>
    </div>
  </div>;
  return <span className={`${styles.rollValueTheme} ${styles.totalRVLine}`} data-grade={grade}><Inspect editTarget="rv" title={mode==='grv'?t('Total Global Roll Value'):t('Total Personal Roll Value')} tooltipDetails={summary} details={details}><span>{t('Total ')}{mode.toUpperCase()} </span><span className={styles.rollValueBadge}><strong className={styles.totalRVCurrent}>{value===null?'—':number(value)}</strong>{!empty&&<span className={styles.totalRVReference}> / {number(maximum)} · {ratio===null?'—':number(ratio*100)+'%'}</span>}</span></Inspect></span>;
}

export function GearRollValue({gear,draft,catalog,locale,score=gearCurrentRollValue(gear,draft,catalog)}:{gear:GearDraft;draft:BuildDraft;catalog:BuildCatalog;locale:BuildLocale;score?:RollValueScore}) {
  const {ratio,grade}=rollValueQuality(score.value,score.maximum);
  const mode=score.mode.toUpperCase();
  const t=localeText(locale);
  const number=(value:number)=>formatNumber(value,locale,{maximumFractionDigits:1});
  const measure=(type:string,value:number)=>catalog.reference.statTypes[type]?.isPercentageBased?formatValue(value,true,locale,4):number(value);
  const ignored=score.entries.filter(entry=>!entry.useful&&!score.entries.some(useful=>useful.useful&&useful.source===entry.type)).map(entry=>entry.type);
  const summary=<RollValueSummary value={score.value} maximum={score.maximum} locale={locale} mode={mode} caption={`${(score.flatElements??[score.element]).map(e=>elementLabel(e,locale)).join(' / ')} · ${t('Current stats')}`} ceilingLabel={t('Slot ceiling')} qualityLabel={t('Slot roll quality')} ratioLabel={t('of slot ceiling')}>
    {score.value===null?<p className={styles.rollValueNote}>{!score.profile?t('Enter base ATK, ATK%, DMG%, Crit and a supported enemy level. Totals must include this equipped item and remain valid after removal.'):score.reason==='missing'?t('Enter all four pre-Titan stats.'):score.reason==='unsupported'?t('The source does not confirm this pull-up case.'):t('Check SSR stat ranges and stars.')}</p>:<div className={styles.rollValueRows}>{score.entries.filter(entry=>entry.useful).map((entry,i)=><div key={i}><span><RollValueStat type={entry.type} catalog={catalog} locale={locale}/>{entry.source!==entry.type&&<small> ← {statLabel(entry.source,locale)}</small>}<small>{t('Now')}: {measure(entry.type,entry.value)}</small></span><strong><RollValueColor entry={entry}>{number(entry.rv)} {mode}</RollValueColor></strong></div>)}</div>}
    {ignored.length>0&&<div className={styles.rollValueIgnored}><span className={styles.rollValueIgnoredStats}>{ignored.map(type=><RollValueStat key={type} type={type} catalog={catalog} locale={locale}/>)}</span><b>0 {mode}</b></div>}
    {score.conservative&&<p className={styles.rollValueNote}>{t('Tied strongest stats: conservative estimate.')}</p>}
  </RollValueSummary>;
  const profile=score.profile;
  const details=<div className={styles.rollValueDialog} data-rv-mode={score.mode}>
    <div className={styles.rollValueIntro}><p>{score.mode==='grv'?(score.role==='tank'?t('One reference profile for everyone. Compare tank gear as it is now by the effective HP it adds against the selected element, independently of account stats.')
      :score.role==='healer'?t('One reference profile for everyone. Compare healer gear as it is now by the ATK it adds, independently of account stats.')
      :t('One reference profile for everyone. Compare offensive gear as it is now in the same element and weapon context, independently of account stats.')):t('The current equipped item is subtracted first. Its current stats are then rated using the remaining build, rather than added on top of its own current stats.')}</p></div>
    {summary}
    <div className={styles.rollValueMethod}>
      <dl className={styles.rollValueMeaning}>
        <div><dt>{t('Score','Оценка')}</dt><dd>{t('Sum of the useful stats the item has now (random stats and the stats Titan added), expressed in units of a maximum weighted roll. Initial stat values also count: this is not a roll count.')}</dd></div>
        <div><dt>{t('Percentage')}</dt><dd>{score.value===null?'—':`${number(score.value)} / ${number(score.maximum)} × 100 = ${number((ratio??0)*100)}%.`} {t('Share of this slot’s theoretical ceiling, not extra damage or a ranking among players.')}</dd></div>
        <div><dt>{t('Context')}</dt><dd>{elementLabel(score.element,locale)} · {localized(score.weapon?.weapon, locale)||t('Single element')}<br/>{score.role==='tank'?t('Rated: HP, HP%, general RES, the element’s RES and RES%'):<>{t('Percent-stat pool')}: {score.percentElements.map(e=>elementLabel(e,locale)).join(' / ')}{score.role==='healer'?` · ${t('no crit or DMG%')}`:''}</>}</dd></div>
      </dl>
      <h3>{t('Maximum roll weights')}</h3>
      <RollWeightList weights={score.rollWeights} catalog={catalog} locale={locale} mode={mode}/>
      <h3>{score.mode==='prv'?t('Build without this item'):t('Reference used for this score')}</h3>
      {score.mode==='prv'&&score.removed&&<><p className={styles.rollValueNote}>{t('Current item removed from the panel totals')}</p><div className={styles.rollValueProfile} data-rv-removal>
        {score.role==='tank'?<>
        <div><span>{t('HP removed')}</span><b>{number(score.removed.hp??0)}</b></div>
        <div><span>HP%</span><b>{number((score.removed.hpPercent??0)*100)}%</b></div>
        <div><span>{t('RES removed')}</span><b>{number(score.removed.resistance??0)}</b></div>
        <div><span>{t('RES%')}</span><b>{number((score.removed.resistancePercent??0)*100)}%</b></div>
        </>:<>
        <div><span>{t('Flat ATK removed')}</span><b>{number(score.removed.flatAttack)}</b></div>
        <div><span>{t('ATK%')}</span><b>{number(score.removed.attackPercent*100)}%</b></div>
        {score.role!=='healer'&&<><div><span>{t('DMG%')}</span><b>{number(score.removed.damagePercent*100)}%</b></div>
        <div><span>{t('Crit removed')}</span><b>{number(score.removed.critRating)}</b></div>
        <div><span>{t('Crit Rate removed')}</span><b>{number(score.removed.critRate*100)}%</b></div></>}
        </>}
      </div></>}
      {profile?<RollValueProfile profile={profile} role={score.role} enemyLevel={score.mode==='grv'?STANDARD_RV_PROFILE.enemyLevel:draft.enemyLevel} locale={locale}/>:<p className={styles.rollValueNote}>{t('Personal reference unavailable. GRV is available through the switch below the card.')}</p>}
      <p className={styles.rollValueNote}>{score.mode==='grv'?t('These baseline values are site assumptions, not official game constants. Your buffs, enemy level and current Crit do not change GRV weights.'):t('The starting flat pool is base ATK before percentages for the selected element; it is not the hidden universal account base. Current base/enhancement, random and augmentation stats of this item are removed, including a lost enhancement resonance. Crit is subtracted before the chance is capped. Entered totals must include the equipped item. Inconsistent totals leave PRV unavailable. Conditional buffs and rotations are held fixed. PRV remains a linear roll-potential rating at the item-free baseline, not the exact damage increase after re-equipping it or crossing the Crit cap.')}</p>
      <details><summary>{t('How the calculation works')}</summary>
        <RollValueFormula mode={mode} locale={locale} role={score.role}/>
        <div className={styles.rollValueRows}>{score.entries.filter(e=>e.useful).map((e,i)=><div key={i}><span><RollValueStat type={e.type} catalog={catalog} locale={locale}/><small>{measure(e.type,e.value)} / {measure(e.type,e.maximumRoll)} × 100</small></span><strong>{number(e.rv)} {mode}</strong></div>)}</div>
        <p>{t('The divisor in each contribution converts that stat into rating units; it is not necessarily the size of that stat’s own maximum roll. In GRV, one maximum Crit roll after the Titan multiplier equals 100. In PRV, the strongest weighted roll may be a different stat, and Q is recalculated. GRV and PRV numbers are not interchangeable.')}</p>
      </details>
      <details><summary>{t('Current values and useful stats')}</summary>
        <p>{t('The score reads the item’s current values: its random stats and the stats Titan added, as they are now, the same rule as the rankings. Titan growth is random per stat, so the score rises as the item is upgraded. Base stats and enhancement are excluded. The slot ceiling is the perfect item at full Titan. PRV removes actual current stats before rating.')}</p>
        <p>{t('Universal ATK and the selected elemental ATK have equal weight per point for the four core elements, but universal ATK has a smaller maximum roll. Altered is separate: universal ATK does not count and core elements cannot pull it up. HP and resistance are outside this offensive rating.')}</p>
        <p>{t('For duo weapons, GRV counts the higher flat elemental ATK of the pair on each item. Frost and Volt use the same Frost–Volt rating. PRV follows the selected element and personal profile. A standalone item uses the higher ATK% and DMG% independently. The whole build uses one ATK% element across all slots, chosen by the higher gear total, and independently chooses one DMG% element. The pair is never added together. Auto follows the main resonance of the newest eligible weapon; healer and tank use the newest weapon of their role. Without a matching resonance, DPS falls back to native final ATK.')}</p>
      </details>
      <details><summary>{t('Slot ceiling, validation and colors')}</summary>
        <p>{t('The ceiling is the best allowed set of')} {catalog.reference.limits.maxNumOfRandomStats} {t('original stats and')} {catalog.reference.limits.maxNumOfRandomStatRolls} {t('maximum rolls, projected to full Titan in this model. The rolls and initial stats must belong to the same legal set. It depends on slot restrictions, element and profile. Missing, duplicate or forbidden stats, impossible star/roll histories and unsupported projections have no score.')}</p>
        <p>{t('Item color uses score ÷ slot ceiling. Contribution color uses that stat’s contribution ÷ its own five-roll maximum in the same profile; these percentages have different denominators.')}</p>
        <RollValueScale/>
      </details>
      <a href={`${catalog.reference.source}/blob/${catalog.reference.revision}/src/definitions/stat-types.ts`} target="_blank" rel="noreferrer">{t('Game stat ranges and Titan coefficients · tof-tools')} ↗</a>
    </div>
  </div>;
  return <div className={`gear-rv ${styles.rollValueTheme}`} data-grade={grade} data-rv-quality={ratio??undefined}><Inspect title={`${localized(catalog.gear.find(item=>item.id===gear.id)!.name, locale)} · ${score.mode==='grv'?t('Global Roll Value'):t('Personal Roll Value')}`}  tooltipDetails={summary} details={details}><span className={styles.rollValueBadge}>{score.value===null?'—':number(score.value)} <small>{mode}</small></span></Inspect></div>;
}
