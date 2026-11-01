export {MATRIX_DISPLAY_ORDER,matrixSetPieces,attackPercentContributions,matrixAttackPercentSources,type AttackPercentContribution,type MatrixAttackPercentSource} from './matrix-attack';
export {weaponStatBonuses,matrixStatBonuses,matrixDisplayValue,enhancementShotBonuses} from './loadout-stats';
import {applyConsumableStats} from './consumable-stats';
import {reconcileWeaponUpgrade} from './weapon-upgrades';
import {characterTitleCode} from './character-title';
import {activeWeaponResonances,buildWeaponElements,mainWeaponResonance} from './weapon-resonances';
import {supportAttack} from './support-attack';
import {CAPTURE_ELEMENT_ATTRIBUTES} from './capture-attributes';
import {scoreBuildForTrack,scoreGearForTrack,pickBuildRollPath,getBuildRollQuality,getBuildAugmentPools,enumerateBuildRolls,getBuildCriticalRates,getBuildStatMaximum,getBuildRollValue,getBuildCurrentValue,getBuildRVWeight,getBuildCritContributionScale,getBuildRatedFamilies,getBuildRatedWeight,type BuildRVRole,getBuildTitanProjection,getBuildTitanPrimaries,pairStatChoice,restrictPairStats} from '@tof-hub/game-domain';
import type {BuildCatalog, BuildDraft, GearDraft} from './types';
import {AccountCountersSchema,BuildCaptureSchema} from '@tof-hub/contracts';
import {estimatedResistancePercent,gearPercentTotal,standardRVProfile,personalRVProfile,type RVRemovedStats} from './rv-profile';

export const DRAFT_KEY = 'tof-build-draft-v1';
// In-game layout read left-to-right, top-to-bottom: Emotion, Mind / Belief, Memory (slot indices of matrixStats.slots).

export function enhanceAllGear(draft:BuildDraft,catalog:BuildCatalog,options:{enhancement:number|null;stars:number|null;stage:''|'normal'|'augmented'|'titan'}) {
  draft.gear.forEach(gear=>{
    const meta=catalog.gear.find(item=>item.id===gear.id)!;
    if(options.stage){gear.titan=options.stage==='titan';gear.augmented=options.stage!=='normal';}
    const stage=gear.titan?'titan':gear.augmented?'augmented':'normal';
    const maximum=meta.baseStats[stage].at(-1)!.level;
    gear.enhancement=Math.min(maximum,Math.max(0,Math.trunc(options.enhancement??gear.enhancement)));
    if(options.stage&&options.stage!=='normal')gear.stars=catalog.reference.limits.maxNumOfRandomStatRolls;
    else if(options.stars!==null)gear.stars=Math.min(catalog.reference.limits.maxNumOfRandomStatRolls,Math.max(0,Math.trunc(options.stars)));
  });
}
export function petStatBonuses(draft:BuildDraft,catalog:BuildCatalog) {
  const pet=catalog.pets.find(p=>p.id===draft.pet.id);
  const stats=pet?.stats?.levels.find(s=>s.level===draft.pet.level);
  if(!stats)return null;
  const rule=pet?.stats?.inheritance.find(s=>s.stars===draft.pet.stars);
  const captured=draft.captureSource?.kind==='file'?draft.captureSource.capture.pet:null;
  const finalAttack:Record<string,string>={Frost:'IceAtk',Volt:'ThunderAtk',Flame:'FireAtk',Physical:'PhysicalAttack',Altered:'SuperpowerAtk'};
  const attacks=rule?.elements.map(element=>captured?draft.captureSource!.capture.combat.attack[finalAttack[element]]:
    draft.combat.elements.find(e=>e.id===element)?.attack);
  const averageAttack=attacks?.length&&attacks.every(value=>typeof value==='number'&&Number.isFinite(value))?attacks.reduce<number>((sum,value)=>sum+value!,0)/attacks.length:null;
  const inheritedAttack=captured?.inheritedAttack??(rule&&averageAttack!==null?averageAttack*rule.rate:null);
  const critChance=getBuildCriticalRates(stats.crit,catalog.reference.critFormula.denominators[draft.enemyLevel],0).base;
  return {...stats,attack:captured?.baseAttack??stats.attack,crit:captured?.baseCrit??stats.crit,
    critChance,inheritanceRate:rule?.rate??null,inheritanceElements:rule?.elements??[],averageAttack,inheritedAttack,totalAttack:inheritedAttack===null?null:(captured?.baseAttack??stats.attack)+inheritedAttack};
}
export function additionalDamageSources(draft:BuildDraft,catalog:BuildCatalog) {
  const sources:{kind:'synthesis'|'computing'|'support';id:string;name:BuildCatalog['weapons'][number]['name'];rank:string;value:number;elements:string[];conditional:boolean}[]=[];
  const elements=(scope:'all'|string[])=>scope==='all'?Object.keys(catalog.elementIcons):scope;
  for(const chosen of draft.synthesis) {
    const item=catalog.weapons.find(w=>w.id===chosen.id);
    const effects=(catalog.synthesis.effects[chosen.id]??[]).filter(e=>e.stage<=chosen.stage&&e.damageScope&&e.damageValue);
    if(item&&effects.length)sources.push({kind:'synthesis',id:chosen.id,name:item.name,rank:`S${chosen.stage}`,value:effects.reduce((total,e)=>total+e.damageValue!,0),elements:[...new Set(effects.flatMap(e=>elements(e.damageScope!)))],conditional:false});
  }
  for(const chosen of draft.computing) {
    const item=catalog.computing.find(n=>n.id===chosen.id);
    for(const effect of item?.effects??[]) {
      const value=effect.levels.find(l=>l.level===chosen.level)?.value??0;
      if(effect.damageScope&&value>0)sources.push({kind:'computing',id:chosen.id,name:{en:item!.label_en,ru:item!.label_ru},rank:`Lv. ${chosen.level}`,value,elements:elements(effect.damageScope),conditional:false});
    }
  }
  for(const chosen of draft.support) {
    const item=catalog.support.modules.find(m=>m.id===chosen.id);
    const value=item?.levels.find(l=>l.level===chosen.level)?.value??0;
    if(item?.damageScope&&value>0)sources.push({kind:'support',id:chosen.id,name:{en:item.name_en,ru:item.name_ru},rank:`Lv. ${chosen.level}`,value,elements:elements(item.damageScope),conditional:!!item.conditional});
  }
  // Content modes are alternatives. Pick one strongest applicable bonus per
  // element; catalog/draft order resolves ties deterministically.
  return sources.map(source=>source.conditional?{...source,elements:source.elements.filter(element=>sources.filter(s=>s.conditional&&s.elements.includes(element)).reduce((best,s)=>s.value>best.value?s:best)===source)}:source).filter(source=>source.elements.length);
}
/** Known elemental DMG%: gear, account relic A4, synthesis, Supercomputing and applicable Space Support. */
export function elementDamagePercent(draft:BuildDraft,catalog:BuildCatalog,element:string) {
  // Altered ATK mirrors the strongest element; it has no DMG% of its own.
  if(element==='Altered')return 0;
  let total=0;
  total+=gearElementStat(draft,catalog,element,'Damage %');
  total+=draft.relicDamage?.[element]??0;
  total+=additionalDamageSources(draft,catalog).filter(source=>source.elements.includes(element)).reduce((sum,source)=>sum+source.value,0);
  return total;
}
export function weaponMarkBonus(draft:BuildDraft,catalog:BuildCatalog,weapon:BuildDraft['weapons'][number]) {
  const owner=draft.weapons.find(w=>catalog.weapons.find(item=>item.id===w.id)?.weaponId===catalog.weaponMark.weaponId);
  const rules=catalog.weaponMark.rules;
  const all=!!owner&&owner.stars>=rules.allMarksMinAdvancement;
  const id=catalog.weapons.find(item=>item.id===weapon.id)?.weaponId;
  const enabled=!!id&&(all||draft.markWeaponId===id);
  const base=owner?rules.inBuildBase:rules.outsideBase;
  const advancements=owner?owner.stars:weapon.stars;
  return {enabled,all,base,advancements,total:base+advancements*rules.perAdvancement,inBuild:!!owner};
}
/** Selection defaults are shared by the card picker and manual editor. */
export function selectBuildWeapon(draft:BuildDraft,index:number,id:string,catalog:BuildCatalog) {
  delete draft.weapons[index].capturedId;
  delete draft.weapons[index].element;delete draft.weapons[index].skills;delete draft.weapons[index].mode;
  draft.weapons[index].id=id;draft.weapons[index].level=id?catalog.defaultLevels?.weapon??0:0;
  if(id)reconcileWeaponUpgrade(draft.weapons[index],catalog);else delete draft.weapons[index].upgradeLevel;
}
export function selectBuildMatrix(draft:BuildDraft,weapon:number,index:number,id:string,catalog:BuildCatalog) {
  delete draft.weapons[weapon].matrices[index].capturedId;
  draft.weapons[weapon].matrices[index].id=id;draft.weapons[weapon].matrices[index].level=id?catalog.defaultLevels?.matrix??0:0;
}
export function selectBuildPet(draft:BuildDraft,id:string,catalog:BuildCatalog) {
  const pet=catalog.pets.find(item=>item.id===id);
  draft.pet={id,stars:pet?.maxStars??0,level:pet?catalog.defaultLevels?.pet??0:0,modules:['','','',''],moduleLevels:[0,0,0,0]};
}
export function petModuleBudget(draft:BuildDraft,catalog:BuildCatalog,exclude=-1) {
  const pet=catalog.pets.find(p=>p.id===draft.pet.id);
  const capacity=pet?.moduleCapacity?.find(s=>s.stars===draft.pet.stars);
  const used=draft.pet.modules.reduce((sum,id,i)=>{
    if(i===exclude)return sum;
    const module=pet?.modules.find(m=>m.id===id);
    const level=module?.levels.find(l=>l.level===draft.pet.moduleLevels?.[i])??module?.levels[0];
    return sum+(level?.load??0);
  },0);
  return {used,max:capacity?.load??0,slots:capacity?.slots??0};
}
export function petModuleOptions(draft:BuildDraft,catalog:BuildCatalog,index:number) {
  const total=petModuleBudget(draft,catalog);
  const budget=petModuleBudget(draft,catalog,index);
  if(total.used>=total.max||index>=budget.slots)return [];
  return (catalog.pets.find(p=>p.id===draft.pet.id)?.modules??[]).filter(module=>{
    const level=module.levels.reduce<typeof module.levels[number]|undefined>((best,l)=>!best||l.level>best.level?l:best,undefined);
    return level?.load!==null&&level?.load!==undefined&&budget.used+level.load<=budget.max;
  });
}
export function petModuleRanks(draft:BuildDraft,catalog:BuildCatalog,index:number) {
  const budget=petModuleBudget(draft,catalog,index);
  const module=catalog.pets.find(p=>p.id===draft.pet.id)?.modules.find(m=>m.id===draft.pet.modules[index]);
  return index<budget.slots?(module?.levels??[]).filter(l=>l.load!==null&&budget.used+l.load<=budget.max):[];
}
export function selectBuildPetModule(draft:BuildDraft,index:number,id:string,catalog:BuildCatalog) {
  const module=petModuleOptions(draft,catalog,index).find(m=>m.id===id);
  if(id&&!module)return;
  draft.pet.modules[index]=id;draft.pet.moduleLevels??=[0,0,0,0];draft.pet.moduleLevels[index]=Math.max(0,...(module?.levels.map(level=>level.level)??[]));
}
/** Changing stars changes slots and Load; release modules that no longer fit, last slot first. */
export function setBuildPetStars(draft:BuildDraft,stars:number,catalog:BuildCatalog) {
  draft.pet.stars=stars;draft.pet.moduleLevels??=[0,0,0,0];
  const release=(i:number)=>{draft.pet.modules[i]='';draft.pet.moduleLevels![i]=0;};
  const {slots,max}=petModuleBudget(draft,catalog);
  draft.pet.modules.forEach((id,i)=>{if(id&&i>=slots)release(i);});
  for(let i=draft.pet.modules.length-1;i>=0&&petModuleBudget(draft,catalog).used>max;i--)if(draft.pet.modules[i])release(i);
}

