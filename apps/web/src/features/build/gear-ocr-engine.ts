/**
 * Browser-side screenshot reading for the gear editor. Nothing is uploaded or stored: the image is passed to a
 * Tesseract worker in this tab and dropped; no network request carries it. The guard below limits what a visitor can
 * do locally (file type/size/dimensions, one reading at a time, a per-minute budget and a gap between readings), so a
 * script cannot keep the tab's CPU busy or hammer the engine-file download.
 */
import {checkRasterFile} from '@/lib/raster-file';
export const GEAR_OCR_LIMITS={
  maxBytes:6*1024*1024,
  types:['image/png','image/jpeg','image/webp'],
  minEdge:120,maxEdge:5000,
  maxPerWindow:8,windowMs:60_000,minGapMs:1_500,
  idleTerminateMs:60_000
} as const;

export type OcrRejection='type'|'size'|'dimensions'|'busy'|'gap'|'rate';
export type OcrGuardResult={ok:true}|{ok:false;reason:OcrRejection;retryAfterMs?:number};

export function createOcrGuard(limits:{maxBytes:number;types:readonly string[];maxPerWindow:number;windowMs:number;minGapMs:number}=GEAR_OCR_LIMITS) {
  let busy=false;
  let starts:number[]=[];
  return {
    /** Cheap checks that need no decoding. */
    check(file:{type:string;size:number},now=Date.now()):OcrGuardResult {
      if(!limits.types.includes(file.type))return {ok:false,reason:'type'};
      if(file.size<=0||file.size>limits.maxBytes)return {ok:false,reason:'size'};
      if(busy)return {ok:false,reason:'busy'};
      starts=starts.filter(time=>now-time<limits.windowMs);
      const last=starts.at(-1);
      if(last!==undefined&&now-last<limits.minGapMs)return {ok:false,reason:'gap',retryAfterMs:limits.minGapMs-(now-last)};
      if(starts.length>=limits.maxPerWindow)return {ok:false,reason:'rate',retryAfterMs:limits.windowMs-(now-starts[0]!)};
      return {ok:true};
    },
    begin(now=Date.now()) {busy=true;starts.push(now);},
    end() {busy=false;}
  };
}

export const ocrGuard=createOcrGuard();

type TesseractWorker=import('tesseract.js').Worker;
let worker:Promise<TesseractWorker>|null=null;
let idle:ReturnType<typeof setTimeout>|undefined;

function scheduleTerminate() {
  clearTimeout(idle);
  idle=setTimeout(()=>{
    const current=worker;worker=null;
    current?.then(item=>item.terminate()).catch(()=>undefined);
  },GEAR_OCR_LIMITS.idleTerminateMs);
}

/** Image dimensions without keeping the pixels. */
async function imageEdges(file:Blob) {
  const bitmap=await createImageBitmap(file);
  const edges={width:bitmap.width,height:bitmap.height};
  bitmap.close();
  return edges;
}

export async function recognizeGearImage(file:File):Promise<{ok:true;text:string}|{ok:false;reason:OcrRejection|'engine';retryAfterMs?:number}> {
  const verdict=ocrGuard.check(file);
  if(!verdict.ok)return verdict;
  ocrGuard.begin();
  try {
    if(!await checkRasterFile(file,GEAR_OCR_LIMITS.maxBytes))return {ok:false,reason:'type'};
    const {width,height}=await imageEdges(file);
    const {minEdge,maxEdge}=GEAR_OCR_LIMITS;
    if(Math.min(width,height)<minEdge||Math.max(width,height)>maxEdge)return {ok:false,reason:'dimensions'};
    clearTimeout(idle);
    worker??=import('tesseract.js').then(({createWorker})=>createWorker('eng'));
    const engine=await worker;
    const {data}=await engine.recognize(file);
    return {ok:true,text:data.text};
  } catch {
    worker=null;
    return {ok:false,reason:'engine'};
  } finally {
    ocrGuard.end();
    scheduleTerminate();
  }
}
