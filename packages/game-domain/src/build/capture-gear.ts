/** One gear entry of a capture (`BuildCapture.gear`): game item id, enhancement, stars and raw attribute rows. */
export interface CaptureGearEntry {itemId:string;enhancement:number;stars:number|null;stats:{attribute:string;value:number;tag:string|null}[];
  /** Random stats before Titan from the matched inventory record, when the capture found one. */
  beforeTitan?:{attribute:string;value:number}[]|null;
  /** Titan clicks (Augmentation Count) of the matched inventory record. */
  augmentCount?:number|null}
export interface CaptureGearMapping {
  /** Generated capture card map: lower-case game item id → build slot and gear stage. */
  items:Record<string,{id:string;stage:'normal'|'augmented'|'titan'}>;
  /** Raw attribute name → build stat label (generated CS rules, inverted). */
  labels:Record<string,string>;
  /** Titan effect ids from the generated reference. */
  rareIds:string[];
  rowsPerItem:number;augmentsPerItem:number;
  /** Duel (PvP) armour ids, lower case (generated capture card map `duelGear`): reported apart, never mapped. */
  duel?:string[];
}
export interface MappedCaptureGear {
  slot:string;itemId:string;stage:'normal'|'augmented'|'titan';enhancement:number;stars:number;
  rows:{type:string;value:number;beforeTitan:number|null}[];augments:{type:string;value:number}[];rareId:string;rareLevel:number;
  /** Titan clicks (Augmentation Count); null when the capture did not read it. */
  augmentCount:number|null;
}

/**
 * Captured gear in build-card terms. Only exact generated identities are used; anything else is reported in
 * `unresolved` and left out. A row's value before Titan comes from the same attribute of `beforeTitan`; for an item
 * without Titan it is the current value. Unmatched rows keep null.
 */
export function mapCaptureGear(entries:CaptureGearEntry[],mapping:CaptureGearMapping) {
  const gear:MappedCaptureGear[]=[],unresolved:string[]=[],duel:string[]=[];
  for(const entry of entries) {
    // Duel armour has fixed stats and works only in duels: not a piece of the PvE build, and not "unknown" either.
    if(mapping.duel?.includes(entry.itemId.toLowerCase())){duel.push(entry.itemId);continue;}
    const itemKey=entry.itemId.toLowerCase();
    const match=Object.hasOwn(mapping.items,itemKey)?mapping.items[itemKey]:undefined;
    if(!match){unresolved.push('gear: '+entry.itemId);continue;}
    const item:MappedCaptureGear={slot:match.id,itemId:entry.itemId,stage:match.stage,enhancement:entry.enhancement,stars:entry.stars??0,rows:[],augments:[],rareId:'',rareLevel:0,
      augmentCount:entry.augmentCount??null};
    const before=[...(entry.beforeTitan??[])];
    for(const stat of entry.stats) {
      if(stat.attribute.startsWith('uncommon_')) {
        const id=stat.tag?.replace(/_Lv\d+$/,'');
        if(id&&mapping.rareIds.includes(id)){item.rareId=id;item.rareLevel=stat.value;}else unresolved.push('rare: '+stat.tag);
        continue;
      }
      const label=Object.hasOwn(mapping.labels,stat.attribute)?mapping.labels[stat.attribute]:undefined;
      if(!label){unresolved.push('stat: '+stat.attribute);continue;}
      if(stat.tag==='EquipmentTupo'){if(item.augments.length<mapping.augmentsPerItem)item.augments.push({type:label,value:stat.value});}
      else if(item.rows.length<mapping.rowsPerItem) {
        const index=before.findIndex(row=>row.attribute===stat.attribute);
        // Inventory values are float32; profile values use 6 decimals.
        const original=index<0?null:Number(before.splice(index,1)[0]!.value.toFixed(6));
        item.rows.push({type:label,value:stat.value,beforeTitan:original??(match.stage==='normal'?stat.value:null)});
      }
    }
    gear.push(item);
  }
  return {gear,unresolved,duel};
}
