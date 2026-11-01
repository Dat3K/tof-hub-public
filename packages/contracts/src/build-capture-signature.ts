import {BuildCaptureSchema,type BuildCapture} from './build-capture';

/** Stable JSON for signed data: JSONB may reorder object keys, but never array entries. */
export function canonicalJson(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).filter(key=>(value as Record<string,unknown>)[key]!==undefined).sort()
    .map(key=>`${JSON.stringify(key)}:${canonicalJson((value as Record<string,unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value)??'null';
}

/** Accept existing signatures as well as canonical ones after a JSONB queue round trip. */
export function buildCaptureSigningTexts(capture:BuildCapture):string[] {
  const legacy=BuildCaptureSchema.parse(capture);
  const sorted=<T>(record:Record<string,T>)=>Object.fromEntries(Object.entries(record).sort(([a],[b])=>a<b?-1:a>b?1:0));
  // Older imports hashed schema-ordered objects with the collector's alphabetically ordered records.
  legacy.availability=sorted(legacy.availability);
  legacy.combat.attack=sorted(legacy.combat.attack);
  legacy.combat.attackBase=sorted(legacy.combat.attackBase);
  legacy.combat.resistance=sorted(legacy.combat.resistance);
  legacy.weaponSettings.elements=sorted(legacy.weaponSettings.elements);
  legacy.weaponSettings.settings=sorted(legacy.weaponSettings.settings);
  return [...new Set([canonicalJson(capture),JSON.stringify(capture),JSON.stringify(legacy)])];
}
