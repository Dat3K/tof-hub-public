'use client';
import {useEffect,useRef,useState,type ReactElement,type ReactNode} from 'react';
import {FilterChip,FilterGroup,type FilterVariant} from '@tof-hub/ui';
import {getServerById} from '@tof-hub/contracts';
import {BuildTooltip,InspectionHeading} from '../build/build-inspection';
import {nicknameParts} from './nickname-parts';
import {NicknameLabel,RegionCode} from './player-label';

export {NicknameLabel,RegionCode};
import {useI18n} from '@/lib/i18n';
import {translateUiText} from '@tof-hub/i18n';
import {copyText} from '@/lib/clipboard';
import styles from './player-identity.module.css';
import buildStyles from '../build/build.module.css';

export const REGION_VARIANTS:Record<string,FilterVariant>={AP:'volt',NA:'flame',EU:'phys',KR:'yellow',SA:'altered',SEA:'frost',TW:'survive',PS:'defense'};

export function Hint({title,text,body,align,open,children}:{title:string|null|undefined;text?:ReactNode;body?:ReactNode;align?:'center'|'end';open?:boolean;children:ReactElement}) {
  if(!title)return children;
  return <BuildTooltip portal align={align} open={open} delayMs={250} className={buildStyles.itemTooltip}
    content={text||body?<><InspectionHeading title={title}/>{text&&<p className={styles.hintText}>{text}</p>}{body}</>:<strong className={styles.hintTitle}>{title}</strong>}>{children}</BuildTooltip>;
}

export interface NicknameCopy {blankName:string;blankNameHint:string;nicknameCopied:string}

/** Preserves the original string for selection/copy while annotating invisible parts like the game. */
export function Nickname({nickname,uid,copy,details}:{nickname:string|null;uid?:string|null;copy:NicknameCopy;details?:ReactNode}) {
  const [copied,setCopied]=useState(false);
  const copiedTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(copiedTimer.current)clearTimeout(copiedTimer.current);},[]);
  const confirmCopy=()=>{
    setCopied(true);
    if(copiedTimer.current)clearTimeout(copiedTimer.current);
    copiedTimer.current=setTimeout(()=>setCopied(false),2000);
  };
  const parts=nicknameParts(nickname??'');
  const codes=parts.filter(part=>part.blank).flatMap(part=>[...part.text].map(char=>'U+'+char.codePointAt(0)!.toString(16).toUpperCase().padStart(4,'0')));
  return <Hint title={copied?copy.nicknameCopied:uid?`UID: ${uid}`:null} open={copied?true:undefined} body={!copied&&details?<div className={styles.hintRows}>{details}</div>:undefined} text={!copied&&codes.length?`${copy.blankNameHint} ${codes.join(' ')}`:undefined}>
    <b onDoubleClick={event=>{
      if(nickname===null)return;
      event.preventDefault();
      const range=document.createRange(),selection=window.getSelection();
      range.selectNodeContents(event.currentTarget);
      selection?.removeAllRanges();selection?.addRange(range);
      void copyText(nickname).then(ok=>{if(ok)confirmCopy();});
    }} onCopy={event=>{
      if(nickname===null)return;
      event.preventDefault();event.clipboardData.setData('text/plain',nickname);
    }}><NicknameLabel nickname={nickname} blankName={copy.blankName}/></b></Hint>;
}

export function RegionCell({player}:{player:{serverId:string|null;region:string|null}}) {
  const server=player.serverId?getServerById(player.serverId):null;
  return <span role="cell" className={styles.regionCell}><RegionCode region={player.region??server?.regionCode}/><Hint title={server?.name??player.serverId} text={player.serverId?`ID: ${player.serverId}`:undefined}><small>{server?.name??player.serverId??''}</small></Hint></span>;
}

/** Extra domain filters (such as the synthetic Pioneer board) are composed by the caller. */
export function RegionFilters({regions,value,onChange,label,allLabel,children}:{
  regions:readonly {code:string;name:string}[];value:string|null;onChange:(region:string|null)=>void;label:string;allLabel:string;children?:ReactNode;
}) {
  const {locale}=useI18n();
  return <FilterGroup label={label}><FilterChip value="all" variant="all" active={!value} onClick={()=>onChange(null)}>{allLabel}</FilterChip>
    {regions.map(region=><FilterChip key={region.code} value={region.code} variant={REGION_VARIANTS[region.code]} title={translateUiText(region.name,locale)} active={value===region.code} onClick={()=>onChange(region.code)}>{region.code}</FilterChip>)}{children}</FilterGroup>;
}
