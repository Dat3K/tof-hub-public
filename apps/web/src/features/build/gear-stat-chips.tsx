import { localeText } from '@/lib/i18n/text';

import {formatValue,gearStatOrder,rollValueStatGroup,statIcon,statLabel} from './presentation';
import type {BuildCatalog,BuildLocale} from './types';
import styles from './gear-stat-chips.module.css';
import {BuildTooltip,InspectionHeading} from './build-inspection';
import buildStyles from './build.module.css';
import {getBuildRVWeight,getBuildRatedWeight,type BuildRVProfile} from '@tof-hub/game-domain';

type StatCatalog=Pick<BuildCatalog,'reference'|'statTypeIcons'|'statIcons'|'displayIcons'|'elementIcons'|'resistanceIcons'>;
/** Counted stats in game order. Flat ATK/RES combines universal and the selected element. */
export function GearStatChips({entries,element,flatElements,catalog,locale,role='dps',attackBase,equivalenceProfile,equivalenceLabel,label=(type)=>statLabel(type,locale)}:{
  entries:readonly {type:string;value:number}[];element:string;catalog:StatCatalog;locale:BuildLocale;
  role?:'dps'|'healer'|'tank';flatElements?:readonly string[];attackBase?:number;label?:(type:string)=>string;
  equivalenceProfile?:BuildRVProfile;equivalenceLabel?:string;
}) {
  const flatKind=role==='tank'?'Resistance':'Attack';
  // Altered copies one native ATK source; its own ATK is a separate post-percentage addition.
  const inherited=element==='Altered'&&role!=='tank'
    ?flatElements?.find(id=>id!=='Altered')??entries.find(entry=>entry.type!=='Altered Attack'&&/ Attack(?: %)?$/.test(entry.type))?.type.replace(/ Attack(?: %)?$/,'')
    :undefined;
  const totals=new Map<string,number>();
  for(const entry of entries)totals.set(entry.type,(totals.get(entry.type)??0)+entry.value);
  const flatTypes=[flatKind,...(role==='tank'?[element]:element==='Altered'?(inherited?[inherited]:[]):flatElements??[element]).map(element=>`${element} ${flatKind}`)];
  let flat=[...totals].filter(([type])=>flatTypes.includes(type)).map(([type,value])=>({type,value}));
  const others=[...totals].filter(([type])=>!flatTypes.includes(type)).map(([type,value])=>({type,value}));
  const percent=(type:string)=>!!catalog.reference.statTypes[type]?.isPercentageBased;
  const mark=(type:string)=>({'attack-percent':'A','damage-percent':'D'} as Record<string,string>)[rollValueStatGroup(type)];
  // A duo total can contain winners from both elements across slots. Label it by the larger counted contribution,
  // rather than the query's first element; the tooltip still lists every source of the unchanged total.
  const pairSource=role!=='tank'&&flatElements&&flatElements.length>1
    ?flat.filter(entry=>entry.type!=='Attack').reduce<{type:string;value:number}|undefined>((best,entry)=>!best||entry.value>best.value?entry:best,undefined)
    :undefined;
  if(pairSource)flat=flat.filter(entry=>entry.type==='Attack'||entry.type===pairSource.type);
  const combinedType=element==='Altered'&&role!=='tank'?(inherited?`${inherited} Attack`:'Attack')
    :role!=='tank'&&flatElements&&flatElements.length>1?pairSource?.type??'Attack':`${element} ${flatKind}`;
  const combined=flat.length?{type:combinedType,value:flat.reduce((sum,entry)=>sum+entry.value,0)}:null;
  const ordered=[...others,...(combined?[combined]:[])].sort((a,b)=>gearStatOrder(a.type)-gearStatOrder(b.type));
  return <>{ordered.map(entry=>{
    const converted=rollValueStatGroup(entry.type)==='attack-percent'&&attackBase!==undefined&&attackBase>0;
    const group=rollValueStatGroup(entry.type),profile=equivalenceProfile;
    const flatWeight=profile?getBuildRVWeight('Attack',profile):0;
    const equivalent=entry.type==='Crit Rate %'&&profile?{label:localeText(locale)('Crit equivalent', 'Эквивалент крита'),value:entry.value*profile.critDenominator}
      :profile&&flatWeight>0&&(group==='attack-percent'||group==='damage-percent')?{label:localeText(locale)('Base ATK equivalent', 'Эквивалент базовой АТК'),value:entry.value*getBuildRVWeight(entry.type,profile)/flatWeight}:null;
    const tankEquivalent=role==='tank'&&profile?(()=>{
      const target=entry.type==='HP %'?'HP':entry.type===element+' Resistance %'?element+' Resistance':null;
      if(!target)return null;
      const targetWeight=getBuildRatedWeight(target,profile,element,undefined,'tank');
      const sourceWeight=getBuildRatedWeight(entry.type,profile,element,undefined,'tank');
      return targetWeight>0&&sourceWeight>0?{label:target==='HP'?(localeText(locale)('HP equivalent', 'Эквивалент HP')):(localeText(locale)('Resistance equivalent', 'Эквивалент резиста')),value:entry.value*sourceWeight/targetWeight}:null;
    })():null;
    const displayedEquivalent=equivalent??tankEquivalent;
    const content=<>
      <InspectionHeading title={label(entry.type)} trailing={<b>{formatValue(entry.value,percent(entry.type),locale)}</b>}/>
      {entry===combined&&<div className={styles.breakdown}>{flat.map(item=><div key={item.type}><span>{label(item.type)}</span><b>{formatValue(item.value,false,locale)}</b></div>)}</div>}
      {displayedEquivalent?<div className={styles.breakdown}>{equivalenceLabel&&<small>{equivalenceLabel}</small>}<div><span>{displayedEquivalent.label}</span><b>≈ +{formatValue(displayedEquivalent.value,false,locale)}</b></div></div>
        :converted&&<div className={styles.breakdown}><div><span>{localeText(locale)('ATK added')}</span><b>≈ +{formatValue(attackBase!*entry.value,false,locale)}</b></div></div>}
    </>;
    return <BuildTooltip key={entry.type} portal delayMs={200} className={buildStyles.itemTooltip} content={content}>
      <span className={styles.chip} tabIndex={0} aria-label={`${label(entry.type)} ${formatValue(entry.value,percent(entry.type),locale)}`}><span className={styles.icon}><img src={statIcon(entry.type,catalog)} alt=""/>{entry!==combined&&mark(entry.type)&&<b aria-hidden="true">{mark(entry.type)}</b>}</span>{formatValue(entry.value,percent(entry.type),locale)}</span>
    </BuildTooltip>;
  })}</>;
}
