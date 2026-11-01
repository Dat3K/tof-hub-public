'use client';
import {cloneElement,createContext,useContext,useState,type ReactElement,type HTMLAttributes} from 'react';

type Inspection={keys:string[];rollsOnly:boolean};
const ActiveStats=createContext<Inspection|null>(null);
// Keep individual roll types distinct; aggregate stats opt into inspecting both.
export function statFamily(type:string) {
  return type.replace(/^ATK(?= %$|$)/,'Attack').replace(/^RES(?= %$|$)/,'Resistance');
}
export function useActiveStatKeys() {
  return useContext(ActiveStats)?.keys??[];
}
function keysAt(target:EventTarget|null) {
  const node=target instanceof Element?(target.closest<HTMLElement>('[data-stat-keys]')
    ??target.closest('button.inspect-trigger')?.querySelector<HTMLElement>('[data-stat-keys]')):null;
  const keys=(node?.dataset.statInspectKeys??node?.dataset.statKeys)?.split('|').filter(Boolean);
  const hasElementDamage=keys?.some(key=>key.endsWith(' Damage %')&&key!=='Damage %');
  const hasElementResistance=keys?.some(key=>key.endsWith(' Resistance')||key.endsWith(' Resistance %'));
  const specificKeys=keys?.filter(key=>
    !(hasElementDamage&&(key===DAMAGE_SOURCES||key==='Damage %'))&&
    !(hasElementResistance&&(key===RESISTANCE_SOURCES||key==='Resistance'||key==='Resistance %'))
  );
  return specificKeys?.length?{keys:specificKeys,rollsOnly:!!node?.closest('.gear-stat-totals')}:null;
}

export function StatHighlight({children}:{children:ReactElement<HTMLAttributes<HTMLElement>>}) {
  const [hover,setHover]=useState<Inspection|null>(null);
  const [focus,setFocus]=useState<Inspection|null>(null);
  const active=hover??focus;
  const updateHover=(inspection:Inspection|null)=>setHover(previous=>previous?.keys.join('|')===inspection?.keys.join('|')&&previous?.rollsOnly===inspection?.rollsOnly?previous:inspection);
  return <ActiveStats.Provider value={active}>{cloneElement(children,{
    'data-stat-highlight':active?.keys.join('|'),
    onMouseOver:e=>updateHover(keysAt(e.target)),
    onMouseLeave:e=>{updateHover(null);if(!e.currentTarget.ownerDocument.activeElement?.matches(':focus-visible'))setFocus(null);},
    onFocusCapture:e=>setFocus(keysAt(e.target)),
    onBlurCapture:e=>setFocus(e.currentTarget.contains(e.relatedTarget)?keysAt(e.relatedTarget):null),
    onPointerDown:e=>{if(!keysAt(e.target)){setFocus(null);updateHover(null);}},
  } as HTMLAttributes<HTMLElement>)}</ActiveStats.Provider>;
}

export const DAMAGE_SOURCES='@damage-sources';
export const ATTACK_SOURCES='@attack-sources';
export const ATTACK_PERCENT_SOURCES='@attack-percent-sources';
export const HP_SOURCES='@hp-sources';
export const RESISTANCE_SOURCES='@resistance-sources';
export const resistanceSourceKey=(element:string)=>`${RESISTANCE_SOURCES}:${statFamily(element)}`;
export const resistanceSourceKeys=(elements:readonly string[])=>elements.map(resistanceSourceKey);
export const CRIT_SOURCES='@crit-sources';
export const ENHANCEMENT_SOURCES='@enhancement-shot';
export const CS_SOURCES='@cs-sources';
export const CS_TOTAL='@cs-total';
/** Titan clicks (Augmentation Count) of every item: lit by any row of "Titan · total levels". */
export const AUGMENT_COUNT='@augment-count';
export function statInspectTypes(type:string) {
  const stat=statFamily(type);
  // Elemental rows already carry their exact stat key. Including the generic
  // source channels here makes every damage/resistance source look relevant.
  if(stat.endsWith(' Damage %'))return [stat];
  if(stat==='Resistance'||stat.endsWith(' Resistance'))return [stat];
  if(stat==='HP')return [stat,HP_SOURCES];
  if(stat==='Crit')return [stat,'Crit Rate %','Crit Damage',CRIT_SOURCES];
  if(stat==='Attack')return [stat,ATTACK_SOURCES];
  return [stat];
}
export function StatLink({types,inspectTypes,sourceBonus,sourceBonuses,sourceChannel=DAMAGE_SOURCES,contribution,highlightOnHover,children,...rest}:{contribution?:'base';highlightOnHover?:boolean;types:string|string[];inspectTypes?:string[];sourceBonus?:string;sourceBonuses?:Record<string,string|undefined>;sourceChannel?:string|string[];children:ReactElement<HTMLAttributes<HTMLElement>>}&HTMLAttributes<HTMLElement>) {
  const active=useContext(ActiveStats);
  const sourceKey=active?.keys.find(key=>sourceBonuses?.[key]!==undefined);
  const channels=typeof sourceChannel==='string'?[sourceChannel]:sourceChannel;
  const activeChannel=active?.keys.find(key=>channels.includes(key));
  const inspecting=active;
  const keys=[...new Set((typeof types==='string'?[types]:types).filter(Boolean).map(statFamily))];
  const activateHighlight=highlightOnHover??(inspectTypes?.length!==0);
  const matched=!!active&&(keys.some(k=>active.keys.includes(k))||
    (contribution==='base'&&keys.includes('Resistance')&&active.keys.some(key=>key.endsWith(' Resistance'))));
  // Footer roll totals inspect gear rolls only: sources (inspectTypes=[]) stay out of that inspection entirely.
  const participates=!!inspecting&&!(active!.rollsOnly&&inspectTypes?.length===0);
  return cloneElement(children,{
    ...rest,
    'data-stat-keys':activateHighlight?keys.join('|'):undefined,
    'data-stat-inspect-keys':inspectTypes?[...new Set(inspectTypes.map(statFamily))].join('|'):undefined,
    'data-stat-match':participates?!(active!.rollsOnly&&contribution==='base')&&matched:undefined,
    'data-damage-bonus':(sourceKey?sourceBonuses?.[sourceKey]:sourceBonus)||undefined,
    'data-source-channel':inspectTypes?.length===0?(sourceKey??activeChannel??channels[0]):undefined,
    tabIndex:children.props.tabIndex??0,
  } as HTMLAttributes<HTMLElement>);
}
