import {draftFromCapture,type CaptureImportCatalog} from './capture-import';
import {loadCaptureCatalogs} from './capture-catalogs';
import type {TemporaryAttackCatalog} from '@tof-hub/game-domain';
import type {BuildCatalog,BuildDraft} from './types';
import {restrictedCaptureOrigin} from './capture-origin';
import {buildCaptureSigningTexts,canonicalJson,type BuildCapture} from '@tof-hub/contracts';

/** Same prefix as apps/api BuildImportService: the server signs `${context}${digest}` once per import. */
const SIGNATURE_CONTEXT='tof-hub-build-capture:1:';
export type CardProvenance='verified'|'edited'|'pioneer-server'|'test-server'|'unknown-server'|'incomplete-capture';

/**
 * Fields a verified card may change after import: presentation (art, RV mode/element, timestamps)
 * and the header role. The enemy level only scales derived damage. Everything else must equal a card
 * rebuilt from the signed capture.
 */
export function comparableDraft(draft:BuildDraft):string {
  const {art,rv,updatedAt,captureSource,enemyLevel,demo,...fields}=draft;
  void art;void rv;void updatedAt;void captureSource;void enemyLevel;void demo;
  const {role,...profile}=fields.profile;void role;
  return canonicalJson({...fields,profile});
}

const fromBase64Url=(text:string)=>Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),char=>char.charCodeAt(0));
async function sha256Hex(text:string) {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function verifyCaptureSignature(digest:string,signature:string,publicKeyPem:string):Promise<boolean> {
  try {
    const der=fromBase64Url(publicKeyPem.replace(/-----[^-]+-----|\s/g,''));
    const key=await crypto.subtle.importKey('spki',der,{name:'RSA-PSS',hash:'SHA-256'},false,['verify']);
    return await crypto.subtle.verify({name:'RSA-PSS',saltLength:32},key,fromBase64Url(signature),new TextEncoder().encode(SIGNATURE_CONTEXT+digest));
  } catch {return false;}
}

interface VerificationSources {publicKeyPem:string|null;mapping:CaptureImportCatalog;temporary?:TemporaryAttackCatalog}
let verificationKey:Promise<string>|null=null;
export function loadBuildVerificationKey():Promise<string> {
  verificationKey??=fetch('/api/v1/build/import/public-key').then(async response=>{
    const key=response.ok?await response.json() as {public_key_pem?:string}:null;
    if(!key?.public_key_pem)throw new Error('The build verification key is unavailable');
    return key.public_key_pem;
  }).catch(error=>{verificationKey=null;throw error;});
  return verificationKey;
}
/** Shared by Gacha and MMO: both the canonical payload digest and the server signature must match. */
export async function verifyBuildCaptureSource(source:{capture:BuildCapture;digest:string;signature?:string},publicKeyPem?:string):Promise<boolean> {
  if(!source.signature)return false;
  const key=publicKeyPem??await loadBuildVerificationKey();
  const hashes=await Promise.all(buildCaptureSigningTexts(source.capture).map(sha256Hex));
  return hashes.includes(source.digest)&&await verifyCaptureSignature(source.digest,source.signature,key);
}
let sources:Promise<VerificationSources>|null=null;
/** Static catalogs plus the import public key; fetched once per page, no per-export server work. */
function loadSources():Promise<VerificationSources> {
  sources??=Promise.all([
    loadBuildVerificationKey(),
    loadCaptureCatalogs(),
  ]).then(([key,{mapping,temporary}])=>{
    return {publicKeyPem:key,mapping,temporary};
  })
    .catch(error=>{sources=null;throw error;});
  return sources;
}

/**
 * "Verified" only when the stored capture is the one the server signed and the card still equals the
 * card rebuilt from it (either locale, since the character title is localized). A determined user can
 * still forge a PNG; this only makes the badge expensive to fake without loading the server.
 */
export async function verifyBuildCard(draft:BuildDraft,catalog:BuildCatalog,loaded?:VerificationSources,purpose:'export'|'ranking'='export'):Promise<CardProvenance> {
  const origin=restrictedCaptureOrigin(draft);
  // A signed unresolved file may compare its gear locally; export and publishing keep their origin policy.
  if(origin&&(purpose!=='ranking'||(origin!=='unknown-server'&&origin!=='incomplete-capture')))return origin;
  const source=draft.captureSource;
  if(!source||!source.signature)return 'edited';
  try {
    const {publicKeyPem,mapping,temporary}=loaded??await loadSources();
    if(!publicKeyPem)return 'edited';
    if(!await verifyBuildCaptureSource(source,publicKeyPem))return 'edited';
    // The server ranks the signed capture's gear; the ranking only needs proof that the gear is unchanged. Card
    // presentation that is not part of the capture (the demo's pet name, derived totals) must not hide the rank.
    const comparable=purpose==='ranking'?(value:BuildDraft)=>canonicalJson(value.gear):comparableDraft;
    const current=comparable(draft);
    for(const locale of ['en','ru'] as const) {
      const rebuilt=draftFromCapture(source.capture,catalog,mapping,locale,source.digest,temporary,source.signature);
      if(comparable(rebuilt)===current)return 'verified';
    }
  } catch {/* Any missing source falls back to the honest default. */}
  return 'edited';
}
