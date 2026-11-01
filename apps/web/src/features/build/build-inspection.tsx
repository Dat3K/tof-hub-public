'use client';
import { localeText } from '@/lib/i18n/text';

import {useSiteHeaderInset} from '../../components/site-shell/use-site-header-inset';
import {createContext,useContext,useState,useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {GameRichText,Modal,Tooltip,type TooltipProps} from '@tof-hub/ui';
import type {BuildLocale} from './types';
import styles from './build.module.css';
import {useBuildEditing,useBuildEditable} from './build-editing';

type Detail={title:string;heading?:ReactNode;meta?:ReactNode;description?:string;children?:ReactNode;size?:'sm'};
const InspectionContext=createContext<{show:(detail:Detail)=>void;open:boolean;viewportTopInset:number}>({show:()=>{},open:false,viewportTopInset:0});

/** Preview tooltips share the responsive header boundary. */
export function BuildTooltip(props:TooltipProps) {
  const {viewportTopInset}=useContext(InspectionContext);
  return <Tooltip {...props} viewportTopInset={viewportTopInset}/>;
}

/** Shared title and current progression for every build detail surface. */
export function InspectionHeading({title,meta,leading,trailing}:{title:string;meta?:ReactNode;leading?:ReactNode;trailing?:ReactNode}) {
  return <div className={styles.inspectionHeading} data-inspection-heading><strong>{leading}<span data-hint-overflow>{title}</span></strong>{meta&&<div className={styles.inspectionMeta}>{meta}</div>}{trailing&&<div className={styles.inspectionTrailing}>{trailing}</div>}</div>;
}

export function InspectionStars({value}:{value:number}) {
  return <span className={styles.inspectionStars}>★{value}</span>;
}

/** One detail view for pointer, keyboard and touch interactions on the preview. */
export function BuildInspection({children,locale}:{children:ReactNode;locale:BuildLocale}) {
  const editing=useBuildEditing();
  const [detail,setDetail]=useState<Detail|null>(null);
  const [menu,setMenu]=useState<{x:number;y:number;links:{href:string;label:string}[]}|null>(null);
  const viewportTopInset=useSiteHeaderInset(true);
  const menuRef=useRef<HTMLDivElement>(null);
  const sourceRef=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    const context=(event:MouseEvent)=>{
      const target=event.target instanceof Element?event.target.closest('[data-info-href]'):null;
      if(!target){setMenu(null);return;}
      event.preventDefault();
      sourceRef.current=target instanceof HTMLElement?target.querySelector<HTMLElement>('button')??target:null;
      const links=[{href:target.getAttribute('data-info-href')!,label:target.getAttribute('data-info-label')||''}];
      const frame=target.getAttribute('data-info-frame-href');
      if(frame)links.push({href:frame,label:localeText(locale)('Frame')});
      setMenu({x:Math.min(event.clientX,window.innerWidth-240),y:Math.min(event.clientY,window.innerHeight-100),links});
    };
    const close=(event:Event)=>{if(!(event.target instanceof Node)||!menuRef.current?.contains(event.target))setMenu(null);};
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){setMenu(null);sourceRef.current?.focus({preventScroll:true});}
      if((event.key==='F10'&&event.shiftKey)||event.key==='ContextMenu'){
        const target=event.target instanceof Element?event.target.closest('[data-info-href]'):null;
        if(target){event.preventDefault();const bounds=target.getBoundingClientRect();target.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:bounds.left,clientY:bounds.bottom}));}
      }
    };
    document.addEventListener('contextmenu',context);
    document.addEventListener('pointerdown',close);
    document.addEventListener('keydown',key);
    window.addEventListener('resize',close);
    window.addEventListener('wheel',close,{passive:true});
    window.addEventListener('touchmove',close,{passive:true});
    return()=>{document.removeEventListener('contextmenu',context);document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);window.removeEventListener('resize',close);window.removeEventListener('wheel',close);window.removeEventListener('touchmove',close);};
  },[locale]);
  useEffect(()=>{menuRef.current?.querySelector('a')?.focus({preventScroll:true});},[menu]);
  return <InspectionContext.Provider value={{show:setDetail,open:!!detail||!!menu||editing.open,viewportTopInset}}>{children}
    {menu&&createPortal(<div ref={menuRef} className={styles.infoContextMenu} role="menu" onKeyDown={event=>{
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      event.preventDefault();
      const items=Array.from(event.currentTarget.querySelectorAll('a'));
      const index=items.indexOf(document.activeElement as HTMLAnchorElement);
      const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
      items[next]?.focus();
    }} aria-label={localeText(locale)('Open in Info', 'Открыть в Info')} style={{left:Math.max(0,menu.x),top:Math.max(0,menu.y)}}>{menu.links.map(link=><a key={link.href} role="menuitem" href={link.href} target="_blank" rel="noopener noreferrer" onClick={()=>setMenu(null)}>{localeText(locale)('Open in Info', 'Открыть в Info')}{link.label&&` · ${link.label}`}</a>)}</div>,document.body)}
    <Modal appearance="tool" size={detail?.size} className={styles.inspectionDialog} viewportTopInset={viewportTopInset} isOpen={!!detail} onClose={()=>setDetail(null)} ariaLabel={detail?.title}>
      <Modal.Header><Modal.Title><div className={styles.inspectionDialogTitle}>{detail&&(detail.heading??<InspectionHeading title={detail.title} meta={detail.meta}/>)}</div></Modal.Title></Modal.Header>
      <Modal.Body><div className={styles.itemDetails}>{detail?.description&&!detail.children&&<GameRichText text={detail.description}/>} {detail?.children}</div></Modal.Body>
    </Modal>
  </InspectionContext.Provider>;
}

