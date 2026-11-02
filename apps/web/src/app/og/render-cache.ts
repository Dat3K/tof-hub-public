import {createHash} from 'node:crypto';

type Rendered = {body:ArrayBuffer;status:number;headers:Headers;expires:number};

/** Public image responses only. Keep both retained output and concurrent native render work bounded. */
export function createPreviewCache({maxBytes=4*1024*1024,maxEntries=32,maxPending=8,ttl=60_000}={}) {
  const cached=new Map<string,Rendered>();
  const flights=new Map<string,Promise<Rendered>>();
  let bytes=0, tail=Promise.resolve();
  const response=(entry:Rendered)=>new Response(entry.body.slice(0),{status:entry.status,headers:entry.headers});
  const remove=(key:string)=>{const old=cached.get(key);if(old){bytes-=old.body.byteLength;cached.delete(key);}};
  return async (href:string,produce:()=>Promise<Response>):Promise<Response>=>{
    const key=createHash('sha256').update(href).digest('hex');
    const saved=cached.get(key);
    if(saved && saved.expires>Date.now()) {cached.delete(key);cached.set(key,saved);return response(saved);}
    if(saved)remove(key);
    const existing=flights.get(key);
    if(existing)return response(await existing);
    if(flights.size>=maxPending)return new Response('Preview busy. Retry shortly.',{status:429,headers:{'Retry-After':'2','Cache-Control':'no-store'}});
    const pending=tail.then(async()=>{
      const output=await produce();
      // ImageResponse renders while its body streams. Admission must stay held until that work finishes.
      const body=await output.arrayBuffer();
      const entry={body,status:output.status,headers:new Headers(output.headers),expires:Date.now()+ttl};
      const policy=output.headers.get('Cache-Control')??'';
      if(output.ok && /\bpublic\b/i.test(policy) && !/\b(?:no-store|private)\b/i.test(policy) && !output.headers.has('Set-Cookie') && body.byteLength<=maxBytes) {
        remove(key);cached.set(key,entry);bytes+=body.byteLength;
        while(cached.size>maxEntries||bytes>maxBytes)remove(cached.keys().next().value!);
      }
      return entry;
    });
    tail=pending.then(()=>undefined,()=>undefined);
    flights.set(key,pending);
    try{return response(await pending);}finally{flights.delete(key);}
  };
}

export const renderPreview=createPreviewCache();
