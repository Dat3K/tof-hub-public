// @vitest-environment node
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=resolve(import.meta.dirname,'../../../../../..');
const require=createRequire(import.meta.url);
const {withThresholdReferences}=require(resolve(root,'scripts/lib/mmo-threshold-references.cjs'));
const dataDir=resolve(root,'scripts/data');
const read=(file:string)=>JSON.parse(readFileSync(resolve(root,file),'utf8'));

describe('MMO threshold reference pipeline',()=>{
  it('reproducibly retains old exact keys without replacing the current export or multiplying records',()=>{
    const catalog=read('apps/web/public/game-data/build-mmo-page.json');
    const active=catalog.thresholds.filter((track:{reference?:string})=>!track.reference);
    const merged=withThresholdReferences({...catalog,thresholds:active},dataDir);
    expect(merged).toEqual(catalog);
    expect(withThresholdReferences(merged,dataDir)).toEqual(merged);
    expect(merged.thresholds.filter((track:{prop:string})=>track.prop==='EquipAttrHealAtk_3')[0].levels[0].value).toBe(6000);
    expect(merged.thresholds.filter((track:{prop:string})=>track.prop==='EquipAttrHealAtk_2')[0].levels[0].value).toBe(2000);
    const reference=read('scripts/data/mmo-threshold-references/mmo-export-2026-10-22.json');
    expect(reference.sources['Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_EquipRandomModifyExtraGain_MMO.json'].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(merged.thresholdReferences[reference.id].region).toBeNull();
  });
});