export function emptyDraft(catalog: BuildCatalog): BuildDraft {
  return {
    consumables:catalog.consumables.map(()=>''),
    version: 1, profile: {name:'',server:'',uid:'',roleId:'',level:0,title:'',signature:'',cs:0,apexCs:0,suppressorId:'',crew:'',characterTitle:'',avatarId:'',avatarFrameId:'',role:''},
    art:{id:'',zoom:1,x:50,y:49,offsetX:0,offsetY:0}, enemyLevel:0,rv:{element:'',includeCrit:true,weaponId:'',mode:'grv'},
    combat:{hpPercent:null,hp:0,endurance:0,crit:0,additionalCritRate:0,critDamage:.5,elements:Object.keys(catalog.elementIcons).map(id=>({id,attack:0,attackPercent:0,damage:0,resistance:0,resistancePercent:null}))},
    weapons:Array.from({length:3},()=>({id:'',stars:0,level:0,matrices:Array.from({length:4},()=>({id:'',stars:0,level:0}))})), markWeaponId:'',
    gear:catalog.gear.map(g=>({id:g.id,equipped:false,enhancement:0,stars:0,titan:false,augmented:false,
      rows:Array.from({length:catalog.reference.limits.maxNumOfRandomStats},()=>({type:'',value:0,beforeTitan:null})),
      augments:Array.from({length:catalog.reference.limits.maxNumOfAugmentStats},()=>({type:'',value:0})),base:Array.from({length:2},()=>({label:'',value:0})),rareId:'',rareLevel:0,augmentCount:null})),
    traitId:'',traitPoints:0,synthesis:catalog.synthesis.ids.map(id=>({id,stage:0})),relics:Array.from({length:2},()=>({id:'',stars:0})),
    pet:{id:'',stars:0,level:0,modules:['','','',''],moduleLevels:[0,0,0,0]},computing:catalog.computing.map(n=>({id:n.id,level:0})),support:catalog.support.modules.map(m=>({id:m.id,level:0})),
  };
}

