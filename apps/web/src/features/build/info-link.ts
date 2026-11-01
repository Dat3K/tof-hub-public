/** Routes accepted by the existing Info catalogs' entity deep-link handlers. */
export function buildInfoHref(kind:'weapon'|'matrix'|'relic'|'pet'|'module'|'cosmetic',id:string):string {
  const value=encodeURIComponent(id);
  switch(kind){
    case 'weapon':return `/info/simulacra?char=${value}`;
    case 'matrix':return `/info/matrices#${value}`;
    case 'relic':return `/info/relics?server=gacha&relic=${value}`;
    case 'pet':return `/info/pets?pet=${value}`;
    case 'module':return `/info/pets?category=modules#${value}`;
    case 'cosmetic':return `/info/cosmetics?id=${value}`;
  }
}
