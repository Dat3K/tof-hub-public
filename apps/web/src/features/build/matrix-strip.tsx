'use client';
import { localeText } from '@/lib/i18n/text';
import { localized, localizedUi, translateUiText } from '@tof-hub/i18n';
import {useState} from 'react';
import {GameRichText,MatrixSetBadge} from '@tof-hub/ui';
import {Inspect,InspectionHeading,InspectionStars} from './build-inspection';
import {BonusEffects,BonusValue,enhancementBonusText} from './stat-bonuses';
import {StatLink,ENHANCEMENT_SOURCES,ATTACK_SOURCES,ATTACK_PERCENT_SOURCES,resistanceSourceKeys,HP_SOURCES,CRIT_SOURCES,CS_SOURCES} from './stat-highlight';
import {matrixStatBonuses,matrixDisplayValue,matrixSetPieces,MATRIX_DISPLAY_ORDER,type MatrixAttackPercentSource} from './model';
import {formatValue} from './presentation';
import {matrixCombatScore} from './system-cs';
import {useBuildEditable,useBuildEditing} from './build-editing';
import {buildInfoHref} from './info-link';
import type {BuildCatalog,BuildDraft,BuildLocale} from './types';
import styles from './build.module.css';
import stripStyles from './matrix-strip.module.css';
// Requested visual order; draft indices keep their original game-slot identity.
const DISPLAY_ORDER=MATRIX_DISPLAY_ORDER;

