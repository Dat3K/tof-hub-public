import {RollWeightList} from '../build/gear-roll-value';
import {useState} from 'react';
import {ModeSwitcher} from '@tof-hub/ui';
import {OptimizerImpact} from './optimizer-impact';
import {useBuildEditable,useBuildEditing,type BuildEditTarget} from '../build/build-editing';
import {buildCombatDraft,combatRates,combatStatWinners,duoInheritedValue,elementTotalAttack,elementTotalDamagePercent,gearElementStat,gearRollValue,rollValueContext,universalAttack} from '../build/model';
import {elementLabel,formatValue} from '../build/presentation';
import type {BuildCatalog,BuildDraft,BuildLocale} from '../build/types';
import buildStyles from '../build/build.module.css';
import {localeText} from '@/lib/i18n/text';
import {pairMarginalWeights} from './model';
import styles from './optimizer.module.css';

function StatValue({value,target,missing=false,hint}:{value:string;target?:BuildEditTarget;missing?:boolean;hint?:string}) {
  const edit=useBuildEditable(),{locked}=useBuildEditing();
  const needsInput=!locked&&missing;
  return target?<span {...edit(target)} className={locked?undefined:styles.editableValue} data-needs-input={needsInput||undefined} aria-invalid={needsInput||undefined} title={needsInput?hint:undefined}>{value}</span>:value;
}
const Icon=({src}:{src?:string})=>src?<img className={styles.statIcon} src={src} alt=""/>:null;

/**
 * Combat baseline laid out like the Build card's COMBAT STATS (HP / universal ATK, the crit hero, crit damage, the
 * element table with a grey gear-only line under each element) and the PRV weights of one roll on the current gear.
 */
