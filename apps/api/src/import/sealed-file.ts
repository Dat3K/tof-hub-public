/**
 * First gate of every uploaded sealed file (docs/imports.md): nothing of a file is parsed
 * before it passes these cheap checks, and its content is only read after AES-GCM authentication (decryptEnvelope).
 *
 * 1. size: not empty, within the limit;
 * 2. strict UTF-8 text (binary or truncated multi-byte data is refused);
 * 3. signature: the text starts with `{"format":"<expected format>"` (the capture app writes the format first),
 *    so a ZIP, an image, another tool's file or a cut-off file is refused before JSON parsing;
 * 4. JSON parsing; the caller then applies its strict envelope schema and decrypts.
 */
export class SealedFileError extends Error {}
import {assertJsonDepth,safeJsonReviver} from '../security/json-safety';

const SIGNATURE=/^\s*\{\s*"format"\s*:\s*"([a-z0-9-]{1,64})"/;

export function readSealedText(body:unknown,{format,maxBytes}:{format:string;maxBytes:number}):unknown {
  const buffer=Buffer.isBuffer(body)?body:typeof body==='string'?Buffer.from(body,'utf8'):null;
  if(!buffer||!buffer.length)throw new SealedFileError('The file is empty');
  if(buffer.length>maxBytes)throw new SealedFileError(`The file exceeds ${Math.round(maxBytes/1024/1024)} MiB`);
  let text:string;
  try {text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(buffer);}
  catch {throw new SealedFileError('The file is not text');}
  const found=SIGNATURE.exec(text.slice(0,256))?.[1];
  if(found!==format)throw new SealedFileError(found?`Wrong file type: ${found}`:'Not a sealed tof-hub file');
  // The closing brace must be there: a cut-off download fails here instead of deep inside the parser.
  if(!text.trimEnd().endsWith('}'))throw new SealedFileError('The file is incomplete');
  try {assertJsonDepth(text);return JSON.parse(text,safeJsonReviver) as unknown;}
  catch {throw new SealedFileError('The file is damaged');}
}
