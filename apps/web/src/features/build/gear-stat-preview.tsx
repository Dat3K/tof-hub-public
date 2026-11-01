import { localized, localizedUi, translateUiText} from '@tof-hub/i18n';
import type {ReactNode} from 'react';
import {InspectionHeading} from './build-inspection';
import {GearStatSection} from './gear-base-stats';
import {GearRollQuality} from './gear-roll-quality';
import {Stars} from './stars';
import {localeText} from '@/lib/i18n/text';
import {augmentCountParts,formatValue,gearStatOrder,statIcon,statLabel} from './presentation';
import type {BuildCatalog,BuildLocale,GearDraft} from './types';
import styles from './gear-stat-preview.module.css';

type PreviewCatalog=Pick<BuildCatalog,'gear'|'reference'|'statTypeIcons'|'statIcons'|'displayIcons'|'elementIcons'|'resistanceIcons'>;

/**
 * Read-only gear stats shared by the Ranking hover card and the optimizer. Callers supply their rating and ceilings.
 * `cell` is `card` without the heading, for a caller-owned gear cell header (Optimizer board).
 */
export function GearStatPreview({gear,catalog,locale,ratedTypes=[],maximums,score,baseDetails,label=(type)=>statLabel(type,locale),showCount=false,presentation='tooltip',density='normal',rolls,pad}: {
  gear:GearDraft;catalog:PreviewCatalog;locale:BuildLocale;ratedTypes?:readonly string[];
  maximums?:{random:readonly (number|null)[];added:readonly (number|null)[]};score?:ReactNode;
  /** Empty rows appended per group so neighbouring cells line their rows up (random / Titan-added counts). */
  pad?:{random:number;added:number};
  label?:(type:string)=>string;showCount?:boolean;
  /** Random-row roll details (gearRollDetails), shown as ×N · quality like the Build card. */
  rolls?:readonly {count:string;quality:number|null}[];presentation?:'tooltip'|'card'|'cell'|'item';density?:'normal'|'compact';baseDetails?:ReactNode;
}) {
  const t=localeText(locale);
  const meta=catalog.gear.find(item=>item.id===gear.id);
  const rare=gear.titan?catalog.reference.titanRare.items.find(item=>item.id===gear.rareId):undefined;
  const count=showCount?augmentCountParts(gear.augmentCount,locale):null;
  const rated=new Set(ratedTypes);
  const rows=[...gear.rows.map((row,index)=>({...row,added:false,maximum:maximums?.random[index]??null,roll:rolls?.[index]})),
    ...(gear.titan||gear.augmented?gear.augments.map((row,index)=>({...row,added:true,maximum:maximums?.added[index]??null,roll:undefined})):[])].filter(row=>row.type).sort((a,b)=>Number(a.added)-Number(b.added)||gearStatOrder(a.type)-gearStatOrder(b.type));
  const blanks=(added:boolean,total:number)=>Array.from({length:Math.max(0,total-rows.filter(row=>row.added===added).length)},()=>({type:'',value:0,added,maximum:null,roll:undefined,blank:true as const}));
  const padded=pad&&presentation==='cell'?[...rows.filter(row=>!row.added),...blanks(false,pad.random),...rows.filter(row=>row.added),...blanks(true,pad.added)]:rows;
  const statRows=(entries:typeof padded)=>{
    const hasMaximums=entries.some(row=>row.maximum!==null);
    return <ul className={styles.stats} data-presentation={presentation} data-density={density} data-rolls={rolls?true:undefined} data-maximums={hasMaximums||undefined}>{entries.map((row,index)=>'blank' in row?<li key={index} aria-hidden="true" data-added={row.added||undefined} data-titan-start={row.added&&!entries[index-1]?.added||undefined}><span className={styles.name}>&nbsp;</span><b className={styles.values}>&nbsp;</b>{rolls&&<small className={styles.roll}/>}</li>:<li key={index} data-rated={rated.has(row.type)||undefined} data-added={row.added||undefined} data-titan-start={presentation!=='item'&&row.added&&!entries[index-1]?.added||undefined}>
      <span className={styles.name}><img src={statIcon(row.type,catalog)} alt=""/>{label(row.type)}</span>
      <b className={styles.values} data-hint={row.maximum!==null?(localeText(locale)('Current value / Titan maximum for this item’s rolls', 'Текущее значение / максимум Titan для проков этой вещи')):undefined}>
        <span data-stat-value="current">{formatValue(row.value,!!catalog.reference.statTypes[row.type]?.isPercentageBased,locale)}</span>
        {hasMaximums&&<><span className={styles.separator}>{row.maximum!==null?' / ':null}</span><span className={styles.maximum} data-stat-value="maximum">{row.maximum!==null?formatValue(row.maximum,!!catalog.reference.statTypes[row.type]?.isPercentageBased,locale):null}</span></>}
      </b>
      {rolls&&<small className={styles.roll}>{row.roll?<>×{row.roll.count}<GearRollQuality value={row.roll.quality} locale={locale}/></>:null}</small>}
    </li>)}</ul>;
  };
  const footer=(rare||count)&&<div className={styles.footer} data-density={density}>{rare&&<span className={styles.rare}><img className={styles.rareIcon} src={statIcon(rare.nameEn,catalog)} alt=""/>{locale === 'ru' ? rare.nameRu : translateUiText(rare.nameEn, locale)} +{gear.rareLevel}</span>}
      {count&&<span className={styles.count}><span>{translateUiText('Aug:',locale)}</span> <b>{count.value}</b></span>}
    </div>;
  if(presentation==='item')return <article className={styles.item} aria-label={`${localizedUi(meta?.name, locale)??gear.id} · ${t('Item stats')}`}>
    <header className={styles.itemHeader}>
      {meta&&<img className={styles.itemIcon} src={meta.icons[gear.titan?'titan':gear.augmented?'augmented':'normal']} alt=""/>}
      <div className={styles.itemIdentity}><h3><span>{localizedUi(meta?.name, locale)??gear.id}</span><b data-hint={t('Enhancement Level')}>+{gear.enhancement}</b></h3>
        <div className={styles.itemProgress}><Stars value={gear.stars}/></div>
        <div className={styles.itemMeta}><span data-stage={gear.titan?'titan':gear.augmented?'augmented':'normal'}>{gear.titan?translateUiText('Titan',locale):gear.augmented?t('Augmented','Аугментация'):t('Normal','Обычная')}</span>{score}</div>
      </div>
    </header>
    {baseDetails}
    <GearStatSection title={t('Random stats')}>{statRows(rows.filter(row=>!row.added))}</GearStatSection>
    {rows.some(row=>row.added)&&<GearStatSection title={gear.titan?translateUiText('Titan',locale):t('Augmentation stats','Статы аугментации')}>{statRows(rows.filter(row=>row.added))}</GearStatSection>}
    {footer}
  </article>;
  return <>
    {presentation!=='cell'&&<InspectionHeading title={localizedUi(meta?.name, locale)??gear.id} meta={gear.titan?<span data-meta-stage>{translateUiText('TITAN',locale)}</span>:undefined} trailing={score}/>}
    {statRows(padded)}
    {footer}
  </>;
}
