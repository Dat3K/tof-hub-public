'use client';
import { fillText } from '@/lib/i18n/text';

import {useCallback,useDeferredValue,useEffect,useId,useMemo,useRef,useState} from 'react';
import {normalizeSearchText} from '@tof-hub/contracts';
import {Button,CatalogSearch,CatalogSort,Dialog,Modal,ModeSwitcher,ProfileAvatar,useBatchedList,useToast} from '@tof-hub/ui';
import {useLocale} from '@/lib/i18n';
import {localeText} from '@/lib/i18n/text';
import {formatFixed} from '@/lib/i18n/format';
import {importBuildCapture,refreshCapturedDraft,serverRefusalNotice} from '../build/capture-import';
import {markCaptureEdit} from '../build/capture-source';
import {BUILD_IMPORT_ROUTES,stashBuildImport} from '../build/import-handoff';
import type {MmoPageMismatchError} from '../build/mmo/capture-import';
import {CaptureOriginNotice,captureOriginLabel,restrictedCaptureOrigin} from '../build/capture-origin';
import {RollValueProfile,RollWeightList,TotalRollValue} from '../build/gear-roll-value';
import {elementLabel,enemyLevelEditHint,formatValue,statIcon,statLabel} from '../build/presentation';
import {buildCombatDraft,buildRollValue,emptyDraft,gearCurrentRollValue,gearRollValue,rollValueContext,titanMaximums} from '../build/model';
import {BuildEditing} from '../build/build-editing';
import {GearPickerEditor} from '../build/gear-editor';
import {BuildFocus} from '../build/build-focus';
import {BuildGearRanking} from '../build/build-gear-ranking';
import {BuildTooltip} from '../build/build-inspection';
import {useSavedBuildRanking} from '../build/use-saved-build-ranking';
import {AugmentationTotal} from '../build/augmentation-total';
import {characterTitleLabel} from '../build/character-title';
import {backpackForDraft} from '../build/browser-storage';
import {InlineNumber} from '../build/build-fields';
import {DemoCallToAction} from '../build/demo-call-to-action';
import {GearSlotChips} from '../build/gear-slot-chips';
import buildStyles from '../build/build.module.css';
import type {BuildCatalog,BuildDraft,BuildLocale,GearDraft} from '../build/types';
import {QueueNotice} from '../queue/queue-notice';
import {useSiteHeaderInset} from '@/components/site-shell/use-site-header-inset';
import {RouteLoading} from '@/components/site-shell/route-loading';
import type {QueueJob} from '../queue/client';
import {gearBeforeTitan,matureTitan,rankInventory,resolveWhatIf,slotComparison,temporaryOutputGain,type OptimizerDemo,type RankedPiece,type UpgradeStage,type WhatIfChange} from './model';
import {inventorySearchIndex,sortInventory} from './inventory-list';
import styles from './optimizer.module.css';
import {OptimizerStats} from './optimizer-stats';
import {OptimizerCalculationHelp} from './optimizer-calculation-help';
import {InfoCard,SectionHeading,ToolInfoModal} from '@/components/tool-rail/tool-info-modal';
import {useAnimatedDetails} from '../info-sections/common/use-animated-details';
import {RailGlyph,ToolRail} from '@/components/tool-rail/tool-rail';
import {CaptureAppModal} from '@/components/tool-rail/capture-app-modal';
import {scrollToSection} from '@/lib/scroll-to-section';
import {GearCell,GearScore,RatingShareChange,gearSummaryContext,InventoryGain as Gain,OptimizerInventoryGrid,gearStage,projectionLabel} from './optimizer-inventory';
import {OPTIMIZER_STORAGE_KEY,exampleSession,restoreOptimizerSession,type OptimizerSession} from './storage';
import {saveImportedBuild} from '../build/browser-storage';

const isBetter=(piece:RankedPiece)=>piece.gain!==null&&piece.gain>1e-8;
const INVENTORY_BATCH_SIZE=20;
function reasonText(piece:RankedPiece,locale:BuildLocale) {
  const t=localeText(locale);
  return piece.projection.reason?{originals:t('Pre-Titan values unavailable'),stars:t('Needs a known five-roll base'),primary:t('Titan ceiling is ambiguous'),pool:t('Lower-stat pool unavailable')}[piece.projection.reason]:matureTitan(piece.piece.gear)?t('See missing % to maximum'):'';
}
function GearIcon({gear,catalog}:{gear:GearDraft;catalog:BuildCatalog}) {
  const meta=catalog.gear.find(item=>item.id===gear.id);
  return meta?<img className={styles.gearIcon} src={meta.icons[gearStage(gear)]} alt=""/>:null;
}
/**
 * Replacement comparison as three gear cells (equipped, inventory now, after Titan at the target) like the board,
 * each with its PRV and output gain. The selected scenario frames its cell and drives the headline and factors.
 */
/** Information about one piece: as it was before Titan, as it is now, and at the full (100%) Titan ceiling. */
function GearInfoDialog({gear,catalog,draft,locale,ratingMode,onClose}:{gear:GearDraft|null;catalog:BuildCatalog;draft:BuildDraft;locale:BuildLocale;ratingMode:'prv'|'grv';onClose:()=>void}) {
  const t=localeText(locale);
  const viewportTopInset=useSiteHeaderInset(!!gear);
  const columns=useMemo(()=>{
    if(!gear)return [];
    const comparison=slotComparison(draft,catalog,gear.id);
    const originals=gear.rows.map(row=>({...row,beforeTitan:gear.titan||gear.augmented?row.beforeTitan:row.value}));
    const maximums=titanMaximums({...gear,equipped:true,rows:originals},catalog);
    const full:GearDraft|null=maximums.random.some(value=>value!==null)?{...gear,titan:true,augmented:true,
      rows:gear.rows.map((row,index)=>({...row,value:maximums.random[index]??row.value})),
      augments:gear.augments.map((stat,index)=>({...stat,value:maximums.added[index]??stat.value}))}:null;
    const before=gearBeforeTitan(gear);
    return [before&&{key:'before',caption:t('Before Titan','До титана'),gear:before},
      {key:'now',caption:t('Now'),gear},
      full&&{key:'full',caption:t('100% Titan'),gear:full}]
      .flatMap(item=>item?[{...item,rate:comparison?.rate(item.gear)??null}]:[]);
  },[gear,catalog,draft,locale]);
  const meta=gear?catalog.gear.find(item=>item.id===gear.id):undefined;
  return <Modal isOpen={!!gear} onClose={onClose} size="full" appearance="table" viewportTopInset={viewportTopInset} ariaLabel={t('Gear information')}>
    <Modal.Header><Modal.Title>{meta?.name[locale]??''} · {t('Gear information')}</Modal.Title></Modal.Header>
    <Modal.Body>{gear&&<div className={styles.compareCells}>
      {columns.map(column=><div key={column.key} data-active={column.key==='now'||undefined}><GearCell gear={column.gear} catalog={catalog} locale={locale} summaryContext={gearSummaryContext(draft,catalog)}
        captionTone={column.key==='now'?'now':'reference'} caption={column.caption} label={column.caption} current={column.key==='now'}
        score={<GearScore rating={{gear:column.gear,draft,catalog,mode:ratingMode}} prv={column.rate?.value??null} maximum={column.rate?.maximum??0} locale={locale}/>}/></div>)}
    </div>}</Modal.Body>
  </Modal>;
}

