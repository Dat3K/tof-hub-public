'use client';

import {useEffect,useState} from 'react';
import type {BuildCatalog,BuildDraft} from '../build/types';
import type {InventoryPiece,LoadoutPotential,UpgradeStage} from './model';

export interface LoadoutRequest {
  pieces:readonly InventoryPiece[];draft:BuildDraft;catalog:BuildCatalog;target:number;
  options:{stage:UpgradeStage;mode:'prv'|'grv';selected:string};
}
export type LoadoutResponse={result:LoadoutPotential;error?:never}|{result?:never;error:true};

export function useLoadoutPotential(input:LoadoutRequest|null) {
  const [completed,setCompleted]=useState<{input:LoadoutRequest;response:LoadoutResponse}|null>(null);
  useEffect(()=>{
    if(!input)return;
    let worker:Worker|undefined;
    let active=true;
    const finish=(response:LoadoutResponse)=>{
      if(active)setCompleted({input,response});
      worker?.terminate();
    };
    try {
      worker=new Worker(new URL('./loadout.worker.ts',import.meta.url));
      worker.onmessage=(event:MessageEvent<LoadoutResponse>)=>finish(event.data);
      worker.onerror=()=>finish({error:true});
      worker.onmessageerror=()=>finish({error:true});
      worker.postMessage(input);
    } catch {finish({error:true});}
    return ()=>{active=false;worker?.terminate();};
  },[input]);
  const response=completed?.input===input?completed?.response:null;
  return {potential:response?.result??null,pending:!!input&&!response,error:!!response?.error};
}
