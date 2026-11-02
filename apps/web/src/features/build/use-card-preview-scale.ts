'use client';

import {useLayoutEffect,useState,type RefObject} from 'react';
import {BUILD_CARD_HEIGHT,BUILD_CARD_WIDTH} from './layout';

/** Fit the live card into the space above its toolbar; export geometry stays unchanged. */
export function useCardPreviewScale({stage,toolbar,ready,height=BUILD_CARD_HEIGHT,fullSize=false,fullscreen=false}:{
  stage:RefObject<HTMLDivElement|null>;
  toolbar:RefObject<HTMLDivElement|null>;
  ready:boolean;
  height?:number;
  fullSize?:boolean;
  fullscreen?:boolean;
}) {
  const [scale,setScale]=useState(1);
  useLayoutEffect(()=>{
    const node=stage.current;if(!ready||!node)return;
    const resize=()=>{
      if(fullscreen){setScale(Math.min(node.clientWidth/BUILD_CARD_WIDTH,node.clientHeight/height));return;}
      const toolbarHeight=toolbar.current?.offsetHeight??48;
      node.closest<HTMLElement>('[data-static]')?.style.setProperty('--build-toolbar-height',`${toolbarHeight}px`);
      const top=node.getBoundingClientRect().top+window.scrollY;
      const unit=parseFloat(getComputedStyle(document.documentElement).fontSize)/16;
      const availableHeight=Math.max(1,window.innerHeight-top-toolbarHeight-24*unit);
      const mobile=window.matchMedia('(max-width:1023px), (max-width:1366px) and (pointer:coarse)').matches;
      setScale(fullSize?1:Math.min(node.clientWidth/BUILD_CARD_WIDTH,mobile?Infinity:availableHeight/height));
    };
    const observer=new ResizeObserver(resize);
    observer.observe(node);
    if(toolbar.current)observer.observe(toolbar.current);
    resize();
    window.addEventListener('resize',resize);
    return()=>{observer.disconnect();window.removeEventListener('resize',resize);};
  },[stage,toolbar,ready,height,fullSize,fullscreen]);
  return scale;
}
