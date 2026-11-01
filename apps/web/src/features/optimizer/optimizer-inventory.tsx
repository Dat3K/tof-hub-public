import { localized, localizedUi } from '@tof-hub/i18n';
import {memo,useMemo,type ReactNode} from 'react';
import {Button} from '@tof-hub/ui';
import {GearStatChips} from '../build/gear-stat-chips';
import {GearStatPreview} from '../build/gear-stat-preview';
import {Stars} from '../build/stars';
import {BuildTooltip} from '../build/build-inspection';
import {elementTotalAttack,gearCurrentRollValue,gearRollDetails,normalMaximums,rollValueContext,titanMaximums} from '../build/model';
import {formatValue,rollValueQuality} from '../build/presentation';
import buildStyles from '../build/build.module.css';
import {formatFixed} from '@/lib/i18n/format';
import {localeText} from '@/lib/i18n/text';
import type {BuildCatalog,BuildDraft,BuildLocale,GearDraft} from '../build/types';
import {personalRVProfile} from '../build/rv-profile';
import type {BuildRVProfile} from '@tof-hub/game-domain';

/** Percent stat hints use the selected element's actual base, including duo inheritance. */
export function gearSummaryContext(draft:BuildDraft,catalog:BuildCatalog) {
  const context=rollValueContext(draft,catalog);
  return {...context,attackBase:elementTotalAttack(draft,catalog,context.selected).base,equivalenceProfile:personalRVProfile(draft,catalog,context.selected)??undefined};
}
import type {RankedPiece} from './model';
import styles from './optimizer.module.css';

const percentage=(value:number|null,locale:BuildLocale)=>value===null?'—':`${value>0?'+':''}${formatFixed(value*100,locale,3)}%`;
export const prvPoints=(value:number|null,locale:BuildLocale)=>value===null?'—':formatFixed(value,locale,1);
export function InventoryGain({value,locale}:{value:number|null;locale:BuildLocale}) {
  return <b className={styles.gain} data-positive={value!==null&&value>1e-8||undefined} data-negative={value!==null&&value<-1e-8||undefined}>{percentage(value,locale)}</b>;
}
export function projectionLabel(entry:RankedPiece,locale:BuildLocale) {
  const t=localeText(locale);
  return {transfer:t('After transfer'),augment:t('After augmentation'),reroll:t('Reroll lower stats'),headroom:t('Actual · Aug > 120')}[entry.projection.kind];
}
export const gearStage=(gear:GearDraft)=>gear.titan?'titan':gear.augmented?'augmented':'normal';
/** Compare ceiling shares using each loadout's own maximum, before display rounding. */
export function RatingShareChange({before,after,locale}:{before:{value:number|null;maximum:number};after:{value:number|null;maximum:number};locale:BuildLocale}) {
  const previous=rollValueQuality(before.value,before.maximum).ratio;
  const current=rollValueQuality(after.value,after.maximum).ratio;
  const share=(ratio:number|null)=>ratio===null?'—':`${formatFixed(ratio*100,locale,2)}%`;
  const delta=previous===null||current===null?null:Math.round((current-previous)*10000)/100;
  const t=localeText(locale);
  return <small className={styles.whatIfDelta} title={t('Real → temporary share of maximum. Each uses its own ceiling; change is in percentage points.')}>
    {share(previous)} → {share(current)}{delta!==null&&<> ({delta>0?'+':''}{formatFixed(delta,locale,2)} {t('pp')})</>}
  </small>;
}
/** Corner score: personal PRV by default, optional standard GRV, slot-ceiling share and personal output gain. */
export function GearScore({prv,maximum,gain,baseline,baselineMaximum=maximum,locale,metric,rating}:{prv:number|null;maximum:number;gain?:number|null;baseline?:number|null;baselineMaximum?:number;locale:BuildLocale;metric?:string;rating?:{gear:GearDraft;draft:BuildDraft;catalog:BuildCatalog;mode:'prv'|'grv'}}) {
  const mode=rating?.mode??'prv';
  if(rating&&mode==='grv') {
    const score=gearCurrentRollValue({...rating.gear,equipped:true},{...rating.draft,rv:{element:'auto',includeCrit:true,...rating.draft.rv,mode}},rating.catalog);
    prv=score.value;maximum=score.maximum;
  }
  // Coloured by the share of the slot ceiling, with Build's GRV/PRV grade bands and badge.
  const {ratio,grade}=rollValueQuality(prv,maximum);
  return <span className={styles.gearScore}><span className={`${buildStyles.rollValueTheme} ${buildStyles.rollValueBadge}`} data-grade={grade}>{prvPoints(prv,locale)} <small>{mode.toUpperCase()}</small>{ratio!==null&&<><span aria-hidden="true"> · </span><span className={styles.gearQuality} title={mode==='grv'?(localeText(locale)('Share of the slot’s maximum GRV on the standard scale', 'Доля максимального GRV слота по общей шкале')):(localeText(locale)('Share of the slot’s maximum PRV for the current build', 'Доля максимального PRV слота для текущего билда'))}>{formatFixed(ratio*100,locale,1)}%</span></>}</span>{baseline!==undefined&&<RatingShareChange before={{value:baseline,maximum:baselineMaximum}} after={{value:prv,maximum}} locale={locale}/>} {gain!==undefined&&<span title={metric?`Δ ${metric}`:undefined}><InventoryGain value={gain} locale={locale}/></span>}</span>;
}