function ComparisonDialog({entry,catalog,draft,locale,target,ratingMode,onClose,onSelect,onTry}:{entry:RankedPiece|null;catalog:BuildCatalog;draft:BuildDraft;locale:BuildLocale;target:number;ratingMode:'prv'|'grv';onClose:()=>void;onSelect:(key:string,pair:string[])=>void;onTry?:(key:string,forecast:boolean)=>void}) {
  const t=localeText(locale);
  const viewportTopInset=useSiteHeaderInset(!!entry);
  const [showFormulas,setShowFormulas]=useState(false);
  const [scenario,setScenario]=useState<'now'|'forecast'>(()=>entry?.forecast&&(entry.forecast.gain>(entry.now?.gain??-Infinity))?'forecast':'now');
  const activeScenario=scenario==='forecast'&&entry?.forecast?'forecast':'now';
  const result=activeScenario==='forecast'?entry?.forecast:entry?.now;
  const resultLabel=activeScenario==='forecast'&&entry?projectionLabel(entry,locale):t('Equip now');
  const context=rollValueContext(draft,catalog);
  const metric=context.role==='tank'?t('EHP'):context.role==='healer'?t('ATK'):t('DMG');
  const mine=entry?.current,candidate=entry?.piece.gear,forecast=entry?.projection.gear;
  const beforeTitanReference=activeScenario==='now'&&mine?gearBeforeTitan(mine):null;
  const referenceGear=beforeTitanReference??mine;
  const referenceLabel=beforeTitanReference?t('Before Titan · reference'):t('Equipped · reference');
  const maximums=candidate?titanMaximums({...candidate,equipped:true,rows:candidate.rows.map(row=>({...row,beforeTitan:candidate.titan||candidate.augmented?row.beforeTitan:row.value}))},catalog):null;
  // A developed Titan keeps its values: show how far each roll is from this piece's own ceiling.
  const shortfall=candidate&&matureTitan(candidate)?candidate.rows.flatMap((row,index)=>{const max=maximums?.random[index];return row.type&&max?[`${statLabel(row.type,locale)} ${formatFixed(Math.max(0,1-row.value/max)*100,locale,1)}%`]:[];}):[];
  const selected=forecast?.augments.map(stat=>stat.type)??candidate?.augments.map(stat=>stat.type)??[];
  const pairOptions=entry?.projection.options??[];
  const onlyPair=pairOptions.length===1;
  // Keep the sole legal pair visible; with several choices, list the alternatives to the forecast card.
  const alternatives=onlyPair?pairOptions:pairOptions.filter(option=>!(option.pair.length===selected.length&&option.pair.every(type=>selected.includes(type))));
  // Your stats with the equipped piece and with the compared state, from the output factors (same profile as Δ):
  // final and base ATK, ATK %, DMG %, crit chance; HP, HP % and damage taken for a tank.
  const profileRows=(()=>{
    const factor=(id:string)=>result?.factors.find(item=>item.id===id);
    const rows:{label:string;icon?:string;from:number;to:number;percent:boolean}[]=[];
    const icons=catalog.displayIcons;
    const attack=factor('attack'),attackPercent=factor('attackPercent'),damage=factor('damagePercent'),crit=factor('crit');
    // Match the combat overview: crit, base ATK, final ATK, ATK%, DMG%.
    const bonus=entry?.profile?.critDamageBonus;
    if(crit&&bonus)rows.push({label:t('Crit chance'),icon:icons.crit?.icon,from:(crit.reference-1)/bonus,to:(crit.value-1)/bonus,percent:true});
    if(attack&&attackPercent)rows.push({label:t('Base ATK','Базовая АТК'),icon:icons.attack?.icon,from:attack.reference,to:attack.value,percent:false},
      {label:t('Final ATK'),icon:icons.attack?.icon,from:attack.reference*attackPercent.reference,to:attack.value*attackPercent.value,percent:false},{label:t('ATK%'),icon:icons.attack?.icon,from:attackPercent.reference-1,to:attackPercent.value-1,percent:true});
    else if(attack)rows.push({label:t('Final ATK'),icon:icons.attack?.icon,from:attack.reference,to:attack.value,percent:false});
    if(damage)rows.push({label:t('DMG%'),icon:icons.damage?.icon,from:damage.reference-1,to:damage.value-1,percent:true});
    const hp=factor('hp'),hpPercent=factor('hpPercent'),resistance=factor('resistance');
    if(hp&&hpPercent)rows.push({label:'HP',icon:icons.hp?.icon,from:hp.reference*hpPercent.reference,to:hp.value*hpPercent.value,percent:false},{label:'HP%',icon:icons.hp?.icon,from:hpPercent.reference-1,to:hpPercent.value-1,percent:true});
    // EHP resistance factor = 1 + RES × (1 + RES%) / K, so the damage taken is its inverse.
    if(resistance)rows.push({label:t('Damage taken'),from:1/resistance.reference,to:1/resistance.value,percent:true});
    return rows;
  })();
  const stat=(value:number,percent:boolean)=>formatValue(value,percent,locale,percent?2:0);
  const change=(value:number,percent:boolean)=>Math.abs(value)<(percent?5e-5:.5)?'0':`${value>0?'+':'−'}${stat(Math.abs(value),percent)}`;
  const weights=mine?gearRollValue(mine,{...draft,rv:{...draft.rv,element:context.selected,includeCrit:true,mode:'prv'}},catalog):null;
  const globalWeights=mine?gearRollValue({...mine,equipped:false},{...draft,rv:{element:context.selected,includeCrit:true,mode:'grv'}},catalog):null;
  const forecastLabel=entry&&forecast?`${projectionLabel(entry,locale)} · ${target}%`:'';
  return <><Modal isOpen={!!entry} onClose={onClose} size="full" appearance="table" viewportTopInset={viewportTopInset} ariaLabel={t('Gear comparison')}>
    {/* The piece, the scenario switch and the headline gain live in the header, leaving the body to the cards and stats. */}
    <Modal.Header className={styles.compareHeader} showCloseButton={false} actions={<>
      {entry?.forecast&&<ModeSwitcher presentation="standalone" value={activeScenario} onChange={setScenario} ariaLabel={t('Comparison scenario')} options={[{value:'now',label:t('Equip now'),tone:'sky'},{value:'forecast',label:forecastLabel,tone:'gold'}]}/>}
      {entry&&<div className={styles.comparisonResult} role="status"><small>{resultLabel}</small><Gain value={result?.gain??null} locale={locale}/></div>}
      {entry&&onTry&&<Button variant="secondary" size="sm" disabled={!result} onClick={()=>onTry(entry.piece.key,activeScenario==='forecast')}>{t('Try on this state')}</Button>}
      <Button variant="secondary" size="sm" onClick={()=>setShowFormulas(true)} aria-label={t('Comparison formulas')}><RailGlyph name="formula"/>{t('Formulas')}</Button>
      <Modal.Close aria-label={t('Close comparison')}/></>}>
      <div className={styles.compareLead}>{candidate&&<GearIcon gear={candidate} catalog={catalog}/>}<div><Modal.Title>{t('Gear comparison')}</Modal.Title>
        {candidate&&<p>{catalog.gear.find(item=>item.id===candidate.id)?.name[locale]} · {t('vs your equipped piece')} · {elementLabel(context.selected,locale)} · Δ {metric}</p>}</div></div>
    </Modal.Header>
    <Modal.Body>{entry&&mine&&candidate&&<div className={styles.comparison}>
      {!entry.profile&&<p role="alert">{t('Personal comparison unavailable: the build is missing required combat totals.')}</p>}
      <div className={styles.compareCells} data-scenario={activeScenario}>
        <GearCell gear={referenceGear!} catalog={catalog} locale={locale} summaryContext={gearSummaryContext(draft,catalog)} ratedTypes={entry.ratedTypes} captionTone="reference" caption={referenceLabel} label={referenceLabel}
          score={<GearScore rating={{gear:referenceGear!,draft,catalog,mode:ratingMode}} prv={slotComparison(draft,catalog,referenceGear!.id)?.rate(referenceGear!).value??null} maximum={entry.prvMaximum} locale={locale}/>}/>
        <div data-cell="now" data-active={activeScenario==='now'||undefined}><GearCell gear={candidate} catalog={catalog} locale={locale} summaryContext={gearSummaryContext(draft,catalog)} ratedTypes={entry.ratedTypes} current={activeScenario==='now'} captionTone="now" caption={t('Inventory · now')} label={t('Inventory · now')}
          score={<GearScore rating={{gear:entry.piece.gear,draft,catalog,mode:ratingMode}} prv={entry.nowPrv} maximum={entry.prvMaximum} gain={entry.now?.gain??null} locale={locale} metric={metric}/>}/></div>
        {forecast&&<div data-cell="forecast" data-active={activeScenario==='forecast'||undefined}><GearCell gear={forecast} catalog={catalog} locale={locale} summaryContext={gearSummaryContext(draft,catalog)} ratedTypes={entry.ratedTypes} current={activeScenario==='forecast'} caption={forecastLabel} label={forecastLabel}
          score={<GearScore rating={{gear:entry.projection.gear!,draft,catalog,mode:ratingMode}} prv={entry.forecastPrv} maximum={entry.prvMaximum} gain={entry.forecast?.gain??null} locale={locale} metric={metric}/>}/></div>}
      </div>
      {shortfall.length>0&&<p className={styles.note}>{t('To max')}: {shortfall.join(' · ')}</p>}
      <div className={styles.comparePanels}>
      <section className={styles.factorSection} aria-label={t('Result factors')}><h3>{t('Your stats')} · {t('equipped')} → {resultLabel}</h3>
        <table className={styles.profileTable}><caption className="sr-only">{t('Your stats with each piece')}</caption>
          <colgroup><col style={{width:'32%'}}/><col style={{width:'22%'}}/><col style={{width:'24%'}}/><col style={{width:'22%'}}/></colgroup>
          <thead><tr><th>{t('Stat')}</th><th>{t('Equipped')}</th><th>{resultLabel}</th><th>{t('Change')}</th></tr></thead>
          <tbody>{profileRows.map(row=><tr key={row.label}><th>{row.icon&&<img className={styles.statIcon} src={row.icon} alt=""/>}{row.label}</th><td>{stat(row.from,row.percent)}</td><td>{stat(row.to,row.percent)}</td><td data-sign={row.to-row.from>0?'up':row.to-row.from<0?'down':undefined}>{change(row.to-row.from,row.percent)}</td></tr>)}
            <tr className={styles.profileTotal}><th>Δ {metric}</th><td/><td/><td><Gain value={result?.gain??null} locale={locale}/></td></tr></tbody>
        </table></section>
      {alternatives.length>0&&<section className={styles.pairOptions} aria-label={t('Possible Titan stat combinations')}>
        <h3>{t('Possible Titan stat combinations')} · {target}%</h3>
        {onlyPair&&<p className={styles.note}>{t('Only one combination is possible for these base stats.')}</p>}
        <ul>{alternatives.map(option=><li key={option.pair.join('|')}><button type="button" disabled={onlyPair} onClick={()=>onSelect(entry.piece.key,option.pair)} aria-label={`${t('Use')} ${option.pair.map(type=>statLabel(type,locale)).join(' / ')}`}>
          {option.pair.map((type,index)=><span key={type}><img src={statIcon(type,catalog)} alt=""/>{statLabel(type,locale)} <b>{formatValue(option.values[index]!,!!catalog.reference.statTypes[type]?.isPercentageBased,locale)}</b></span>)}
          <Gain value={option.gain} locale={locale}/>
        </button></li>)}</ul>
      </section>}
      </div>
      <details className={styles.compareDetails}>
        <summary>{t('Your stats with this slot empty · personal roll weights')}</summary>
      <InfoCard><section className={styles.comparisonMethod} aria-label={t('Personal rating · PRV')}>
            <SectionHeading>{t('Your stats with this slot empty')}</SectionHeading>
            {entry.profile?<RollValueProfile profile={entry.profile} enemyLevel={draft.enemyLevel} locale={locale} role={context.role} showPostPercentAttack={false}/>:<p>{t('PRV is unavailable: required combat totals are missing or inconsistent.')}</p>}
            {weights?.profile&&<><SectionHeading>{t('Personal roll weights')}</SectionHeading><RollWeightList weights={weights.rollWeights.filter(row=>row.rated)} catalog={catalog} locale={locale} mode="PRV" presentation="table" showMinimum/></>}
      </section></InfoCard>
      </details>

      {!forecast&&reasonText(entry,locale)&&<p className={styles.note}>{reasonText(entry,locale)}</p>}
    </div>}</Modal.Body>
  </Modal>
    <ToolInfoModal isOpen={showFormulas&&!!entry} onClose={()=>setShowFormulas(false)} eyebrow="PRV / GRV" title={t('Comparison formulas')} closeLabel={t('Close')}>
        <div className={buildStyles.rollValueMethod}>
          <OptimizerCalculationHelp catalog={catalog} draft={draft} locale={locale} result={result} scenario={resultLabel}
            referenceWeights={globalWeights&&<RollWeightList weights={globalWeights.rollWeights.filter(row=>row.rated)} catalog={catalog} locale={locale} mode="GRV" presentation="table" showMinimum/>}/>
        </div>
    </ToolInfoModal></>;
}

