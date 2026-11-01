'use client';
import {useLayoutEffect,useState} from 'react';

/** Keep overlays below the current responsive site header. */
export function useSiteHeaderInset(active:boolean) {
  const [inset,setInset]=useState(0);
  useLayoutEffect(()=>{
    if(!active)return;
    const header=document.querySelector<HTMLElement>('[data-site-header]');
    const update=()=>setInset(Math.max(0,header?.getBoundingClientRect().bottom??0));
    update();
    const observer=new ResizeObserver(update);if(header)observer.observe(header);
    window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
    return()=>{observer.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};
  },[active]);
  return inset;
}
