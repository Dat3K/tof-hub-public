// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {buildRuntimeData} from '../../scripts/generators/build-runtime-data.cjs';
import {loadServerGameData,loadServerSimulacra,resolveServerDatasetPath} from '../../apps/web/src/lib/game-data-server';
import {buildDatasetUrl} from '../../apps/web/src/lib/game-data-client/loader';
import {adaptCompCatalog} from '../../packages/game-domain/src/adapters/comp-adapter';

const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0)) fs.rmSync(root,{recursive:true,force:true});});
function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tof-runtime-'));roots.push(root);
  const write=(file:string,value:unknown)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(value));};
  const read=(file:string)=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  return {root,write,read};
}

describe('generated runtime data',()=>{
  it('preserves unchanged files and updates a file when Windows denies rename',()=>{
    const {root,write,read}=fixture();
    write('link-previews.json',{version:1});
    buildRuntimeData(root);
    const rename=vi.spyOn(fs,'renameSync').mockImplementation(()=>{
      throw Object.assign(new Error('Windows file lock'),{code:'EPERM'});
    });
    try {
      buildRuntimeData(root);
      expect(rename).not.toHaveBeenCalled();
      write('link-previews.json',{version:2});
      buildRuntimeData(root);
      expect(rename).toHaveBeenCalledOnce();
      expect(read('runtime/link-previews.json')).toEqual({version:2});
      expect(fs.readdirSync(path.join(root,'runtime'))).toEqual(['link-previews.json']);
    } finally { rename.mockRestore(); }
  });

  it('reads compact catalogs without opening the original, and restores only the selected entity losslessly',async()=>{
    const {root,write,read}=fixture();
    const item={id:'test',slug:'alias',canonical_id:'canonical',name_en:'Test',name_ru:'Тест',weapon_id:'weapon',server_mode:'gacha',weapon:{skills:[{description:'full detail'}]},sources:{original:'kept'},assets:{art:'original.webp'}};
    const mmo={...item,id:'test-mmo',canonical_id:'canonical',server_mode:'mmo',weapon:{skills:[{description:'MMO detail'}]}};
    write('en/simulacra.json',{items:[item],gacha:[item],mmo:[mmo]});
    write('ru/simulacra.json',{items:[item],gacha:[item],mmo:[mmo]});
    write('weapon-growth.json',{weapons:{weapon:{levels:[1,2]}}});
    buildRuntimeData(root);
    const catalog=read('en/runtime/simulacra.json');
    expect(catalog.items).toBeUndefined();expect(catalog.gacha[0].sources).toBeUndefined();
    expect(catalog.gacha[0]._detail).toMatch(/^runtime\/details\/simulacra\/[a-f0-9]{24}$/);
    expect(catalog._locale).toBe('en');
    fs.writeFileSync(path.join(root,'en/simulacra.json'),'broken original: must not be read');
    const compact=await loadServerSimulacra('en',{dataRoot:root});
    expect(compact.gacha?.[0].name_en).toBe('Test');
    const full=await loadServerSimulacra('en',{dataRoot:root,selectedId:'ALIAS'});
    expect(full.gacha?.[0]).toEqual({...item,growth:{levels:[1,2]}});
    expect((full.mmo?.[0] as any)._detail).toBeTruthy();
    const mmoFull=await loadServerSimulacra('en',{dataRoot:root,selectedId:'canonical',selectedCollection:'mmo'});
    expect(mmoFull.mmo?.[0]).toEqual({...mmo,growth:{levels:[1,2]}});
    expect((mmoFull.gacha?.[0] as any)._detail).toBeTruthy();
    expect((compact.gacha?.[0] as any)._detail).toBeTruthy();
  });

  it('keeps list search, passive-star text, recipes and matrix pieces, while sharding heavy relic/pet fields',()=>{
    const {root,write,read}=fixture();
    const relic={id:'r',stars:[{star:4,desc_en:'searchable passive'}],variants:[{description:'full variant'}],property:'Assist'};
    const pet={id:'p',category:'combat',stats_progression:{levels:{'1':{hp:10}}},skills:[{description:'full skill'}]};
    const matrix={id:'m',pieces:[{name_en:'searchable piece'}],effects:[{desc_ru:'эффект'}],carriers:[{role:'Tank'}]};
    const food={id:'f',recipe:{ingredients:[{name:'searchable ingredient'}]}};
    write('en/relics.json',{items:[relic],relics:[relic],gacha:[relic],mmo:[]});
    write('en/pets.json',{items:[pet],pets:[pet],module_families:[],modules:[]});
    write('en/matrices.json',{items:[matrix],suits:[matrix]});
    write('en/food.json',{items:[food],dishes:[food],ingredients:[],potions:[]});
    buildRuntimeData(root);
    const r=read('en/runtime/relics.json').gacha[0];expect(r.stars).toEqual(relic.stars);expect(r.variants).toBeUndefined();
    expect(read(`en/${r._detail}.json`)).toEqual(relic);
    const p=read('en/runtime/pets.json').items[0];expect(p.skills).toEqual([{}]);expect(p.stats_progression).toBeUndefined();expect(read(`en/${p._detail}.json`)).toEqual(pet);
    expect(read('en/runtime/matrices.json').items[0]).toEqual(matrix);
    expect(read('en/runtime/food.json').items[0]).toEqual(food);
  });

  it('prepares Comp once, preserves the adapter output and includes both MMO rosters',()=>{
    const {root,write,read}=fixture();
    const sim={id:'sim',name_en:'Sim',name_ru:'Сим',weapon_id:'w',element:'frost',role:'dps',rarity:'SSR',release_order:5,weapon:{unused:'large detail'}};
    const mmo={...sim,id:'sim-mmo',server_mode:'mmo',icon:'mmo.webp'};
    const relic={id:'relic-mmo',server_mode:'mmo',name_en:'Relic',quality:'SSR',property:'Attack',item_icon:'relic.webp',stars:[]};
    const raw={simulacra:[sim],roles:[],matrices:[],relics:[],pets:[]};
    write('en/comp.json',raw);write('en/simulacra.json',{gacha:[sim],mmo:[mmo]});write('en/relics.json',{gacha:[],mmo:[relic]});
    buildRuntimeData(root);
    const runtime=read('en/runtime/comp.json');
    expect(adaptCompCatalog(runtime)).toEqual(adaptCompCatalog({...raw,simulacra:[sim,{...mmo,weapon_icon:mmo.icon}],relics:[{...relic,icon:relic.item_icon}]}));
    expect(runtime.simulacra[0].weapon).toBeUndefined();
  });

  it('preserves small page datasets, reload freshness and safe nested paths',async()=>{
    const {root,write}=fixture();
    write('en/items.json',{'1':{id:'item',description_en:'visible table text'}});
    write('build-page.json',{schemaVersion:1,gear:[{id:'slot'}]});
    buildRuntimeData(root);
    expect(await loadServerGameData('en','items',{dataRoot:root})).toEqual({'1':{id:'item',description_en:'visible table text'}});
    expect(await loadServerGameData('','build-page',{dataRoot:root})).toEqual({schemaVersion:1,gear:[{id:'slot'}]});
    write('en/runtime/items.json',{'2':{id:'fresh'}});
    expect(await loadServerGameData('en','items',{dataRoot:root})).toEqual({'2':{id:'fresh'}});
    expect(buildDatasetUrl('ru','simulacra')).toBe('/game-data/ru/runtime/simulacra.json');
    expect(buildDatasetUrl('en','runtime/details/pets/0123456789abcdef01234567')).toBe('/game-data/en/runtime/details/pets/0123456789abcdef01234567.json');
    expect(()=>resolveServerDatasetPath('en','../../secret',root)).toThrow('Invalid game dataset path');
    expect(()=>resolveServerDatasetPath('en','runtime\\..\\secret',root)).toThrow();
  });
});
