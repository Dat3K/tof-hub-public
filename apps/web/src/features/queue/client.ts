/**
 * The shared queue of heavy operations (apps/api src/queue, docs/architecture/job-queue.md): wish imports, player
 * files, build imports and profile saves answer with a job; the page polls it until it finishes.
 */
import type {QueueBoard,QueueJob,QueueKind} from '@tof-hub/contracts';

export {QUEUE_KINDS,type QueueBoard,type QueueJob,type QueueKind,type QueueState} from '@tof-hub/contracts';

/** A refused request or a failed job: the server's status and message, and the extra fields of the answer. */
export class QueueError extends Error {
  constructor(message:string,readonly status:number,readonly data:Record<string,unknown>={}) {super(message);this.name='QueueError';}
}

const POLL_MS=1500;
const STORAGE_KEY='tof-queue-jobs',REMEMBERED=5;
export interface RememberedJob {id:string;kind:QueueKind;createdAt:string}

/** Jobs sent from this browser, newest first (the queue page shows their results). */
export function rememberedJobs():RememberedJob[] {
  try {
    const value:unknown=JSON.parse(window.localStorage.getItem(STORAGE_KEY)??'[]');
    const jobs=Array.isArray(value)?value.filter((item):item is RememberedJob=>!!item&&typeof item.id==='string'&&typeof item.kind==='string').slice(0,REMEMBERED):[];
    if(Array.isArray(value)&&value.length>jobs.length) {
      try {window.localStorage.setItem(STORAGE_KEY,JSON.stringify(jobs));}
      catch {/* Keep showing jobs even if storage cannot be compacted. */}
    }
    return jobs;
  } catch {return [];}
}
function remember(job:QueueJob) {
  try {window.localStorage.setItem(STORAGE_KEY,JSON.stringify([{id:job.id,kind:job.kind,createdAt:job.createdAt},...rememberedJobs().filter(item=>item.id!==job.id)].slice(0,REMEMBERED)));}
  catch {/* Browser storage is optional. */}
}

/** Sends the operation; the answer is its queue job. A refusal (bad file, one job per IP, full queue) throws. */
export async function submitJob(url:string,init:RequestInit):Promise<QueueJob> {
  const response=await fetch(url,{method:'POST',cache:'no-store',...init});
  const body=await response.json().catch(()=>null) as (QueueJob&{message?:unknown})|null;
  if(!response.ok||!body?.id) {
    const {message:raw,statusCode:_statusCode,error:_error,...data}=(body??{}) as Record<string,unknown>;
    const message=Array.isArray(raw)?raw.join('; '):typeof raw==='string'?raw:'';
    throw new QueueError(message||`HTTP ${response.status}`,response.status,data);
  }
  remember(body);
  return body;
}

export async function fetchJob(id:string,signal?:AbortSignal):Promise<QueueJob|null> {
  const response=await fetch(`/api/v1/queue/jobs/${encodeURIComponent(id)}`,{cache:'no-store',signal});
  if(response.status===404)return null;
  if(!response.ok)throw new QueueError(`HTTP ${response.status}`,response.status);
  return response.json() as Promise<QueueJob>;
}

async function fetchJobDelivery<T>(id:string,signal?:AbortSignal):Promise<T> {
  const response=await fetch(`/api/v1/queue/jobs/${encodeURIComponent(id)}/delivery`,{cache:'no-store',signal});
  if(!response.ok)throw new QueueError(`HTTP ${response.status}`,response.status);
  return response.json() as Promise<T>;
}

/** Polls the job until it finishes; `onUpdate` sees every state. Resolves with the result, throws the job's error. */
export async function waitForJob<T>(job:QueueJob,onUpdate?:(job:QueueJob)=>void,signal?:AbortSignal):Promise<T> {
  let current:QueueJob|null=job;
  for(;;) {
    onUpdate?.(current);
    if(current.state==='complete')return current.deliveryAvailable?fetchJobDelivery<T>(job.id,signal):current.result as T;
    if(current.state==='failed')throw new QueueError(current.error?.message??'The operation failed',current.error?.status??500,current.error?.data);
    await new Promise<void>((resolve,reject)=>{
      const timer=window.setTimeout(resolve,POLL_MS);
      signal?.addEventListener('abort',()=>{window.clearTimeout(timer);reject(signal.reason);},{once:true});
    });
    current=await fetchJob(job.id,signal);
    if(!current)throw new QueueError('The job is no longer known to the server',404);
  }
}