export function MatrixStrip({matrices,catalog,locale,weaponIndex,enhancementBonuses,attackSources,presentation='card'}:{attackSources:MatrixAttackPercentSource[];enhancementBonuses:{id:string;value:number}[][];weaponIndex:number;matrices:BuildDraft['weapons'][number]['matrices'];catalog:BuildCatalog;locale:BuildLocale;presentation?:'card'|'compact'}) {
  const edit=useBuildEditable();
  const {locked}=useBuildEditing();
  const [hover,setHover]=useState<number|null>(null);
  const [focus,setFocus]=useState<number|null>(null);
  const active=hover??focus;
  const pieces=(index:number)=>matrixSetPieces(matrices,index);
  const group=active===null?null:pieces(active);
  return <div className={`matrix-strip${presentation==='compact'?` ${stripStyles.compact}`:''}`} onMouseLeave={e=>{setHover(null);if(!e.currentTarget.ownerDocument.activeElement?.matches(':focus-visible'))setFocus(null);}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocus(null);}}>
    {DISPLAY_ORDER.map(index=>{
      const matrix=matrices[index];
      const entry=catalog.matrices.find(item=>item.id===matrix.id);
      const {count,level,rank}=pieces(index);
      const effect=entry?.effects?.find(item=>item.level===level);
      const highlighted=!!group?.level&&group.indices.includes(index);
      const matrixSlot=catalog.matrixStats.slots[index];
      const position=localizedUi(matrixSlot?.name, locale)??'—';
      const slotIcon=matrixSlot?.icon?<img className={styles.inspectionHeadingIcon} src={matrixSlot.icon} alt={position}/>:undefined;
      const stats=matrixStatBonuses(matrix,index,catalog).map(s=>({...s,value:matrixDisplayValue(s.value)}));
      const labels:Record<string,string>={CommonAtkAdded:localeText(locale)('ATK'),CritAdded:localeText(locale)('Crit'),MaxHealthAdded:localeText(locale)('HP'),ElementDef:localeText(locale)('Resistance', 'Сопротивление')};
      const bonuses=<BonusEffects effects={stats.map(s=>({id:s.id,icon:catalog.statIcons[s.id==='MaxHealthAdded'?'MaxHealth':s.id]?.icon,label:labels[s.id]??s.id,value:<BonusValue tone="neutral">+{formatValue(s.value,false,locale)}</BonusValue>}))}/>;
      const star=<small {...edit(`matrix-stars:${weaponIndex}:${index}`)}>★{matrix.stars}</small>;
      const piecesLabel=localeText(locale)('pieces');
      const attack=stats.find(s=>s.id==='CommonAtkAdded')?.value??0;
      const attackBonus=attack>0?enhancementBonusText([{id:'attack',value:attack}],locale):undefined;
      const hpBonus=enhancementBonusText(stats.filter(s=>s.id==='MaxHealthAdded').map(s=>({id:'hp',value:s.value})),locale);
      const resistanceBonus=enhancementBonusText(stats.filter(s=>s.id==='ElementDef').map(s=>({id:'resistance',value:s.value})),locale);
      const resistanceKeys=resistanceBonus?resistanceSourceKeys(Object.keys(catalog.elementIcons)):[];
      const percent=attackSources.find(source=>source.indices.includes(index))?.bonuses??[];
      const percentKeys=percent.flatMap(b=>b.elements.map(element=>`${element} Attack %`));
      const matrixCs=matrixCombatScore(matrix,index,catalog);
      const critBonus=enhancementBonusText(stats.filter(s=>s.id==='CritAdded').map(s=>({id:'crit',value:s.value})),locale);
      return <StatLink key={index} types={[CS_SOURCES,...(enhancementBonuses[index].some(s=>s.value>0)?[ENHANCEMENT_SOURCES]:[]),...(attackBonus?[ATTACK_SOURCES]:[]),...(critBonus?[CRIT_SOURCES]:[]),...resistanceKeys,...(hpBonus?[HP_SOURCES]:[]),...percentKeys]} inspectTypes={[]} sourceChannel={[ENHANCEMENT_SOURCES,ATTACK_PERCENT_SOURCES,...resistanceKeys]} sourceBonuses={{[CS_SOURCES]:matrixCs===null?undefined:`CS: ${formatValue(Math.round(matrixCs),false,locale)}`,[ATTACK_SOURCES]:attackBonus,[CRIT_SOURCES]:critBonus||undefined,...Object.fromEntries(resistanceKeys.map(key=>[key,resistanceBonus||undefined])),[HP_SOURCES]:hpBonus||undefined,[ATTACK_PERCENT_SOURCES]:percent.length?'':undefined}} sourceBonus={enhancementBonusText(enhancementBonuses[index],locale,'column')}><div className="matrix" data-matrix-slot={index} {...edit(`matrix:${weaponIndex}:${index}`,'area')} data-info-href={entry?buildInfoHref('matrix',entry.id):undefined} data-matrix-highlight={highlighted||undefined} onMouseEnter={()=>setHover(index)} onFocus={()=>setFocus(index)}>
        {entry?<><Inspect tooltipSize="wide" title={localized(entry.name, locale)} heading={<InspectionHeading title={localized(entry.name, locale)} leading={slotIcon} meta={<div className={`${styles.matrixMeta} ${styles.inspectionLevelMeta}`}><InspectionStars value={rank(level)??matrix.stars}/><span>{localeText(locale)('Lv.')} {matrix.level}</span></div>} trailing={level>0?<MatrixSetBadge>✦ {translateUiText('{0}-Piece Set',locale).replace('{0}',String(level))}</MatrixSetBadge>:<span>{localeText(locale)('No set bonus', 'Нет бонуса набора')}</span>}/> }
          tooltipDetails={effect?<GameRichText text={localized(effect.description, locale)} rank={rank(level)}/>:undefined}
          description={localized(effect?.description, locale)??(level===0?(localeText(locale)('Two matrices are required for a set effect.')):undefined)}
          details={<>{entry.effects?.map(item=><div key={item.level}><h3>{item.level} {piecesLabel}{count>=item.level?` · ★${rank(item.level)} · ${localeText(locale)('Active')}`:''}</h3><GameRichText text={localized(item.description, locale)} rank={rank(item.level)}/></div>)}</>}>
          <img src={entry.icon} alt={localized(entry.name, locale)}/>{locked&&star}
        </Inspect>{!locked&&star}</>:<><span className="media-placeholder matrix-placeholder" data-hint={matrix.capturedId} {...edit(`matrix:${weaponIndex}:${index}`)}>{matrix.capturedId?<span className={stripStyles.unknownIdentity}>{matrix.capturedId}</span>:'—'}</span><small {...edit(`matrix-stars:${weaponIndex}:${index}`)}>★{matrix.stars}</small></>}
      <span className="matrix-level" {...edit(`matrix-level:${weaponIndex}:${index}`,'area')}>{entry?<Inspect title={localized(entry.name, locale)} heading={<InspectionHeading title={localized(entry.name, locale)} leading={slotIcon} meta={<div className={`${styles.matrixMeta} ${styles.inspectionLevelMeta}`}><InspectionStars value={matrix.stars}/><span>{localeText(locale)('Lv.')} {matrix.level}</span></div>}/>} tooltipDetails={stats.length?bonuses:<span>{localeText(locale)('Stat data unavailable', 'Нет данных о статах')}</span>} details={bonuses}>{localeText(locale)('Lv.')} {matrix.level}</Inspect>:<span {...edit(`matrix-level:${weaponIndex}:${index}`)}>{localeText(locale)('Lv.')} {matrix.level}</span>}</span></div></StatLink>;
    })}
  </div>;
}
