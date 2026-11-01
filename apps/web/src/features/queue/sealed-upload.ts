import type {Locale} from '@tof-hub/i18n';
import type {SealedFileKind} from '@tof-hub/contracts';
import {checkSealedFile,sealedFileMessage} from '@/lib/sealed-file';
import {runQueued,type QueueJob} from './client';

/** A file refused by the browser gate (wrong tool, size, cut-off): its message is ready to show. */
export class SealedFileError extends Error {
  constructor(message:string) {super(message);this.name='SealedFileError';}
}

export interface SealedUploadOptions {
  /** The import endpoint that answers with a queue job. */
  url:string;
  locale:Locale;
  /** JSON uploads (.tofbuild, .tofwish) may add unencrypted fields to the envelope before it is sent. */
  encode?:(envelope:Record<string,unknown>)=>unknown;
  onUpdate?:(job:QueueJob)=>void;
  signal?:AbortSignal;
  headers?:Record<string,string>;
}

/**
 * Every Tools upload of a capture-app file: the browser gate (lib/sealed-file.ts), then the shared queue until the
 * import finishes. `.tofplayers` goes as raw bytes; `.tofbuild` and `.tofwish` as their JSON envelope. Throws
 * `SealedFileError` for a refused file and `QueueError` for a refused or failed job (see `queueMessage`).
 */
export async function submitSealedFile<T>(kind:SealedFileKind,file:File,{url,locale,encode,onUpdate,signal,headers}:SealedUploadOptions):Promise<T> {
  const problem=await checkSealedFile(file,kind);
  if(problem)throw new SealedFileError(sealedFileMessage(problem,kind,locale));
  if(kind==='players')return runQueued<T>(url,{headers:{'Content-Type':'application/octet-stream'},body:file},onUpdate,signal);
  let envelope:Record<string,unknown>;
  try {envelope=JSON.parse(await file.text()) as Record<string,unknown>;}
  catch {throw new SealedFileError(sealedFileMessage('format',kind,locale));}
  return runQueued<T>(url,{headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(encode?encode(envelope):envelope)},onUpdate,signal);
}
