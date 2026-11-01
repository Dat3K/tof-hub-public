'use client';
import { localeText } from '@/lib/i18n/text';
import { localized, translateUiText } from '@tof-hub/i18n';
import {cloneElement,useEffect,useId,useRef,useState,type ReactElement,type ReactNode} from 'react';
import {useDismiss,useSortListbox} from '@tof-hub/ui';
import type {BuildLocale,CatalogItem} from './types';
import styles from './build.module.css';

export function Field({label,children}:{label:string;children:ReactNode}) {
  const id=useId();
  return <label className={styles.field} htmlFor={id}><span id={`${id}-label`}>{label}</span>{cloneElement(children as ReactElement<{id:string;'aria-labelledby':string}>,{id,'aria-labelledby':`${id}-label`})}</label>;
}
export function NumberField({label,value,onChange,max=1e9,min=0,percentage=false,nullable=false}:{label:string;value:number|null;onChange:(n:number|null)=>void;max?:number;min?:number;percentage?:boolean;nullable?:boolean}) {
  return <Field label={label}><input type="number" min={min} max={max} step={percentage?'0.01':'1'} value={value===null?'':percentage?Number((value*100).toFixed(4)):value} onChange={e=>{
    if(nullable&&e.target.value===''){onChange(null);return;}
    const n=e.target.valueAsNumber;if(Number.isFinite(n))onChange(Math.min(max,Math.max(min,percentage?n:Math.trunc(n)))/(percentage?100:1));
  }}/></Field>;
}
/** A card value edited in place in every mode: plain text until focused, then a number input. */
export function InlineNumber({label,value,min=0,max,onChange,className,step=1,hint}:{label:string;value:number;min?:number;max:number;onChange:(n:number)=>void;className?:string;step?:number;/** Hover/focus hint; defaults to `label`, `null` when a surrounding tooltip explains it. */hint?:string|null}) {
  const [draft,setDraft]=useState<string|null>(null);
  const commit=()=>{const n=Number(draft);if(draft!==null&&draft!==''&&Number.isFinite(n))onChange(Math.min(max,Math.max(min,step===1?Math.trunc(n):n)));setDraft(null);};
  return <input className={`${styles.inlineNumber} ${className??''}`} data-build-edit-skip aria-label={label} data-hint={hint===null?undefined:hint??label} type="number" inputMode={step===1?'numeric':'decimal'} min={min} max={max} step={step}
    value={draft??String(value)} style={{width:`${Math.max(2,(draft??String(value)).length)+.6}ch`}}
    onFocus={event=>{setDraft(String(value));event.currentTarget.select();}} onChange={event=>setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();if(event.key==='Escape'){setDraft(null);event.currentTarget.blur();}}}/>;
}
/** This control represents UTC explicitly, independent of the browser timezone. */
export function DateTimeField({label,value,onChange,locale='en'}:{label:string;value:string|null;onChange:(value:string|null)=>void;locale?:BuildLocale}) {
  const current=value?new Date(value):null;
  const date=current&&!Number.isNaN(current.getTime())?current.toISOString().slice(0,10):'';
  const time=current&&!Number.isNaN(current.getTime())?current.toISOString().slice(11,16):'';
  return <fieldset className={`${styles.dateTimeField} ${styles.field}`}><legend>{label}</legend><label><span>{localeText(locale)('Date')}</span><input aria-label={`${label} · UTC date`} type="date" value={date} onChange={event=>{
    const next=event.target.value;if(!next){onChange(null);return;}
    const nextTime=time||'00:00';const parsed=new Date(`${next}T${nextTime}:00Z`);if(Number.isFinite(parsed.getTime()))onChange(parsed.toISOString());
  }}/></label><label><span>UTC</span><input aria-label={`${label} · UTC time`} type="time" value={time} onChange={event=>{
    if(!date){return;}
    const nextTime=event.target.value||'00:00';const parsed=new Date(`${date}T${nextTime}:00Z`);if(Number.isFinite(parsed.getTime()))onChange(parsed.toISOString());
  }}/></label></fieldset>;
}
export function Pick({label,value,items,locale,onChange}:{label:string;value:string;items:CatalogItem[];locale:BuildLocale;onChange:(id:string)=>void}) {
  return <IconPick label={label} value={value} items={items} locale={locale} onChange={onChange} searchable/>;
}

