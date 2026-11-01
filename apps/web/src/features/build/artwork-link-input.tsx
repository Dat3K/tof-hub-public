'use client';
import { localized } from '@tof-hub/i18n';
import {fillText,localeText} from '@/lib/i18n/text';
import {useEffect,useRef,useState,type ClipboardEvent} from 'react';
import {Field} from './build-fields';
import {artworkIdFromLink} from './model';
import type {BuildCatalog,BuildLocale,CatalogItem} from './types';
import styles from './build.module.css';
export function ArtworkLinkInput({catalog,locale,onSelect,onAutoClose,items,label}:{catalog:Pick<BuildCatalog,'artworks'>;locale:BuildLocale;onSelect:(id:string,options?:{keepOpen?:boolean})=>void;onAutoClose?:()=>void;items?:CatalogItem[];label?:string}) {
  const [link,setLink]=useState('');
  const [pasteNotice,setPasteNotice]=useState('');
  const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const source=items??catalog.artworks;
  const findId=(value:string)=>{
    const exact=artworkIdFromLink(value,catalog);
    if(exact&&source.some(item=>item.id===exact))return exact;
    let normalized=value.trim().toLowerCase();
    try {normalized=decodeURIComponent(normalized);} catch {/* Keep malformed external text searchable as-is. */}
    normalized=normalized.replace(/\\/g,'/');
    return source.find(item=>{
      const id=item.id.toLowerCase();
      const icon=item.icon.toLowerCase();
      return normalized===id||normalized.endsWith(`#${id}`)||normalized.endsWith(`/${id}`)||normalized.includes(icon)||
        normalized.includes(item.name.en.toLowerCase())||normalized.includes(item.name.ru.toLowerCase());
    })?.id??'';
  };
  const id=findId(link);
  const art=source.find(item=>item.id===id);
  const t=localeText(locale);
  useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current);},[]);
  const paste=(event:ClipboardEvent<HTMLInputElement>)=>{
    if(closeTimer.current){clearTimeout(closeTimer.current);closeTimer.current=null;}
    const pasted=event.clipboardData.getData('text');
    const matchedId=findId(pasted);
    if(!matchedId)return;
    event.preventDefault();
    const matchedArt=source.find(item=>item.id===matchedId);
    setLink(pasted);
    const matchedName=localized(matchedArt?.name,locale)??matchedId;
    setPasteNotice(items
      ? fillText(t('{0} set: {1}', '{0} выбран: {1}'), [label || t('Item'), matchedName])
      : fillText(t('Background set: {0}', 'Фон установлен: {0}'), [matchedName]));
    onSelect(matchedId,{keepOpen:true});
    closeTimer.current=setTimeout(()=>{setPasteNotice('');onAutoClose?.();},1000);
  };
  return <div className={styles.artworkLink}>
    <Field label={items?label??t('Paste item link'):t('Link from Arts')}><input value={link} maxLength={2000} placeholder={items?t('Paste an avatar or frame link'):t('Paste a link from Arts: /info/arts/#…')} onChange={event=>{if(closeTimer.current){clearTimeout(closeTimer.current);closeTimer.current=null;}setLink(event.target.value);setPasteNotice('');}} onPaste={paste} onKeyDown={event=>{if(event.key==='Enter'&&id){event.preventDefault();onSelect(id);}}}/></Field>
    {pasteNotice?<p className={styles.note} role="status">{pasteNotice}</p>:link.trim()&&<p className={styles.note}>{localized(art?.name, locale)??(items?t('No matching item found.'):t('Artwork not found. Paste a link from /info/arts/.'))}</p>}
  </div>;
}
