'use client';
import {useRef,useState} from 'react';
import type {BuildDraft} from './types';
import {centredArt} from './model';

export interface DraftSnapshot<Draft=BuildDraft> {draft:Draft;customArt:string;siteArt?:BuildDraft['art']}
export interface BuildArtworkSettings {version:1;art:BuildDraft['art'];siteArt:BuildDraft['art']}
/** Personal framing never replaces the site's framing in a shared profile. */
export function withCustomArtwork(snapshot:DraftSnapshot,url:string):DraftSnapshot {
  return {...snapshot,siteArt:snapshot.customArt?snapshot.siteArt:snapshot.draft.art,
    draft:{...snapshot.draft,art:centredArt(snapshot.draft.art)},customArt:url};
}
export function withoutCustomArtwork(snapshot:DraftSnapshot):DraftSnapshot {
  return {...snapshot,draft:{...snapshot.draft,art:snapshot.siteArt??centredArt({...snapshot.draft.art,zoom:1})},customArt:'',siteArt:undefined};
}
export function buildArtworkSettings(snapshot:DraftSnapshot):BuildArtworkSettings {
  return {version:1,art:snapshot.draft.art,siteArt:snapshot.siteArt??centredArt({...snapshot.draft.art,zoom:1})};
}
export interface DraftHistory<Draft=BuildDraft> {past:DraftSnapshot<Draft>[];present:DraftSnapshot<Draft>;future:DraftSnapshot<Draft>[];group:string|null;time:number}
export const DRAFT_HISTORY_LIMIT=50;
export function createDraftHistory<Draft>(present:DraftSnapshot<Draft>):DraftHistory<Draft> {return {past:[],present,future:[],group:null,time:0};}
const comparable=<Draft,>(value:DraftSnapshot<Draft>)=>JSON.stringify({...value,draft:{...value.draft,updatedAt:undefined}});
export function commitDraftHistory<Draft>(history:DraftHistory<Draft>,present:DraftSnapshot<Draft>,group:string|null=null,time=Date.now(),continuous=false):DraftHistory<Draft> {
  if(comparable(history.present)===comparable(present))return history;
  const merge=group!==null&&group===history.group&&(continuous||time-history.time<700)&&history.future.length===0;
  if(merge&&history.past.length&&comparable(history.past.at(-1)!)===comparable(present))return {...history,past:history.past.slice(0,-1),present,group:null,time:0};
  return {past:merge?history.past:[...history.past,history.present].slice(-DRAFT_HISTORY_LIMIT),present,future:[],group,time};
}
export function stepDraftHistory<Draft>(history:DraftHistory<Draft>,direction:'undo'|'redo'):DraftHistory<Draft> {
  if(direction==='undo'){
    if(!history.past.length)return history;
    return {past:history.past.slice(0,-1),present:history.past.at(-1)!,future:[history.present,...history.future],group:null,time:0};
  }
  if(!history.future.length)return history;
  return {past:[...history.past,history.present].slice(-DRAFT_HISTORY_LIMIT),present:history.future[0],future:history.future.slice(1),group:null,time:0};
}
/** Group consecutive edits of one scalar field; bulk changes remain separate transactions. */
export function draftEditGroup<Draft>(before:Draft,after:Draft):string|null {
  const paths:string[]=[];
  const visit=(a:unknown,b:unknown,path:string)=>{
    if(a===b||path==='updatedAt')return;
    if(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'){
      for(const key of new Set([...Object.keys(a),...Object.keys(b)]))visit((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key],path?`${path}.${key}`:key);
    }else paths.push(path);
  };
  visit(before,after,'');return paths.length===1?paths[0]:null;
}
export function useDraftHistory<Draft=BuildDraft>(initial:()=>DraftSnapshot<Draft>) {
  const [history,setHistory]=useState(()=>createDraftHistory(initial()));
  const current=useRef(history);
  const apply=(next:DraftHistory<Draft>)=>{current.current=next;setHistory(next);return next.present;};
  return {history,current,reset:(snapshot:DraftSnapshot<Draft>)=>apply(createDraftHistory(snapshot)),
    commit:(snapshot:DraftSnapshot<Draft>,group:string|null=null,continuous=false)=>apply(commitDraftHistory(current.current,snapshot,group,Date.now(),continuous)),
    step:(direction:'undo'|'redo')=>apply(stepDraftHistory(current.current,direction))};
}
