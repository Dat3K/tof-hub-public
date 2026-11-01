'use client';
import {useEffect,useState} from 'react';
import type {WeaponOptionsCatalog} from './weapon-options';
let request:Promise<WeaponOptionsCatalog>|undefined;
/** Shared generated options are small and cached across Comp rows. */
export function useWeaponOptions(enabled:boolean) {
  const [catalog,setCatalog]=useState<WeaponOptionsCatalog|null>(null);
  useEffect(()=>{
    if(!enabled)return;
    let active=true;
    request??=fetch('/game-data/runtime/weapon-options.json').then(response=>{if(!response.ok)throw new Error('Weapon options unavailable');return response.json() as Promise<WeaponOptionsCatalog>;}).catch(error=>{request=undefined;throw error;});
    request.then(value=>{if(active)setCatalog(value);}).catch(()=>{});
    return ()=>{active=false;};
  },[enabled]);
  return enabled?catalog:null;
}