export function Inspect({title,heading,meta,description,tooltipDetails,details,children,infoHref,editTarget,tooltipSize,dialogSize,hoverPreview=true,placement}:{/** False: no hover/focus preview, the dialog opens on click only (help triggers). */hoverPreview?:boolean;tooltipSize?:'wide';/** Compact list dialogs; default width otherwise. */dialogSize?:'sm';/** Preview side; the shared default is top. */placement?:TooltipProps['placement'];editTarget?:string;title:string;heading?:ReactNode;meta?:ReactNode;description?:string;tooltipDetails?:ReactNode;details?:ReactNode;children:ReactNode;infoHref?:string}) {
  const edit=useBuildEditable<string>();
  const {show,open}=useContext(InspectionContext);
  const [dismissed,setDismissed]=useState(false);
  const [visible,setVisible]=useState(false);
  return <BuildTooltip portal placement={placement} disabled={!hoverPreview} open={hoverPreview&&!open&&!dismissed&&visible} onOpenChange={setVisible} className={`${styles.itemTooltip} ${tooltipSize==='wide'?styles.itemTooltipWide:''}`} content={<>{heading??<InspectionHeading title={title} meta={meta}/>}{tooltipDetails??(description&&<GameRichText text={description}/>)}</>}>
    <button type="button" {...(editTarget?edit(editTarget):{})} className="inspect-trigger" aria-label={title} aria-haspopup="dialog" data-info-href={infoHref}
      onMouseEnter={()=>{setDismissed(false);setVisible(true);}}
      onMouseLeave={()=>setVisible(false)}
      onBlur={()=>setVisible(false)}
      onFocus={e=>{if(!open&&e.currentTarget.matches(':focus-visible')){if(e.relatedTarget instanceof Element&&!e.relatedTarget.closest('[role="dialog"]'))setDismissed(false);setVisible(true);}}}
      onClick={event=>{const selection=window.getSelection();if(selection&&!selection.isCollapsed&&event.currentTarget.contains(selection.anchorNode))return;event.currentTarget.focus({preventScroll:true});setDismissed(true);setVisible(false);show({title,heading,meta,description,children:details,size:dialogSize});}}>{children}</button>
  </BuildTooltip>;
}
