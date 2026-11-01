import fs from 'node:fs';
import path from 'node:path';

interface CurveKey {Time:number;Value:number}
interface SourceCurve {Keys:CurveKey[];InterpMode?:string;PreInfinityExtrap?:string;PostInfinityExtrap?:string}
export type SkillTipCurves=Map<string,{curve:SourceCurve;source:string}>;

/** Overseas skill tips override the base table; coordinates are game curve times, never array indices. */
export function loadSkillTipCurves(rawRoot?:string):SkillTipCurves {
  const result:SkillTipCurves=new Map();
  if(!rawRoot)return result;
  for(const source of [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Skill/SkillUpdateTips.json',
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/SkillUpdateTips_Overseas.json',
  ]){
    const file=path.join(rawRoot,source);
    if(!fs.existsSync(file))continue;
    const data=JSON.parse(fs.readFileSync(file,'utf8'));
    const rows=(Array.isArray(data)?data[0]:data)?.Rows??{};
    for(const [key,curve] of Object.entries(rows))if(Array.isArray((curve as SourceCurve)?.Keys))result.set(key,{curve:curve as SourceCurve,source});
  }
  return result;
}

/** Mutates only parameter curves of a caller-owned generated weapon snapshot. */
export function restoreSkillCurveTimes(weapon:unknown,curves:SkillTipCurves):number {
  let changed=0;
  const visit=(node:unknown)=>{
    if(!node||typeof node!=='object')return;
    if(Array.isArray(node)){node.forEach(visit);return;}
    const parameter=node as Record<string,unknown>;
    const source=typeof parameter.key==='string'&&parameter.levels?curves.get(parameter.key):undefined;
    if(source){
      const keys=source.curve.Keys.filter(key=>Number.isFinite(key.Time)&&Number.isFinite(key.Value));
      if(keys.length){
        parameter.levels=Object.fromEntries(keys.map(key=>[String(key.Time),key.Value]));
        parameter.interpMode=source.curve.InterpMode;
        parameter.curveSource={path:source.source,row:parameter.key,timeField:'Keys.Time',valueField:'Keys.Value',preInfinity:source.curve.PreInfinityExtrap,postInfinity:source.curve.PostInfinityExtrap};
        changed++;
      }
    }
    Object.values(parameter).forEach(visit);
  };
  visit(weapon);
  return changed;
}