export function OptimizerView({catalog,demo}:{catalog:BuildCatalog;demo:OptimizerDemo}) {
  const {locale}=useLocale(),t=localeText(locale);
  const [session,setSession]=useState(()=>exampleSession(catalog));
  const [ratingMode,setRatingMode]=useState<'prv'|'grv'>('prv');
  const [stage,setStage]=useState<UpgradeStage>('all');
  const sessionRef=useRef(session);
  const {draft:realDraft,example,inventory,inventoryReceived,target}=session;
  const demoProfile=example||realDraft.demo||(
    !!realDraft.captureSource?.digest&&realDraft.captureSource.digest===catalog.demoDraft.captureSource?.digest);
  const [whatIf,setWhatIf]=useState<Record<string,WhatIfChange>>({});
  const [ready,setReady]=useState(false);
  const [importing,setImporting]=useState(false),[queueJob,setQueueJob]=useState<QueueJob|null>(null);
  const {notify,dismiss}=useToast(),noticeId=useId();
  const storageNoticeId=useId();
  useEffect(()=>{
    let active=true,revision=0;
    const hydrate=async(next:OptimizerSession)=>{
      const current=++revision,previous=sessionRef.current;
      try {next={...next,draft:await refreshCapturedDraft(next.draft,catalog,locale)};}
      catch {if(active&&current===revision)notify(localeText(locale)('Could not refresh the saved capture. Its cached values are still shown.'),{id:storageNoticeId,tone:'error'});}
      if(!active||current!==revision||sessionRef.current!==previous)return;
      sessionRef.current=next;setSession(next);setWhatIf({});setSelected(null);setSelections({});
      setReady(true);
    };
    let next=exampleSession(catalog);
    try {
      const cached=localStorage.getItem(OPTIMIZER_STORAGE_KEY);
      if(cached) {
        const restored=restoreOptimizerSession(JSON.parse(cached),catalog);
        if(restored)next=restored;
        else notify(localeText(locale)('The saved optimizer build could not be restored.'),{id:storageNoticeId,tone:'error'});
      }
    } catch {notify(localeText(locale)('Browser storage is unavailable or the saved optimizer build is unreadable.'),{id:storageNoticeId,tone:'error'});}
    void hydrate(next);
    const syncImported=(event:StorageEvent)=>{
      if(event.key!==OPTIMIZER_STORAGE_KEY||!event.newValue)return;
      try {
        const next=restoreOptimizerSession(JSON.parse(event.newValue),catalog);
        if(!next)return;
        void hydrate(next);
      } catch { /* Another tab may be writing the session; keep the current view. */ }
    };
    window.addEventListener('storage',syncImported);
    return ()=>{active=false;window.removeEventListener('storage',syncImported);};
    // Restore once for this catalog; a language change keeps the current profile.
  },[catalog]);
  function updateSession(patch:Partial<OptimizerSession>) {
    const next={...sessionRef.current,...patch};
    sessionRef.current=next;setSession(next);
    // Save on committed actions, so immediate navigation/reload cannot lose the latest values.
    try {localStorage.setItem(OPTIMIZER_STORAGE_KEY,JSON.stringify(next));}
    catch {notify(t('The optimizer build could not be saved in this browser.'),{id:storageNoticeId,tone:'error'});}
  }
  const [railDialog,setRailDialog]=useState<'formula'|'clear'|null>(null);
  const [showCaptureApp,setShowCaptureApp]=useState(false);
  // The formulas fold with the same motion as Build and Simulacra; the sections exist only while the dialog is open.
  useAnimatedDetails({containerSelector:'[data-comparison-formulas]',dependencyKey:`${locale}-${railDialog}`});
  const closeRailDialog=useCallback(()=>setRailDialog(null),[]);
  const [infoSlot,setInfoSlot]=useState<string|null>(null);
  const [selected,setSelected]=useState<string|null>(null),[selections,setSelections]=useState<Record<string,string[]>>({});
  const [slot,setSlot]=useState(''),[search,setSearch]=useState(''),[view,setView]=useState<'upgrades'|'all'>('upgrades'),[sort,setSort]=useState('best');
  const fileInput=useRef<HTMLInputElement>(null);
  const equipment=useRef<HTMLElement>(null);
  const railInset=useSiteHeaderInset(railDialog!==null);
  const deferredSearch=useDeferredValue(search);
  const realPool=example?demo.pieces:inventory;
  const effective=useMemo(()=>resolveWhatIf(realDraft,realPool,whatIf,catalog,target,selections),[realDraft,realPool,whatIf,catalog,target,selections]);
  const draft=effective.draft,temporaryCount=effective.changed.size;
  const temporaryGain=useMemo(()=>temporaryCount?temporaryOutputGain(realDraft,effective.draft,effective.changed,catalog):null,[temporaryCount,realDraft,effective.draft,effective.changed,catalog]);
  const ranked=useMemo(()=>rankInventory(effective.pool,draft,catalog,target,selections,{stage}),[draft,effective.pool,catalog,target,selections,stage]);
  const context=useMemo(()=>rollValueContext(draft,catalog),[draft,catalog]);
  const combatDraft=useMemo(()=>buildCombatDraft(draft,catalog),[draft,catalog]);
  const summaryContext=useMemo(()=>gearSummaryContext(draft,catalog),[draft,catalog]);
  const totalRv=useMemo(()=>buildRollValue({...combatDraft,rv:{...combatDraft.rv,element:context.selected,includeCrit:true,mode:ratingMode}},catalog),[combatDraft,catalog,ratingMode,context.selected]);
  const rankingEdited=temporaryCount>0||!!(realDraft.captureSource?.kind==='manual'&&realDraft.captureSource.signature);
  const ranking=useSavedBuildRanking(realDraft,catalog,null,ready&&!rankingEdited);
  const metric=context.role==='tank'?t('EHP'):context.role==='healer'?t('ATK'):t('DMG');
  const upgrades=useMemo(()=>ranked.filter(isBetter),[ranked]);
  const self=useMemo(()=>rankInventory(draft.gear.filter(gear=>gear.equipped).map(gear=>({key:`equipped-${gear.id}`,gear})),draft,catalog,target,selections),[draft,catalog,target,selections]);
  // Defer the additional baseline ranking; stale target/selection/baseline deltas are never rendered.
  const hasTemporary=temporaryCount>0;
  const baselineInput=useMemo(()=>hasTemporary?{realDraft,realPool,catalog,target,selections,stage,ratingMode}:null,[hasTemporary,realDraft,realPool,catalog,target,selections,stage,ratingMode]);
  const deferredBaseline=useDeferredValue(baselineInput,null);
  const baseline=useMemo(()=>{
    if(!deferredBaseline)return null;
    const {realDraft,realPool,catalog,target,selections,stage,ratingMode}=deferredBaseline;
    const equipped=realDraft.gear.filter(gear=>gear.equipped).map(gear=>({key:`equipped-${gear.id}`,gear}));
    const entries=rankInventory([...realPool,...equipped],realDraft,catalog,target,selections);
    const pieces=new Map(entries.map(entry=>[entry.piece.key,entry]));
    const scores=new Map(realDraft.gear.map(gear=>{
      const entry=pieces.get(`equipped-${gear.id}`);
      const score=ratingMode==='grv'
        ?gearCurrentRollValue(gear,{...realDraft,rv:{element:'auto',includeCrit:true,...realDraft.rv,mode:'grv'}},catalog)
        :{value:entry?.nowPrv??null,maximum:entry?.prvMaximum??0};
      return [gear.id,{value:gear.equipped?score.value:0,maximum:score.maximum}] as const;
    }));
    return {pieces,scores,total:buildRollValue({...buildCombatDraft(realDraft,catalog),rv:{element:'auto',includeCrit:true,...realDraft.rv,mode:ratingMode}},catalog),stage};
  },[deferredBaseline]);
  const readyBaseline=deferredBaseline===baselineInput?baseline:null;
  useEffect(()=>{
    const slots=Object.keys(effective.failed);if(!slots.length)return;
    setWhatIf(current=>Object.fromEntries(Object.entries(current).filter(([slot])=>!slots.includes(slot))));
    notify(localeText(locale)('Some temporary changes are no longer available and were reverted.'),{id:noticeId,tone:'info'});
  },[effective.failed,notify,noticeId,locale]);
  const rerolls=self.filter(entry=>entry.projection.kind==='reroll'&&isBetter(entry));
  // Equipped gear without a replacement is compared at the 100% target, with the same reroll rules.
  const greySelf=useMemo(()=>rankInventory(draft.gear.filter(gear=>gear.equipped).map(gear=>({key:`equipped-${gear.id}`,gear})),draft,catalog,100,selections),[draft,catalog,selections]);
  const greyRerolls=greySelf.filter(entry=>entry.projection.kind==='reroll'&&isBetter(entry));
  const searchIndex=useMemo(()=>inventorySearchIndex(ranked,catalog),[ranked,catalog]);
  const ordered=useMemo(()=>sortInventory(ranked,sort),[ranked,sort]);
  const matching=useMemo(()=>{
    const query=normalizeSearchText(deferredSearch);
    return ordered.filter(entry=>(!slot||entry.piece.gear.id===slot)&&(view==='all'||isBetter(entry))&&(!query||searchIndex.get(entry.piece.key)?.includes(query)));
  },[ordered,slot,view,deferredSearch,searchIndex]);
  const {visibleItems:visible,hasMore,loadMore,sentinelRef}=useBatchedList(matching,{batchSize:INVENTORY_BATCH_SIZE,resetKey:matching,rootMargin:'400px 0px'});
  const globalActive=selected?(ranked.find(entry=>entry.piece.key===selected)??self.find(entry=>entry.piece.key===selected)??null):null;
  const greyComparison=!!selected&&selected.startsWith('equipped-')&&!(globalActive&&(rerolls.some(entry=>entry.piece.key===selected)||(globalActive.projection.gear&&isBetter(globalActive))));
  const active=greyComparison?(greyRerolls.find(entry=>entry.piece.key===selected)??null):globalActive;
  const activeTarget=greyComparison?100:target;
  useEffect(()=>{if(selected&&!active)setSelected(null);},[selected,active]);
  const revertSlot=useCallback((slot:string)=>setWhatIf(current=>Object.fromEntries(Object.entries(current).filter(([id])=>id!==slot))),[]);
  const tryState=useCallback((key:string,forecast=false)=>{
    const original=realDraft.gear.find(gear=>key===`equipped-${gear.id}`);
    if(original){
      if(forecast)setWhatIf(current=>({...current,[original.id]:{kind:'forecast'}}));
      else revertSlot(original.id);
    } else {
      const piece=realPool.find(piece=>piece.key===key);if(!piece)return;
      setWhatIf(current=>({...current,[piece.gear.id]:{kind:'swap',pieceKey:key,forecast,allowTransfer:stage==='all',donor:forecast?draft.gear.find(gear=>gear.id===piece.gear.id):undefined}}));
    }
    setSelected(null);
  },[realDraft,realPool,draft,stage,revertSlot]);
  const tryPiece=useCallback((key:string,forecast:boolean)=>tryState(key,forecast),[tryState]);
  const manual=!example&&!draft.captureSource;
  const captureFlag=restrictedCaptureOrigin(draft);
  const captureFlagLabel=captureFlag?captureOriginLabel(captureFlag,locale,'page',draft.captureSource?.capture.capture.scan?.distribution):'';
  const upgradeSlots=new Set(upgrades.map(entry=>entry.piece.gear.id)).size;
  const suppressor=catalog.suppressors.find(item=>item.id===draft.profile.suppressorId);
  const serverParts=/^(.*?)\s*\(([A-Za-z]{2,4})\)$/.exec(draft.profile.server.trim());
  const characterTitle=characterTitleLabel(draft.profile.characterTitle,catalog,locale,draft.captureSource?.capture.profile.titleId);
  const augmentationBackpack=useMemo(()=>backpackForDraft(realDraft,catalog,session),[realDraft,catalog,session]);
  const serverLine=serverParts?`${serverParts[2].toUpperCase()}${serverParts[1]?` / ${serverParts[1]}`:''}`:draft.profile.server||'—';
  const avatar=catalog.avatars.find(item=>item.id===draft.profile.avatarId),frame=catalog.avatarFrames.find(item=>item.id===draft.profile.avatarFrameId);
  const targetRef=useRef<HTMLElement>(null),[targetHint,setTargetHint]=useState(false);
  const hintTarget=setTargetHint;
  const [manualGear,setManualGear]=useState<BuildDraft|null>(null);
  function openManualGear() {
    if(example){notify(t('Clear the example or import a build first, then add your own gear.'),{id:noticeId,tone:'info'});return;}
    setManualGear(emptyDraft(catalog));
  }
  function addManualGear() {
    if(!manualGear)return;
    const filled=manualGear.gear.filter(gear=>gear.rows.some(row=>row.type));
    if(!filled.length){notify(t('Choose stats for at least one piece.'),{id:noticeId,tone:'error'});return;}
    const used=new Set(inventory.map(piece=>piece.key));
    let counter=0;
    const added=filled.map(gear=>{let key:string;do key=`manual-${Date.now().toString(36)}-${counter++}`;while(used.has(key));used.add(key);const worn=realDraft.gear.find(item=>item.id===gear.id&&item.equipped);
      // As the importer does: a piece put on takes the slot's enhancement; stars stay as entered.
      return {key,gear:{...structuredClone(gear),equipped:false,enhancement:gear.enhancement||worn?.enhancement||0}};});
    updateSession({inventory:[...inventory,...added],inventoryReceived:true});
    setSelected(null);setView('all');
    notify(fillText(t('Added {0} piece(s) to the inventory.', 'Добавлено вещей в инвентарь: {0}.'), [added.length]),{id:noticeId,tone:'info'});
    setManualGear(null);
  }
  function resetFilters() {setSlot('');setSearch('');setView('upgrades');setSort('best');}
  function clearDraft() {
    if(importing)return;
    const next=emptyDraft(catalog);
    next.enemyLevel=draft.enemyLevel;
    next.rv={...next.rv,element:context.selected,includeCrit:true,mode:'prv'};
    updateSession({draft:next,inventory:[],inventoryReceived:false,example:false});setWhatIf({});setSelected(null);setSelections({});resetFilters();dismiss(noticeId);setRailDialog(null);
  }
  function changeDraft(change:(draft:BuildDraft)=>void) {const previous=sessionRef.current.draft,next=structuredClone(previous);change(next);markCaptureEdit(previous,next);updateSession({draft:next});setSelections({});}
  async function importFile(file:File|undefined) {
    if(!file||importing)return;
    setImporting(true);dismiss(noticeId);
    try {const next=await importBuildCapture(file,catalog,locale,setQueueJob);
      const {optimizer,failed}=saveImportedBuild(next,catalog,sessionRef.current.target);sessionRef.current=optimizer;setSession(optimizer);setWhatIf({});setSelected(null);setSelections({});resetFilters();
      notify((failed.length?t('Build imported, but browser storage could not save both pages.')
        :next.inventoryReceived?fillText(t('Build imported with {0} backpack pieces.', 'Билд импортирован, вещей в рюкзаке: {0}.'), [next.inventory.length])
          :t('Build imported. This file has equipped gear only; capture it again with the current app to include the backpack.'))
        +serverRefusalNotice(next.serverRefusal??null,locale,next.outdatedExporter),{id:noticeId,tone:failed.length?'error':'info'});
    }catch(cause){
      // An MMO file: the MMO Build page shows it (no Optimizer for MMO); its server result moves there, no second upload.
      if(cause instanceof Error&&cause.name==='MmoPageMismatchError'&&stashBuildImport((cause as MmoPageMismatchError).result)) {
        window.location.assign(BUILD_IMPORT_ROUTES[(cause as MmoPageMismatchError).target]);return;
      }
      notify(`${t('Could not import .tofbuild.')} ${cause instanceof Error?cause.message:''}`,{id:noticeId,tone:'error'});}
    finally {setImporting(false);setQueueJob(null);}
  }
  const openImport=()=>{if(!importing)fileInput.current?.click();};
  function goToEquipment() {
    scrollToSection(equipment.current);
  }
  if(!ready)return <RouteLoading/>;
  return <><BuildEditing locked={!manual||importing} draft={realDraft} catalog={catalog} locale={locale} change={changeDraft}><div className={`${styles.page} filter-hover-preview`}>
    <h1 className="sr-only">{t('Gear optimizer')}</h1>
    <input ref={fileInput} type="file" accept=".tofbuild,.json" aria-label={t('Build capture file')} className="sr-only" disabled={importing} onChange={event=>{void importFile(event.target.files?.[0]);event.target.value='';}}/>
    <QueueNotice job={queueJob} locale={locale}/>
    {!demoProfile&&<CaptureOriginNotice draft={realDraft} locale={locale}/>}
    <section className={styles.board} aria-label={t('Build')}>
      <header className={styles.boardHeader}>
        <div className={`${buildStyles.profileIdentity} ${styles.identity}`}>
          <ProfileAvatar size={64} avatar={avatar} frame={frame} avatarLabel={avatar?.name[locale]}/>
          <div className={styles.profileText}>
            <div className={styles.profileTop}>
              <div className={`${buildStyles.profileName} ${styles.player}`}>{draft.profile.name||(manual?t('Custom build'):t('Imported build'))}</div>
              {suppressor&&<img className={styles.suppressorIcon} src={suppressor.icon} alt={suppressor.version} title={`${t('Suppressor','Сапрессор')} · ${suppressor.version}`}/>}
              {(draft.profile.crew||draft.profile.characterTitle)&&<div className={styles.affiliations}>
                <span><small>{t('Crew','Гильдия')}:</small><b title={draft.profile.crew}>{draft.profile.crew||'—'}</b></span>
                <span><small>{t('Title')}:</small><b data-profile-title title={characterTitle}>{characterTitle||'—'}</b></span>
              </div>}
            </div>
            <div className={styles.profileBottom}>
              <div className={buildStyles.profileSub}>{serverLine}{draft.profile.uid&&<> · UID {draft.profile.uid}</>}{draft.profile.level>0&&<> · Lv. {draft.profile.level}</>}<span className={styles.profileAug}><AugmentationTotal draft={realDraft} backpack={augmentationBackpack} locale={locale}/></span></div>
            </div>
          </div>
        </div>
        {example?<div className={styles.headerCenter} role="note" aria-label={t('Example build')}>
          <DemoCallToAction label={t('Example · demo inventory')} importLabel={t('Import your .tofbuild')} onImport={()=>setShowCaptureApp(true)} disabled={importing}/>
          <BuildGearRanking ranking={ranking} edited={rankingEdited} locale={locale}/>
        </div>:<div className={styles.headerCenter} role="note" aria-label={manual?undefined:t('Imported profile')}>
          {manual?<span className={styles.headerStatus}>{t('Fill the softly outlined fields and gear slots with your values.')}</span>:<>
            <dl className={styles.profileSummary}>
              <div><dt>{inventoryReceived?t('Backpack'):t('Gear')}</dt><dd>{inventoryReceived?inventory.length:t('Equipped gear only')}</dd></div>
              <div><dt>{t('Slots with upgrades')}</dt><dd>{upgradeSlots}</dd></div>
            </dl>
            {captureFlagLabel&&<span className={styles.headerStatus} data-capture-flag={captureFlag}>{captureFlagLabel}</span>}
          </>}
          <BuildGearRanking ranking={ranking} edited={rankingEdited} locale={locale}/>
        </div>}
        <div className={styles.headerRight}>
          <BuildFocus draft={draft} catalog={catalog} locale={locale}/>
          <div className={`${buildStyles.sectionTitle} ${styles.headerMeta}`}>
            <BuildTooltip portal content={enemyLevelEditHint(locale)}><small>{t('Enemy Lv.','Ур. врага')} <InlineNumber className="level-value" label={t('Enemy level','Уровень врага')} hint={null} value={draft.enemyLevel} min={1} max={100} onChange={level=>changeDraft(next=>{next.enemyLevel=level;})}/></small></BuildTooltip>
            <BuildTooltip portal content={<>{t('Edit the target Titan percentage (1–100%) to set the share of modeled stat maximums used in upgrade forecasts.')}<br/>{t('Yellow equipment is below this target.')}</>}><small ref={targetRef} className={styles.titanTarget} data-hint={targetHint||undefined}>{t('Titan target')} <InlineNumber className="level-value" label={t('Titan target percent')} hint={null} value={target} min={1} max={100} onChange={target=>updateSession({target})}/><span className="level-value">%</span></small></BuildTooltip>
          </div>
        </div>
      </header>
      <OptimizerStats draft={combatDraft} catalog={catalog} locale={locale} temporaryLabel={temporaryCount?t('Temporary build'):undefined} onTargetHint={hintTarget}/>
      <section ref={equipment} className={styles.equipment} aria-label={t('Equipped gear','Надетый гир')}>
        <div className={styles.equipmentHeading}>
          <div className={styles.equipmentRating} data-align="start">
            <h2 className={buildStyles.sectionTitle}>{t('Equipment')}</h2>
            <BuildTooltip portal className={buildStyles.itemTooltip} content={<p className={buildStyles.rollValueNote}>{t('Restricts backpack pieces to mature Titan gear (Aug > 120). The restriction compares pieces with their own enhancement and effect: finishing Titan stats and rerolling lower stats are allowed; enhancement transfer is excluded.')}</p>}>
              <ModeSwitcher value={stage} onChange={next=>{setStage(next);setSelected(null);}} ariaLabel={t('Upgrade stage')} options={[
                {value:'all',label:t('All'),tone:'sky'},
                {value:'mature',label:t('Aug > 120','Aug > 120'),tone:'rose'}]}/>
            </BuildTooltip>
            <small className={styles.whatIfMeta} data-temporary={temporaryCount>0||undefined} aria-live="polite">{temporaryCount?<><span>{t('Temporary changes')} · <b className={styles.slotCount}>{temporaryCount}</b></span><Button variant="ghost" size="sm" onClick={()=>{setWhatIf({});setSelected(null);}}>{t('Reset all')}</Button></>:<span><b className={styles.slotCount}>{upgradeSlots}</b> {t('slots with an upgrade')}</span>}</small>
            <ModeSwitcher value={ratingMode} onChange={setRatingMode} ariaLabel={t('Gear rating')} options={[{value:'prv',label:t('Personal RV'),tone:'gold'},{value:'grv',label:t('Global RV'),tone:'sky'}]}/>
          </div>
          <div className={`${styles.equipmentRating} ${styles.equipmentTotal}`}>
            {temporaryGain!==null&&<small className={styles.totalDelta} aria-label={t('Build output change against the real build')}>Δ {rollValueContext(draft,catalog).role==='tank'?t('EHP'):rollValueContext(draft,catalog).role==='healer'?t('ATK'):t('DMG')} <Gain value={temporaryGain} locale={locale}/></small>}
            <TotalRollValue value={totalRv.value} maximum={totalRv.maximum} empty={totalRv.equipped===0} locale={locale} mode={ratingMode}/>
            {readyBaseline&&<RatingShareChange before={readyBaseline.total} after={totalRv} locale={locale}/>}
          </div>
        </div>
        <div className={styles.gearGrid}>{draft.gear.map((gear,index)=>{const best=upgrades.find(entry=>entry.piece.gear.id===gear.id),reroll=rerolls.find(entry=>entry.piece.gear.id===gear.id),greyReroll=greyRerolls.find(entry=>entry.piece.gear.id===gear.id),entry=self.find(entry=>entry.piece.gear.id===gear.id);
          const change=effective.changed.has(gear.id)?whatIf[gear.id]:undefined;
          const finish=entry?.projection.gear&&isBetter(entry)&&!change;
          const name=catalog.gear.find(item=>item.id===gear.id)?.name[locale]??gear.id;
          return <GearCell key={gear.id} gear={gear} catalog={catalog} locale={locale} summaryContext={summaryContext} ratedTypes={entry?.ratedTypes} empty={!gear.equipped} needsInput={manual&&!gear.equipped} label={name} tone={change?'whatif':best?'upgrade':finish||reroll?'reroll':undefined} density="compact"
            score={gear.equipped&&<GearScore rating={{gear,draft,catalog,mode:ratingMode}} prv={entry?.nowPrv??null} maximum={entry?.prvMaximum??0} baseline={readyBaseline?.scores.get(gear.id)?.value} baselineMaximum={readyBaseline?.scores.get(gear.id)?.maximum} locale={locale}/>}
            action={manual&&!change&&<button type="button" className={styles.gearEdit} data-build-edit={`gear:${index}`} aria-label={`${gear.equipped?t('Edit'):t('Add','Добавить')} ${name}`}><RailGlyph name="edit"/></button>}>
            <button type="button" className={styles.cellAction} data-info={!best&&!reroll&&!finish&&!greyReroll||undefined} disabled={!best&&!reroll&&!gear.equipped} onClick={()=>{if(best||reroll||finish||greyReroll)setSelected((best??reroll??entry)!.piece.key);else setInfoSlot(gear.id);}}>{best?<><span>{t('Better in inventory')}</span><Gain value={best.gain} locale={locale}/></>:reroll||finish||greyReroll?<><span>{reroll||greyReroll?t('Lower-stat reroll'):projectionLabel(entry!,locale)}</span><Gain value={(reroll??(finish?entry:greyReroll))!.gain} locale={locale}/></>:<><span>{t('No replacement found')}</span>{gear.equipped&&<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>}</>}</button>
          </GearCell>;})}</div>
      </section>
    </section>
    <section className={styles.board} aria-label={t('Inventory')}>
      <h2 className={buildStyles.sectionTitle}><span>{t('Inventory')}</span><small role="status">{matching.length} / {ranked.length} · {t('order')}: {sort.endsWith('-asc')?'↑':'↓'}</small></h2>
      <div className={styles.inventoryControls}>
        <ModeSwitcher presentation="standalone" value={view} onChange={setView} ariaLabel={t('Inventory view')} options={[{value:'upgrades',label:`${t('Upgrades')} · ${upgrades.length}`,tone:'gold'},{value:'all',label:`${t('All pieces')} · ${ranked.length}`,tone:'sky'}]}/>
        <div className={styles.inventorySearch}><CatalogSearch value={search} onChange={setSearch} debounceMs={0} placeholder={t('Search item or stat…')}/></div>
        <Button variant="primary" size="sm" className={styles.addGear} onClick={openManualGear} disabled={importing}>+ {t('Add gear')}</Button>
        <CatalogSort value={sort} onChange={setSort} label={t('Order')} options={(['best','now','forecast','prv'] as const).flatMap((key,index)=>{
          const name={best:t('Best result'),now:t('Equip now'),forecast:fillText(t('After Titan · {0}%', 'После титана · {0}%'), [target]),prv:'PRV'}[key];
          return [{value:key,label:`${name}: ${t('High → Low')}`,dividerBefore:index>0},{value:`${key}-asc`,label:`${name}: ${t('Low → High')}`}];
        })}/>
        <div className={styles.slotRow}><GearSlotChips gear={catalog.gear} value={slot||null} onChange={next=>setSlot(next??'')} label={t('Slot')} allLabel={t('All')} locale={locale}/></div>
      </div>
      {visible.length?<OptimizerInventoryGrid ratingMode={ratingMode} entries={visible} draft={combatDraft} catalog={catalog} locale={locale} metric={metric} target={target} label={t('Inventory comparison')} onCompare={setSelected} onTry={tryPiece} baseline={readyBaseline?.pieces}/>
        :<p className={styles.empty}>{ranked.length?view==='upgrades'&&!slot&&!search?t('No better piece at these settings. Change the element or target.'):t('No matching pieces.')
          :manual?t('No inventory pieces yet.'):inventoryReceived?t('No backpack pieces to compare.'):t('This .tofbuild has no backpack inventory. Capture again with the current app; the example demonstrates 50 pieces.')}</p>}
      {hasMore&&<div ref={sentinelRef} className={styles.inventoryMore}>
        <Button variant="ghost" size="sm" onClick={loadMore}>{fillText(t('Show {0} more', 'Показать ещё {0}'), [Math.min(INVENTORY_BATCH_SIZE,matching.length-visible.length)])}</Button>
      </div>}
    </section>
    <ToolRail placement="side" label={t('Optimizer actions')} items={[
      {id:'import',label:importing?t('Importing…'):t('Import .tofbuild','Импорт .tofbuild'),icon:<RailGlyph name="import"/>,tone:'accent',onClick:openImport,disabled:importing},
      {id:'equipment',label:t('Go to equipment'),icon:<RailGlyph name="equipment"/>,onClick:goToEquipment},
      {id:'add-gear',label:t('Add gear'),icon:<RailGlyph name="add"/>,onClick:openManualGear,disabled:importing},
      {id:'clear',label:t('Clear'),icon:<RailGlyph name="clear"/>,onClick:()=>setRailDialog('clear'),disabled:importing},
      {id:'formula',label:t('Comparison formulas'),icon:<RailGlyph name="formula"/>,onClick:()=>setRailDialog('formula')},
    ]}/>
    <CaptureAppModal isOpen={showCaptureApp} onClose={()=>setShowCaptureApp(false)} locale={locale} upload={{label:t('Import .tofbuild','Импорт .tofbuild'),onClick:openImport}}/>
    <Dialog isOpen={railDialog==='clear'} onClose={closeRailDialog} appearance="table" type="warning" viewportTopInset={railInset}
      title={t('Clear this build?')}
      description={t('The build and backpack will be cleared in this browser. Saved profiles and uploaded data will remain.')}
      cancelLabel={t('Cancel')} confirmLabel={t('Clear')} onConfirm={clearDraft}/>
    <ToolInfoModal isOpen={railDialog==='formula'} onClose={closeRailDialog} eyebrow={t('Gear optimizer · Calculations')} title={t('Comparison formulas')}
      intro={t('Start with the replacement gain; below are the inputs, personal weights and upgrade scenarios behind it. The selected role and element determine the model.')} closeLabel={t('Close')}>
      <div data-comparison-formulas className={styles.formulaStack}>
        <OptimizerCalculationHelp catalog={catalog} draft={draft} locale={locale}/>
      </div>
    </ToolInfoModal>
    <GearInfoDialog gear={draft.gear.find(item=>item.id===infoSlot&&item.equipped)??null} catalog={catalog} draft={combatDraft} locale={locale} ratingMode={ratingMode} onClose={()=>setInfoSlot(null)}/>
    <ComparisonDialog ratingMode={ratingMode} key={selected??'closed'} entry={active} catalog={catalog} draft={draft} locale={locale} target={activeTarget} onClose={()=>setSelected(null)} onSelect={(key,pair)=>setSelections(current=>({...current,[key]:pair}))} onTry={greyComparison?undefined:tryState}/>
  </div></BuildEditing>
    <Modal appearance="tool" size="xl" isOpen={manualGear!==null} onClose={()=>setManualGear(null)} viewportTopInset={railInset} ariaLabel={t('Add gear manually')}>
      <Modal.Header><Modal.Title>{t('Add gear manually')}</Modal.Title></Modal.Header>
      <Modal.Body>{manualGear&&<>
        <p className={styles.note}>{t('Fill the stats of one or several slots; every slot with stats becomes a backpack piece. Enter the values before Titan so forecasts are possible.')}</p>
        <GearPickerEditor draft={manualGear} catalog={catalog} locale={locale} viewportTopInset={railInset} index={0}
          change={mutate=>setManualGear(current=>{if(!current)return current;const next=structuredClone(current);mutate(next);return next;})}/>
        <div className={styles.manualActions}><Button variant="ghost" onClick={()=>setManualGear(null)}>{t('Cancel')}</Button><Button variant="primary" onClick={addManualGear}>{t('Add to inventory')}</Button></div>
      </>}</Modal.Body>
    </Modal></>;
}
