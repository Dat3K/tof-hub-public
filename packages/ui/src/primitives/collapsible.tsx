'use client';
import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';

/** Lazily mount once; retain closed content so both directions can animate. */
export function Collapsible({open,children,id}:{open:boolean;children:ReactNode|(()=>ReactNode);id?:string}) {
  const [mounted,setMounted]=useState(open);
  // In the same commit as the click: an extra effect pass delays the first frame of the opening.
  if(open&&!mounted)setMounted(true);
  const ref=useRef<HTMLDivElement>(null);
  const running=useRef<Animation|null>(null);
  const played=useRef(false);
  useLayoutEffect(()=>{
    const element=ref.current;
    if(!element)return;
    let frame=0;
    const play=()=>{
      played.current=true;
      // Layout is read once per toggle; on a long board each forced reflow is a visible pause before the movement.
      const previous=running.current;
      const startHeight=previous||!open?element.getBoundingClientRect().height:0;
      const startOpacity=previous?getComputedStyle(element).opacity:open?'0':'1';
      previous?.cancel();
      if(open)element.setAttribute('data-open','');else element.removeAttribute('data-open');
      const height=open?(element.firstElementChild as HTMLElement).scrollHeight:0;
      element.style.height=`${height}px`;
      element.style.opacity=open?'1':'0';
      // Keep the requested layout feedback under Windows' reduced-motion setting,
      // with a shorter transition and no decorative translation (CSS).
      const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?180:360;
      const animation=element.animate([{height:`${startHeight}px`,opacity:startOpacity},{height:`${height}px`,opacity:open?1:0}],{duration,easing:'cubic-bezier(.25,.46,.45,.94)',fill:'both'});
      running.current=animation;
      animation.onfinish=()=>{
        if(running.current!==animation)return;
        running.current=null;
        element.style.height=open?'auto':'0px';
        animation.cancel();
        element.style.opacity='';
      };
    };
    // Let newly mounted game images/layout settle before starting the very first frame.
    if(open&&!played.current)frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(play);});else play();
    return ()=>cancelAnimationFrame(frame);
  },[open]);
  if(!mounted)return null;
  return <div id={id} ref={ref} className="tof-collapsible" role="presentation" inert={!open||undefined} aria-hidden={!open||undefined}><div className="tof-collapsible-inner" role="presentation">{typeof children==='function'?children():children}</div></div>;
}