/** Rebuild only known fields. Stored drafts cannot supply media URLs. */
export function restoreDraft(value: unknown, catalog: BuildCatalog): BuildDraft | null {
  function read(input: unknown, template: unknown, key=''): unknown {
    if(key==='consumables'&&input===undefined)return template;
    if(key==='moduleLevels'&&input===undefined)return template;
    if(key==='augmented'&&input===undefined)return false;
    // Titan clicks (Augmentation Count): only captures of the own profile have it.
    if(key==='augmentCount'&&input===undefined)return null;
    if(key==='rv'&&input===undefined)return template;
    if(key==='mode'&&input===undefined)return 'grv';
    if(['suppressorId','crew','characterTitle','avatarFrameId','roleId'].includes(key)&&input===undefined)return '';
    // Optional label override; absent means "follow the resonance".
    if(key==='role'&&input===undefined)return undefined;
    if(['endurance','attackPercent'].includes(key)&&input===undefined)return 0;
    if(['offsetX','offsetY'].includes(key)) {
      if(input===undefined)return 0;
      if(typeof input==='number'&&Number.isFinite(input)&&Math.abs(input)<=1e12)return input;
      throw new Error('Invalid artwork offset');
    }
    if(key==='weaponId'&&input===undefined)return '';
    if((key==='cs'||key==='apexCs')&&input===undefined)return null;
    if((key==='cs'||key==='apexCs')&&input===null)return null;
    if((key==='hpPercent'||key==='resistancePercent')&&input===undefined)return null;
    // Preserve compatibility with drafts that previously left resistance empty.
    if(key==='resistance' && input===null)return null;
    if (template===null) {
      if(input===null || (typeof input==='number' && Number.isFinite(input) && input>=0 && input<=1e12))return input;
      throw new Error('Invalid nullable number');
    }
    if(Array.isArray(template)) {
      if(!Array.isArray(input) || input.length!==template.length)throw new Error('Invalid slots');
      return template.map((t,i)=>read(input[i],t));
    }
    if(typeof template==='object') {
      if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('Invalid object');
      const record=input as Record<string,unknown>;
      return Object.fromEntries(Object.entries(template as Record<string,unknown>).map(([k,t])=>[k,read(record[k],t,k)]));
    }
    if(typeof input!==typeof template)throw new Error('Invalid type');
    if(typeof input==='string' && input.length>500)throw new Error('Text too long');
    if(typeof input==='number' && (!Number.isFinite(input) || input<0 || input>1e12))throw new Error('Invalid number');
    if(key==='version' && input!==1)throw new Error('Unsupported version');
    return input;
  }
  try {
    const d=read(value,emptyDraft(catalog)) as BuildDraft;
    // Unknown capture identities are display text only, never catalog keys or asset URLs.
    for(const [index,weapon] of ((value as BuildDraft).weapons??[]).entries()) {
      for(const [source,target] of [[weapon,d.weapons[index]],...weapon.matrices.map((matrix,slot)=>[matrix,d.weapons[index].matrices[slot]])] as const) {
        if(source.capturedId===undefined)continue;
        if(typeof source.capturedId!=='string'||source.capturedId.length>160)return null;
        target.capturedId=source.capturedId;
      }
    }
    const damageSource=(value as BuildDraft).combat?.damageSource;
    if(damageSource!==undefined){if(damageSource!=='totals')return null;d.combat.damageSource=damageSource;}
    const applied=(value as BuildDraft).combat?.consumableStatsApplied;
    if(applied!==undefined){
      if(!applied||typeof applied!=='object'||Array.isArray(applied))return null;
      const fields=['attack','hp','crit','resistance','combatScore','baseCS','rawCS'] as const;
      if(fields.some(key=>{
        const amount=applied[key],nullable=key==='combatScore'||key==='baseCS'||key==='rawCS';
        return amount===null?!nullable:typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>1e12;
      }))return null;
      if(!applied.attackPercent||typeof applied.attackPercent!=='object'||Array.isArray(applied.attackPercent)||Object.entries(applied.attackPercent).some(([element,value])=>!catalog.elementIcons[element]||!Number.isFinite(value)||value<0||value>100))return null;
      d.combat.consumableStatsApplied={...Object.fromEntries(fields.map(key=>[key,applied[key]])),attackPercent:{...applied.attackPercent}} as NonNullable<BuildDraft['combat']['consumableStatsApplied']>;
      for(const key of ['elementAttack','postPercentElementAttack'] as const)if(applied[key]!==undefined){
        const gains=applied[key];
        if(!gains||typeof gains!=='object'||Array.isArray(gains)||Object.entries(gains).some(([element,amount])=>!catalog.elementIcons[element]||!Number.isFinite(amount)||amount<0||amount>1e12))return null;
        d.combat.consumableStatsApplied[key]={...gains};
      }
    }
    const source=(value as BuildDraft).captureSource;
    if(source!==undefined) {
      if(!source||!['file','manual'].includes(source.kind)||!/^\w{64}$/.test(source.digest)||
        !Array.isArray(source.unresolved)||source.unresolved.length>1000||source.unresolved.some(text=>typeof text!=='string'||text.length>1000))return null;
      const capture=BuildCaptureSchema.safeParse(source.capture);if(!capture.success)return null;
      const signature=typeof source.signature==='string'&&/^[A-Za-z0-9_-]{16,1024}$/.test(source.signature)?source.signature:undefined;
      d.captureSource={kind:source.kind,digest:source.digest,...(signature?{signature}:{}),capture:capture.data,unresolved:[...source.unresolved]};
      d.profile.characterTitle=characterTitleCode(d.profile.characterTitle,catalog.titles,capture.data.profile.titleId);
    }
    if((value as BuildDraft).demo===true)d.demo=true;
    // Optional account counters (own captures and the sample): whole numbers or null only.
    const account=(value as BuildDraft).account;
    if(account!==undefined){const parsed=AccountCountersSchema.safeParse(account);if(!parsed.success)return null;d.account=parsed.data;}
    const augmentationSpent=(value as BuildDraft).augmentationSpent;
    if(augmentationSpent!==undefined){
      if(augmentationSpent===null)d.augmentationSpent=null;
      else if(Number.isSafeInteger(augmentationSpent)&&augmentationSpent>=0)d.augmentationSpent=augmentationSpent;
      else return null;
    }
    // Optional captured Supercomputing EXP; the template restore keeps only the empty draft's keys.
    for(const [index,node] of ((value as BuildDraft).computing??[]).entries()) {
      if(node?.progress===undefined||!d.computing[index])continue;
      if(!Number.isInteger(node.progress)||node.progress<0||node.progress>1e6)return null;
      d.computing[index].progress=node.progress;
    }
    const petName=(value as BuildDraft).pet.customName;
    if(petName!==undefined){
      if(typeof petName!=='string'||petName.length>120)return null;
      d.pet.customName=petName.trim();
    }
    const relicDamage=(value as BuildDraft).relicDamage;
    if(relicDamage!==undefined){
      if(!relicDamage||typeof relicDamage!=='object'||Array.isArray(relicDamage))return null;
      d.relicDamage={};
      for(const [element,amount] of Object.entries(relicDamage)){
        if(element==='Altered'||!catalog.elementIcons[element]||(amount!==null&&(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>100)))return null;
        d.relicDamage[element]=amount;
      }
    }
    const relicResistance=(value as BuildDraft).relicResistance;
    if(relicResistance!==undefined){
      if(!relicResistance||typeof relicResistance!=='object'||Array.isArray(relicResistance))return null;
      d.relicResistance={};
      for(const [element,amount] of Object.entries(relicResistance)){
        if(!catalog.elementIcons[element]||(amount!==null&&(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>100)))return null;
        d.relicResistance[element]=amount;
      }
    }
    const expiries=(value as BuildDraft).consumableExpiresAt;
    if(expiries!==undefined){
      if(!expiries||typeof expiries!=='object'||Array.isArray(expiries))return null;
      const shotIds=new Set(catalog.consumables.flatMap(group=>group.items.map(item=>item.id)));
      d.consumableExpiresAt={};
      for(const [id,time] of Object.entries(expiries)){
        if(!shotIds.has(id)||typeof time!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(time)||!Number.isFinite(Date.parse(time)))return null;
        if(new Date(`${time.slice(0,10)}T00:00:00Z`).toISOString().slice(0,10)!==time.slice(0,10))return null;
        d.consumableExpiresAt[id]=new Date(time).toISOString();
      }
    }
    const achievedAt=(value as BuildDraft).profile.apexGsAchievedAt;
    if(achievedAt===null)d.profile.apexGsAchievedAt=null;
    else if(achievedAt!==undefined){
      if(typeof achievedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(achievedAt)||!Number.isFinite(Date.parse(achievedAt)))return null;
      if(new Date(`${achievedAt.slice(0,10)}T00:00:00Z`).toISOString().slice(0,10)!==achievedAt.slice(0,10))return null;
      d.profile.apexGsAchievedAt=new Date(achievedAt).toISOString();
    }
    if(d.rv)d.rv.includeCrit=true;
    if(d.rv?.mode!=='grv'&&d.rv?.mode!=='prv')return null;
    if(d.rv?.element&&!catalog.elementIcons[d.rv.element])return null;
    if(d.rv?.weaponId&&!d.weapons.some(w=>w.id===d.rv!.weaponId))d.rv.weaponId='';
    const updatedAt=(value as Record<string,unknown>).updatedAt;
    if(typeof updatedAt==='string' && /^\d{4}-\d{2}-\d{2}T/.test(updatedAt) && Number.isFinite(Date.parse(updatedAt)))d.updatedAt=new Date(updatedAt).toISOString();
    if([d.profile.level,d.enemyLevel,d.pet.stars,d.pet.level,d.traitPoints,...d.weapons.flatMap(w=>[w.stars,w.level,...w.matrices.flatMap(m=>[m.stars,m.level])]),...d.gear.flatMap(g=>[g.stars,g.enhancement,g.rareLevel]),...d.synthesis.map(s=>s.stage),...d.relics.map(r=>r.stars),...d.computing.map(n=>n.level),...d.support.map(m=>m.level)].some(n=>!Number.isInteger(n)))return null;
    const known=(id:string,items:{id:string}[])=>!id || items.some(i=>i.id===id);
    if(d.consumables?.some((id,i)=>!known(id,catalog.consumables[i].items)))return null;
    if(!known(d.profile.suppressorId||'',catalog.suppressors))return null;
    // A role from another catalog version falls back to the resonance.
    if(d.profile.role&&!catalog.roleResonances.items.some(item=>item.id===d.profile.role))d.profile.role='';
    if(!known(d.profile.avatarId,catalog.avatars)&&catalog.avatarAliases[d.profile.avatarId])d.profile.avatarId=catalog.avatarAliases[d.profile.avatarId];
    if(!known(d.art.id,catalog.artworks)){
      const legacy=catalog.weapons.find(w=>w.id===d.art.id);
      if(!legacy)return null;
      d.art.id=catalog.artworks.find(art=>art.url===legacy.art)?.id||randomLoadingArtwork(catalog);
    }
    if( !known(d.profile.avatarId,catalog.avatars) || !known(d.profile.avatarFrameId||'',catalog.avatarFrames) || !known(d.traitId,catalog.weapons))return null;
    if((d.enemyLevel!==0&&!catalog.reference.critFormula.denominators[d.enemyLevel]) || (d.profile.level!==0&&!catalog.reference.resistanceFormula.constants[d.profile.level]))return null;
    if(d.art.zoom<0.25 || d.art.zoom>3 || d.art.x>100 || d.art.y>100)return null;
    for(const w of d.weapons)if(!known(w.id,catalog.weapons) || w.stars>6 || w.matrices.some(m=>!known(m.id,catalog.matrices)||m.stars>3))return null;
    for(const [index,chosen] of d.weapons.entries()) {
      const original=(value as BuildDraft).weapons[index];
      if(original.upgradeLevel!==undefined){
        if(!Number.isInteger(original.upgradeLevel)||original.upgradeLevel<0||original.upgradeLevel>200)return null;
        chosen.upgradeLevel=original.upgradeLevel;
        reconcileWeaponUpgrade(chosen,catalog);
      }
      if(original.element!==undefined){if(typeof original.element!=='string')return null;chosen.element=original.element;}
      if(original.mode!==undefined){if(typeof original.mode!=='string'||!catalog.weapons.find(w=>w.id===chosen.id)?.selectableModes?.some(option=>option.id===original.mode))return null;chosen.mode=original.mode;}
      if(original.skills!==undefined){if(!Array.isArray(original.skills))return null;chosen.skills=[...original.skills];}
      const weapon=catalog.weapons.find(item=>item.id===chosen.id);
      if(weapon?.elementFromResonance)delete chosen.element;
      else if(chosen.element!==undefined&&(!weapon?.selectableElements?.some(option=>option.id===chosen.element)))return null;
      if(chosen.skills!==undefined&&(!Array.isArray(chosen.skills)||chosen.skills.length!==2||chosen.skills.some(id=>typeof id!=='string'||(id&&!weapon?.selectableSkills?.some(option=>option.id===id)))||(chosen.skills[0]&&chosen.skills[0]===chosen.skills[1])))return null;
    }
    for(const [i,g] of d.gear.entries()) {
      const meta=catalog.gear[i];
      if(g.id!==meta.id || g.stars>catalog.reference.limits.maxNumOfRandomStatRolls || g.rows.some(r=>r.type&&!meta.allowedStats.includes(r.type)) || g.augments.some(r=>r.type&&!catalog.reference.statTypes[r.type]) || (g.rareId&&!meta.rarePool.includes(g.rareId)))return null;
      if(g.rareId && !catalog.reference.titanRare.items.find(r=>r.id===g.rareId)?.levels.includes(g.rareLevel))return null;
    }
    if(d.relics.some(r=>!known(r.id,catalog.relics)||r.stars>5) || !known(d.pet.id,catalog.pets))return null;
    const pet=catalog.pets.find(p=>p.id===d.pet.id);
    if(pet&&!pet.modules.length){d.pet.modules=d.pet.modules.map(()=>'');d.pet.moduleLevels=d.pet.modules.map(()=>0);}
    if(pet && (d.pet.stars>pet.maxStars || d.pet.modules.some(id=>!known(id,pet.modules))))return null;
    if(d.pet.moduleLevels?.some((level,i)=>!Number.isInteger(level)||(level!==0&&!pet?.modules.find(m=>m.id===d.pet.modules[i])?.levels.some(l=>l.level===level))))return null;
    if(d.synthesis.some((s,i)=>s.id!==catalog.synthesis.ids[i] || s.stage>catalog.synthesis.maxStage))return null;
    if(d.computing.some((n,i)=>n.id!==catalog.computing[i].id||n.level>catalog.computing[i].maxLevel||(n.progress!==undefined&&(!Number.isInteger(n.progress)||n.progress<0))) || d.support.some((m,i)=>m.id!==catalog.support.modules[i].id||m.level>catalog.support.modules[i].maxLevel))return null;
    if(d.combat.elements.some((e,i)=>e.id!==Object.keys(catalog.elementIcons)[i]))return null;
    if(d.markWeaponId && !catalog.weapons.some(w=>w.weaponId===d.markWeaponId))return null;
    if(d.support.some(m=>m.level>supportSystem(d,catalog).maxModuleLevel))return null;
    // Repair captures saved with Space Support incorrectly subtracted from the final/base ratio.
    // A manually edited percentage or a temporary-buff-adjusted ratio is left as entered.
    if(d.captureSource?.kind==='file')for(const element of d.combat.elements) {
      const keys=CAPTURE_ELEMENT_ATTRIBUTES[element.id as keyof typeof CAPTURE_ELEMENT_ATTRIBUTES];if(!keys)continue;
      const capture=d.captureSource.capture,base=capture.combat.attackBase[keys[1]],final=capture.combat.attack[keys[0]];
      if(base&&final!==null&&final!==undefined&&element.attackPercent!==undefined&&Math.abs(element.attackPercent-((final-supportAttack(d,catalog,element.id))/base-1))<1e-10)
        element.attackPercent=Math.max(0,final/base-1);
    }
    return d;
  } catch {return null;}
}

