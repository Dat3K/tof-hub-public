import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fetchCompCatalog} from './data';
import {compareSimulacraRelease} from '../info-sections/common/catalog-release-order';

const reference=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../public/game-data/en/simulacra.json'),'utf8'));
const runtime=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../public/game-data/en/runtime/comp.json'),'utf8'));

describe('Comp canonical MMO roster',()=>{
  it('loads the generated canonical MMO roster while preserving standard rows',async()=>{
    const standard={id:'standard-fixture',name_en:'Standard fixture',weapon_name_en:'Standard weapon'};
    const fetchFn=vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input);
      if(url.endsWith('/runtime/comp.json'))return new Response(JSON.stringify({...runtime,simulacra:[standard,...runtime.simulacra]}));
      return new Response('',{status:404});
    });
    const catalog=await fetchCompCatalog({locale:'mmo-parity-test',fetchFn});
    expect(catalog.weapons?.find(item=>item.id===standard.id)?.name.en).toBe('Standard weapon');
    const weapons=(catalog.weapons??[]).filter(item=>item.serverMode==='mmo').sort((a,b)=>compareSimulacraRelease(a,b,true));
    const expected=[...reference.mmo].sort((a,b)=>compareSimulacraRelease(a,b,true));
    expect(weapons.map(item=>item.id)).toEqual(expected.map(item=>item.id));
    for(const raw of reference.mmo){
      const weapon=weapons.find(item=>item.id===raw.id)!;
      expect(weapon.weaponId).toBe(raw.weapon_id);
      expect(weapon.name.en).toBe(raw.weapon_name_en);
      expect(weapon.simName.en).toBe(raw.name_en);
      expect(weapon.imitationId).toBe(raw.imitation_id);
      expect(weapon.season).toBe(raw.season);
      expect(weapon.icon).toBe(raw.weapon_icon||raw.icon||raw.avatar);
    }
    expect(weapons[0]?.id).toBe('salidy-mmo');
    expect(weapons.findIndex(item=>item.id==='aige-mmo')).toBeGreaterThan(40);
  });
});
