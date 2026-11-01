import {constants,createDecipheriv,createPrivateKey,createPublicKey,generateKeyPairSync,privateDecrypt,type KeyObject} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {SEALED_FILES,type SealedFileKind} from '@tof-hub/contracts';
import {assertJsonDepth,safeJsonReviver} from '../security/json-safety';

/** Shared Wish/Build key. Private key never leaves the server. */
export function loadImportKey() {
  let pem=process.env.WISH_IMPORT_PRIVATE_KEY_PEM?.replace(/\\n/g,'\n');
  if(!pem&&process.env.WISH_IMPORT_PRIVATE_KEY_PATH)pem=fs.readFileSync(process.env.WISH_IMPORT_PRIVATE_KEY_PATH,'utf8');
  if(!pem&&process.env.NODE_ENV!=='production') {
    const file=path.resolve(process.cwd(),'.data','wish-import-private.pem');
    fs.mkdirSync(path.dirname(file),{recursive:true});
    if(!fs.existsSync(file))fs.writeFileSync(file,generateKeyPairSync('rsa',{modulusLength:3072}).privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});
    pem=fs.readFileSync(file,'utf8');
  }
  return pem?createPrivateKey(pem):null;
}

export function decryptEnvelope(envelope:{format:string;key_id:string;wrapped_key:string;nonce:string;ciphertext:string;tag:string},
  privateKey:ReturnType<typeof createPrivateKey>,maxBytes:number):unknown {
  const decode=(value:string)=>{const bytes=Buffer.from(value,'base64url');if(bytes.toString('base64url')!==value)throw new Error('Noncanonical base64url');return bytes;};
  // Reject lengths before RSA or allocating plaintext; ciphertext is uncompressed AES-GCM.
  if(envelope.ciphertext.length>Math.ceil(maxBytes*4/3))throw new Error('Payload exceeds limit');
  const nonce=decode(envelope.nonce),tag=decode(envelope.tag),wrapped=decode(envelope.wrapped_key),ciphertext=decode(envelope.ciphertext);
  if(nonce.length!==12||tag.length!==16)throw new Error('Invalid envelope lengths');
  if(wrapped.length!==(privateKey.asymmetricKeyDetails?.modulusLength??3072)/8||ciphertext.length>maxBytes)throw new Error('Invalid envelope lengths');
  const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},wrapped);
  let plaintext:Buffer|undefined,decoded:Buffer|undefined;
  try {
    if(key.length!==32)throw new Error('Invalid AES key');
    const decipher=createDecipheriv('aes-256-gcm',key,nonce);
    decipher.setAAD(Buffer.from(`${envelope.format}:1:${envelope.key_id}`));decipher.setAuthTag(tag);
    decoded=decipher.update(ciphertext);
    plaintext=Buffer.concat([decoded,decipher.final()]);
    if(plaintext.length>maxBytes)throw new Error('Payload exceeds limit');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(plaintext);
    assertJsonDepth(text);
    return JSON.parse(text,safeJsonReviver) as unknown;
  } finally {key.fill(0);decoded?.fill(0);plaintext?.fill(0);}
}

/** Id of the site key the capture app seals for; every import compares the envelope's `key_id` with it. */
export const IMPORT_KEY_ID=process.env.WISH_IMPORT_KEY_ID??'local-1';

/** `GET …/public-key` of every import: what the capture app needs to seal a file for this site. */
export function importPublicKeyInfo(privateKey:KeyObject|null):{ready:boolean;key_id?:string;algorithm?:string;public_key_pem?:string} {
  return privateKey?{ready:true,key_id:IMPORT_KEY_ID,algorithm:'RSA-OAEP-SHA256+AES-256-GCM',
    public_key_pem:createPublicKey(privateKey).export({type:'spki',format:'pem'}).toString()}:{ready:false};
}

const base64url=z.string().regex(/^[A-Za-z0-9_-]+$/);
/**
 * Strict envelope of one sealed file kind (format and limits from SEALED_FILES in @tof-hub/contracts). `maxCiphertext`
 * defaults to the file limit; `extra` adds the kind's own unencrypted fields (Wish: manual pity counters).
 */
export function sealedEnvelopeSchema<Extra extends z.ZodRawShape=Record<never,never>>(kind:SealedFileKind,{maxCiphertext=SEALED_FILES[kind].maxBytes,extra}:{maxCiphertext?:number;extra?:Extra}={}) {
  return z.object({format:z.literal(SEALED_FILES[kind].format),version:z.literal(1),key_id:z.string().regex(/^[a-zA-Z0-9-]{1,32}$/),
    wrapped_key:base64url.max(1024),nonce:base64url.max(32),ciphertext:base64url.max(maxCiphertext),tag:base64url.max(32)})
    .extend(extra??({} as Extra)).strict();
}
