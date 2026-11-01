'use client';
import { type Locale } from '@tof-hub/i18n';
import { fillText, localeText } from '@/lib/i18n/text';
import Link from 'next/link';
import {Spinner,Toast} from '@tof-hub/ui';
import {formatWait,type QueueJob} from './client';

/**
 * "Your action is in the queue" line shown while a queued operation waits or runs (wish import, players upload,
 * build import, saving a build). Nothing once it finished: each page reports the result itself.
 */
export function QueueNotice({job,locale}:{job:QueueJob|null;locale:Locale;className?:string}) {
  if(!job||(job.state!=='queued'&&job.state!=='processing'))return null;
  const t=localeText(locale),ru=locale==='ru';
  const ahead=Math.max(0,job.position-1);
  const text=job.state==='processing'
    ?t('Your action is being processed…', 'Ваше действие обрабатывается…')
    :ahead>0
      ?fillText(t('Your action is in the queue: #{0}, {1} ahead of you. Please wait and keep this page open.', 'Ваше действие в очереди: №{0}, перед вами {1}. Дождитесь выполнения, не закрывая страницу.'),[job.position,ahead])
      :fillText(t('Your action is in the queue: #{0}; you are next. Please wait and keep this page open.', 'Ваше действие в очереди: №{0}; вы следующие. Дождитесь выполнения, не закрывая страницу.'),[job.position]);
  return <Toast eventKey={[job.id,job.state,job.position,job.estimateMs,locale].join(':')} duration={null}><div className="flex flex-wrap items-center gap-x-2 gap-y-1">
    <Spinner size="sm" aria-label={t('Waiting', 'Ожидание')}/>
    <span>{text}</span>
    {job.estimateMs!==null&&<span className="text-sky-200/70">{formatWait(job.estimateMs,ru)}</span>}
    <Link href="/tools/queue/" className="ml-auto text-sky-200 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300">{t('Queue', 'Очередь')} →</Link>
  </div></Toast>;
}