export function OptimizerStats({draft,catalog,locale,temporaryLabel,onTargetHint}:{draft:BuildDraft;catalog:BuildCatalog;locale:BuildLocale;temporaryLabel?:string;/** Highlights the Titan target input in the header (hover and keyboard focus only). */onTargetHint?:(active:boolean)=>void}) {
  const [view,setView]=useState<'weights'|'impact'>('weights');
  const t=localeText(locale),combat=buildCombatDraft(draft,catalog),context=rollValueContext(combat,catalog);
  const missingHint=t('Enter your value');
  const elements=[...new Set([context.element,...context.percentElements])].filter(element=>!!catalog.elementIcons[element]);
  const rates=combatRates(combat,catalog),whiteAttack=universalAttack(combat);
  const winners=context.role==='tank'?null:combatStatWinners(combat,catalog);
  const received=draft.captureSource?.capture.combat;
  const fmt=(value:number|null|undefined,percent=false,digits=percent?1:0)=>value===null||value===undefined?'—':formatValue(value,percent,locale,digits);
  const crit=received?.crit===null?null:combat.combat.crit;
  // An unequipped item removes nothing: these weights are on TOP of the complete current build.
  const anchor=draft.gear[0];
  const weights=anchor?gearRollValue({...anchor,equipped:false},{...combat,rv:{...draft.rv,element:context.selected,includeCrit:true,mode:'prv'}},catalog):null;
  const marginalWeights=weights?.profile?pairMarginalWeights(weights.rollWeights.filter(row=>row.rated),combat,catalog,context):[];
  const icons=catalog.displayIcons;
  const gear=elements.map(element=>({element,attack:gearElementStat(draft,catalog,element,'Attack','rolls'),attackPercent:gearElementStat(draft,catalog,element,'Attack %','rolls'),damage:gearElementStat(draft,catalog,element,'Damage %','rolls')}));
  // The pair's counted gear ATK% / DMG% (duoInheritedValue): the higher element total of each kind.
  const pair=!context.inheritFrom&&context.percentElements.length===2;
  return <section className={styles.overview} aria-label={t('Build stats and personal weights')}>
    <div className={styles.column}>
      <h2 className={buildStyles.sectionTitle}><span>{t('Combat stats')}</span><small className={temporaryLabel?styles.whatIfDelta:undefined}>{temporaryLabel??t('Current equipment')}</small></h2>
      <div className={`${styles.panel} ${styles.combat}`}>
        <div className={styles.healthRow}>
          <div><span><Icon src={icons.hp?.icon}/>{t('HP')}</span><b><StatValue value={fmt(received?.hp===null?null:combat.combat.hp)} target="combat:hp" missing={!(combat.combat.hp>0)} hint={missingHint}/></b></div>
          <div><span><Icon src={catalog.statIcons.CommonAtkAdded?.icon}/>{t('Universal ATK')}</span><b>{fmt(whiteAttack===null?null:Math.round(whiteAttack))}</b></div>
        </div>
        {/* One line: rating → base chance + extra = total, then crit damage (user, 2026-10-09). */}
        <div className={styles.critRow} title={`${t('Crit rating ÷ enemy-level coefficient')} · Lv. ${draft.enemyLevel}. ${t('The displayed total is uncapped; effective chance is capped at 100%.')}`}>
          <div><span><Icon src={icons.crit?.icon}/>{t('Crit')}</span><b><StatValue value={fmt(crit)} target="combat:crit"/></b>
            <small>→ {fmt(crit===null?null:rates.base,true,3)} + <StatValue value={fmt(received?.additionalCritRate===null?null:combat.combat.additionalCritRate,true,3)} target="combat:additionalCritRate"/> =</small>
            <strong aria-label={t('Crit chance, uncapped')}>{fmt(crit===null||rates.total===null?null:rates.total,true,3)}</strong></div>
          <div><span><Icon src={icons.critDamage?.icon}/>{t('Crit DMG')}</span><b><StatValue value={fmt(received?.critDamage===null?null:combat.combat.critDamage,true,2)} target="combat:critDamage"/></b></div>
        </div>
        <section className={styles.statsGroup} aria-label={t('Full build')}>
        <h3 className={styles.statsGroupTitle}>{t('Full build')}</h3>
        <div className={styles.statsScroll}><table className={`${styles.statsTable} ${buildStyles.elementStatPalette}`} data-element={winners?.element??undefined}>
          <caption className="sr-only">{t('Combat stats')}</caption>
          <colgroup>{Array.from({length:5},(_,index)=><col key={index}/>)}</colgroup>
          <thead><tr><th>{t('Element','Стихия')}</th><th><Icon src={icons.attack?.icon}/>{t('Base ATK','Базовая АТК')}</th><th>{t('Final ATK')}</th><th><Icon src={icons.attack?.icon}/>{t('ATK%')}</th><th><Icon src={icons.damage?.icon}/>{t('DMG%')}</th></tr></thead>
          <tbody>{elements.filter(element=>element===context.element).map(element=>{
            const index=draft.combat.elements.findIndex(row=>row.id===element),stats=combat.combat.elements[index],attack=elementTotalAttack(combat,catalog,element);
            const complete=stats&&stats.attack>0&&stats.attackPercent!==undefined;
            const totals=(kind:'attackPercent'|'damage')=>Object.fromEntries(combat.combat.elements.map(row=>[row.id,row[kind]??0]));
            const percentSource=duoInheritedValue(combat,catalog,element,'Attack %',totals('attackPercent'))?.from??element;
            const damageSource=duoInheritedValue(combat,catalog,element,'Damage %',totals('damage'))?.from??element;
            const finalSource=attack.inherited?attack.source:percentSource;
            const colour=(source:string)=>context.role==='tank'?{}:{className:buildStyles.sourcePercentage,'data-element':source};
            const attackIndex=draft.combat.elements.findIndex(row=>row.id===attack.source);
            return <tr key={element} data-selected={context.element===element||undefined}>
                <th data-used={winners?.element===element||undefined}><span className={styles.elementName}><img src={catalog.elementIcons[element]?.icon} alt=""/>{elementLabel(element,locale)}</span></th>
                <td><span {...colour(attack.source)}><StatValue value={stats&&stats.attack>0?fmt(attack.attack):'—'} target={attackIndex>=0?`element:${attackIndex}:attack`:undefined} missing={!stats||!(stats.attack>0)} hint={missingHint}/></span></td>
                <td className={styles.finalAttack} title={complete?`${fmt(attack.attack)} + ${fmt(attack.attack*attack.percent)}${attack.support>0?` + ${fmt(attack.support)} (Space Support)`:''}${attack.foodAttack>0?` + ${fmt(attack.foodAttack)} (${t('Food')})`:''} = ${fmt(attack.total)}`:undefined}>
                  <span className={styles.attackSum}><span {...colour(percentSource)} data-attack-bonus title={t('ATK% converted to flat ATK')}>+ {complete?fmt(attack.attack*attack.percent):'—'}</span>{attack.foodAttack>0&&<span title={t('Food ATK · after ATK%')}> + {fmt(attack.foodAttack)}</span>}{' '}<strong {...colour(finalSource)} data-final-attack>= {complete?fmt(attack.total):'—'}</strong></span>
                </td>
                <td><span {...colour(percentSource)}><StatValue value={complete?fmt(attack.percent,true):'—'} target={index>=0?`element:${index}:attackPercent`:undefined}/></span></td>
                <td><span {...colour(damageSource)}><StatValue value={fmt(stats?elementTotalDamagePercent(combat,catalog,element):null,true)} target={index>=0?`element:${index}:damage`:undefined}/></span></td>
              </tr>;
          })}</tbody>
        </table></div>
        </section>
        <section className={styles.statsGroup} aria-label={t('From gear')}>
        <h3 className={styles.statsGroupTitle}>{t('From gear · random stats')}</h3>
        <p className={styles.panelNote}>{t('Initial random values, upgrade rolls and Titan additions. Fixed base stats and enhancement are excluded.')}</p>
        <div className={styles.statsScroll}><table className={`${styles.statsTable} ${buildStyles.elementStatPalette}`} data-element={winners?.element??undefined}>
          <caption className="sr-only">{t('Equipped gear totals')}</caption>
          <colgroup>{Array.from({length:5},(_,index)=><col key={index}/>)}</colgroup>
          <thead><tr><th>{t('Element','Стихия')}</th><th colSpan={2}><Icon src={icons.attack?.icon}/>{t('Flat ATK')}</th><th><Icon src={icons.attack?.icon}/>{t('ATK%')}</th><th><Icon src={icons.damage?.icon}/>{t('DMG%')}</th></tr></thead>
          <tbody>{gear.map(row=><tr key={row.element} data-selected={context.element===row.element||undefined}>
            <th data-used={winners?.element===row.element||undefined}><span className={styles.elementName}><img src={catalog.elementIcons[row.element]?.icon} alt=""/>{elementLabel(row.element,locale)}</span></th>
            <td colSpan={2} data-used={winners?.attack===row.element||undefined}>{fmt(row.attack)}</td>
            <td data-counted={!!winners&&pair&&winners.attackPercent===row.element||undefined} data-used={!pair&&winners?.attackPercent===row.element&&row.attackPercent>0||undefined}>{fmt(row.attackPercent,true)}</td>
            <td data-counted={!!winners&&pair&&winners.damage===row.element||undefined} data-used={!pair&&winners?.damage===row.element&&row.damage>0||undefined}>{fmt(row.damage,true)}</td>
          </tr>)}</tbody>
        </table></div>
        </section>
        {pair&&winners&&<p className={styles.panelNote}>{t('On a duo pair, flat ATK, ATK% and DMG% each count from the element with the higher gear total (highlighted).')}</p>}
      </div>
    </div>
    <div className={styles.column}>
      <div className={styles.equipmentHeading}>
        <h2 className={buildStyles.sectionTitle}>{t('Stat weights · PRV')}</h2>
        <ModeSwitcher presentation="standalone" value={view} onChange={setView} ariaLabel={t('Stat table view')} options={[{value:'weights',label:t('PRV weights'),tone:'gold'},{value:'impact',label:t('Stat impact'),tone:'sky'}]}/>
        <span className={styles.headerStatus}>{t('On current gear')}</span>
      </div>
      <div className={styles.ratingTables}>
      <div className={`${styles.panel} ${styles.ratingTablePanel}`} data-active={view==='weights'} inert={view!=='weights'} aria-hidden={view!=='weights'}>
        {weights?.profile?<RollWeightList weights={marginalWeights} catalog={catalog} locale={locale} mode="PRV" presentation="table" density="compact" showMinimum/>:<p className={styles.panelNote}>{t('Not enough combat data to calculate personal weights.')}</p>}
      </div>
      <OptimizerImpact draft={draft} catalog={catalog} locale={locale} showTable={view==='impact'} statOrder={marginalWeights.map(row=>row.type)}/>
      </div>
      <ul className={styles.equipmentLegend} aria-label={t('Equipment outline colors')}>
        <li data-tone="reroll"><span aria-hidden="true"/><div><strong>{t('Yellow')}</strong> — {t('Titan stats are below your ')}<span tabIndex={0} className={styles.targetLink} onMouseEnter={()=>onTargetHint?.(true)} onMouseLeave={()=>onTargetHint?.(false)} onFocus={()=>onTargetHint?.(true)} onBlur={()=>onTargetHint?.(false)}>{t('selected target percentage')}</span>.</div></li>
        <li data-tone="upgrade"><span aria-hidden="true"/><div><strong>{t('Red')}</strong> — {t('Better gear is available in your inventory.')}</div></li>
      </ul>
    </div>
  </section>;
}
