import {useEffect,useMemo,useState} from 'react';
import {useBrowserOwner} from '../players/use-browser-owner';
import type {GearTopEntry,PlayerTopEntry,RankingResponse} from './types';

type Entry=GearTopEntry|PlayerTopEntry;
const EMPTY:Entry[]=[];
export function useRankingOwner(board:string,url:string,loaded:Entry[]) {
  const owner=useBrowserOwner();
  const [requested,setRequested]=useState<{scope:string;attempt:number}|null>(null);
  const [visible,setVisible]=useState(false);
  const [result,setResult]=useState<{board:string;uid:string;entries:Entry[];status:'ready'|'missing'|'error'}|null>(null);
  const scope=board+'|'+owner?.uid;
  useEffect(()=>{setRequested(null);setResult(null);setVisible(false);},[scope]);
  const requestedHere=requested?.scope===scope;
  const active=visible&&requestedHere;
  const saved=result?.board===board&&result.uid===owner?.uid?result:null;
  const resolved=saved?.status==='ready'||saved?.status==='missing';
  const present=useMemo(()=>owner?loaded.filter(entry=>!entry.ideal&&!('synthetic' in entry&&entry.synthetic)&&entry.player.uid===owner.uid):EMPTY,[loaded,owner]);
  const hasPresent=present.length>0;
  const lookupUrl=useMemo(()=>{
    if(!owner)return '';
    const target=new URL(url,window.location.origin);
    target.searchParams.set('q',owner.uid);target.searchParams.delete('offset');target.searchParams.delete('slots');
    return target.pathname+target.search;
  },[url,owner]);
  useEffect(()=>{
    if(!requestedHere||!owner||hasPresent||resolved)return;
    const controller=new AbortController();
    void fetch(lookupUrl,{signal:controller.signal,cache:'no-store'})
      .then(response=>{if(!response.ok)throw new Error('Ranking unavailable');return response.json() as Promise<RankingResponse<Entry>>;})
      .then(response=>{
        if(controller.signal.aborted)return;
        if(!response.available)throw new Error('Ranking unavailable');
        const entries=response.entries.filter(entry=>entry.player.uid===owner.uid&&!entry.ideal).map(entry=>({...entry,ownerPin:true as const}));
        setResult({board,uid:owner.uid,entries,status:entries.length?'ready':'missing'});
      }).catch(()=>{if(!controller.signal.aborted)setResult({board,uid:owner.uid,entries:[],status:'error'});});
    return ()=>controller.abort();
  },[requestedHere,board,lookupUrl,owner,hasPresent,requested,resolved]);
  const current=active?saved:null;
  return {owner,active,reveal:()=>{
    setVisible(true);
    if(requestedHere&&saved?.status!=='error')return;
    setResult(null);setRequested(current=>({scope,attempt:(current?.attempt??0)+1}));
  },
    // Hiding is presentation-only: retain a settled result or the one in-flight request.
    hide:()=>{setVisible(false);},
    pinned:active&&!!current?.entries.length,
    entries:active?(current?.entries.length?current.entries:hasPresent?present:EMPTY):EMPTY,
    status:active?(hasPresent?'ready':current?.status??'loading'):'idle'};
}

/** A pinned copy remains stable above the board; the original row keeps its natural position too. */
export function includeOwnerEntries<T extends Entry>(entries:T[],own:T[],id:(entry:T)=>string,pinned=false):T[] {
  if(pinned&&own.length)return [...own,...entries];
  const ids=new Set(entries.map(id));
  const missing=own.filter(entry=>!ids.has(id(entry)));
  return missing.length?[...missing,...entries]:entries;
}