export function analyzeGear(gear:GearDraft,catalog:BuildCatalog) {
  if(!gear.equipped)return {combinations:[] as number[][],rolls:gear.rows.map(()=>null as number|null),estimated:gear.rows.map(()=>false)};
  const paths=enumerateBuildRolls(gear.rows,catalog.reference.statTypes,gear.stars,catalog.reference.limits.maxNumOfRandomStatRolls);
  // Several splits can fit: always show the most likely one and mark the rows where the candidates disagree.
  const best=pickBuildRollPath(gear.rows,catalog.reference.statTypes,paths);
  return {combinations:paths,rolls:gear.rows.map((_,i)=>best?best[i]:null),estimated:gear.rows.map((_,i)=>paths.length>1&&paths.some(p=>p[i]!==paths[0][i]))};
}
/**
 * Per random row of an equipped item (pass a backpack item as equipped): the roll count text (`3`, `~3` when
 * several splits fit, `?`) and the roll quality of its pre-Titan value (null when unknown). Build card and Optimizer.
 */
export function gearRollDetails(gear:GearDraft,catalog:BuildCatalog) {
  const {rolls,estimated}=analyzeGear(gear,catalog);
  return gear.rows.map((row,i)=>{
    const bounds=catalog.reference.statTypes[row.type],count=rolls[i];
    return {count:count===null||count===undefined?'?':`${estimated[i]?'~':''}${count}`,
      quality:bounds?getBuildRollQuality(row.beforeTitan===null?null:row.beforeTitan-bounds.randomStatDefaultValue,count??null,bounds):null};
  });
}
export interface AugmentationTotal {total:number;equipped:number;backpack:number;equippedPieces:number;backpackPieces:number;unknown:number;backpackKnown:boolean}
/**
 * Total Titan clicks (Augmentation Count) spent on all of the user's gear: the twelve equipped slots plus every
 * backpack piece, including pieces no ranking would pick. Null counts are unknown, never zero: they are left out of
 * the sum and reported in `unknown`. `backpack` is absent when the file has no backpack inventory.
 */
export function totalAugmentationSpent(draft:BuildDraft,backpack?:Pick<GearDraft,'augmentCount'>[]):AugmentationTotal {
  const sum=(pieces:Pick<GearDraft,'augmentCount'>[])=>{
    let value=0,known=0;
    for(const piece of pieces) {
      const count=piece.augmentCount;
      if(typeof count==='number'&&Number.isFinite(count)&&count>=0){value+=count;known++;}
    }
    return {value,known,unknown:pieces.length-known};
  };
  const worn=sum(draft.gear.filter(gear=>gear.equipped));
  const pack=backpack?sum(backpack):{value:0,known:0,unknown:0};
  return {total:worn.value+pack.value,equipped:worn.value,backpack:pack.value,
    equippedPieces:worn.known,backpackPieces:pack.known,unknown:worn.unknown+pack.unknown,backpackKnown:backpack!==undefined};
}
/** Prefer the imported account total; explicit null means the full count is unknown. */
export function augmentationTotalValue(draft:BuildDraft,backpack?:Pick<GearDraft,'augmentCount'>[]){
  return draft.augmentationSpent!==undefined?draft.augmentationSpent:totalAugmentationSpent(draft,backpack).total;
}
export const statMaximum=getBuildStatMaximum;
/** Union of possible primary pools when pre-Titan history is incomplete. */
export function gearAugmentOptions(gear:GearDraft,catalog:BuildCatalog,index:number) {
  const primaries=getBuildTitanPrimaries(gear.rows,catalog.reference.statTypes);
  const candidates=primaries.length?primaries:gear.rows.map((_,i)=>i);
  return [...new Set(candidates.flatMap(primary=>{
    const pools=getBuildAugmentPools(gear.rows,catalog.reference.titanGrowth,primary);
    return pools.priority.concat(pools.fallback);
  }))].filter(type=>!gear.augments.some((a,i)=>i!==index&&a.type===type));
}
/**
 * Ceiling of a piece that has not been through Titan: its own roll count at 100% roll quality
 * (default + rolls × max roll). Unknown roll counts have no ceiling. Added stats do not exist yet.
 */
export function normalMaximums(gear:GearDraft,catalog:BuildCatalog) {
  const {rolls}=analyzeGear(gear,catalog);
  return {random:gear.rows.map((row,i)=>{
    const bounds=catalog.reference.statTypes[row.type],count=rolls[i];
    return bounds&&count!==null&&count!==undefined&&count>0?bounds.randomStatDefaultValue+count*bounds.randomStatMaxRollValue:null;
  }),added:gear.augments.map(()=>null)};
}
export function titanMaximums(gear:GearDraft,catalog:BuildCatalog) {
  const valid=gear.stars===catalog.reference.limits.maxNumOfRandomStatRolls&&analyzeGear(gear,catalog).combinations.length>0;
  const primaries=getBuildTitanPrimaries(gear.rows,catalog.reference.statTypes);
  // A captured Titan item also reveals which primary roll could have produced its chosen added stats. Use those
  // observed pool entries to resolve tied primaries (for example ATK % vs DMG %); if the pool data matches none,
  // keep all original candidates and leave genuinely ambiguous maxima unknown.
  const observedAugments=gear.augments.map(augment=>augment.type).filter(Boolean);
  const compatible=observedAugments.length?primaries.filter(primary=>{
    const pools=getBuildAugmentPools(gear.rows,catalog.reference.titanGrowth,primary);
    return observedAugments.every(type=>pools.priority.includes(type)||pools.fallback.includes(type));
  }):[];
  const candidates=compatible.length?compatible:primaries;
  const projections=(candidates.length?candidates:[-1]).map(primary=>getBuildTitanProjection(gear.rows,catalog.reference.statTypes,catalog.reference.titanGrowth,primary));
  const same=(values:(number|null)[])=>valid&&values.every(v=>v!==null&&Math.abs(v-values[0]!)<1e-8)?values[0]:null;
  return {random:gear.rows.map((_,i)=>same(projections.map(p=>p.random[i]))),added:gear.augments.map(a=>same(projections.map(p=>p.added(a.type))))};
}
export function combatRates(draft:BuildDraft,catalog:BuildCatalog) {
  draft=applyConsumableStats(draft,catalog);
  const denominator=catalog.reference.critFormula.denominators[draft.enemyLevel];
  return getBuildCriticalRates(draft.combat.crit,denominator,draft.combat.additionalCritRate);
}

/** Captures contain no DMG% total; keep the combat panel and personal scoring on the same derived loadout. */
export function buildCombatDraft(draft:BuildDraft,catalog:BuildCatalog):BuildDraft {
  draft=applyConsumableStats(draft,catalog);
  return deriveDamagePercentDraft(draft,catalog);
}
/** Materialize DMG% without modifying captured ATK, CS or selected-consumable bookkeeping. */
export function deriveDamagePercentDraft(draft:BuildDraft,catalog:BuildCatalog):BuildDraft {
  return draft.captureSource&&draft.combat.damageSource!=='totals'?{...draft,combat:{...draft.combat,elements:draft.combat.elements.map(element=>({...element,damage:elementDamagePercent(draft,catalog,element.id)}))}}:draft;
}
/** The card role that drives GRV/PRV: Balance is rated as DPS; an empty choice is DPS. */
export function buildRole(draft:BuildDraft):'dps'|'healer'|'tank' {
  const role=draft.profile.role;
  return role==='healer'||role==='tank'?role:'dps';
}
const SUPPORT_WEAPON_ROLES={healer:'benediction',tank:'tank'} as const;
/**
 * Auto element of a healer or tank build: the main element of its newest equipped role weapon.
 * Catalog weapons keep the game's newest-first order, so the lowest catalog index is the latest release.
 */
