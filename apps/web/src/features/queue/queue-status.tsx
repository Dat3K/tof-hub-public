'use client';
import { type Locale } from '@tof-hub/i18n';
import { fillText, localeText } from '@/lib/i18n/text';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Spinner} from '@tof-hub/ui';
import {fetchBoard,formatWait,type QueueBoard,type QueueJob} from './client';
import { queueKindLabel } from './labels';

/** Background refresh of the shared board behind the pill (the queue page itself polls every 3 s). */
const BOARD_POLL_MS=30000;

/**
 * Top-right queue pill for every tool page: the viewer's own waiting or running job with its place and estimate,
 * otherwise the shared queue load with a typical time. Always links to /tools/queue. One component, same look on
 * every page; a failed board poll degrades to the quiet link, never to a stale number.
 */
export function QueueStatus({job,locale,className}:{job:QueueJob|null;locale:Locale;className?:string}) {
  const ru=locale==='ru',t=localeText(locale);
  const [board,setBoard]=useState<QueueBoard|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    let timer=0,live=true;
    const load=async()=>{
      try {
        const next=await fetchBoard(controller.signal);
        if(live&&!controller.signal.aborted)setBoard(next);
      } catch {/* The pill keeps its last state; without a board it is just the link. */}
      if(live&&!controller.signal.aborted)timer=window.setTimeout(load,BOARD_POLL_MS);
    };
    void load();
    return ()=>{live=false;controller.abort();window.clearTimeout(timer);};
  },[]);
  const active=job&&(job.state==='queued'||job.state==='processing')?job:null;
  // A job sent from another tool page of this browser: the board marks the viewer's own rows.
  const mine=!active?board?.active.find(item=>item.mine&&(item.state==='queued'||item.state==='processing'))??null:null;
  const waiting=board?.active.filter(item=>item.state==='queued').length??0;
  const typical=active?.estimateMs??(mine?board?.averageMs[mine.kind]??null:null);
  const kind=active?.kind??mine?.kind;
  const label=kind?queueKindLabel(kind,locale):null;
  const ahead=active?Math.max(0,active.position-1):mine?Math.max(0,mine.position-1):0;
  const statusText=(position:number,aheadCount:number,mineQueue=false)=>aheadCount>0
    ?fillText(t(mineQueue?'My queue #{0}, {1} ahead of you':'Queue #{0}, {1} ahead of you',mineQueue?'Моя очередь №{0}, перед вами {1}':'Очередь №{0}, перед вами {1}'),[position,aheadCount])
    :fillText(t(mineQueue?'My queue #{0}; you are next':'Queue #{0}; you are next',mineQueue?'Моя очередь №{0}; вы следующие':'Очередь №{0}; вы следующие'),[position]);
  const text=active
    ?active.state==='processing'
      ?t('Processing…','Обрабатывается…')
      :statusText(active.position,ahead)
    :mine?statusText(mine.position,ahead,true)
    :board?waiting?fillText(t('In queue: {0}','В очереди: {0}'),[waiting])
      :t('Queue is empty','Очередь пуста')
    :t('Queue','Очередь');
  const busy=!!active||!!mine;
  return <Link href="/tools/queue/" className={className} data-queue-pill={busy||undefined} aria-live="polite"
    style={{display:'inline-flex',alignItems:'center',gap:8,padding:'5px 12px',borderRadius:999,
      border:'1px solid rgba(125,211,252,.3)',background:'rgba(14,116,144,.14)',color:'#bae6fd',
      fontSize:12,lineHeight:'16px',whiteSpace:'nowrap',textDecoration:'none',fontVariantNumeric:'tabular-nums'}}>
    {busy&&<Spinner size="sm" aria-label={t('Waiting','Ожидание')}/>}
    <span>{text}{label?` · ${label}`:''}{typical!==null&&typical!==undefined?` · ${formatWait(typical,ru)}`:''}</span>
  </Link>;
}
