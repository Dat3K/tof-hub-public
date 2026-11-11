import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {compareSimulacraRelease} from '@/features/info-sections/common/catalog-release-order';
import {loadMmoBuildCatalog} from './catalog';

const read=(name:string)=>JSON.parse(readFileSync(resolve(import.meta.dirname,`../../../../../public/game-data/${name}.json`),'utf8'));
const reference=read('en/runtime/simulacra');
const generated=read('build-mmo-page');
vi.mock('@/lib/game-data-server',()=>({loadServerGameData:vi.fn()}));
import {loadServerGameData} from '@/lib/game-data-server';

function mockCatalog(mmo=generated,simulacra=reference) {
  vi.mocked(loadServerGameData).mockImplementation(async(_locale,name)=>{
    if(name==='build-mmo-page')return mmo;
    if(name==='simulacra')return simulacra;
    if(name==='build-page')return read('build-page');
    return null;
  });
}

describe('MMO Build canonical weapon roster',()=>{
  it('matches the complete Info release order and preserves MMO advancement values',async()=>{
    mockCatalog({...generated, weapons: [...generated.weapons].reverse()});
    const catalog=await loadMmoBuildCatalog();
    const expected=[...reference.mmo].sort((a,b)=>compareSimulacraRelease(a,b,true));
    expect(catalog.weapons.map(item=>item.id)).toEqual(expected.map(item=>item.id));
    for(const weapon of catalog.weapons)expect(weapon).toEqual(generated.weapons.find((item:{id:string})=>item.id===weapon.id));
  });

  it('excludes stale or mismatched rows and never invents missing MMO weapon data',async()=>{
    const stale={...generated.weapons[0],id:'removed-fixture'};
    const missing=generated.weapons[1];
    const mismatch={...generated.weapons[2],weaponId:'different-fixture'};
    mockCatalog({...generated,weapons:[stale,mismatch,...generated.weapons.filter((item:{id:string})=>![missing.id,mismatch.id].includes(item.id))]});
    const catalog=await loadMmoBuildCatalog();
    expect(catalog.weapons.some(item=>[stale.id,missing.id,mismatch.id].includes(item.id))).toBe(false);
    mockCatalog(generated,{...reference,mmo:[]});
    expect((await loadMmoBuildCatalog()).weapons).toEqual([]);
  });
});
