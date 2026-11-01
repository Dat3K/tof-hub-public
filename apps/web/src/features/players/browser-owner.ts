import {DRAFT_KEY} from '../build/model';

const OWNER_KEY='tof-imported-owner-v1';
export const OWNER_CHANGED='tof-imported-owner-changed';
export interface BrowserOwner {uid:string;nickname:string|null}
function owner(value:unknown):BrowserOwner|null {
  if(!value||typeof value!=='object')return null;
  const item=value as Record<string,unknown>;
  return typeof item.uid==='string'&&/^\d{6,24}$/.test(item.uid)
    ?{uid:item.uid,nickname:typeof item.nickname==='string'?item.nickname.slice(0,64):null}:null;
}
/** Convenience identity from a successful import; never authentication or permission to edit a profile. */
export function rememberBrowserOwner(value:BrowserOwner) {
  const parsed=owner(value);if(!parsed)return;
  try {localStorage.setItem(OWNER_KEY,JSON.stringify(parsed));window.dispatchEvent(new Event(OWNER_CHANGED));}
  catch { /* Imports still work when browser persistence is unavailable. */ }
}
export function readBrowserOwner():BrowserOwner|null {
  try {
    const saved=owner(JSON.parse(localStorage.getItem(OWNER_KEY)??'null'));if(saved)return saved;
    // Existing browsers predate OWNER_KEY. Use the captured subject, never the editable profile UID or demo.
    const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)??'null');
    const source=draft?.captureSource;
    if(draft?.demo||source?.kind!=='file')return null;
    return owner({uid:source.capture?.capture?.subject?.uid,nickname:source.capture?.profile?.name});
  } catch {return null;}
}