export function supportRoleElement(draft:BuildDraft,catalog:BuildCatalog):string {
  const role=draft.profile.role||'dps';
  const weaponRole=role&&role in SUPPORT_WEAPON_ROLES?SUPPORT_WEAPON_ROLES[role as keyof typeof SUPPORT_WEAPON_ROLES]:undefined;
  if(!weaponRole)return '';
  const resolved=buildWeaponElements(draft,catalog);
  const newest=draft.weapons.map((chosen,slot)=>({slot,index:catalog.weapons.findIndex(item=>item.id===chosen.id)}))
    .filter(({index})=>index>=0&&catalog.weapons[index]!.role===weaponRole).sort((a,b)=>a.index-b.index)[0];
  return newest?resolved[newest.slot]?.[0]??'':'';
}
export function rollValueElement(draft:BuildDraft,catalog?:BuildCatalog) {
  if(draft.rv?.element)return draft.rv.element;
  const support=catalog?supportRoleElement(draft,catalog):'';
  if(support)return support;
  // The primary active resonance of the newest eligible weapon is the build's main element, Altered included.
  // A duo keeps both resonances for calculations, but its main resonance names Auto instead of the larger ATK.
  if(catalog) {
    const main=mainWeaponResonance(draft,catalog);
    if(main)return main.element;
  }
  // Otherwise compare final ATK (base x ATK%). Altered shows a value at or above the strongest element,
  // so it is never chosen by ATK — only through its own resonance or a manual choice.
  const total=(item:BuildDraft['combat']['elements'][number])=>item.attack*(1+(item.attackPercent??0))+(draft.combat.consumableStatsApplied?.postPercentElementAttack?.[item.id]??0);
  return draft.combat.elements.filter(item=>item.id!=='Altered').reduce<string>((best,item)=>total(item)>(draft.combat.elements.find(e=>e.id===best)?total(draft.combat.elements.find(e=>e.id===best)!):0)?item.id:best,'');
}
export {gearPercentTotal,elementResistanceBase,estimatedResistancePercent} from './rv-profile';
export function rollValueContext(draft:BuildDraft,catalog:BuildCatalog) {
  const selected=rollValueElement(draft,catalog);
  const resolved=buildWeaponElements(draft,catalog);
  const equipped=draft.weapons.flatMap((chosen,index)=>{const weapon=catalog.weapons.find(item=>item.id===chosen.id);return weapon?[{...weapon,elements:resolved[index]}]:[];});
  const weapon=equipped.find(w=>w.id===draft.rv?.weaponId)??equipped.find(w=>w.elements.length===2&&w.elements.includes(selected));
  const elements=weapon?.elements.length===2&&weapon.elements.includes(selected)?weapon.elements:[selected];
  // Altered inherits the final ATK of the strongest element and adds Altered ATK on top: that element's flat ATK and
  // ATK% rate the gear (getBuildRatedFamilies).
  // The card role picks what is rated: DPS damage, healer ATK only, tank resistance (Balance counts as DPS).
  const role=buildRole(draft);
  // A tank rates the selected element's own resistance, so Altered inherits nothing there.
  const inheritFrom=selected==='Altered'&&role!=='tank'?(draft.rv?.mode==='prv'?alteredSource(draft,catalog):alteredGearSource(draft,catalog)):undefined;
  if(inheritFrom)return {element:selected,selected,percentElements:[inheritFrom],weapon,inheritFrom,role};
  // The selected element retains its own non-gear bonuses; the duo shares gear stat sources.
  return {element:selected,selected,percentElements:[selected,...elements.filter(id=>id!==selected)],weapon,inheritFrom,role};
}
/** Gear-only GRV picks one native source for the complete equipped set, shared with persisted ranking. */
export function alteredGearSource(draft:BuildDraft,catalog:BuildCatalog) {
  return scoreBuildForTrack(draft.gear.filter(gear=>gear.equipped),gear=>gear.id,gear=>({rows:gear.rows,
    augments:gear.titan||gear.augmented?gear.augments:[],allowedTypes:catalog.gear.find(slot=>slot.id===gear.id)?.allowedStats??[]}),
    ['Altered'],catalog.reference,buildRole(draft)).inheritFrom??alteredSource(draft,catalog);
}
/** The source Altered copies: highest native displayed base × (1 + ATK%). */
export function alteredSource(draft:BuildDraft,_catalog?:BuildCatalog) {
  const total=(item:BuildDraft['combat']['elements'][number])=>item.attack*(1+(item.attackPercent??0));
  const candidates=draft.combat.elements.filter(item=>item.id!=='Altered');
  const best=candidates.reduce<BuildDraft['combat']['elements'][number]|undefined>((winner,item)=>!winner||total(item)>total(winner)?item:winner,undefined);
  return best&&total(best)>0?best.id:'Frost';
}
/** Stats of one equipped item: base at its enhancement, random rows and Augment/Titan rows. */
export function equippedGearStats(gear:GearDraft,catalog:BuildCatalog) {
  const meta=catalog.gear.find(item=>item.id===gear.id);
  const base=meta?.baseStats[gear.titan?'titan':gear.augmented?'augmented':'normal'].find(entry=>entry.level===gear.enhancement);
  return [...(base?.stats.map(stat=>({type:stat.label,value:stat.value}))??[]),...gear.rows,...(gear.titan||gear.augmented?gear.augments:[])]
    .filter(stat=>Number.isFinite(stat.value));
}
export type PercentKind='Attack %'|'Damage %';
export type ElementStatKind='Attack'|PercentKind;
/** Separate fixed gear progression from random stat values (including their initial values and Titan additions). */
export function gearStatContributions(draft:BuildDraft,catalog:BuildCatalog,types:readonly string[]) {
  let progression=0,rolls=0;
  for(const gear of draft.gear.filter(item=>item.equipped)) {
    progression+=gearBaseStats(gear,catalog).filter(stat=>types.includes(stat.label)).reduce((sum,stat)=>sum+(Number.isFinite(stat.value)?stat.value:0),0);
    rolls+=[...gear.rows,...(gear.titan||gear.augmented?gear.augments:[])].filter(stat=>types.includes(stat.type)).reduce((sum,stat)=>sum+(Number.isFinite(stat.value)?stat.value:0),0);
  }
  return {progression,rolls,total:progression+rolls};
}
/** Gear-only flat ATK (with universal ATK where it applies), ATK% or DMG% of one element. */
export function gearElementStat(draft:BuildDraft,catalog:BuildCatalog,element:string,kind:ElementStatKind,contribution:'total'|'progression'|'rolls'='total') {
  const types=kind==='Attack'?[`${element} Attack`,...(catalog.reference.titanGrowth.universalAttackElements.includes(element)?['Attack']:[])]:[`${element} ${kind}`];
  return gearStatContributions(draft,catalog,types)[contribution];
}
/**
 * Duo-element inheritance covers gear only: every equipped item contributes its higher ATK%/DMG% among the
 * duo elements, while relics, Supercomputing, Space Support and other sources stay on their own element.
 */
export function gearPercentInheritance(draft:BuildDraft,catalog:BuildCatalog,kind:PercentKind) {
  const context=rollValueContext(draft,catalog);
  const elements=context.percentElements;
  const byElement=Object.fromEntries(elements.map(element=>[element,0])) as Record<string,number>;
  const values=elements.map(element=>gearElementStat(draft,catalog,element,kind));
  const inherited=Math.max(0,...values);
  if(inherited>0)byElement[elements[values.indexOf(inherited)]]=inherited;
  return {element:context.element,elements,inherited,byElement};
}
/**
 * In-game "value (inherited)" for a duo element: ATK — the partner's higher ATK; ATK%/DMG% — this element's other
 * sources plus the partner's gear total when that is higher than this element's gear. Null when nothing is inherited.
 */
/** The other element of the selected duo weapon pair, or null outside the pair. */
export function duoPartner(draft:BuildDraft,catalog:BuildCatalog,element:string) {
  const {percentElements}=rollValueContext(draft,catalog);
  return percentElements.length===2&&percentElements.includes(element)?percentElements.find(id=>id!==element)!:null;
}
export function duoInheritedValue(draft:BuildDraft,catalog:BuildCatalog,element:string,kind:ElementStatKind,totals:Record<string,number>) {
  const own=totals[element]??0;
  const partner=duoPartner(draft,catalog,element);
  if(!partner)return null;
  if(kind==='Attack')return (totals[partner]??0)>own+1e-9?{value:totals[partner]!,from:partner}:null;
  // ATK%/DMG%: only gear is inherited, and as a whole (corrected 2026-10-08): the partner's gear total replaces this
  // element's gear total when it is higher; other sources stay this element's. Frost gear DMG% 6.3% against Volt gear
  // 4.2% inherits nothing (summing the better element item by item, the earlier rule, would have shown 7.0%).
  const ownGear=gearElementStat(draft,catalog,element,kind),partnerGear=gearElementStat(draft,catalog,partner,kind);
  return partnerGear>ownGear+1e-9?{value:own-ownGear+partnerGear,from:partner}:null;
}
export function elementTotalDamagePercent(draft:BuildDraft,catalog:BuildCatalog,element:string){
  const totals=Object.fromEntries(draft.combat.elements.map(row=>[row.id,row.damage]));
  return duoInheritedValue(draft,catalog,element,'Damage %',totals)?.value??totals[element]??0;
}
/**
 * In-game total ATK of an element.
 * - DisplayBase already contains its own Space Support; solo ATK is DisplayBase × (1 + own ATK%).
 * - Duo pair: compare bases without their own support, then add the destination's support once before ATK%.
 *   Gear ATK% is replaced by the higher gear ATK% of the pair; other percentages stay on their own element.
 * - Altered: the copied source total plus its own remainder, own ATK% and Space Support.
 * `attack` is the amount ATK% multiplies (for a duo it already includes S); `base` is the pair's base without S, and
 * `supportBase` is the S counted inside `attack`. `own` is the element's own base ATK, shown first in the tooltip.
 */
