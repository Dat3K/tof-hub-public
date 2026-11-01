import fs from 'node:fs';
import path from 'node:path';
import {elementTracks,type CaptureGearMapping,type GearScoreReference} from '@tof-hub/game-domain';

/** Generated build catalog fields the server needs to score gear and map captures (apps/web/public/game-data). */
export interface ScoringCatalog {
  reference:GearScoreReference;
  allowedStats:Record<string,string[]>;
  tracks:string[][];
  captureGear:CaptureGearMapping;
}

interface BuildPageJson {
  reference:GearScoreReference&{limits:{maxNumOfAugmentStats:number};titanRare:{items:{id:string}[]}};
  gear:{id:string;allowedStats:string[]}[];
  elementIcons:Record<string,unknown>;
  weapons:{elements:string[];selectableElements?:{elements:string[]}[]}[];
  csRules:{attributes:Record<string,string>};
}

let cached:ScoringCatalog|null|undefined;
export function gameDataDirectory() {
  return process.env.WISH_GAME_DATA_DIR??path.resolve(__dirname,'..','..','..','..','apps','web','public','game-data');
}
export function buildScoringCatalog(page:BuildPageJson,cardMap:{gear:CaptureGearMapping['items'];duelGear?:string[]}):ScoringCatalog {
  return {
    reference:page.reference,
    allowedStats:Object.fromEntries(page.gear.map(item=>[item.id,item.allowedStats])),
    tracks:elementTracks(Object.keys(page.elementIcons),page.weapons),
    captureGear:{items:cardMap.gear,labels:Object.fromEntries(Object.entries(page.csRules.attributes).map(([label,attribute])=>[attribute,label])),
      rareIds:page.reference.titanRare.items.map(item=>item.id),rowsPerItem:page.reference.limits.maxNumOfRandomStats,
      augmentsPerItem:page.reference.limits.maxNumOfAugmentStats,duel:cardMap.duelGear??[]},
  };
}
/** Read once; null when the generated files are missing (scores cannot be computed then). */
export function loadScoringCatalog():ScoringCatalog|null {
  if(cached!==undefined)return cached;
  const directory=gameDataDirectory(),page=path.join(directory,'build-page.json'),map=path.join(directory,'capture-card-map.json');
  cached=fs.existsSync(page)&&fs.existsSync(map)?buildScoringCatalog(JSON.parse(fs.readFileSync(page,'utf8')),JSON.parse(fs.readFileSync(map,'utf8'))):null;
  return cached;
}
