export interface CatalogReleaseItem {
  id: string; quality?: string; rarity?: string; property?: string;
  matrix_suit_num?: number; matrixSuitNum?: number; matrix_suit_id?: string; matrixSuitId?: string;
}

interface SimulacraReleaseItem {
  id:string;season?:unknown;season_badge?:unknown;season_tag?:unknown;
  imitation_id?:string|null;imitationId?:string;
  matrix_suit_num?:number|null;matrixSuitNum?:number;
  matrix_suit_id?:string|null;matrixSuitId?:string|null;
}

/** The Info Simulacra order, shared by Comp's MMO weapons and traits. */
export function compareSimulacraRelease(a:SimulacraReleaseItem,b:SimulacraReleaseItem,mmo:boolean,ascending=false):number {
  const season=(item:SimulacraReleaseItem)=>{
    if(typeof item.season==='number'&&item.season>0)return item.season;
    const value=parseInt(String(item.season||item.season_badge||item.season_tag||'').replace(/\D+/g,''),10);
    return Number.isNaN(value)?1:value;
  };
  const suit=(item:SimulacraReleaseItem)=>{
    const number=item.matrix_suit_num??item.matrixSuitNum;
    if(typeof number==='number'&&!Number.isNaN(number))return number;
    return parseInt(String(item.matrix_suit_id||item.matrixSuitId||'').replace(/\D/g,''),10)||0;
  };
  const imitation=(item:SimulacraReleaseItem)=>parseInt(String(item.imitation_id||item.imitationId||item.id).match(/\d+/)?.[0]||'0',10);
  const direction=ascending?1:-1;
  return direction*((mmo?season(a)-season(b):0)||suit(a)-suit(b)||imitation(a)-imitation(b))||a.id.localeCompare(b.id);
}

/**
 * Compares two relics by quality (SSR -> SR -> R -> N) then descending numeric ID.
 */
export function compareRelics(a: CatalogReleaseItem, b: CatalogReleaseItem): number {
  const qOrder: Record<string, number> = { SSR: 1, SR: 2, R: 3, N: 4 };
  const qDiff = (qOrder[a.quality || ""] || 99) - (qOrder[b.quality || ""] || 99);
  if (qDiff !== 0) return qDiff;
  const numA = parseInt(String(a.id || '').replace(/\D/g, ''), 10) || 0;
  const numB = parseInt(String(b.id || '').replace(/\D/g, ''), 10) || 0;
  if (numA !== numB) return numB - numA;
  return (a.id || '').localeCompare(b.id || '');
}

/**
 * Resolves suit number from matrixSuitId or matrix_suit_num for newest sorting.
 */
export function getSuitNumber(item: CatalogReleaseItem | null | undefined): number {
  if (!item) return 0;
  if (typeof item.matrix_suit_num === 'number') return item.matrix_suit_num;
  if (typeof item.matrixSuitNum === 'number') return item.matrixSuitNum;
  const suitId = item.matrix_suit_id || item.matrixSuitId || (/^suit_/i.test(String(item.id || '')) ? item.id : null);
  if (suitId) {
    const m = String(suitId).match(/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return 0;
}

/**
 * Compares two comp items (weapons, simulacra, matrices, relics) by newest release first.
 */
export function compareCompItemsByNewest(a: CatalogReleaseItem, b: CatalogReleaseItem): number {
  const isRelicA = Boolean(a && ((a.id && String(a.id).startsWith('artifact_')) || a.property));
  const isRelicB = Boolean(b && ((b.id && String(b.id).startsWith('artifact_')) || b.property));
  if (isRelicA || isRelicB) {
    return compareRelics(a, b);
  }

  const rA = String(a.rarity || a.quality || 'SSR').toUpperCase();
  const rB = String(b.rarity || b.quality || 'SSR').toUpperCase();
  const isSsrA = rA === 'SSR';
  const isSsrB = rB === 'SSR';
  if (isSsrA && !isSsrB) return -1;
  if (!isSsrA && isSsrB) return 1;

  const numA = getSuitNumber(a);
  const numB = getSuitNumber(b);
  if (numB !== numA) return numB - numA;

  return (a.id || '').localeCompare(b.id || '');
}

