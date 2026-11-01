import {useEffect,useState} from 'react';
import {equippedRankingTrack,type EquippedBuildRanking,type ProfileElement} from '@tof-hub/contracts';
import {buildRole,rollValueElement} from './model';
import type {BuildCatalog,BuildDraft} from './types';
import {comparableDraft,verifyBuildCard} from './card-verification';

export interface SavedRankingSource {uid:string;slot:string;digest:string;gear:string}

/** Saved snapshots or verified signed imports; an edited card never borrows the original file's rank. */
export function useSavedBuildRanking(draft:BuildDraft,catalog:BuildCatalog,source:SavedRankingSource|null,enabled=true) {
  const element=rollValueElement(draft,catalog) as ProfileElement|null;
  const role=buildRole(draft);
  const matches=enabled&&source&&draft.captureSource?.digest===source.digest&&JSON.stringify(draft.gear)===source.gear;
  const selected=element?equippedRankingTrack(element)[0]:null;
  const captureSource=draft.captureSource;
  const digest=captureSource?.digest;
  const proofKey=enabled&&!matches&&captureSource?.signature?`${digest}:${comparableDraft(draft)}`:null;
  const [verified,setVerified]=useState<string|null>(null);
  useEffect(()=>{
    if(!enabled||!proofKey)return;
    let active=true;
    verifyBuildCard(draft,catalog,undefined,'ranking').then(provenance=>{if(active)setVerified(provenance==='verified'?proofKey:null);});
    return()=>{active=false;};
  },[enabled,proofKey,draft,catalog]);
  const imported=!!proofKey&&verified===proofKey;
  const url=matches&&selected?`/api/v1/build/profiles/${encodeURIComponent(source.uid)}/${encodeURIComponent(source.slot)}/ranking?role=${role}&element=${selected}`
    :imported&&selected?'/api/v1/build/import/ranking':null;
  const body=imported&&url==='/api/v1/build/import/ranking'?JSON.stringify({capture:captureSource!.capture,digest,signature:captureSource!.signature,role,element:selected}):undefined;
  const requestKey=url?JSON.stringify([url,digest,role,selected]):null;
  const [result,setResult]=useState<{url:string;ranking:EquippedBuildRanking}|null>(null);
  useEffect(()=>{
    if(!url||!digest||!requestKey)return;
    let controller:AbortController|null=null,active=true;
    const refresh=()=>{
      controller?.abort();const pending=new AbortController();controller=pending;
      fetch(url,{cache:'no-store',signal:pending.signal,...(body?{method:'POST',headers:{'Content-Type':'application/json'},body}:{})})
        .then(response=>response.ok?response.json() as Promise<EquippedBuildRanking>:null)
        .then(ranking=>{if(active&&!pending.signal.aborted)setResult(ranking?.available&&ranking.digest===digest?{url:requestKey,ranking}:null);})
        .catch(()=>{if(active&&!pending.signal.aborted)setResult(null);});
    };
    refresh();
    const timer=setInterval(refresh,60000);
    return()=>{active=false;controller?.abort();clearInterval(timer);};
  },[url,digest,body,requestKey]);
  return enabled&&requestKey&&result?.url===requestKey&&result.ranking.digest===digest?result.ranking:undefined;
}
