'use client';

import {useEffect,useRef,type ReactNode} from 'react';
import styles from './encounter-choices.module.css';

/** One selection viewport for the whole encounter roster, including all three rows. */
export function EncounterChoices({label,selectedKey,children,layout='wrap',className=''}:{label:string;selectedKey:string;children:ReactNode;layout?:'wrap'|'columns';className?:string}) {
  const ref=useRef<HTMLElement>(null);
  useEffect(()=>{
    const panel=ref.current,selected=panel?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if(!panel||!selected)return;
    const bounds=panel.getBoundingClientRect(),item=selected.getBoundingClientRect();
    if(item.left<bounds.left||item.right>bounds.right)panel.scrollLeft+=item.left-bounds.left-(panel.clientWidth-item.width)/2;
  },[selectedKey]);
  return <nav ref={ref} className={`${styles.list} ${layout==='columns'?styles.columns:''} ${className}`} aria-label={label}>{children}</nav>;
}