/** Gear stat choices reuse the shared listbox keyboard/typeahead state machine. */
/** `inline` hides the visible label and renders `display` as the trigger, for in-card text controls. */
export function IconPick({label,value,items,locale,onChange,searchable=false,emptyLabel={en:'Not selected',ru:'Не выбрано'},inline=false,display,tone,hint=true,'aria-describedby':ariaDescribedBy}:{label:string;value:string;items:CatalogItem[];locale:BuildLocale;onChange:(id:string)=>void;searchable?:boolean;emptyLabel?:{en:string;ru:string};inline?:boolean;display?:ReactNode;/** `rare`: Titan rare stats use the red of the Build card's rare line; `stat`: white stat icons like the card. */tone?:'rare'|'stat';hint?:boolean;'aria-describedby'?:string}) {
  const id=useId(),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),optionsRef=useRef<(HTMLButtonElement|null)[]>([]);
  const search=useRef<HTMLInputElement>(null),[query,setQuery]=useState('');
  const allChoices=[{id:'',name:emptyLabel,icon:''},...items];
  const choices=query.trim()?allChoices.filter(item=>localized(item.name, locale).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())):allChoices;
  const options=choices.map(item=>({value:item.id,label:localized(item.name, locale)}));
  const state=useSortListbox({value,onChange,options});
  useEffect(()=>{
    if(!state.isOpen)return;
    if(searchable&&document.activeElement===search.current)return;
    const option=optionsRef.current[state.focusedIndex];option?.focus({preventScroll:true});option?.scrollIntoView({block:'nearest'});
  },[state.isOpen,state.focusedIndex,searchable]);
  useEffect(()=>{if(state.isOpen&&searchable)search.current?.focus({preventScroll:true});if(!state.isOpen)setQuery('');},[state.isOpen,searchable]);
  useDismiss({refs:[root],onDismiss:()=>state.setOpen(false),enabled:state.isOpen,escape:false});
  const selected=allChoices.find(item=>item.id===value);
  return <div ref={root} className={`${inline?`${styles.iconPick} ${styles.iconPickInline}`:`${styles.field} ${styles.iconPick}`} ${tone==='rare'?styles.iconPickRare:tone==='stat'?styles.iconPickStat:''}`} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))state.setOpen(false);}}>
    <span id={`${id}-label`} className={inline?'sr-only':undefined}>{label}</span>
    <button type="button" ref={trigger} data-value={value} data-hint={hint?localized(selected?.name, locale):undefined} aria-describedby={ariaDescribedBy} aria-labelledby={`${id}-label`} aria-haspopup="listbox" aria-expanded={state.isOpen} aria-controls={`${id}-options`} onClick={()=>state.setOpen(!state.isOpen,'selected')} onKeyDown={event=>{state.handleTriggerKeyDown(event);if(event.key==='Escape'&&state.isOpen)event.stopPropagation();}}>
      {display??<>{selected?.icon&&<img src={selected.icon} alt=""/>}<span>{localized(selected?.name, locale)??localized(emptyLabel, locale)}</span><span aria-hidden="true">⌄</span></>}
    </button>
    {state.isOpen&&<div className={styles.iconPickPopover}>
      {searchable&&<input ref={search} type="search" aria-label={translateUiText('Search: {0}',locale).replace('{0}',label)} placeholder={localeText(locale)('Search…')} value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();state.setOpen(true,event.key==='ArrowDown'?'first':'last');optionsRef.current[event.key==='ArrowDown'?0:choices.length-1]?.focus();}
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();state.setOpen(false);trigger.current?.focus();}
      }}/>}
      <div id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`} className={styles.iconPickOptions} onKeyDown={event=>{
      state.handleMenuKeyDown(event);
      if(['Escape','Enter',' '].includes(event.key)){event.stopPropagation();trigger.current?.focus();}
    }}>{choices.map((item,i)=><button key={item.id} data-value={item.id} type="button" ref={node=>{optionsRef.current[i]=node;}} role="option" aria-selected={item.id===value} tabIndex={i===state.focusedIndex?0:-1} onClick={()=>{state.commitOption(options[i]);trigger.current?.focus();}}>{item.icon&&<img src={item.icon} alt="" loading="lazy"/>}<span>{localized(item.name, locale)}</span>{item.id===value&&<span aria-hidden="true">✓</span>}</button>)}</div>
      {!choices.length&&<p role="status" className={styles.note}>{localeText(locale)('No matches')}</p>}
    </div>}
  </div>;
}