export function elementTotalAttack(draft:BuildDraft,catalog:BuildCatalog,element:string):{own:number;ownAdded?:number;base:number;supportBase:number;attack:number;percent:number;source:string;inherited:boolean;support:number;foodAttack:number;total:number} {
  draft=applyConsumableStats(draft,catalog);
  const column=(key:'attack'|'attackPercent')=>Object.fromEntries(draft.combat.elements.map(item=>[item.id,item[key]??0])) as Record<string,number>;
  const attacks=column('attack'),percents=column('attackPercent');
  if(element==='Altered') {
    const source=alteredSource(draft,catalog),native=draft.combat.elements.find(item=>item.id===source),copied=(native?.attack??0)*(1+(native?.attackPercent??0));
    // DisplayBase already contains the copied final ATK. Expose its own remainder without counting the copy twice.
    const snapshot=draft.captureSource?.capture.combat.attack;
    const capturedCopy=snapshot?Math.max(0,...Object.entries(CAPTURE_ELEMENT_ATTRIBUTES).filter(([id])=>id!=='Altered').map(([,keys])=>snapshot[keys[0]]??0)):0;
    const unenhancedCopy=((native?.attack??0)-(draft.combat.consumableStatsApplied?.attack??0))*(1+(native?.attackPercent??0)-(draft.combat.consumableStatsApplied?.attackPercent[source]??0));
    const ownAdded=Math.max(0,(attacks[element]??0)-(capturedCopy>0?capturedCopy:unenhancedCopy)),attack=copied+ownAdded;
    const percent=percents[element]??0,support=supportAttack(draft,catalog,element);
    const foodAttack=draft.combat.consumableStatsApplied?.postPercentElementAttack?.[source]??0;
    return {own:attack,ownAdded,base:attack,supportBase:0,attack,percent,source,inherited:true,support,foodAttack,total:attack*(1+percent)+support+foodAttack};
  }
  const own=attacks[element]??0,support=supportAttack(draft,catalog,element),partner=duoPartner(draft,catalog,element),foodAttack=draft.combat.consumableStatsApplied?.postPercentElementAttack?.[element]??0;
  if(!partner) {
    const percent=percents[element]??0;
    return {own,base:own-support,supportBase:support,attack:own,percent,source:element,inherited:false,support:0,foodAttack,total:own*(1+percent)+foodAttack};
  }
  const ownBase=own-support,partnerBase=(attacks[partner]??0)-supportAttack(draft,catalog,partner);
  const source=partnerBase>ownBase+1e-9?partner:element,base=Math.max(ownBase,partnerBase);
  const percent=duoInheritedValue(draft,catalog,element,'Attack %',percents)?.value??percents[element]??0;
  const attack=base+support;
  return {own,base,supportBase:support,attack,percent,source,inherited:source!==element,support:0,foodAttack,total:attack*(1+percent)+foodAttack};
}
/**
 * Highlighted winners of the combat table (2026-10-11): on the pair, the element with the larger GEAR flat ATK, gear ATK %
 * each. Other sources (relics, Space Support, synthesis) do not decide the highlight. Equal gear ATK % or DMG % totals
 * (including zero) highlight the native element (the card's element). A gear ATK total of 0 highlights nothing. Altered
 * takes its source's ATK %.
 */
export function combatStatWinners(draft:BuildDraft,catalog:BuildCatalog) {
  const context=rollValueContext(draft,catalog);
  const gearTotals=(kind:ElementStatKind)=>context.percentElements.map(id=>({id,value:gearElementStat(draft,catalog,id,kind)}));
  const winner=(kind:ElementStatKind)=>{
    const best=gearTotals(kind).reduce<{id:string|null;value:number}>((top,item)=>item.value>top.value+1e-9?item:top,{id:null,value:0});
    return best.id;
  };
  const nativeOnPairTie=(kind:PercentKind)=>{
    const totals=gearTotals(kind);
    return totals.length>0&&totals.every(item=>Math.abs(item.value-totals[0]!.value)<1e-9)
      ?context.element:winner(kind);
  };
  return {element:context.element,attack:winner('Attack'),attackPercent:context.inheritFrom??nativeOnPairTie('Attack %'),damage:nativeOnPairTie('Damage %')};
}
/** Current equipped values, never the full-Titan projection used in the rating. */
export function gearRVRemovedStats(gear:GearDraft,draft:BuildDraft,catalog:BuildCatalog,context:RollValueContext=rollValueContext(draft,catalog)):RVRemovedStats|null {
  const removed:RVRemovedStats={flatAttack:0,attackPercent:0,damagePercent:0,critRating:0,critRate:0,resistance:0,resistancePercent:0,hp:0,hpPercent:0};
  if(!gear.equipped)return removed;
  const meta=catalog.gear.find(item=>item.id===gear.id);
  const base=meta?.baseStats[gear.titan?'titan':gear.augmented?'augmented':'normal'].find(entry=>entry.level===gear.enhancement);
  if(!base)return null;
  const stats=[...base.stats.map(stat=>({type:stat.label,value:stat.value})),...gear.rows,...(gear.titan||gear.augmented?gear.augments:[])];
  const sum=(type:string)=>stats.filter(stat=>stat.type===type).reduce((value,stat)=>value+stat.value,0);
  if(stats.some(stat=>!Number.isFinite(stat.value)||stat.value<0))return null;
  const flatElement=context.inheritFrom??context.element;
  removed.flatAttack=sum(flatElement+' Attack')+(catalog.reference.titanGrowth.universalAttackElements.includes(flatElement)?sum('Attack'):0);
  // Pair inheritance selects one element's total across the whole loadout. Removing one item can change that winner.
  const withoutItem={...draft,gear:draft.gear.map(item=>item.id===gear.id?{...item,equipped:false}:item)};
  const marginalPercent=(kind:'Attack %'|'Damage %')=>Math.max(0,...context.percentElements.map(element=>gearElementStat(draft,catalog,element,kind)))
    -Math.max(0,...context.percentElements.map(element=>gearElementStat(withoutItem,catalog,element,kind)));
  removed.attackPercent=marginalPercent('Attack %');
  removed.damagePercent=context.inheritFrom?0:marginalPercent('Damage %');
  removed.critRating=sum('Crit');removed.critRate=sum('Crit Rate %');
  // Tank PRV: the item's general RES and the selected element's RES and RES%.
  removed.resistance=sum('Resistance')+sum(context.element+' Resistance');
  removed.resistancePercent=sum(context.element+' Resistance %');
  removed.hp=sum('HP');removed.hpPercent=sum('HP %');
  const before=enhancementResonance(draft,catalog)?.stats;
  const after=enhancementResonance({...draft,gear:draft.gear.map(item=>item.id===gear.id?{...item,equipped:false}:item)},catalog)?.stats;
  if(catalog.reference.titanGrowth.universalAttackElements.includes(flatElement))removed.flatAttack+=Math.max(0,(before?.atk??0)-(after?.atk??0));
  removed.critRating+=Math.max(0,(before?.crit??0)-(after?.crit??0));
  removed.hp+=Math.max(0,(before?.hp??0)-(after?.hp??0));
  removed.resistance+=Math.max(0,(before?.res??0)-(after?.res??0));
  return removed;
}
export type RollValueContext=Pick<ReturnType<typeof rollValueContext>,'element'|'selected'|'percentElements'>&{weapon?:ReturnType<typeof rollValueContext>['weapon'];inheritFrom?:string;role?:BuildRVRole};
/** The context defaults to the card's own element; gear rankings pass an explicit mono or pair element track. */
function gearRatingProfile(gear:GearDraft,draft:BuildDraft,catalog:BuildCatalog,context:RollValueContext) {
  const mode=draft.rv?.mode??'grv';
  // Ranking's GRV catalog has no personal consumables/combat data and needs only the fixed reference.
  if(mode==='prv')draft=buildCombatDraft(draft,catalog);
  // cardGear filters the rated rows; removing a slot still needs all of its actual source stats.
  const original=mode==='prv'&&gear.equipped?draft.gear.find(item=>item.id===gear.id)??gear:gear;
  const flatElements=context.role!=='tank'&&!context.inheritFrom&&context.percentElements.length===2?context.percentElements:undefined;
  const removed=mode==='prv'?gearRVRemovedStats(original,draft,catalog,context):null;
  // An inheriting element (Altered) is rated with the source element's flat ATK and ATK%.
  let profile=mode==='prv'?(removed?personalRVProfile(draft,catalog,context.inheritFrom??context.element,removed):null):standardRVProfile(catalog,context.element);
  if(profile&&mode==='prv'&&flatElements){
    const bases=flatElements.map(element=>{
      const contribution=gearRVRemovedStats(original,draft,catalog,{...context,element,selected:element,percentElements:[element]});
      return (draft.combat.elements.find(row=>row.id===element)?.attack??0)-supportAttack(draft,catalog,element)-(contribution?.flatAttack??0);
    });
    profile={...profile,flatAttack:Math.max(...bases)+supportAttack(draft,catalog,context.element),
      attackPercent:Math.max(0,elementTotalAttack(draft,catalog,context.element).percent-(removed?.attackPercent??0)),
      damagePercent:Math.max(0,elementTotalDamagePercent(draft,catalog,context.element)-(removed?.damagePercent??0))};
  }
  if(profile&&mode==='prv'&&context.inheritFrom)profile={...profile,damagePercent:draft.combat.elements.find(element=>element.id==='Altered')?.damage??0,postPercentAttack:(profile.postPercentAttack??0)+Math.max(0,(elementTotalAttack(draft,catalog,'Altered').ownAdded??0)-(gear.equipped?equippedGearStats(gear,catalog).filter(row=>row.type==='Altered Attack').reduce((sum,row)=>sum+row.value,0):0))};
  return {mode,flatElements,removed,profile};
}
export function gearRollValue(gear:GearDraft,draft:BuildDraft,catalog:BuildCatalog,context:RollValueContext=rollValueContext(draft,catalog)) {
  if(context.element==='Altered'&&context.role!=='tank'&&!context.inheritFrom) {
    const source=scoreGearForTrack({rows:gear.rows,stars:gear.stars,augmented:!!(gear.titan||gear.augmented),allowedTypes:catalog.gear.find(slot=>slot.id===gear.id)?.allowedStats??[]},['Altered'],catalog.reference,context.role).inheritFrom;
    if(source)context={...context,inheritFrom:source,percentElements:[source]};
  }
  const {mode,flatElements,removed,profile}=gearRatingProfile(gear,draft,catalog,context);
  const score=getBuildRollValue({rows:gear.rows.map(row=>({type:row.type,beforeTitan:gear.titan||gear.augmented?row.beforeTitan:row.value})),
    types:catalog.reference.statTypes,growth:catalog.reference.titanGrowth,element:context.element,percentElements:context.percentElements,includeCrit:true,profile:profile??{...standardRVProfile(catalog),flatAttack:0},inheritFrom:context.inheritFrom,flatElements,role:context.role,
    allowedTypes:catalog.gear.find(item=>item.id===gear.id)?.allowedStats??[],stars:gear.stars,
    maxStats:catalog.reference.limits.maxNumOfRandomStats,maxRolls:catalog.reference.limits.maxNumOfRandomStatRolls});
  const ratedTypes=new Set(getBuildRatedFamilies(context.element,context.percentElements,true,catalog.reference.titanGrowth,context.inheritFrom,context.role,flatElements).flat());
  const allowedTypes=catalog.gear.find(item=>item.id===gear.id)?.allowedStats??[];
  const rollWeights=Object.entries(catalog.reference.statTypes).filter(([type])=>ratedTypes.has(type)||allowedTypes.includes(type)).map(([type,bounds])=>{
    const beforeTitan=bounds.randomStatMaxRollValue;
    // The fixed Titan increase belongs to the stat's initial presence, not each roll.
    const afterTitan=beforeTitan*(1+bounds.maxAugmentIncreaseMultiplier);
    // The weakest roll scales the same way (percentage rolls are fixed: minimum = maximum).
    const minAfterTitan=bounds.randomStatMinRollValue*(1+bounds.maxAugmentIncreaseMultiplier);
    const weight=profile&&ratedTypes.has(type)?getBuildRatedWeight(type,profile,context.element,context.inheritFrom,context.role):0;
    const contribution=(amount:number)=>profile&&score.normalization>0?100*amount*weight*getBuildCritContributionScale([{type,value:amount}],profile)/score.normalization:null;
    return {type,beforeTitan,afterTitan,minAfterTitan,rated:ratedTypes.has(type),value:contribution(afterTitan),minValue:contribution(minAfterTitan)};
  }).sort((a,b)=>(b.value??0)-(a.value??0));
  return {...score,...context,mode,profile,removed,flatElements,rollWeights};
}
/**
 * Card GRV/PRV from the item's current values: its random stats and the stats Titan added, with the same families,
 * units, weights and slot ceiling as `gearRollValue` (which projects pre-Titan values to full Titan and stays for the
 * rankings' "Titan maximum" stage). Every equipped item is scored, whether or not its pre-Titan values are known.
 */