/**
 * One gear cell of the Optimizer board, laid out like the Build card's equipment cell: stage art, name and
 * enhancement, stage and stars, a right-hand score, then the read-only stats with their rolls and caller-owned rows.
 * `flat` drops the frame for a half of an inventory pair; `caption` labels that half.
 */
export function GearCell({gear,catalog,locale,ratedTypes,score,tone,label,action,status,empty,caption,captionTone,current,flat,density='normal',summaryContext,needsInput=false,pad,children}:{pad?:{random:number;added:number};gear:GearDraft;catalog:BuildCatalog;locale:BuildLocale;ratedTypes?:readonly string[];score?:ReactNode;tone?:'upgrade'|'reroll'|'better'|'whatif';label:string;action?:ReactNode;status?:ReactNode;empty?:boolean;caption?:ReactNode;/** reference = neutral, now = sky, forecast (default) = gold. */captionTone?:'reference'|'now';current?:boolean;flat?:boolean;density?:'normal'|'compact';needsInput?:boolean;summaryContext?:{element:string;role:'dps'|'healer'|'tank';attackBase?:number;equivalenceProfile?:BuildRVProfile};children?:ReactNode}) {
  const t=localeText(locale),meta=catalog.gear.find(item=>item.id===gear.id),stage=gearStage(gear);
  return <section className={styles.gearCell} data-needs-input={needsInput||undefined} data-tone={tone} data-flat={flat||undefined} data-density={density} aria-label={label}>
    {status&&<div className={styles.whatIfRibbon}>{status}</div>}
    {caption&&<p className={styles.gearCaption} data-tone={captionTone} data-current={current||undefined}>{caption}</p>}
    <header className={styles.gearHead}>
      {meta&&<img className={styles.gearIcon} src={meta.icons[stage]} alt=""/>}
      <div className={styles.gearName}>
        <div><b title={localizedUi(meta?.name, locale)}>{localizedUi(meta?.name, locale)??gear.id}</b>{!empty&&<small>+{gear.enhancement}</small>}</div>
        {!empty&&<span data-stage={stage}>{stage==='titan'?t('TITAN'):stage==='augmented'?t('AUGMENTED'):t('NORMAL')} · <Stars value={gear.stars}/></span>}
      </div>
      {score}{action}
    </header>
    {empty?<p className={styles.gearEmpty}>{t('Empty slot')}</p>:<GearStatPreview gear={gear} catalog={catalog} locale={locale} ratedTypes={ratedTypes} showCount presentation="cell" pad={pad} density={density} maximums={stage==='normal'?normalMaximums({...gear,equipped:true},catalog):titanMaximums({...gear,equipped:true},catalog)} rolls={gearRollDetails({...gear,equipped:true},catalog)}/>}
    {!empty&&summaryContext&&<div className={styles.gearStatSummary} aria-label={t('Useful stat totals')}><GearStatChips entries={[...gear.rows,...(gear.titan||gear.augmented?gear.augments:[])].filter(row=>ratedTypes?.includes(row.type))} element={summaryContext.element} flatElements={ratedTypes?.filter(type=>type.endsWith(' Attack')).map(type=>type.slice(0,-7))} role={summaryContext.role} attackBase={summaryContext.attackBase} equivalenceProfile={summaryContext.equivalenceProfile} catalog={catalog} locale={locale}/></div>}
    {children}
  </section>;
}

/**
 * Backpack pieces. Two-state comparisons take two grid columns; comparisons with a pre-Titan reference and a forecast
 * take three. Each state shows its PRV and output gain in the corner.
 */