/** Sends the operation and waits for its result. */
export async function runQueued<T>(url:string,init:RequestInit,onUpdate?:(job:QueueJob)=>void,signal?:AbortSignal):Promise<T> {
  return waitForJob<T>(await submitJob(url,init),onUpdate,signal);
}

export async function fetchBoard(signal?:AbortSignal):Promise<QueueBoard> {
  const response=await fetch('/api/v1/queue',{cache:'no-store',signal});
  if(!response.ok)throw new QueueError(`HTTP ${response.status}`,response.status);
  return response.json() as Promise<QueueBoard>;
}

/** "about 40 s", "about 2 min". */
export function formatWait(ms:number,ru:boolean):string {
  const seconds=Math.max(1,Math.round(ms/1000));
  if(seconds<60)return ru?`≈ ${seconds} с`:`≈ ${seconds} s`;
  const minutes=Math.round(seconds/60);
  return ru?`≈ ${minutes} мин`:`≈ ${minutes} min`;
}

/**
 * Text for a refused or failed queued operation: the queue's own refusals (one active operation per IP, a full queue)
 * in the page language, otherwise the server's message or `fallback`.
 */
export function queueMessage(error:unknown,ru:boolean,fallback:string):string {
  if(error instanceof QueueError) {
    const code=error.data.code;
    const minutes=Math.max(1,Math.ceil(Number(error.data.retryAfter??60)/60));
    if(code==='IP_BLOCKED')return ru?`Загрузки с этого IP временно заблокированы после некорректных файлов. Повторите через ${minutes} мин.`:`Uploads from this IP are temporarily blocked after invalid files. Retry in ${minutes} min.`;
    if(code==='DUPLICATE_UPLOAD')return ru?'Этот файл уже отправлен дважды. Используйте результат в очереди или сделайте новый захват.':'This file was already submitted twice. Use the queue result or make a new capture.';
    if(code==='UPLOAD_BUDGET')return ru?'Достигнут суточный лимит загрузок. Попробуйте завтра.':'Daily upload limit reached. Try again tomorrow.';
    if(code==='RATE_LIMIT')return ru?'Слишком много запросов. Подождите минуту.':'Too many requests. Wait a minute.';
    if(code==='SERVER_BUSY'||code==='SECURITY_UNAVAILABLE')return ru?'Сервер занят. Повторите позже.':'The server is busy. Retry later.';
    if(code==='WISH_ACCESS_REQUIRED')return ru?'Для обновления истории нужен токен устройства или сеть первого импорта.':'Updating this history requires a device token or the original importing network.';
    if(code==='INVALID_UPLOAD')return ru?`Файл некорректен или проверка подписи не пройдена. До временной блокировки осталось попыток: ${error.data.remainingAttempts??'—'}.`:`Invalid file or failed signature check. Attempts left before a temporary block: ${error.data.remainingAttempts??'—'}.`;
    if(code==='INCOMPATIBLE_CAPTURE')return ru?'Формат данных захвата не поддерживается. Обновите сайт и Capture и экспортируйте файл снова. Это не считается нарушением.':'The capture data format is not supported. Update the site and Capture, then export again. This does not count as a violation.';
  }
  if(error instanceof QueueError&&error.status===429) {
    if(/one operation at a time/i.test(error.message))return ru?'У вас уже есть действие в очереди: дождитесь его окончания.':'You already have an action in the queue: wait for it to finish.';
    return ru?'Слишком много запросов. Повторите позже.':'Too many requests. Retry later.';
  }
  if(error instanceof QueueError&&error.status===503&&/queue is full/i.test(error.message))return ru?'Очередь заполнена, попробуйте через минуту.':'The queue is full, try again in a minute.';
  return error instanceof Error&&error.message?error.message:fallback;
}