export function gearCurrentRollValue(gear:GearDraft,draft:BuildDraft,catalog:BuildCatalog,context:RollValueContext=rollValueContext(draft,catalog)) {
  const base=gearRollValue(gear,draft,catalog,context);
  if(!gear.equipped)return base;
  const {statTypes:types,titanGrowth:growth,limits}=catalog.reference;
  const allowedTypes=catalog.gear.find(item=>item.id===gear.id)?.allowedStats??[];
  const rows=gear.rows.filter(row=>row.type&&Number.isFinite(row.value));
  if(!base.profile)return {...base,value:null,entries:rows.map(row=>({type:row.type,source:row.type,added:false,useful:false,value:row.value,maximumRoll:0,maximumRV:0,rv:0})),reason:'missing' as const};
  const profile=base.profile;
  const current=getBuildCurrentValue({rows:rows.map(row=>({type:row.type,value:row.value})),added:gear.titan||gear.augmented?gear.augments.filter(augment=>augment.type):[],
    types,growth,element:context.element,percentElements:context.percentElements,includeCrit:true,allowedTypes,maxStats:limits.maxNumOfRandomStats,maxRolls:limits.maxNumOfRandomStatRolls,profile,inheritFrom:context.inheritFrom,flatElements:base.flatElements,role:context.role});
  const unit=(type:string)=>{const weight=getBuildRatedWeight(type,profile,context.element,context.inheritFrom,context.role);return weight>0&&base.normalization>0?base.normalization/weight:0;};
  // A stat's own ceiling (five rolls at full Titan) colours its contribution, as before.
  const ceilingRV=(type:string)=>{const bounds=types[type],size=unit(type);
    const value=bounds?getBuildStatMaximum(bounds.randomStatDefaultValue+limits.maxNumOfRandomStatRolls*bounds.randomStatMaxRollValue,0,bounds).titan:0;
    return size>0?100*value*getBuildCritContributionScale([{type,value}],profile)/size:0;};
  const useful=current.entries.map(entry=>({type:entry.type,source:entry.type,added:entry.added,useful:true,value:entry.value,maximumRoll:unit(entry.type),maximumRV:ceilingRV(entry.type),rv:entry.rv}));
  const ignored=rows.filter(row=>!useful.some(entry=>entry.type===row.type)).map(row=>({type:row.type,source:row.type,added:false,useful:false,value:row.value,maximumRoll:unit(row.type),maximumRV:0,rv:0}));
  return {...base,value:current.value,maximum:current.maximum,entries:[...useful,...ignored],conservative:false,reason:null};
}
/**
 * An item as the card's build uses it (2026-10-08): on a duo pair ATK % and DMG % each come from the element with the
 * higher gear total of that kind (the duoInheritedValue rule), so the other element's ATK % / DMG % rows drop out. The
 * card's item scores and total use this; a single item elsewhere (gear rankings) keeps the better of the pair.
 * Personal scores also keep flat ATK from the pair's winning whole-gear source.
 */
export function cardGear(gear:GearDraft,draft:BuildDraft,catalog:BuildCatalog):GearDraft {
  const context=rollValueContext(draft,catalog);
  if(context.inheritFrom||context.percentElements.length!==2)return gear;
  const choice=pairStatChoice((element,kind)=>gearElementStat(draft,catalog,element,kind,draft.rv?.mode==='prv'?'total':'rolls'),context.percentElements);
  const personalAttack=draft.rv?.mode==='prv'&&context.role!=='tank'?combatStatWinners(draft,catalog).attack:null;
  if(choice&&personalAttack)choice.Attack=personalAttack;
  const restrict=<T extends {type:string}>(rows:readonly T[])=>restrictPairStats(rows,context.percentElements,choice);
  return {...gear,rows:restrict(gear.rows),augments:restrict(gear.augments)};
}
export function buildRollValue(draft:BuildDraft,catalog:BuildCatalog) {
  const context=rollValueContext(draft,catalog),{statTypes:types,titanGrowth:growth,limits}=catalog.reference;
  // Totals need current scores only, not projected roll inference, tooltip weights or per-stat colours.
  const allScores=draft.gear.map(item=>{
    const gear=cardGear(item,draft,catalog);
    const {profile,flatElements}=gearRatingProfile(gear,draft,catalog,context);
    const result=getBuildCurrentValue({rows:gear.rows.filter(row=>row.type&&Number.isFinite(row.value)),
      added:gear.titan||gear.augmented?gear.augments.filter(row=>row.type):[],types,growth,
      element:context.element,percentElements:context.percentElements,includeCrit:true,
      allowedTypes:catalog.gear.find(slot=>slot.id===gear.id)?.allowedStats??[],
      maxStats:limits.maxNumOfRandomStats,maxRolls:limits.maxNumOfRandomStatRolls,
      profile:profile??{...standardRVProfile(catalog),flatAttack:0},inheritFrom:context.inheritFrom,flatElements,role:context.role});
    return {value:profile?result.value:null,maximum:result.maximum};
  });
  const scores=allScores.filter((_,i)=>draft.gear[i].equipped);
  // Empty slots add no points. Current ratings need a valid profile, not pre-Titan roll history.
  const complete=scores.length>0&&scores.every(score=>score.value!==null);
  // `equipped` = how many slots hold an item: an empty card shows no build maximum (2026-10-08).
  return {value:complete?scores.reduce((sum,score)=>sum+score.value!,0):null,maximum:allScores.reduce((sum,score)=>sum+score.maximum,0),equipped:scores.length};
}
export function supportSystem(draft:BuildDraft,catalog:BuildCatalog) {
  return [...catalog.support.systemLevels].sort((a,b)=>b.maxModuleLevel-a.maxModuleLevel).find(s=>draft.support.every(m=>m.level>=s.needAllModuleLevel))!;
}
export function summaryStats(draft:BuildDraft,catalog:BuildCatalog) {
  const result=new Map<string,{type:string;value:number;rolls:number|null;maximum:number}>();
  for(const gear of draft.gear.filter(g=>g.equipped)) {
    const {rolls}=analyzeGear(gear,catalog);
    gear.rows.forEach((row,i)=>{
      if(!row.type || row.beforeTitan===null)return;
      const type=catalog.reference.statTypes[row.type];
      const total=result.get(row.type)||{type:row.type,value:0,rolls:0,maximum:0};
      total.value+=Math.max(0,row.beforeTitan-type.randomStatDefaultValue);
      total.rolls=total.rolls===null || rolls[i]===null ? null : total.rolls+rolls[i]!;
      if(rolls[i]!==null)total.maximum+=rolls[i]!*type.randomStatMaxRollValue;
      result.set(row.type,total);
    });
  }
  const elements=Object.keys(catalog.elementIcons);
  const order=(type:string)=>{
    if(type.startsWith('HP'))return [0,0,Number(type.includes('%'))];
    if(type.startsWith('Crit'))return [1,0,Number(type.includes('%'))];
    const element=elements.findIndex(e=>type.startsWith(e+' '));
    if(type.includes('Resistance'))return [3,element+1,Number(type.includes('%'))];
    return [2,element+1,type.includes('Damage')?2:Number(type.includes('%'))];
  };
  return [...result.values()].map(stat=>({...stat,quality:getBuildRollQuality(stat.value,stat.rolls,catalog.reference.statTypes[stat.type])})).filter(stat=>stat.rolls!==0).sort((a,b)=>{
    const x=order(a.type),y=order(b.type);
    return x[0]-y[0]||x[1]-y[1]||x[2]-y[2]||a.type.localeCompare(b.type);
  });
}