type InventoryGridProps={entries:readonly RankedPiece[];draft:BuildDraft;catalog:BuildCatalog;locale:BuildLocale;metric:string;target:number;label:string;ratingMode?:'prv'|'grv';onCompare:(key:string)=>void;onTry?:(key:string,forecast:boolean)=>void;baseline?:ReadonlyMap<string,RankedPiece>};
export const OptimizerInventoryGrid=memo(function OptimizerInventoryGrid({entries,...props}:InventoryGridProps) {
  const summaryContext=useMemo(()=>gearSummaryContext(props.draft,props.catalog),[props.draft,props.catalog]);
  return <div className={styles.inventoryArea}><ul className={styles.inventoryGrid} aria-label={props.label}>{entries.map(entry=><InventoryPair key={entry.piece.key} entry={entry} {...props} summaryContext={summaryContext}/>)}</ul></div>;
});
const InventoryPair=memo(function InventoryPair({entry,draft,catalog,locale,metric,target,ratingMode='prv',onCompare,onTry,baseline,summaryContext}:Omit<InventoryGridProps,'entries'>&{entry:RankedPiece;summaryContext:ReturnType<typeof gearSummaryContext>}) {
  const t=localeText(locale);
    const gear=entry.piece.gear,name=localizedUi(catalog.gear.find(item=>item.id===gear.id)?.name, locale)??gear.id;
    const original=entry.piece.key.startsWith('equipped-');
    const previous=baseline?.get(entry.piece.key);
    const better=entry.gain!==null&&entry.gain>1e-8;
    const forecast=entry.forecast&&entry.projection.gear;
    // Without a forecast a developed piece shows where it came from: its pre-Titan state beside the current one.
    const before=!forecast?entry.before:null;
    const now=gear.titan?t('Titan · current'):gear.augmented?t('Augmented · current'):t('Before Titan · current');
    const beforeLabel=t('Before Titan','До титана');
    // Halves of one pair carry the same number of rows per group, so stats and the Titan separator line up.
    const halves=[before?.gear,gear,forecast?entry.projection.gear:null].filter((item):item is GearDraft=>!!item);
    const pad={random:Math.max(...halves.map(item=>item.rows.filter(row=>row.type).length)),added:Math.max(...halves.map(item=>item.titan||item.augmented?item.augments.filter(row=>row.type).length:0))};
    return <li key={entry.piece.key} data-pair={forecast||before?true:undefined} data-pair-columns={forecast&&before?3:undefined}>
      <article className={styles.pairCard} data-tone={original?'whatif':better?'better':undefined} aria-label={`${name} · ${entry.piece.key}`}>
        {original&&<div className={styles.whatIfRibbon}>{t('Equipped (real)')}</div>}
        <div className={styles.pairHalves}>
          {before&&<GearCell flat pad={pad} captionTone="reference" caption={beforeLabel} gear={before.gear} catalog={catalog} locale={locale} summaryContext={summaryContext} ratedTypes={entry.ratedTypes} label={beforeLabel}
            score={<GearScore rating={{gear:before.gear,draft,catalog,mode:ratingMode}} prv={before.prv} maximum={entry.prvMaximum} gain={before.gain} locale={locale} metric={metric}/>}/>}
          <GearCell flat pad={pad} current captionTone="now" caption={now} gear={gear} catalog={catalog} locale={locale} summaryContext={summaryContext} ratedTypes={entry.ratedTypes} label={now}
            score={<GearScore rating={{gear,draft,catalog,mode:ratingMode}} prv={entry.nowPrv} maximum={entry.prvMaximum} gain={entry.now?.gain??null} locale={locale} metric={metric}/>}/>
          {forecast&&<GearCell flat pad={pad} caption={`${projectionLabel(entry,locale)} · ${target}%`} gear={entry.projection.gear!} catalog={catalog} locale={locale} summaryContext={summaryContext} ratedTypes={entry.ratedTypes} label={`${projectionLabel(entry,locale)} · ${target}%`}
            score={<GearScore rating={{gear:entry.projection.gear!,draft,catalog,mode:ratingMode}} prv={entry.forecastPrv} maximum={entry.prvMaximum} gain={entry.forecast!.gain} locale={locale} metric={metric}/>}/>}
        </div>
        <footer className={styles.pairFoot}>
          {previous&&<span className={styles.whatIfDelta} title={t('Gain against the equipped piece: real → temporary')}>{t('Gain vs real')}: <InventoryGain value={previous.now?.gain??null} locale={locale}/> → <InventoryGain value={entry.now?.gain??null} locale={locale}/> · Δ <InventoryGain value={previous.now&&entry.now?entry.now.gain-previous.now.gain:null} locale={locale}/></span>}
          {!forecast&&!before&&<span>{entry.projection.reason?t('No Titan forecast: unknown base'):t('Actual stats')}</span>}
          {onTry&&<Button variant="secondary" size="sm" aria-label={`${original?t('Reset','Сбросить'):t('Try on')} ${name} ${entry.piece.key}`} disabled={!entry.now&&!forecast} onClick={()=>onTry(entry.piece.key,!original&&Boolean(forecast))}>{original?t('Reset','Сбросить'):t('Try on')}</Button>}
          <button type="button" className={styles.cellAction} aria-label={`${t('Compare')} ${name} ${entry.piece.key}`} onClick={()=>onCompare(entry.piece.key)}><span>{t('Compare')}</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 8h10M8 3l5 5-5 5"/></svg></button>
        </footer>
      </article>
    </li>;
});
