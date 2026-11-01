import {useEffect,useState} from 'react';
import {OWNER_CHANGED,readBrowserOwner,type BrowserOwner} from './browser-owner';

/** Follows the imported character across tabs and later imports; null until mounted (SSR-safe). */
export function useBrowserOwner():BrowserOwner|null {
  const [owner,setOwner]=useState<BrowserOwner|null>(null);
  useEffect(()=>{
    const refresh=()=>{const next=readBrowserOwner();setOwner(current=>current?.uid===next?.uid&&current?.nickname===next?.nickname?current:next);};refresh();
    window.addEventListener('storage',refresh);window.addEventListener(OWNER_CHANGED,refresh);
    return ()=>{window.removeEventListener('storage',refresh);window.removeEventListener(OWNER_CHANGED,refresh);};
  },[]);
  return owner;
}
