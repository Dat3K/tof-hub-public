import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {normalizeSearchText} from '@tof-hub/contracts';
import type {BuildCatalog} from '../build/types';
import {rankInventory} from './model';
import {inventorySearchIndex,sortInventory} from './inventory-list';

const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'../build/__fixtures__/catalog.json'),'utf8')) as BuildCatalog;
const [entry]=rankInventory([{key:'test',gear:catalog.demoDraft.gear[0]!}],catalog.demoDraft,catalog,98);

describe('inventory search and ordering',()=>{
  it('indexes both languages and tolerates invisible/compatibility characters in a query',()=>{
    const index=inventorySearchIndex([entry!],catalog),text=index.get('test')!;
    const slot=catalog.gear.find(gear=>gear.id===entry!.piece.gear.id)!;
    expect(text).toContain(normalizeSearchText(slot.name.en));
    expect(text).toContain(normalizeSearchText(slot.name.ru));
    expect(text).toContain(normalizeSearchText('Ｈｅｌ\u200bｍｅｔ'));
  });
  it('keeps unknown PRV values last in both directions and leaves the default order untouched',()=>{
    const entries=Array.from({length:500},(_,i)=>({...entry!,piece:{...entry!.piece,key:String(i)},nowPrv:i===499?null:i}));
    const sorted=sortInventory(entries,'prv');
    expect(sorted[0]!.piece.key).toBe('498');expect(sorted.at(-1)!.piece.key).toBe('499');
    expect(entries[0]!.piece.key).toBe('0');
    const ascending=sortInventory(entries,'prv-asc');
    expect(ascending[0]!.piece.key).toBe('0');expect(ascending.at(-1)!.piece.key).toBe('499');
    expect(sortInventory(entries,'best')).toBe(entries);
  });
});
