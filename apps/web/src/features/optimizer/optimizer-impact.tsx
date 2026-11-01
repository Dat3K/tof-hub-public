'use client';
import { fillText } from '@/lib/i18n/text';
import {useState} from 'react';
import {InlineNumber} from '../build/build-fields';
import {BuildTooltip,InspectionHeading} from '../build/build-inspection';
import buildStyles from '../build/build.module.css';
import tableStyles from '../build/roll-weight-table.module.css';
import {elementLabel,formatValue,statIcon} from '../build/presentation';
import type {BuildCatalog,BuildDraft,BuildLocale} from '../build/types';
import {localeText} from '@/lib/i18n/text';
import {formatFixed} from '@/lib/i18n/format';
import {statImpactModel} from './model';
import styles from './optimizer.module.css';

// Editable comparison inputs transcribed from the user's Gear Compare sheet, not game coefficients.
const initial=[1.44,.72,250,1000,1.19];
export function OptimizerImpact({draft,catalog,locale,showTable,statOrder}:{draft:BuildDraft;catalog:BuildCatalog;locale:BuildLocale;showTable:boolean;statOrder:readonly string[]}) {
  const t=localeText(locale),model=statImpactModel(draft,catalog);
  const [amounts,setAmounts]=useState(initial);
  const number=(value:number|null|undefined,percentage=false)=>value===null||value===undefined?'—':formatValue(value,percentage,locale,percentage?1:0);
  const source=model?.context.inheritFrom??model?.context.element??'';
  const rows=[{label:'ATK%',type:source+' Attack %',percent:true},{label:'DMG%',type:(model?.context.element??'')+' Damage %',percent:true},
    {label:t('ATK'),type:source+' Attack',percent:false},{label:t('Crit'),type:'Crit',percent:false},{label:'CR%',type:'Crit Rate %',percent:true}];
  const order=(type:string)=>{
    const index=statOrder.findIndex(stat=>type==='Crit'||type==='Crit Rate %'?stat===type
      :type.endsWith(' Attack %')?stat.endsWith(' Attack %')
      :type.endsWith(' Damage %')?stat.endsWith(' Damage %'):stat==='Attack');
    return index<0?statOrder.length:index;
  };
  const ordered=rows.map((row,index)=>({row,index})).sort((a,b)=>order(a.row.type)-order(b.row.type));
  const input=(values:number[],update:(values:number[])=>void,index:number,label:string)=><span className={styles.impactValue}><InlineNumber className={styles.impactInput} label={label} value={values[index]!} step={rows[index]!.percent?0.01:1} max={rows[index]!.percent?100:1000000} onChange={value=>update(values.map((current,i)=>i===index?value:current))}/>{rows[index]!.percent&&<span aria-hidden="true">%</span>}</span>;
  const support=model?.supportComparison(.005);
  return <>
    <div className={`${styles.panel} ${styles.ratingTablePanel} ${styles.impactPanel}`} data-active={showTable} inert={!showTable} aria-hidden={!showTable}>
      {!model?<p className={styles.panelNote}>{t('ATK impact needs complete combat data and a DPS or Healer role. Tank uses the PRV resistance and HP weights.')}</p>:<>
        <div className={styles.impactReference}><span>{t('Reference · ATK roll before Titan')}</span><strong>{elementLabel(source,locale)} · {model.minimum===null?'—':formatFixed(model.minimum,locale,1)}–{model.maximum===null?'—':formatFixed(model.maximum,locale,1)} {t('ATK')}</strong></div>
        <div className={styles.statsScroll}><table className={`${tableStyles.table} ${styles.impactTable}`} data-density="compact" aria-label={t('Stat impact')}>
          <thead><tr><th scope="col">{t('Stat')}</th><th scope="col" data-align="center">{t('Add','Прибавка')}</th><th scope="col">PRV</th><th scope="col">{t('EQ ATK')}</th><th scope="col"><BuildTooltip portal className={buildStyles.itemTooltip} content={<><InspectionHeading title={t('Equivalent ATK roll quality')}/><p className={buildStyles.rollValueNote}>{t('The EQ ATK value expressed within the elemental ATK roll range before Titan: 0% is the minimum, 100% the maximum. Values above 100% exceed one maximum ATK roll. This is not the roll quality of the original stat.')}</p></>}><span tabIndex={0} className={styles.impactHelp}>{t('ATK roll %')}</span></BuildTooltip></th></tr></thead>
          <tbody>{ordered.map(({row,index})=>{
            const value=amounts[index]!/(row.percent?100:1);
            const prv=model.prv(row.type,value),eq=model.equivalent(row.type,value);
            return <tr key={row.type}><th scope="row"><span className={styles.impactStat}><img className={styles.statIcon} src={statIcon(row.type,catalog)} alt=""/>{row.label}</span></th><td data-align="center">{input(amounts,setAmounts,index,`${row.label} ${t('addition')}`)}</td><td data-weight>{prv===null?'—':formatFixed(prv,locale,1)}</td><td>{number(eq.attack)}</td><td>{number(eq.quality,true)}</td></tr>;
          })}</tbody>
        </table></div>
      </>}
    </div>
    <section className={styles.supportImpact} aria-label={t('Space Support comparison')}>
      <div><strong>{t('Space Support')}{model&&` · ${elementLabel(model.context.element,locale)}`}</strong><span title={t('ATK scaled by ATK%, compared with DMG%')}>+{number(model?.supportStep)} {t('ATK')} <span aria-hidden="true">↔</span> {formatFixed(.5,locale,1)}% DMG</span></div>
      <b data-better={support===null||support===undefined?undefined:Math.abs(support-1)<.005?'equal':support>1?'atk':'dmg'}
        title={fillText(t('+{0} ATK gives {1} of the output gain of +0.5% DMG', '+{0} АТК даёт {1} от прироста урона +0.5% DMG'), [number(model?.supportStep), number(support,true)])}>
        <span>{number(support,true)}</span>
        {support!==null&&support!==undefined&&<small>{Math.abs(support-1)<.005?t('equal'):support>1?t('ATK is better'):t('DMG% is better')}</small>}
      </b>
    </section>
  </>;
}
