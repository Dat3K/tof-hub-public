'use client';
import {localeText} from '@/lib/i18n/text';
import {fillText} from '@/lib/i18n/text';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Button,Collapsible,LoadingState} from '@tof-hub/ui';
import {useLocale} from '@/lib/i18n';
import {resolvePlayerServer} from '@tof-hub/contracts';
import {fetchBoard,fetchJob,formatWait,rememberedJobs,type QueueBoard,type QueueJob,type QueueKind,type QueueState} from './client';
import { queueKindLabel, queueStateLabel } from './labels';
import {formatDate} from '@/lib/i18n/format';
import type {Locale} from '@tof-hub/i18n';

const BOARD_POLL_MS=3000;
const STATE_TONE:Record<QueueState,string>={queued:'text-amber-200',processing:'text-sky-200',complete:'text-emerald-300',failed:'text-rose-300'};

function RegionBadge({region}:{region:string}) {
  return (
    <span className="inline-flex items-center rounded border border-sky-400/30 bg-sky-400/15 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-sky-200">
      {region}
    </span>
  );
}

function getJobSubject(job:QueueJob) {
  if(!job.result||typeof job.result!=='object')return {name:null,uid:null,region:null,server:null};
  const res=job.result as Record<string,unknown>;
  const data=res.data as Record<string,unknown>|undefined;
  const cardProfile=data?.profile as Record<string,unknown>|undefined;
  const cardSubject=(data?.capture as Record<string,unknown>|undefined)?.subject as Record<string,unknown>|undefined;

  const rawName=(res.nickname??res.name??cardProfile?.name) as string|null|undefined;
  const name=typeof rawName==='string'&&rawName.trim()?rawName.trim():null;

  const rawUid=(res.uid??cardSubject?.uid) as string|number|null|undefined;
  const uid=rawUid?String(rawUid).trim():null;

  let region=typeof res.region==='string'&&res.region.trim()?res.region.trim():null;
  let server=typeof res.server==='string'&&res.server.trim()?res.server.trim():null;
  if(uid&&(!region||!server)) {
    const resolved=resolvePlayerServer({uid});
    region=region??resolved.regionCode;
    server=server??resolved.server?.name??null;
  }
  if((!region||!server)&&job.kind==='players-import'&&Array.isArray(res.players)&&res.players.length>0) {
    const firstUid=(res.players[0] as {uid?:string|null})?.uid;
    if(firstUid) {
      const resolved=resolvePlayerServer({uid:firstUid});
      region=region??resolved.regionCode;
      server=server??resolved.server?.name??null;
    }
  }

  return {name,uid,region,server};
}

function formatSubject(name:string|null,uid:string|null) {
  if(name&&uid) {
    if(name===`UID ${uid}`||name===uid)return `UID ${uid}`;
    return `${name} (UID ${uid})`;
  }
  if(name)return name;
  if(uid)return `UID ${uid}`;
  return null;
}

interface InspectPlayerEntry {
  uid:string|null;
  name:string|null;
  gear?:number;
  status?:'new'|'repeated'|'rejected';
}