export function enhancementResonance(draft:BuildDraft,catalog:BuildCatalog) {
  const contract=catalog.enhancementResonance;
  const basic=draft.gear.filter(gear=>contract.slotIds.includes(gear.id));
  return contract.tiers.filter(tier=>basic.filter(gear=>gear.equipped&&gear.enhancement>=tier.enhancement).length>=tier.count).at(-1)??null;
}

export function gearBaseStats(gear:GearDraft,catalog:BuildCatalog) {
  if(!gear.equipped)return [];
  const stage=gear.titan?'titan':gear.augmented?'augmented':'normal';
  return catalog.gear.find(item=>item.id===gear.id)?.baseStats[stage].find(entry=>entry.level===gear.enhancement)?.stats??[];
}

/** A newly chosen background starts centred: no drag offset, centred object position; the zoom is kept. */
export function centredArt(art:BuildDraft['art']):BuildDraft['art'] {
  return {...art,x:50,y:50,offsetX:0,offsetY:0};
}

/** Resolve catalog links to an existing artwork; never use the pasted URL as an image source. */
export function artworkIdFromLink(input:string,catalog:Pick<BuildCatalog,'artworks'>) {
  const text=input.trim();
  const byId=(id:string)=>{
    let decoded:string;
    try {decoded=decodeURIComponent(id).toLowerCase();} catch {return '';}
    return catalog.artworks.find(art=>art.id.toLowerCase()===decoded)?.id||'';
  };
  const directId=byId(text.startsWith('#')?text.slice(1):text);
  if(directId)return directId;
  try {
    const url=new URL(text,'https://tof-hub.invalid');
    if(url.pathname.replace(/\/$/,'')==='/info/arts'&&url.hash)return byId(url.hash.slice(1));
  } catch {return '';}
  const resourcePath=(value:string)=>{
    let path=value.trim();
    if(/^https?:\/\//i.test(path))path=new URL(path).pathname;
    return decodeURIComponent(path.split(/[?#]/,1)[0].replace(/\\/g,'/').replace(/^\/+/,''))
      .replace(/\.(?:webp|png|jpe?g)$/i,'').toLowerCase();
  };
  try {
    const wanted=resourcePath(text);
    if(!wanted.includes('/'))return '';
    return catalog.artworks.find(art=>{
      const asset=resourcePath(art.url);
      return asset===wanted||asset.endsWith(`/${wanted}`);
    })?.id||'';
  } catch {return '';}
}
export function randomLoadingArtwork(catalog:BuildCatalog,random=Math.random,exceptId?:string) {
  const loading=catalog.artworks.filter(art=>art.loading);
  const alternatives=exceptId&&loading.length>1?loading.filter(art=>art.id!==exceptId):loading;
  const options=alternatives.length?alternatives:loading;
  return options[Math.min(options.length-1,Math.floor(random()*options.length))]?.id||'';
}

/** Unreal SimpleCurve: linear interpolation with constant endpoint extrapolation.
 * An unequipped/zero-level property is absent, rather than the curve's Lv. 1 value. */
export function titanRareEffect(id:string,level:number,catalog:BuildCatalog) {
  if(!Number.isFinite(level)||level<0)return null;
  const item=catalog.reference.titanRare.items.find(item=>item.id===id);
  if(!item)return null;
  const evaluate=(curve:{level:number;value:number}[])=>{
    if(!curve?.length)return null;
    if(level===0)return 0;
    if(level<=curve[0].level)return curve[0].value;
    const upper=curve.findIndex(point=>point.level>=level);
    if(upper===-1)return curve.at(-1)!.value;
    const a=curve[upper-1],b=curve[upper];
    return a.value+(b.value-a.value)*(level-a.level)/(b.level-a.level);
  };
  const value=evaluate(item.effectCurve),displayValue=evaluate(item.displayCurve);
  return value===null||displayValue===null?null:{value,displayValue};
}

/** Rare property's CS at this item's level; independent of the numeric-stat bases. */
export function gearTitanCombatScore(gear:GearDraft,catalog:BuildCatalog):number|null {
  if(!gear.titan||!gear.rareId||gear.rareLevel<=0)return 0;
  const effect=titanRareEffect(gear.rareId,gear.rareLevel,catalog);
  const weight=catalog.csRules?.titan?.[gear.rareId]?.weight;
  return effect&&weight!==undefined?effect.displayValue*weight:null;
}

/** Equipment CS; percentages use the full pre-percentage pool, rare CS uses the item's level. */
export function gearCombatScore(gear:GearDraft,draft:BuildDraft,catalog:BuildCatalog) {
  draft=applyConsumableStats(draft,catalog);
  const stats=[...gearBaseStats({...gear,equipped:true},catalog).map(s=>({type:s.label,value:s.value})),...gear.rows,...(gear.titan||gear.augmented?gear.augments:[])];
  // Captures carry final HP / RES but not full percentages. HP falls back to gear HP%; RES additionally uses
  // known resonance, computing and relic passives. Missing external multipliers can overestimate these pools.
  const gearPercent=(types:string[])=>gearPercentTotal(draft,types);
  let estimated=false;
  const percent=(known:number|null|undefined,types:string[])=>{
    if(known!==null&&known!==undefined)return known;
    estimated=true;return gearPercent(types);
  };
  const pool=(base:string):number|null=>{
    if(base==='fixedPercent')return 1;
    if(base==='HP')return draft.combat.hp>0?draft.combat.hp/(1+percent(draft.combat.hpPercent,['HP %'])):null;
    const element=draft.combat.elements.find(e=>base===e.id+' Attack'||base===e.id+' Resistance');
    if(!element)return null;
    // BuildDraft stores DisplayBase ATK, already before ATK% (unlike final HP / RES).
    // Keep each element's own pool: duo/Altered inheritance is a combat-output rule, not item CS.
    if(base.endsWith(' Attack'))return element.attack>0?(element.id==='Altered'&&draft.combat.consumableStatsApplied?elementTotalAttack(draft,catalog,'Altered').attack:element.attack):null;
    // Without an entered RES% total: the gear's RES% plus the active elemental resonance.
    if(element.resistance===null||!(element.resistance>0))return null;
    const known=element.resistancePercent!==null&&element.resistancePercent!==undefined;
    if(!known)estimated=true;
    return element.resistance/(1+(known?element.resistancePercent!:estimatedResistancePercent(draft,element.id,catalog)));
  };
  const entries=stats.filter(s=>s.type&&s.value!==0).map(stat=>{
    const weight=catalog.csRules?.weights[stat.type],baseType=catalog.csRules?.bases[stat.type];
    const base=weight===0?1:baseType?pool(baseType):1;
    const value=weight===undefined||base===null||!Number.isFinite(base)||base<0||!Number.isFinite(stat.value)||stat.value<0?null:stat.value*base*weight;
    return {...stat,weight,base:baseType?base:null,cs:value};
  });
  const titanCS=gearTitanCombatScore(gear,catalog);
  const numeric=entries.reduce((sum,e)=>sum+(e.cs??0),0);
  const known=numeric+(titanCS??0);
  return {value:entries.some(e=>e.cs===null)||titanCS===null?null:Math.trunc(known),known:Math.trunc(known),numeric,titanCS,entries,estimated};
}

/**
 * Universal ("white") ATK before ATK%: each element's base ATK minus the elemental flat ATK of equipped gear.
 * Verified on three captures where all four elements leave the same remainder (docs/imports.md).
 * Null when an element is missing or the remainders disagree (manual values that do not fit this model).
 */
export function universalAttack(draft:BuildDraft):number|null {
  const remainders=['Frost','Volt','Flame','Physical'].map(element=>{
    const base=draft.combat.elements.find(item=>item.id===element)?.attack??0;
    if(base<=0)return null;
    const gear=draft.gear.filter(item=>item.equipped).reduce((sum,item)=>sum+[...item.rows,...item.augments]
      .filter(stat=>stat.type===`${element} Attack`).reduce((total,stat)=>total+stat.value,0),0);
    return base-gear;
  });
  if(remainders.some(value=>value===null))return null;
  const values=remainders as number[],spread=Math.max(...values)-Math.min(...values);
  return spread<=1?values.reduce((sum,value)=>sum+value,0)/values.length:null;
}
