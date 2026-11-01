// Progression facts stay in the pipeline. Preserve raw row indices and bindings;
// never infer an active cap or a native lookup convention from an unused row.
const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const rawRoot=sitePaths.rawDir;
const common='Hotta/Content/Resources/CoreBlueprints/DataTable/';
const overseas='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/';
const sources={};
function read(base,file){
  const bytes=fs.readFileSync(path.join(base,file));
  sources[file]={sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  return JSON.parse(bytes);
}
const rows=file=>read(rawRoot,file).find(x=>x.Rows).Rows;
const localized=locale=>Object.values(read(sitePaths.publicDir,`game-data/${locale}/items.json`));
const enItems=new Map(localized('en').map(x=>[x.id.toLowerCase(),x.name]));
const ruItems=new Map(localized('ru').map(x=>[x.id.toLowerCase(),x.name]));
const petNames=new Map(read(sitePaths.publicDir,'game-data/en/pets.json').items.map(x=>[x.id.toLowerCase(),x.name_en||x.name]));
const itemRows={...rows(common+'Item/ItemConfigs.json'),...rows(common+'Item/ItemConfigs_OS.json')};
const lowerMap=entries=>new Map(Object.entries(entries).map(([k,v])=>[k.toLowerCase(),{row:k,value:v}]));
const itemIndex=lowerMap(itemRows);
const weaponStatic={...rows(common+'StaticWeaponDataTable.json'),...rows(overseas+'StaticWeaponDataTable_Overseas.json')};
const matrixStatic={...rows(common+'WeaponData/WeaponMatrix/StaticMatrixData.json'),...rows(overseas+'StaticMatrixData_Overseas.json')};
function name(id){return {en:enItems.get(id.toLowerCase())||null,ru:ruItems.get(id.toLowerCase())||null,raw:itemIndex.get(id.toLowerCase())?.value.ItemName?.SourceString||weaponStatic[id]?.ItemName?.SourceString||matrixStatic[id]?.ItemName?.SourceString||null};}
function items(text){
  if(!text||text==='None')return {};
  const result={};
  for(const pair of text.split(';').filter(Boolean)){
    const [id,n]=pair.split(',');assert.ok(id&&Number.isFinite(Number(n))&&Number(n)>=0,pair);
    result[id]=(result[id]||0)+Number(n);
  }
  return result;
}
function add(total,values){for(const [id,n]of Object.entries(values))total[id]=(total[id]||0)+n;}
function packs(table){
  const result={};
  for(const [row,value]of Object.entries(table)){
    const match=row.match(/^(.*)_(\d+)$/);assert.ok(match,row);
    (result[match[1]]??=[]).push({row,index:Number(match[2]),...value});
  }
  for(const list of Object.values(result))list.sort((a,b)=>a.index-b.index);
  return result;
}
const upgrade=packs(rows(overseas+'DT_WeaponUpgrade_Overseas.json'));
const tupo=packs(rows(overseas+'DT_WeaponTupo_Overseas.json'));
const upgradeIndex=lowerMap(upgrade),tupoIndex=lowerMap(tupo);
const unresolvedWeaponBindings=[];
const bindings=Object.entries(weaponStatic).filter(([,r])=>r.UpgradePackId&&r.UpgradePackId!=='None').map(([id,r])=>{
  const up=upgradeIndex.get(r.UpgradePackId.toLowerCase()),tu=tupoIndex.get(r.TupoPackId.toLowerCase());
  if(!up||!tu){unresolvedWeaponBindings.push({id,upgradePack:r.UpgradePackId,tupoPack:r.TupoPackId,reason:'No complete Overseas upgrade/tupo binding'});return null;}
  return {id,name:name(id),rarity:r.ItemRarity,upgradePack:up.row,tupoPack:tu.row,rawUpgradePack:r.UpgradePackId,rawTupoPack:r.TupoPackId,maxTupoLevelRaw:r.MaxTupoLevel};
}).filter(Boolean);
const weaponProfiles={};
for(const id of [...new Set(bindings.map(x=>x.upgradePack))].sort()){
  let cumulative=0;
  const all=upgrade[id],active=all.filter(x=>x.ModifyPack!=='None');
  const progression=active.map(r=>{
    assert.ok(Number.isInteger(r.NeedExp)&&r.NeedExp>=0);
    cumulative+=r.NeedExp;
    return {row:r.row,rowLevel:r.index,requiredExp:r.NeedExp,cumulativeRawExp:cumulative,goldFactor:r.GoldFactor,needTupoLevel:r.NeedTupoLevel,costItems:r.CostItems,tupoItems:r.TupoItems};
  });
  weaponProfiles[id]={progression,excludedRows:all.filter(x=>x.ModifyPack==='None'),rawExpTotal:cumulative,level1ToMaxCandidates:{lookupTargetLevel:cumulative-progression[0].requiredExp,lookupCurrentLevel:cumulative-progression.at(-1).requiredExp}};
}
const breakthroughProfiles={};
for(const id of [...new Set(bindings.map(x=>x.tupoPack))].sort()){
  const cumulative={},progression=[];
  for(const r of tupo[id]){
    // Base row and cap-equal terminal rows do not unlock another level range.
    if(r.index===0||r.MaxWeaponLevel<=r.NeedWeaponLevel)continue;
    const cost=items(r.NeedItems);add(cumulative,cost);add(cumulative,{Gold:r.NeedGolds});
    progression.push({row:r.row,stage:r.index,weaponLevel:r.NeedWeaponLevel,newLevelCap:r.MaxWeaponLevel,needPlayerLevel:r.NeedPlayerLevel,items:cost,gold:r.NeedGolds,cumulative:{...cumulative}});
  }
  breakthroughProfiles[id]={progression,excludedRows:tupo[id].filter(r=>r.index===0||r.MaxWeaponLevel<=r.NeedWeaponLevel),total:{...cumulative}};
}
const matrixStrength=lowerMap({...rows(common+'WeaponData/WeaponMatrix/MatrixStrengthenData.json'),...rows(overseas+'MatrixStrengthenData_Overseas.json')});
const matrixStars=lowerMap({...rows(common+'WeaponData/WeaponMatrix/MatrixUpgradeStarData.json'),...rows(overseas+'MatrixUpgradeStarData_Overseas.json')});
const matrixBindings=[],matrixProfiles={},matrixStarProfiles={};
for(const [id,r]of Object.entries(matrixStatic)){
  if(!r.BaseMaxStrengthenLevel||!r.StrengthenPackID||r.StrengthenPackID==='None')continue;
  const profile=r.StrengthenPackID.toLowerCase();
  matrixBindings.push({id,name:name(id),rarity:r.ItemRarity,profile,maxLevel:r.BaseMaxStrengthenLevel,starPack:r.UpgradeStarPackID,maxStars:r.MaxStarLevel});
  if(!matrixProfiles[profile]){
    let cumulative=0;
    const progression=Array.from({length:r.BaseMaxStrengthenLevel},(_,i)=>{
      const match=matrixStrength.get(`${profile}_${i+1}`);assert.ok(match,`${id} ${i+1}`);
      const row=match.value;cumulative+=row.NeedExp;
      return {row:match.row,targetLevel:i+1,requiredExp:row.NeedExp,cumulativeExp:cumulative,goldFactor:row.GoldFactor,needPlayerLevel:row.NeedLevel};
    });
    matrixProfiles[profile]={progression,totalExp:cumulative};
  }else assert.equal(matrixProfiles[profile].progression.length,r.BaseMaxStrengthenLevel);
  if(r.UpgradeStarPackID!=='None'&&!matrixStarProfiles[r.UpgradeStarPackID]){
    let copies=0,gold=0;
    matrixStarProfiles[r.UpgradeStarPackID]=Array.from({length:r.MaxStarLevel},(_,i)=>{
      const match=matrixStars.get(`${r.UpgradeStarPackID}_${i+1}`.toLowerCase());assert.ok(match);
      const row=match.value;copies+=row.NeedCount;gold+=row.NeedGolds;
      return {row:match.row,targetStar:i+1,copies:row.NeedCount,currency:row.CostType,gold:row.NeedGolds,cumulativeCopies:copies,cumulativeGold:gold};
    });
  }
}
const petRows=rows(common+'Pet/PetDataTable.json'),petUpgrades=rows(common+'Pet/PetUpgradeDataTable.json');
const mmoPetRows=rows(common+'Pet/PetDataTable_MMO.json'),mmoPetUpgrades=rows(common+'Pet/PetUpgradeDataTable_MMO.json');
const giftsFor=r=>r.PetUpgradeItemMap.map(g=>({id:g.Key,name:name(g.Key),exp:g.Value.ItemExp,preferred:g.Value.ItemPanelName==='CanvasPanel_Like',panel:g.Value.ItemPanelName}));
const mmoCoverage=Object.entries(mmoPetRows).map(([id,r])=>({id,name:{en:petNames.get(('mmo_'+id).toLowerCase())||petNames.get(id.toLowerCase())||null,raw:r.ItemName.SourceString},maxLevel:r.MaxPetLevel,gifts:giftsFor(r),missingLevels:Array.from({length:r.MaxPetLevel},(_,i)=>i+1).filter(n=>!mmoPetUpgrades[`${r.PetUpgradePack}_${n}`])}));
let mmoCumulativeExp=0;
const mmoProgression=Object.entries(mmoPetUpgrades).map(([row,r])=>({row,targetLevel:Number(row.split('_').at(-1)),requiredExp:r.NeedExp,needPlayerLevel:r.NeedPlayerLevel})).sort((a,b)=>a.targetLevel-b.targetLevel).map(r=>{mmoCumulativeExp+=r.requiredExp;return {...r,cumulativeExp:mmoCumulativeExp};});
const petProfiles={},pets=[];
for(const [id,r]of Object.entries(petRows)){
  if(!petProfiles[r.PetUpgradePack]){
    let cumulative=0;
    const progression=Array.from({length:r.MaxPetLevel},(_,i)=>{
      const key=`${r.PetUpgradePack}_${i+1}`,row=petUpgrades[key];assert.ok(row,key);
      cumulative+=row.NeedExp;
      return {row:key,targetLevel:i+1,requiredExp:row.NeedExp,cumulativeExp:cumulative,needPlayerLevel:row.NeedPlayerLevel};
    });
    petProfiles[r.PetUpgradePack]={progression,totalExp:cumulative,excludedRows:Object.entries(petUpgrades).filter(([key])=>key.startsWith(r.PetUpgradePack+'_')&&Number(key.split('_').at(-1))>r.MaxPetLevel).map(([row,value])=>({row,...value}))};
  }
  pets.push({id,name:{en:petNames.get(id.toLowerCase())||null,raw:r.ItemName.SourceString},maxLevel:r.MaxPetLevel,profile:r.PetUpgradePack,gifts:giftsFor(r)});
}
const materials={};
for(const profile of Object.values(breakthroughProfiles))for(const row of profile.progression)for(const id of Object.keys(row.items))materials[id]={name:name(id)};
for(const pet of pets)for(const gift of pet.gifts)materials[gift.id]={name:gift.name};
const expItems={weapon:Object.entries(weaponStatic).filter(([,r])=>r.WeaponExp>0).map(([id,r])=>({id,name:name(id),exp:r.WeaponExp})),matrix:Object.entries(matrixStatic).filter(([,r])=>r.BaseExp>0&&!r.BaseMaxStrengthenLevel).map(([id,r])=>({id,name:name(id),exp:r.BaseExp}))};
const data={schemaVersion:1,sourceEdition:'standard/Overseas overrides',sources,weapon:{bindings,unresolvedBindings:unresolvedWeaponBindings,profiles:weaponProfiles,breakthroughProfiles},matrix:{bindings:matrixBindings,profiles:matrixProfiles,starProfiles:matrixStarProfiles},pet:{profiles:petProfiles,pets,mmoCoverage,mmoProgression},materials,expItems};
const esc=value=>String(value??'—').replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
const table=(heads,body)=>'| '+heads.join(' | ')+' |\n| '+heads.map(()=>'---').join(' | ')+' |\n'+body.map(r=>'| '+r.map(esc).join(' | ')+' |').join('\n')+'\n';
const itemText=values=>Object.entries(values).map(([id,n])=>`${id} ×${n}`).join('; ')||'—';
const materialTable=ids=>table(['Item ID','Name EN / RU / raw'],[...new Set(ids)].sort().map(id=>[id,[name(id).en,name(id).ru,name(id).raw].filter(Boolean).join(' / ')]));
const introduction=(title,files)=>`# ${title}\n\nRaw root: \`${rawRoot.replace(/\\/g,'/')}\`. The client version of the local export is not separately established. Numbers come from raw; EN/RU names come from the existing generated \`en/ru/items.json\`, pet names from \`en/pets.json\`; all inputs and SHA-256 hashes are recorded in the JSON. The ID remains the primary link. MMO/Balance data is not mixed into this set.\n\nGenerator: \`scripts/generators/build-loadout-progression.cjs\`; data: \`apps/web/public/game-data/build-loadout-progression.json\`. Regenerate: \`pnpm generate:build-loadout-progression\`; check freshness: \`node scripts/generators/build-loadout-progression.cjs --check\`.\n\nSources relative to the raw root:\n\n${files.map(f=>'- `'+f+'`').join('\n')}\n\n`;
// Cost-identical profiles share a documentation table; all original bindings and
// row IDs remain in the machine-readable export.
function groupedProfiles(profiles,signature){
  const groups=new Map();
  for(const [id,p]of Object.entries(profiles)){
    const key=JSON.stringify(signature(p));
    if(!groups.has(key))groups.set(key,{ids:[],profile:p});
    groups.get(key).ids.push(id);
  }
  return [...groups.values()];
}
const weaponDocs=introduction('Weapons: EXP and resources for every breakthrough',[overseas+'StaticWeaponDataTable_Overseas.json',overseas+'DT_WeaponUpgrade_Overseas.json',overseas+'DT_WeaponTupo_Overseas.json',common+'StaticWeaponDataTable.json'])+
  '`StaticWeaponDataTable.UpgradePackId` links a weapon to `DT_WeaponUpgrade`; `TupoPackId` links it to `DT_WeaponTupo`. UE key lookup is case-insensitive and the original case is preserved. `NeedExp` and `GoldFactor` are recorded separately: the factor is not a fixed button price. Empty `CostItems/TupoItems` are kept in the JSON.\n\n'+
  'The EXP table lists the **raw row index**, not a confirmed native transition `Lv.N → Lv.N+1`. Σ is the sum of `NeedExp` for rows 1…N. For the exact cost from the game\'s starting Lv.1 it remains to be checked whether the server uses the row of the current or of the target level; sums for both variants are calculated from the JSON. This prevents an off-by-one error. Row 201 with `ModifyPack=None` is excluded from the ordinary levels.\n\n'+
  groupedProfiles(weaponProfiles,p=>p.progression.map(r=>[r.rowLevel,r.requiredExp,r.goldFactor,r.needTupoLevel])).map(g=>'## EXP: '+g.ids.length+' identical packs\n\nExample row prefix: `'+g.ids[0]+'`. All bindings are in the JSON.\n\n'+table(['Raw Lv.','NeedExp','Σ raw exp','GoldFactor','NeedTupoLevel'],g.profile.progression.map(r=>[r.rowLevel,r.requiredExp,r.cumulativeRawExp,r.goldFactor,r.needTupoLevel]))).join('\n')+
  '\n## EXP total bounds\n\n'+table(['Example pack','Σ of all ordinary raw rows','Lv.1→max: if lookup by target Lv.','Lv.1→max: if lookup by current Lv.'],groupedProfiles(weaponProfiles,p=>p.progression.map(r=>r.requiredExp)).map(g=>[g.ids[0],g.profile.rawExpTotal,g.profile.level1ToMaxCandidates.lookupTargetLevel,g.profile.level1ToMaxCandidates.lookupCurrentLevel]))+'\nThe last two columns are hypothetical variants, not two established game modes. The native lookup needs measuring.\n\n'+
  '\n## Breakthroughs\n\n`NeedItems` is the exact quantity of each material; `NeedGolds` is the exact gold per stage. `NeedWeaponLevel/MaxWeaponLevel` define the range being unlocked. Σ includes the completed stages of this pack. The initial stage 0 is free. Terminal stage 20, whose old and new cap are both 200, is kept in `excludedRows` but not added to the cost of unlocking Lv.200. `MaxTupoLevel=0` appears even on ordinary weapons, so this field is not used as sole evidence that a weapon has no breakthroughs.\n\n'+
  Object.entries(breakthroughProfiles).map(([id,p])=>'### '+id+'\n\n'+table(['Stage','Weapon Lv. → cap','Player Lv.','Materials','Gold','Σ materials and Gold'],p.progression.map(r=>[r.stage,`${r.weaponLevel} → ${r.newLevelCap}`,r.needPlayerLevel,itemText(r.items),r.gold,itemText(r.cumulative)]))).join('\n')+
  '\n## Weapon bindings\n\n'+table(['Weapon row ID','Name EN / raw','UpgradePackId','TupoPackId'],bindings.map(r=>[r.id,r.name.en||r.name.raw,r.upgradePack,r.tupoPack]))+
  '\nIncomplete/test bindings are not replaced with other recipes: '+unresolvedWeaponBindings.map(r=>'`'+r.id+'`').join(', ')+'. They are kept in `weapon.unresolvedBindings`.\n\n## Breakthrough material names\n\n'+materialTable(Object.values(breakthroughProfiles).flatMap(p=>p.progression.flatMap(r=>Object.keys(r.items))))+
  '\n## EXP items\n\n'+table(['Item ID','Name EN / raw','WeaponExp'],expItems.weapon.map(r=>[r.id,r.name.en||r.name.raw,r.exp]));
const matrixDocs=introduction('Matrices: level EXP and star costs',[common+'WeaponData/WeaponMatrix/StaticMatrixData.json',common+'WeaponData/WeaponMatrix/MatrixStrengthenData.json',common+'WeaponData/WeaponMatrix/MatrixUpgradeStarData.json',overseas+'StaticMatrixData_Overseas.json',overseas+'MatrixStrengthenData_Overseas.json',overseas+'MatrixUpgradeStarData_Overseas.json'])+
  'An Overseas row replaces the common row of the same name. For example, SSR row `matrix_ssr_1_strengthen_1`: **100 EXP Overseas**, **170 common**. `StrengthenPackID` links a specific matrix/slot to its EXP; `BaseMaxStrengthenLevel` caps the table. Σ adds target levels 1…N (from base enhancement 0). `NeedLevel` is the player level, not EXP and not a separate fee. `GoldFactor` is kept separately; the exact native gold charge when feeding needs verification.\n\n'+
  'These tables define no separate limit breakthrough like weapons have. Stars use `UpgradeStarPackID` → `MatrixUpgradeStarData`: `NeedCount` duplicates and `NeedGolds` gold per step. These costs are separate from level EXP.\n\n'+
  groupedProfiles(matrixProfiles,p=>p.progression.map(r=>[r.targetLevel,r.requiredExp,r.goldFactor,r.needPlayerLevel])).map(g=>'## EXP: '+g.ids.join(', ')+'\n\n'+table(['Target +Lv.','NeedExp','Σ EXP','GoldFactor','Player Lv.'],g.profile.progression.map(r=>[r.targetLevel,r.requiredExp,r.cumulativeExp,r.goldFactor,r.needPlayerLevel]))).join('\n')+
  Object.entries(matrixStarProfiles).map(([id,p])=>'## Stars: '+id+'\n\n'+table(['Target ★','Duplicates','Gold','Σ duplicates','Σ Gold'],p.map(r=>[r.targetStar,r.copies,r.gold,r.cumulativeCopies,r.cumulativeGold]))).join('\n')+
  '\n## EXP items\n\n'+table(['Item ID','Name EN / raw','BaseExp'],expItems.matrix.map(r=>[r.id,r.name.en||r.name.raw,r.exp]))+
  '\nBindings of all matrices, their slots, caps and star packs are kept in the `matrix.bindings` JSON. The EXP returned when feeding a levelled matrix is not automatically `BaseExp`: the native refund rule is not established by this research.\n';
const petDocs=introduction('Combat pets: level EXP and favourite gifts',[common+'Pet/PetDataTable.json',common+'Pet/PetUpgradeDataTable.json',common+'Item/ItemConfigs.json',common+'Item/ItemConfigs_OS.json'])+
  '`PetDataTable.PetUpgradePack` → `PetUpgradeDataTable[pack_N].NeedExp`; `MaxPetLevel` sets the last allowed level. This standard set has '+pets.length+' pets; packs: '+Object.entries(petProfiles).map(([id,p])=>'`'+id+'`, cap '+p.progression.at(-1).targetLevel+', Σ **'+p.totalExp+' EXP**').join('; ')+'. Lv.1 requires 0. Rows beyond the cap are excluded from the total and kept in `excludedRows`. `NeedPlayerLevel` is an access requirement.\n\n'+
  '`PetUpgradeItemMap[].Key` is the item; `.Value.ItemExp` is the EXP **per item for this pet**; `.Value.ItemPanelName=CanvasPanel_Like` directly marks a favourite gift. Preference is never inferred from the EXP amount alone: for some pets the favourite gives 20, for others 40, for PENPEN 60. The other listed items are accepted too, just without the Like marker. This is feeding combat pets, not Simulacra awakening gifts and not taming a home pet.\n\n'+
  Object.entries(petProfiles).map(([id,p])=>'## '+id+'\n\n'+table(['Target Lv.','NeedExp','Σ EXP','Player Lv.'],p.progression.map(r=>[r.targetLevel,r.requiredExp,r.cumulativeExp,r.needPlayerLevel]))).join('\n')+
  '\n## Favourite gifts of each pet\n\n'+table(['Pet ID','Name EN / raw','Favourite gifts: Item ID, EN, EXP'],pets.map(p=>[p.id,p.name.en||p.name.raw,p.gifts.filter(g=>g.preferred).map(g=>`${g.id} (${g.name.en||g.name.raw||'—'}): ${g.exp}`).join('; ')]))+
  '\n## All accepted gifts\n\n'+pets.map(p=>'### '+(p.name.en||p.name.raw)+' / '+p.id+'\n\n'+table(['Item ID','Name EN / RU / raw','EXP per item','Favourite'],p.gifts.map(g=>[g.id,[g.name.en,g.name.ru,g.name.raw].filter(Boolean).join(' / '),g.exp,g.preferred?'Yes':'No']))).join('\n')+
  '\n## Coverage of the separate MMO set\n\nSources: `'+common+'Pet/PetDataTable_MMO.json`, `'+common+'Pet/PetUpgradeDataTable_MMO.json`. These pets do not continue the standard list; the standard curve is not attributed to them.\n\n'+table(['MMO Pet ID','Name','Declared cap','Levels without a raw row'],mmoCoverage.map(p=>[p.id,p.name.en||p.name.raw,p.maxLevel,p.missingLevels.join(', ')||'—']))+
  '\n### MMO pet gifts\n\n'+table(['MMO Pet ID','Item ID','EN / raw','EXP per item','Favourite'],mmoCoverage.flatMap(p=>p.gifts.map(g=>[p.id,g.id,g.name.en||g.name.raw,g.exp,g.preferred?'Yes':'No'])))+
  '\n### Available MMO levels (the full total up to the cap is unknown)\n\n'+table(['Target Lv.','NeedExp','Σ known EXP','Player Lv.'],mmoProgression.map(r=>[r.targetLevel,r.requiredExp,r.cumulativeExp,r.needPlayerLevel]));
function write(file,text){writeTo(root,file,text);}
function writeTo(base,file,text){
  const target=path.join(base,file);
  if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),text,`Stale output ${file}`);
  else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);}
}
writeTo(sitePaths.publicDir,'game-data/build-loadout-progression.json',JSON.stringify(data,null,2)+'\n');
// Pipeline runs publish data only; the research notes live in this repository.
if(sitePaths.writesRepoFixtures)for(const [file,text]of Object.entries({'weapon-progression.md':weaponDocs,'matrix-progression.md':matrixDocs,'pet-progression-gifts.md':petDocs}))write('docs/tools/build/'+file,text);
console.log(JSON.stringify({weaponBindings:bindings.length,weaponProfiles:Object.keys(weaponProfiles).length,weaponBreakthroughProfiles:Object.keys(breakthroughProfiles).length,matrixBindings:matrixBindings.length,matrixProfiles:Object.keys(matrixProfiles).length,pets:pets.length,petTotalExp:Object.values(petProfiles).map(p=>p.totalExp)},null,2));
