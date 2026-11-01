// Weapon configuration is materialized from raw flags and normalized game skills.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
module.exports=function({pub,raw,media}) {
  const source='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/StaticWeaponDataTable_Overseas.json';
  const rows=JSON.parse(fs.readFileSync(path.join(raw,source),'utf8'))[0].Rows;
  const byId=new Map(Object.entries(rows).map(([id,row])=>[id.toLowerCase(),row]));
  const en=JSON.parse(fs.readFileSync(path.join(pub,'en/simulacra.json'),'utf8')).items;
  const ru=JSON.parse(fs.readFileSync(path.join(pub,'ru/simulacra.json'),'utf8')).items;
  const elements=['Flame','Frost','Physical','Volt','Altered'];
  const weapons={};
  for(const item of en.filter(item=>item.server_mode==='gacha')) {
    const row=byId.get(item.weapon_id?.toLowerCase());
    const localized=ru.find(other=>other.id===item.id);
    const skills=item.weapon?.skills;
    const translated=Object.values(localized?.weapon?.skills||{}).flat();
    const present=skill=>({id:skill.id,name:{en:skill.name_en,ru:translated.find(other=>other.id===skill.id)?.name_ru||skill.name_ru||skill.name_en},icon:media(skill.icon?.full||skill.icon_thumb),description:{en:skill.desc_display_en||skill.desc_en||'',ru:translated.find(other=>other.id===skill.id)?.desc_display_ru||skill.desc_display_ru||skill.desc_ru||skill.desc_display_en||''}});
    const resonances=(skills?.passives||[]).flatMap(skill=>{
      const element=elements.find(element=>skill.name_en===`${element} Resonance`);
      if(!element)return [];
      const description=skill.desc_display_en||skill.desc_en||'';
      if(!/2 or more|at least 2|two or more/i.test(description))return [];
      const effect=present(skill);
      // Some exported text has misplaced placeholders. Keep the raw numeric
      // parameter binding instead of displaying the broken formatted sentence.
      const atk=skill.parameters?.find(parameter=>/atk/i.test(parameter.rowName||''))?.levels?.['1'];
      const def=skill.parameters?.find(parameter=>/def/i.test(parameter.rowName||''))?.levels?.['1'];
      if(Number.isFinite(atk)&&Number.isFinite(def))effect.description={en:`${element} ATK +${atk}%, ${element} resistance +${def}%. Active with at least 2 matching weapons. Does not stack with another resonance of the same element.`,ru:`АТК +${atk}%, сопротивление +${def}%. Активен при экипировке хотя бы 2 оружий соответствующего элемента. Не складывается с другим резонансом того же элемента.`};
      const attackPercent=require('./build-resonance-attack.cjs')({parameterValue:atk,description});
      const resistancePercent=require('./build-resonance-attack.cjs').resistance({parameterValue:def,description});
      return [{...effect,element,requiredWeapons:2,...(attackPercent===null?{}:{attackPercent}),...(resistancePercent===null?{}:{resistancePercent})}];
    });
    // Custom-element choices retain ordered pairs from the weapon's passives.
    // Lana names them in fusion text; Nola names them in Superspeed Reform.
    // User-confirmed behavior: BlackStar copies an established resonance.
    const elementFromResonance=item.weapon_id?.toLowerCase()==='blackstar_superpower';
    const selectableElements=row?.bCustomWeaponElement&&!elementFromResonance?elements.map(element=>{
      const fusion=(skills?.passives||[]).find(skill=>(skill.desc_display_en||'').startsWith(`Fusion of ${element==='Physical'?'Mass':element}`));
      const sentence=(fusion?.desc_display_en||'').split('.')[0];
      const secondary=elements.find(other=>other!==element&&new RegExp(`\\b${other==='Physical'?'Mass|Physical':other}\\b`,'i').test(sentence));
      const reform=(skills?.passives||[]).find(skill=>skill.name_en?.startsWith(`Superspeed Reform: ${element}-`));
      const reformElements=reform?.name_en.slice('Superspeed Reform: '.length).split('-');
      const pair=reformElements?.length===2&&reformElements.every(id=>elements.includes(id))?reformElements:undefined;
      return {id:element,elements:pair??(secondary?[element,secondary]:[element])};
    }):[];
    // Queen's six Scatter Techniques are distinct from her base active skill.
    const selectableSkills=(skills?.skills||[]).filter(skill=>/^GA_FPlayerQueenSkill_Skill[1-6]$/.test(skill.id)).map(present);
    // Exact normalized SkillList identities; indices in capture are not mapped here.
    const modeIds={
      Snipe_fire:['Snipe_Skill_Fire','Snipe_Skill_Smoke'],
      yulan_ice:['GA_FPlayerYulanSkill','GA_FPlayerYulanSkill_Skill2'],
      Lana_SuperPower:['GA_FPlayerLanaSkill_Skill1','GA_FPlayerLanaSkill_Skill2','GA_FPlayerLanaSkill_Skill3'],
      BlackStar_SuperPower:['ga_BlackStar_RealSkill1','ga_BlackStar_RealSkill2'],
    };
    const modeKey=Object.keys(modeIds).find(id=>id.toLowerCase()===item.weapon_id?.toLowerCase());
    const allSkills=Object.values(skills||{}).flat();
    const selectableModes=(modeIds[modeKey]||[]).map((id,index)=>{
      const skill=allSkills.find(skill=>skill.id===id);
      if(!skill)throw new Error(`Missing weapon mode ${item.id}: ${id}`);
      const option=present(skill);
      if(modeKey==='yulan_ice'){
        const passive=allSkills.find(skill=>skill.id==='GA_FPlayerYulanSkill_PassiveSkill');
        const enForms=passive?.desc_display_en?.match(/has 2 forms: (.+?) and (.+?)\./);
        const ruForms=translated.find(skill=>skill.id===passive?.id)?.desc_display_ru?.match(/2 формы: (.+?) и (.+?)\./);
        if(enForms)option.name.en=enForms[index+1];
        if(ruForms)option.name.ru=ruForms[index+1];
      }
      if(modeKey==='Lana_SuperPower'){
        option.name.en=option.name.en.replace(/^Evolution Power - /,'');
        option.name.ru=option.name.ru.replace(/^Сила эволюции: /,'');
      }
      // Annabella's mode entries lack resolved icons in Info. Use the existing
      // Ember Mag icon for both, rather than guessing associations for raw PNGs.
      if(!option.icon&&modeKey==='Snipe_fire')option.icon=present(allSkills.find(skill=>skill.id==='GA_FPlayerSnipeSkill_Skill')).icon;
      return option;
    });
    if(resonances.length||selectableElements.length||selectableSkills.length||selectableModes.length)weapons[item.id]={selectableElements,selectableSkills,selectableModes,resonances,...(elementFromResonance?{elementFromResonance:true}:{})};
  }
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const result={source,sourceSha256:hash(path.join(raw,source)),skillsSource:'en/ru/simulacra.json → weapon.skills (raw WeaponSkillList, GameplayEffectTipsDataTable, localization)',skillsSha256:{en:hash(path.join(pub,'en/simulacra.json')),ru:hash(path.join(pub,'ru/simulacra.json'))},priority:'generated catalog newest-first; one resonance per element',weapons};
  fs.mkdirSync(path.join(pub,'game-data'),{recursive:true});
  fs.writeFileSync(path.join(pub,'game-data/weapon-options.json'),JSON.stringify(result,null,2)+'\n');
  return result;
};
