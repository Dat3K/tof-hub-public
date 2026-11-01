import {emptyDraft,restoreDraft,supportSystem} from './model';
import type {BuildCatalog,BuildDraft} from './types';

/**
 * A capture can come from a newer game patch than the card catalog: unknown identities stay outside the formulas (weapons/matrices retain captured display IDs), and
 * import, but a known item can still carry values the catalog does not allow (a new level cap, more stars, a stat or
 * Titan effect that is new for that slot, a negative stat). The card is never rejected for that: each such value is
 * reset or clamped to the catalog and listed in `unresolved`. As a last resort a section that still fails the card
 * validation is emptied as a whole, so the import always opens.
 */
export function fitCaptureDraft(draft:BuildDraft,catalog:BuildCatalog,unresolved:string[]):BuildDraft {
  const note=(text:string)=>{if(!unresolved.includes(text))unresolved.push(text);};
  const clamp=(value:number,max:number,label:string)=>{
    if(!Number.isInteger(value)||value<0){note(`${label}: ${value}`);return 0;}
    if(value>max){note(`${label}: ${value} > ${max}`);return max;}
    return value;
  };
  const known=(id:string,items:{id:string}[])=>!id||items.some(item=>item.id===id);
  // Levels outside the generated tables (a newer level cap): the profile level is dropped, enemy level uses the highest known one.
  if(draft.profile.level&&!catalog.reference.resistanceFormula.constants[draft.profile.level]){note(`level: ${draft.profile.level}`);draft.profile.level=0;}
  if(draft.enemyLevel&&!catalog.reference.critFormula.denominators[draft.enemyLevel]){
    const levels=Object.keys(catalog.reference.critFormula.denominators).map(Number).filter(level=>level<=draft.enemyLevel);
    note(`enemy level: ${draft.enemyLevel}`);draft.enemyLevel=levels.length?Math.max(...levels):0;
  }
  if(!known(draft.profile.avatarId,catalog.avatars)){note('avatar: '+draft.profile.avatarId);draft.profile.avatarId='';}
  if(!known(draft.profile.avatarFrameId||'',catalog.avatarFrames)){note('frame: '+draft.profile.avatarFrameId);draft.profile.avatarFrameId='';}
  if(!known(draft.profile.suppressorId||'',catalog.suppressors)){note('suppressor: '+draft.profile.suppressorId);draft.profile.suppressorId='';}
  for(const element of draft.combat.elements){
    // A new temporary effect can leave the received ATK below its base: no negative ATK% on the card.
    if(!(element.attackPercent!>=0)){note(`ATK%: ${element.id} ${element.attackPercent}`);element.attackPercent=0;}
  }
  for(const [index,weapon] of draft.weapons.entries()){
    const meta=catalog.weapons.find(item=>item.id===weapon.id);
    if(!meta&&weapon.id){note('weapon: '+weapon.id);weapon.id='';}
    weapon.stars=clamp(weapon.stars,6,`weapon ${index+1} stars`);
    if(weapon.element!==undefined&&!meta?.selectableElements?.some(option=>option.id===weapon.element)){note(`element: ${weapon.id}`);delete weapon.element;}
    if(weapon.mode!==undefined&&!meta?.selectableModes?.some(option=>option.id===weapon.mode)){note(`mode: ${weapon.id}`);delete weapon.mode;}
    if(weapon.skills!==undefined&&(weapon.skills.length!==2||weapon.skills.some(id=>id&&!meta?.selectableSkills?.some(option=>option.id===id))||(weapon.skills[0]&&weapon.skills[0]===weapon.skills[1]))){note(`skills: ${weapon.id}`);delete weapon.skills;}
    for(const matrix of weapon.matrices){
      if(!known(matrix.id,catalog.matrices)){note('matrix: '+matrix.id);Object.assign(matrix,{id:'',stars:0,level:0});}
      matrix.stars=clamp(matrix.stars,3,'matrix stars');
    }
  }
  if(!known(draft.traitId,catalog.weapons)){note('trait: '+draft.traitId);draft.traitId='';}
  for(const [index,gear] of draft.gear.entries()){
    const meta=catalog.gear[index]!;
    gear.stars=clamp(gear.stars,catalog.reference.limits.maxNumOfRandomStatRolls,`${gear.id} stars`);
    gear.rows=gear.rows.map(row=>{
      if(row.type&&(!meta.allowedStats.includes(row.type)||!(row.value>=0))){note(`${gear.id} stat: ${row.type} ${row.value}`);return {type:'',value:0,beforeTitan:null};}
      return row;
    });
    gear.augments=gear.augments.map(augment=>{
      if(augment.type&&(!catalog.reference.statTypes[augment.type]||!(augment.value>=0))){note(`${gear.id} Titan stat: ${augment.type} ${augment.value}`);return {type:'',value:0};}
      return augment;
    });
    const rare=catalog.reference.titanRare.items.find(item=>item.id===gear.rareId);
    if(gear.rareId&&(!meta.rarePool.includes(gear.rareId)||!rare?.levels.includes(gear.rareLevel))){note(`${gear.id} Titan effect: ${gear.rareId} ${gear.rareLevel}`);gear.rareId='';gear.rareLevel=0;}
  }
  for(const relic of draft.relics){
    if(!known(relic.id,catalog.relics)){note('relic: '+relic.id);Object.assign(relic,{id:'',stars:0});}
    relic.stars=clamp(relic.stars,5,'relic stars');
  }
  const pet=catalog.pets.find(item=>item.id===draft.pet.id);
  if(draft.pet.id&&!pet){note('pet: '+draft.pet.id);draft.pet.id='';}
  if(pet)draft.pet.stars=clamp(draft.pet.stars,pet.maxStars,'pet stars');
  draft.pet.modules.forEach((id,slot)=>{
    const module=pet?.modules.find(item=>item.id===id),level=draft.pet.moduleLevels?.[slot]??0;
    if(id&&!module){note('pet module: '+id);draft.pet.modules[slot]='';draft.pet.moduleLevels![slot]=0;}
    else if(level&&!module?.levels.some(item=>item.level===level)){note(`pet module level: ${id} ${level}`);draft.pet.moduleLevels![slot]=0;}
  });
  draft.synthesis.forEach(item=>{item.stage=clamp(item.stage,catalog.synthesis.maxStage,'synthesis '+item.id);});
  draft.computing.forEach((node,index)=>{node.level=clamp(node.level,catalog.computing[index]!.maxLevel,'computing '+node.id);});
  draft.support.forEach((module,index)=>{module.level=clamp(module.level,catalog.support.modules[index]!.maxLevel,'support '+module.id);});
  const supportCap=supportSystem(draft,catalog).maxModuleLevel;
  draft.support.forEach(module=>{if(module.level>supportCap){note(`support ${module.id}: ${module.level} > ${supportCap}`);module.level=supportCap;}});
  for(const [field,label] of [['relicDamage','relic damage'],['relicResistance','relic resistance']] as const){
    const values=draft[field];if(!values)continue;
    for(const [element,amount] of Object.entries(values)){
      if(amount!==null&&!(amount>=0&&amount<=100)){note(`${label}: ${element} ${amount}`);delete values[element];}
    }
  }
  if(restoreDraft(draft,catalog))return draft;
  // Last resort: empty whole sections, one at a time, until the card validates.
  const template=emptyDraft(catalog);
  const sections:[string,(d:BuildDraft)=>void][]=[
    ['weapons',d=>{d.weapons=structuredClone(template.weapons);}],
    ['gear',d=>{d.gear=structuredClone(template.gear);}],
    ['pet',d=>{d.pet=structuredClone(template.pet);}],
    ['relics',d=>{d.relics=structuredClone(template.relics);d.relicDamage={};d.relicResistance={};}],
    ['systems',d=>{d.computing=structuredClone(template.computing);d.support=structuredClone(template.support);d.synthesis=structuredClone(template.synthesis);d.traitId='';}],
    ['consumables',d=>{d.consumables=structuredClone(template.consumables);d.consumableExpiresAt={};}],
    ['profile',d=>{d.profile={...structuredClone(template.profile),name:d.profile.name,uid:d.profile.uid,cs:d.profile.cs,apexCs:d.profile.apexCs};d.enemyLevel=0;}],
    ['combat',d=>{d.combat=structuredClone(template.combat);}],
  ];
  for(const [name,reset] of sections){
    reset(draft);note('section reset: '+name);
    if(restoreDraft(draft,catalog))return draft;
  }
  return draft;
}
