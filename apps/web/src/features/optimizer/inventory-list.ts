import {normalizeSearchText} from '@tof-hub/contracts';
import {statLabel} from '../build/presentation';
import type {BuildCatalog} from '../build/types';
import type {RankedPiece} from './model';

export type InventorySortKey='best'|'now'|'forecast'|'prv';

/** Built once per inventory/catalog, independently of query, slot, sort and page language. */
export function inventorySearchIndex(entries:readonly RankedPiece[],catalog:BuildCatalog) {
  const slots=new Map(catalog.gear.map(gear=>[gear.id,gear]));
  return new Map(entries.map(entry=>{
    const gear=entry.piece.gear,slot=slots.get(gear.id);
    const types=[...new Set([...gear.rows,...gear.augments].map(row=>row.type))];
    return [entry.piece.key,normalizeSearchText([gear.id,slot?.name.en,slot?.name.ru,...types.flatMap(type=>[statLabel(type,'en'),statLabel(type,'ru')])].join(' '))];
  }));
}

/** Decorate once so the comparator reads precomputed values. */
export function sortInventory(entries:readonly RankedPiece[],sort:string) {
  const [key,direction]=sort.split('-') as [InventorySortKey,string|undefined];
  if(key==='best'&&!direction)return entries;
  const scored=entries.map(entry=>({entry,value:({best:entry.gain,now:entry.now?.gain,forecast:entry.forecast?.gain,prv:entry.nowPrv}[key])??null}));
  scored.sort((a,b)=>{const x=a.value,y=b.value;return x===null?(y===null?0:1):y===null?-1:direction==='asc'?x-y:y-x;});
  return scored.map(item=>item.entry);
}
