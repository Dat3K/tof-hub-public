'use client';
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';

/** Lazily mount once; retain closed content so both directions can animate. */
export function Collapsible({open,children,id}:{open:boolean;children:ReactNode|(()=>ReactNode);id?:string}) {
  const [mounted,setMounted]=useState(open);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(open)setMounted(true);},[open]);
  useLayoutEffect(()=>{
    const element=ref.current;
    if(!element)return;
    const startHeight=element.getBoundingClientRect().height;
    const startOpacity=getComputedStyle(element).opacity;
    let animation:Animation|undefined;
    let frame=0;
    const play=()=>{
      if(open)element.setAttribute('data-open','');else element.removeAttribute('data-open');
      const height=open?(element.firstElementChild as HTMLElement).scrollHeight:0;
      element.style.height=`${height}px`;
      element.style.opacity=open?'1':'0';
      // Keep the requested layout feedback under Windows' reduced-motion setting,
      // with a shorter transition and no decorative translation (CSS).
      const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?180:360;
      animation=element.animate([{height:`${startHeight}px`,opacity:startOpacity},{height:`${height}px`,opacity:open?1:0}],{duration,easing:'cubic-bezier(.25,.46,.45,.94)',fill:'both'});
      animation.onfinish=()=>{element.style.height=open?'auto':'0px';animation?.cancel();element.style.opacity='';};
    };
    // Let newly mounted game images/layout settle before starting the first frame.
    if(open)frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(play);});else play();
    return ()=>{
      cancelAnimationFrame(frame);
      // Preserve the visible height when a click reverses an unfinished animation.
      element.style.height=`${element.getBoundingClientRect().height}px`;
      element.style.opacity=getComputedStyle(element).opacity;
      animation?.cancel();
    };
  },[open,mounted]);
  if(!mounted)return null;
  return <div id={id} ref={ref} className="tof-collapsible" role="presentation" inert={!open||undefined} aria-hidden={!open||undefined}><div className="tof-collapsible-inner" role="presentation">{typeof children==='function'?children():children}</div></div>;
}
