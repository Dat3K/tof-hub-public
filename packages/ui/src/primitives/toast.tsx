'use client';

import {createContext,useCallback,useContext,useEffect,useId,useMemo,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

export interface ToastOptions {id?:string;tone?:'info'|'error';duration?:number|null}
interface ToastEntry {id:string;message:ReactNode;tone:'info'|'error';duration:number|null;revision:number;paused:boolean}
interface ToastApi {notify:(message:ReactNode,options?:ToastOptions)=>string;dismiss:(id:string)=>void}
interface ToastState extends ToastApi {entries:ToastEntry[];pause:(id:string,value:boolean)=>void;closeLabel:string}
const ToastContext=createContext<ToastState|null>(null);

function ToastItem({entry,dismiss,pause,closeLabel,mirror=false}:{entry:ToastEntry;dismiss:(id:string)=>void;pause:ToastState['pause'];closeLabel:string;mirror?:boolean}) {
  const setPaused=(value:boolean)=>pause(entry.id,value);
  useEffect(()=>{
    if(mirror||entry.paused||entry.duration===null)return;
    const timer=setTimeout(()=>dismiss(entry.id),entry.duration);
    return ()=>clearTimeout(timer);
  },[entry.id,entry.duration,entry.revision,entry.paused,dismiss,mirror]);
  return <div className="tof-toast" data-tone={entry.tone} data-toast-id={entry.id}
    onMouseEnter={()=>setPaused(true)} onMouseLeave={event=>setPaused(event.currentTarget.contains(document.activeElement))}
    onFocus={()=>setPaused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false);}}
    onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();dismiss(entry.id);}}}>
    <div className="tof-toast-message" role={mirror?undefined:entry.tone==='error'?'alert':'status'} aria-live={mirror?'off':entry.tone==='error'?'assertive':'polite'}>{entry.message}</div>
    <button type="button" className="tof-toast-close" aria-label={closeLabel} title={closeLabel} onClick={()=>dismiss(entry.id)}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>
    </button>
  </div>;
}

/** One fixed viewport for all transient notices; it never takes space in the page or moves focus. */
export function ToastProvider({children,closeLabel='Dismiss notification',label='Notifications'}:{children:ReactNode;closeLabel?:string;label?:string}) {
  const [entries,setEntries]=useState<ToastEntry[]>([]);
  const [mounted,setMounted]=useState(false);
  const sequence=useRef(0);
  useEffect(()=>setMounted(true),[]);
  const dismiss=useCallback((id:string)=>setEntries(current=>current.some(entry=>entry.id===id)?current.filter(entry=>entry.id!==id):current),[]);
  const pause=useCallback((id:string,value:boolean)=>setEntries(current=>current.some(entry=>entry.id===id&&entry.paused!==value)?current.map(entry=>entry.id===id?{...entry,paused:value}:entry):current),[]);
  const notify=useCallback((message:ReactNode,options:ToastOptions={})=>{
    const revision=++sequence.current,id=options.id??`toast-${revision}`;
    const entry:ToastEntry={id,message,tone:options.tone??'info',duration:options.duration===undefined?6000:options.duration,revision,paused:false};
    setEntries(current=>[...current.filter(item=>item.id!==id),entry].slice(-4));
    return id;
  },[]);
  const api=useMemo(()=>({notify,dismiss,entries,pause,closeLabel}),[notify,dismiss,entries,pause,closeLabel]);
  return <ToastContext.Provider value={api}>{children}{mounted&&createPortal(
    <aside className="tof-toast-viewport" aria-label={label}>{entries.map(entry=><ToastItem key={entry.id} entry={entry} dismiss={dismiss} pause={pause} closeLabel={closeLabel}/>)}</aside>,document.body)}
  </ToastContext.Provider>;
}

export function useToast():ToastApi {
  const api=useContext(ToastContext);
  if(!api)throw new Error('useToast requires ToastProvider');
  return api;
}

/** A silent visual copy of an existing notice; dismissal and lifetime remain shared. */
export function ToastMirror({id,className}:{id:string;className?:string}) {
  const api=useContext(ToastContext);
  if(!api)throw new Error('ToastMirror requires ToastProvider');
  const entry=api.entries.find(item=>item.id===id);
  return entry?<div className={className} data-toast-mirror={id}><ToastItem entry={entry} dismiss={api.dismiss} pause={api.pause} closeLabel={api.closeLabel} mirror/></div>:null;
}

/** Declarative adapter for capture provenance and queue progress. An event key prevents unrelated edits reopening it. */
export function Toast({children,eventKey='',tone='info',duration=6000}:{children:ReactNode;eventKey?:string;tone?:ToastOptions['tone'];duration?:number|null}) {
  const {notify,dismiss}=useToast(),id=useId();
  const content=useRef(children);content.current=children;
  const visible=children!==null&&children!==undefined&&children!=='';
  useEffect(()=>{
    if(visible)notify(content.current,{id,tone,duration});
    return ()=>dismiss(id);
  },[notify,dismiss,id,visible,eventKey,tone,duration]);
  return null;
}