function PlayersResultLine({result,region,server,locale}:{result:Record<string,unknown>;region:string|null;server:string|null;locale:Locale}) {
  const ru=locale==='ru',t=localeText(locale);
  const [open,setOpen]=useState(false);
  const n=(key:string)=>typeof result[key]==='number'?result[key] as number:0;
  const rawPlayers=Array.isArray(result.players)?result.players as InspectPlayerEntry[]:[];
  const hasCounts=['stored','duplicates','rejected'].every(key=>typeof result[key]==='number');
  const statusesComplete=rawPlayers.length>0&&rawPlayers.every(player=>player.status==='new'||player.status==='repeated'||player.status==='rejected');
  const playerDetailsComplete=rawPlayers.length>0&&rawPlayers.every(player=>(typeof player.name==='string'||player.name===null)&&
    (typeof player.uid==='string'||player.uid===null)&&typeof player.gear==='number'&&
    (player.status==='new'||player.status==='repeated'||player.status==='rejected'));
  if(!hasCounts&&!statusesComplete)return null;
  const counts=hasCounts?{stored:n('stored'),duplicates:n('duplicates'),rejected:n('rejected')}:{
    stored:rawPlayers.filter(player=>player.status==='new').length,
    duplicates:rawPlayers.filter(player=>player.status==='repeated').length,
    rejected:rawPlayers.filter(player=>player.status==='rejected').length,
  };
  const total=typeof result.total==='number'?result.total:typeof result.files==='number'?result.files:
    rawPlayers.length||counts.stored+counts.duplicates+counts.rejected;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {region&&<RegionBadge region={region}/>}
        {server&&<span className="text-slate-400">{t('Server')}: {server}</span>}
        <span>
          {fillText(localeText(locale)('Players: {0} total, {1} new, {2} updated, {3} rejected.', 'Игроки: всего {0}, новых {1}, обновлено {2}, отклонено {3}.'), [total, counts.stored, counts.duplicates, counts.rejected])}{' '}
        </span>
        {playerDetailsComplete&&(
          <Button
            variant="outline"
            size="sm"
            onClick={()=>setOpen(!open)}
            aria-expanded={open}
            className="ml-2 border-sky-400/30 bg-sky-400/10 text-sky-100 hover:border-sky-300/50 hover:bg-sky-400/15"
            rightIcon={<span aria-hidden="true" className="text-sky-300">{open?'−':'+'}</span>}
          >
            {open
              ?t('Hide player list','Скрыть список')
              :(fillText(localeText(locale)('Show player list ({0})', 'Показать список игроков ({0})'), [rawPlayers.length]))}
          </Button>
        )}
      </div>

      {playerDetailsComplete&&(
        <Collapsible open={open}>
          <div className="mt-2 max-h-64 overflow-y-auto">
            <div className="flex flex-wrap content-start gap-1.5 py-1 text-xs">
              {rawPlayers.map((player,idx)=>{
                const pName=player.name||'—';
                const pUid=player.uid?`UID ${player.uid}`:'';
                return (
                  <div
                    key={idx}
                    className="inline-flex w-fit max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-white/10 bg-white/[0.025] px-2 py-1.5 transition-colors hover:border-sky-400/25 hover:bg-sky-400/[0.04]"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Link
                        href={`/tools/ranking/?q=${encodeURIComponent(player.uid||player.name||'')}`}
                        className="font-medium text-white hover:text-amber-200 underline-offset-2 hover:underline transition-colors"
                      >
                        {pName}
                      </Link>
                      {pUid&&<span className="text-slate-400 font-mono text-[11px]">{pUid}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {typeof player.gear==='number'&&<span className="text-slate-400">{fillText(t('{0} gear items','{0} предметов снаряжения'),[player.gear])}</span>}
                      {player.status==='new'&&(
                        <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                          {t('new','новый')}
                        </span>
                      )}
                      {player.status==='repeated'&&(
                        <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                          {t('updated','обновлён')}
                        </span>
                      )}
                      {player.status==='rejected'&&(
                        <span className="rounded bg-rose-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                          {t('rejected','отклонён')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Collapsible>
      )}
    </div>
  );
}

/** What the finished job produced, in a line, with a link where there is a page for it. */
function ResultLine({job,locale}:{job:QueueJob;locale:Locale}) {
  const ru=locale==='ru',t=localeText(locale);
  if(job.state==='failed')return <span className="text-rose-200">{job.error?.message}</span>;
  if(job.state!=='complete'||!job.result||typeof job.result!=='object')return null;
  const result=job.result as Record<string,unknown>;
  const subj=getJobSubject(job);
  const n=(key:string)=>typeof result[key]==='number'?result[key] as number:0;

  if(job.kind==='wish-import'&&typeof result.profileId==='string') {
    const subject=formatSubject(subj.name,subj.uid);
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {subj.region&&<RegionBadge region={subj.region}/>}
        {subject&&<span className="font-semibold text-white">{subject}</span>}
        {subject&&<span className="text-slate-400">·</span>}
        <span>
          {fillText(localeText(locale)('New pulls {0}, already known {1}.', 'Новых круток: {0}, уже были: {1}.'), [n('inserted'), n('duplicates')])}{' '}
          <Link className="text-amber-200 underline underline-offset-2 hover:text-amber-100" href={`/tools/wish/?profileId=${encodeURIComponent(result.profileId)}&tab=history`}>
            {t('History','История')} →
          </Link>
        </span>
      </div>
    );
  }

  if(job.kind==='players-import') {
    return <PlayersResultLine result={result} region={subj.region} server={subj.server} locale={locale}/>;
  }

  if(job.kind==='build-profile'&&typeof result.uid==='string'&&typeof result.slot==='string') {
    const subject=formatSubject(subj.name,subj.uid);
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {subj.region&&<RegionBadge region={subj.region}/>}
        {subject&&<span className="font-semibold text-white">{subject}</span>}
        {subject&&<span className="text-slate-400">·</span>}
        <span>
          {t('Profile saved.','Профиль сохранён.')} {' '}
          <Link className="text-amber-200 underline underline-offset-2 hover:text-amber-100" href={`/tools/build/${encodeURIComponent(result.uid)}/${encodeURIComponent(result.slot)}/`}>
            {t('Open','Открыть')} →
          </Link>
        </span>
      </div>
    );
  }

  if(job.kind==='build-import') {
    const subject=formatSubject(subj.name,subj.uid);
    const gear=typeof result.gear==='number'?result.gear:
      Array.isArray((result.data as Record<string,unknown>|undefined)?.gear)?((result.data as {gear:unknown[]}).gear.length):null;
    if(gear===null)return null;
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {subj.region&&<RegionBadge region={subj.region}/>}
        {subj.server&&<span className="text-slate-400">{t('Server')}: {subj.server}</span>}
        {subject&&<span className="font-semibold text-white">{subject}</span>}
        {subject&&<span className="text-slate-400">·</span>}
        {gear!==null&&<span>{fillText(localeText(locale)('Equipped items: {0}.', 'Предметов экипировки: {0}.'), [gear])}</span>}
        {subj.uid&&<Link className="text-amber-200 underline underline-offset-2 hover:text-amber-100" href={`/tools/build/${encodeURIComponent(subj.uid)}/`}>
          {t('Profile →','Профиль →')}
        </Link>}
      </div>
    );
  }

  return null;
}

const time=(value:string|null,locale:Locale)=>value?formatDate(value,locale,{hour:'2-digit',minute:'2-digit',second:'2-digit'},'—'):'—';
const label=queueKindLabel;

/**
 * /tools/queue (docs/architecture/job-queue.md): the shared queue of heavy operations. Everyone sees what waits and runs without
 * names or files; the viewer's own jobs (same IP) are marked, and the jobs sent from this browser show their results.
 */
export function QueueView() {
  const {locale}=useLocale();
  const ru=locale==='ru',t=localeText(locale);
  const [board,setBoard]=useState<QueueBoard|null>(null);
  const [failed,setFailed]=useState(false);
  const [mine,setMine]=useState<QueueJob[]|null>(null);

  useEffect(()=>{
    const controller=new AbortController();
    let timer=0;
    const load=async()=>{
      try {
        const [next,own]=await Promise.all([fetchBoard(controller.signal),
          Promise.all(rememberedJobs().map(item=>fetchJob(item.id,controller.signal).catch(()=>null)))]);
        setBoard(next);setFailed(false);setMine(own.filter((job):job is QueueJob=>!!job));
      } catch {if(!controller.signal.aborted)setFailed(true);}
      if(!controller.signal.aborted)timer=window.setTimeout(load,BOARD_POLL_MS);
    };
    void load();
    return ()=>{controller.abort();window.clearTimeout(timer);};
  },[]);

  const waiting=board?.active.filter(job=>job.state==='queued').length??0;
  return <main className="info-ui min-h-screen bg-[#0b0d13] px-4 pb-12 pt-4 text-[#e8e6e5] md:px-8">
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 mt-3 border-l-2 border-sky-400/70 pl-4">
        <p className="text-[11px] font-bold tracking-[0.23em] text-sky-300">{t('TOOLS / QUEUE')}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">{t('Processing queue')}</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{t(
          'Imports and saved builds run here, one at a time. Follow your action here or on the page that sent it.')}</p>
      </header>

      {failed&&!board&&<p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{t('The queue is unavailable: the server is not connected.')}</p>}
      {!board&&!failed&&<LoadingState/>}

      {board&&<>
        <section aria-label={t('Summary')} className="mb-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-[var(--surface-panel)] px-3 py-2"><p className="text-xs text-slate-400">{t('Waiting')}</p>
            <p className="mt-0.5 text-xl font-bold text-white">{waiting}<span className="text-sm font-normal text-slate-400"> / {board.limits.maxWaiting}</span></p></div>
          <div className="rounded-lg border border-white/10 bg-[var(--surface-panel)] px-3 py-2"><p className="text-xs text-slate-400">{t('Processing now')}</p>
            <p className="mt-0.5 text-sm font-semibold text-sky-200">{(()=>{const job=board.active.find(item=>item.state==='processing');return job?`№${job.seq} · ${label(job.kind,locale)}`:t('Nothing');})()}</p></div>
          <div className="rounded-lg border border-white/10 bg-[var(--surface-panel)] px-3 py-2"><p className="text-xs text-slate-400">{t('Average time')}</p>
            <ul className="mt-0.5 text-xs leading-5 text-slate-300">{(Object.entries(board.averageMs) as [QueueKind,number][]).map(([kind,ms])=><li key={kind}>{label(kind,locale)}: {formatWait(ms,ru)}</li>)}
              {!Object.keys(board.averageMs).length&&<li className="text-slate-500">{t('No finished jobs yet.')}</li>}</ul></div>
        </section>

        {!!mine?.length&&<section className="mb-5">
          <h2 className="mb-2 text-base font-bold text-white">{t('My actions')}</h2>
          <ul className="space-y-1.5">{mine.map(job=><li key={job.id} className="rounded-lg border border-sky-300/25 bg-sky-400/5 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="font-semibold text-white">№{job.seq} · {label(job.kind,locale)}</span>
              <span className={STATE_TONE[job.state]}>{queueStateLabel(job.state,locale)}{job.state==='queued'?` · ${t('place')} ${job.position}`:''}</span>
              {job.estimateMs!==null&&<span className="text-slate-400">{formatWait(job.estimateMs,ru)}</span>}
              <span className="ml-auto text-xs text-slate-500">{time(job.createdAt,locale)}</span></div>
            <ActionResult job={job} locale={locale}/>
          </li>)}</ul>
        </section>}

        <section className="mb-5">
          <h2 className="mb-2 text-base font-bold text-white">{t('In the queue')}</h2>
          {board.active.length?<QueueTable locale={locale} rows={board.active.map(job=>({...job,finishedAt:null,durationMs:null}))}/>
            :<p className="rounded-lg border border-white/10 bg-[var(--surface-panel)] px-3 py-2 text-sm text-slate-400">{t('The queue is empty: a new action starts at once.')}</p>}
        </section>
        <section>
          <h2 className="mb-2 text-base font-bold text-white">{t('History')}</h2>
          {board.recent.length?<QueueTable locale={locale} rows={board.recent.map(job=>({...job,position:0}))}/>
            :<p className="rounded-lg border border-white/10 bg-[var(--surface-panel)] px-3 py-2 text-sm text-slate-400">{t('Nothing yet.')}</p>}
        </section>
      </>}
    </div>
  </main>;
}

function ActionResult({job,locale}:{job:QueueJob;locale:Locale}) {
  const ru=locale==='ru';
  const result=ResultLine({job,locale});
  return result?<div className="mt-1 text-slate-300">{result}</div>:null;
}

function QueueTable({rows,locale}:{locale:Locale;rows:{seq:number;kind:QueueKind;state:QueueState;position:number;createdAt:string;startedAt:string|null;finishedAt:string|null;durationMs:number|null;mine:boolean}[]}) {
  const ru=locale==='ru',t=localeText(locale);
  return <div className="overflow-x-auto rounded-xl border border-white/10 bg-[var(--surface-panel)]">
    <table className="w-full min-w-[520px] text-left text-sm">
      <thead className="border-b border-white/10 text-xs text-slate-400"><tr>
        <th className="px-3 py-1.5 font-medium">№</th><th className="px-3 py-1.5 font-medium">{t('Action')}</th><th className="px-3 py-1.5 font-medium">{t('State')}</th>
        <th className="px-3 py-1.5 font-medium">{t('Sent')}</th><th className="px-3 py-1.5 font-medium">{t('Took')}</th></tr></thead>
      <tbody>{rows.map(row=><tr key={row.seq} className={`border-b border-white/5 last:border-0 ${row.mine?'bg-sky-400/10':''}`}>
        <td className="px-3 py-1.5 tabular-nums text-slate-300">{row.seq}</td>
        <td className="px-3 py-1.5 text-white">{label(row.kind,locale)}{row.mine&&<span className="ml-2 rounded bg-sky-400/20 px-1.5 py-0.5 text-[11px] text-sky-100">{t('you')}</span>}</td>
        <td className={`px-3 py-1.5 ${STATE_TONE[row.state]}`}>{queueStateLabel(row.state,locale)}{row.state==='queued'?` · ${row.position}`:''}</td>
        <td className="px-3 py-1.5 tabular-nums text-slate-400">{time(row.createdAt,ru?'ru':'en')}</td>
        <td className="px-3 py-1.5 tabular-nums text-slate-400">{row.durationMs!==null?formatWait(row.durationMs,ru).replace('≈ ',''):'—'}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
