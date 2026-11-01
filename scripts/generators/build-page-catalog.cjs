// Materialize build-editor identities/media from the existing migration pipeline.
// Preview numbers remain explicitly authored fixtures, never player/game facts.
const sitePaths=require('../lib/site-paths.cjs');
const fs = require('node:fs');
const path = require('node:path');
const attackPercentBonuses=require('./build-attack-percent.cjs');
module.exports = async function generate({pub,catalog,reference,runtime,gearIcons,petsData,computing,supportData,statMedia,markMedia,fixtures}) {
  // Locale projections can put translated labels in English fallback fields.
  // Resolve authored sample identities against the canonical EN output by ID.
  const basePublic=process.env.TOF_BASE_PUBLIC_DIR?path.resolve(process.env.TOF_BASE_PUBLIC_DIR):null;
  const baseCatalog=basePublic?JSON.parse(fs.readFileSync(path.join(basePublic,'tools/data/catalog.json'),'utf8')):catalog;
  const basePets=basePublic?JSON.parse(fs.readFileSync(path.join(basePublic,'game-data/en/pets.json'),'utf8')):petsData;
  const relicIdByEnglishName=name=>baseCatalog.relics.find(item=>item.name_en===name)?.id;
  const petIdByEnglishName=name=>basePets.items.find(item=>(item.name_en||item.name)===name)?.id;
  const petStats=require('./build-pet-stats.cjs')({raw:sitePaths.rawDir,items:petsData.items});
  const gearMedia=await require('./build-gear-media.cjs')({pub,raw:sitePaths.rawDir});
  const titanMark=await require('./build-titan-mark.cjs')({pub});
  ({computing,supportData}=require('./build-system-bonuses.cjs')({computing,supportData,legacy:sitePaths.legacyDir}));
  const suppressors=await require('./build-suppressor-preview.cjs')({pub,raw:sitePaths.rawDir});
  const enhancementResonance=require('./build-enhance-resonance.cjs')({raw:sitePaths.rawDir,gearMedia});
  const gearBaseStats=require('./build-gear-base-stats.cjs')({raw:sitePaths.rawDir,gearMedia});
  const synthesisEffects=JSON.parse(fs.readFileSync(path.join(sitePaths.generatorDataDir,'build-synthesis-effects.json'),'utf8'));
  for(const effects of Object.values(synthesisEffects.effects))for(const effect of effects) {
    const amount=effect.description.en.match(/^\+([\d.]+)%$/);
    if(!amount)throw new Error('Missing synthesis damage amount');
    effect.damageValue=Number(amount[1])/100;effect.damageScope='all';
  }
  const media = url => {
    if (!url) return '';
    const candidates=[url,url.replace('/datamine/shared/media/','/game-assets/webp/')];
    const resolved=candidates.find(u=>fs.existsSync(path.join(pub,u)));
    return resolved || '';
  };
  const weaponOptions=require('./build-weapon-options.cjs')({pub,raw:sitePaths.rawDir,media});
  const artsByLocale=Object.fromEntries(['en','ru'].map(locale=>[locale,JSON.parse(fs.readFileSync(path.join(pub,locale,'arts.json'),'utf8')).items]));
  const consumables=require('./build-consumables.cjs')({pub,media});
  // The normalized matrix catalog already uses newest-first game suit ordering.
  // Keep weapons and their traits in that same order instead of source file order.
  const matrixOrder=new Map(catalog.matrices.map((matrix,index)=>[matrix.id.toLowerCase(),index]));
  catalog={...catalog,simulacra:[...catalog.simulacra].sort((a,b)=>(matrixOrder.get(String(a.matrix_suit_id).toLowerCase())??Infinity)-(matrixOrder.get(String(b.matrix_suit_id).toLowerCase())??Infinity))};
  const title=(value,fallback,locale)=>typeof value==='string'?value:value?.[locale]||value?.en||value?.ru||fallback;
  const artworks=artsByLocale.en.map(art=>{
    const translated=artsByLocale.ru.find(item=>item.id===art.id);
    const url=media(art.webpUrl||art.url||art.pngUrl);
    return {id:art.id,name:{en:title(art.title,art.id,'en'),ru:title(translated?.title,art.id,'ru')},icon:media(art.thumbUrl)||url,url,loading:!!art.subCategory?.includes('loading')};
  }).filter(art=>art.url);
  const weapons=catalog.simulacra.filter(s=>s.weapon_id && s.weapon_icon).map(s=>({id:s.id,...weaponOptions.weapons[s.id],quality:s.rarity||s.quality,matrixSuitId:s.matrix_suit_id,weaponId:s.weapon_id,role:String(s.role||'').toLowerCase().replace(/^(support|healer)$/,'benediction'),elements:[s.element,s.element_secondary].filter(Boolean),name:{en:s.name_en,ru:s.name_ru||s.name_en},weapon:{en:s.weapon_name_en,ru:s.weapon_name_ru||s.weapon_name_en},icon:media(s.weapon_icon),avatar:media(s.avatar),art:media(s.card),traitIcon:media(reference.traitIcons[s.id]),trait:{en:s.trait_desc_en||'',ru:s.trait_desc_ru||''}}));
  const weaponUpgrades=require('./build-weapon-upgrades.cjs')({raw:sitePaths.rawDir});
  for(const weapon of weapons)weapon.upgradeStages=weaponUpgrades[String(weapon.weaponId).toLowerCase()]||[];
  // Use the same cosmetic catalogs as Info, retaining only original game textures.
  const cosmetics=Object.fromEntries(['en','ru'].map(locale=>[locale,JSON.parse(fs.readFileSync(path.join(pub,locale,'cosmetics.json'),'utf8'))]));
  const cosmeticItems=category=>cosmetics.en[category].filter(item=>item.icon?.includes('/Hotta/Content/')).map(item=>{
    const translated=cosmetics.ru[category].find(row=>row.id===item.id);
    return {id:item.id,name:{en:item.name_en||item.name,ru:translated?.name_ru||translated?.name||item.name_ru||item.name_en||item.name},icon:media(item.icon),animation:item.animation};
  }).filter(item=>item.icon);
  const avatars=cosmeticItems('avatars'),avatarFrames=cosmeticItems('avatarFrames');
  await require('./build-cosmetic-layout.cjs')([...avatars,...avatarFrames],pub);
  const avatarAliases=Object.fromEntries(weapons.flatMap(weapon=>{
    const avatar=avatars.find(item=>item.id.toLowerCase()===weapon.id.toLowerCase()||item.name.en===weapon.name.en);
    return avatar?[[weapon.id,avatar.id]]:[];
  }));
  const matrices=catalog.matrices.map(m=>({id:m.id,quality:m.quality,elementLoadouts:[...new Map(catalog.simulacra.filter(s=>String(s.matrix_suit_id).toLowerCase()===m.id.toLowerCase()).map(s=>{const elements=[s.element,s.element_secondary].filter(Boolean);return [elements.join("-"),elements];})).values()],elements:[...new Set(catalog.simulacra.filter(s=>String(s.matrix_suit_id).toLowerCase()===m.id.toLowerCase()).map(s=>s.element).filter(Boolean))],roles:[...new Set(catalog.simulacra.filter(s=>String(s.matrix_suit_id).toLowerCase()===m.id.toLowerCase()).map(s=>String(s.role||'').toLowerCase().replace(/^(support|healer)$/,'benediction')).filter(Boolean))],name:{en:m.name_en,ru:m.name_ru||m.name_en},icon:media(m.icon),effects:[2,3,4].filter(n=>m[`desc_${n}p_en`]).map(n=>({level:n,attackPercentBonuses:attackPercentBonuses(m[`desc_${n}p_en`]),description:{en:m[`desc_${n}p_en`],ru:m[`desc_${n}p_ru`]||m[`desc_${n}p_en`]}}))}));
  const relics=catalog.relics.map(r=>({id:r.id,quality:r.quality,property:r.property,name:{en:r.name_en,ru:r.name_ru||r.name_en},icon:media(r.icon),description:{en:r.desc_en||'',ru:r.desc_ru||r.desc_en||''},effects:(r.stars||[]).map(s=>({level:Number(s.star),description:{en:s.desc_en||s.desc||'',ru:s.desc_ru||s.desc_en||s.desc||''}}))}));
  const pets=petsData.items.filter(p=>p.category==='combat' && p.icon).map(p=>({id:p.id,name:{en:p.name_en||p.name,ru:p.name_ru||p.name},icon:media(p.icon),stats:petStats.get(p.id),maxStars:Math.max(0,...p.stars.map(s=>Number(s.star))),moduleCapacity:(p.stars||[]).filter(s=>Number.isFinite(s.module_load)&&Number.isFinite(s.module_slots)).map(s=>({stars:Number(s.star),load:s.module_load,slots:s.module_slots})),modules:petsData.module_families.filter(m=>{
    if(p.source_edition==='mmo')return false;
    const keys=[p.id,p.name,p.name_en,p.name_ru].filter(Boolean).map(s=>s.toLowerCase().trim());
    const owners=[m.owner_id,m.owner,m.owner_en,m.owner_ru].filter(Boolean).map(s=>s.toLowerCase().trim());
    return owners.length===0 || owners.some(o=>keys.includes(o));
  }).map(m=>({id:m.id||m.family_id||m.name,name:{en:m.name_en||m.name,ru:m.name_ru||m.name},icon:media(m.icon),levels:(m.levels||[]).map(l=>({level:l.level,icon:media(l.icon||l.icon_thumb||m.icon),description:{en:l.desc_en||l.desc_ru||'',ru:l.desc_ru||l.desc_en||''},load:l.need_load??m.need_load??null}))}))}));
  const gear=runtime.GEAR_SLOTS.map(id=>{
    const meta=runtime.GEAR_SLOT_META[id];
    const slot={pants:'Legguards',core:'Combat Engine',visor:'Eyepiece',reactor:'Microreactor'}[id]||meta.nameEn;
    return {id,slot,name:{en:meta.nameEn,ru:meta.nameRu},icon:gearMedia[id].icons.normal,icons:gearMedia[id].icons,baseStats:gearBaseStats[id],allowedStats:reference.slots[slot].randomStats,rarePool:reference.titanRare.pools[id]||[]};
  });
  const number=value=>Number(String(value).replaceAll(',','').replaceAll(' ','').replaceAll('\u00a0','').replace('%',''))/(String(value).includes('%')?100:1);
  const f=fixtures.en;
  const elementIcons=Object.fromEntries(['Frost','Volt','Flame','Physical','Altered'].filter(id=>statMedia.elements[id]).map(id=>[id,statMedia.elements[id]]));
  const nodes=f.supercomputing.map(n=>computing.nodes.find(x=>x.icon===n.icon));
  const displayIcons=Object.fromEntries(Object.entries({hp:'MaxHealth',endurance:'MaxEnergy',crit:'CritAdded',critDamage:'CritDam',attack:'CommonAtkAdded',damage:'CommonAggravatingInjury',resistance:'ElementDef'}).map(([role,id])=>[role,statMedia.attributes[id]]));
  const resistanceIcons=Object.fromEntries(Object.entries({Frost:'IceDefAdded',Volt:'ThunderDefAdded',Flame:'FireDefAdded',Physical:'PhyDefAdded',Altered:'SuperpowerDefAdded'}).map(([element,id])=>[element,statMedia.attributes[id]]));
  const statTypeIcons=Object.fromEntries(Object.keys(reference.statTypes).map(type=>{
    const id=/Crit/.test(type)?'CritAdded':/HP/.test(type)?'MaxHealth':/Resistance/.test(type)?'ElementDef':/Frost/.test(type)?'IceAtkAdded':/Volt/.test(type)?'ThunderAtkAdded':/Flame/.test(type)?'FireAtkAdded':/Physical/.test(type)?'PhyAtkAdded':'CommonAtkAdded';
    return [type,(type.includes('Resistance')?resistanceIcons[type.split(' ')[0]]||displayIcons.resistance:statMedia.attributes[id])||displayIcons.attack];
  }));
  const demo={version:1,profile:{name:'kritik',server:'EU / Demo server',uid:'00000000',roleId:'50000000000000',level:f.combat.level,title:'Frost · Fairy Wreath / Evolution Cube',signature:'See you in game.',cs:311318,apexCs:319228,apexGsAchievedAt:'2026-10-01T18:42:00.000Z',suppressorId:'11_4',crew:'Whalesong',characterTitle:'potuzhno’s Mentor',avatarId:f.weapons[0].id},art:{id:f.weapons[0].id,zoom:1,x:50,y:49,offsetX:0,offsetY:0},enemyLevel:f.combat.enemyLevel,
    combat:{hp:f.combat.hp,crit:f.combat.crit,additionalCritRate:f.combat.additionalCritRate,critDamage:f.combat.critDamage,elements:Object.keys(elementIcons).map((id,i)=>({id,attack:[58420,51760,28340,27910,56120][i],damage:0,resistance:[14630,12180,11420,10860,9860][i]}))},
    weapons:f.weapons.map((w,i)=>({id:w.id,level:200,stars:[6,3,6][i],matrices:Array.from({length:4},(_,j)=>({id:matrices.find(m=>m.name.en===w.matrix)?.id||'',stars:[3,3,2,3][j],level:100}))})),markWeaponId:f.nanYinMark.selectedWeaponId,
    gear:f.gear.map((g,i)=>({id:g.id,equipped:true,enhancement:50+i,stars:5,titan:true,augmented:true,rows:g.rows.map(r=>({type:r.type,value:number(r.value),beforeTitan:r.beforeTitan})),augments:g.augments.map((a,j)=>({type:(j===0?'Volt ':'Flame ')+(g.vera?(g.id==='visor'?'Attack %':'Damage %'):'Attack'),value:number(a[1])})),base:g.baseStats.map(b=>({label:b.label,value:number(b.value)})),rareId:g.rareId,rareLevel:g.rareLevel||0})),
    traitId:f.weapons[0].id,traitPoints:4000,synthesis:f.synthesis.map(s=>({id:s.id,stage:s.stage})),relics:f.relics.map(r=>({id:relics.find(x=>x.name.en===r.name)?.id||'',stars:r.rank})),pet:{id:pets.find(p=>p.name.en===f.pet.name)?.id||'',stars:f.pet.stars,level:100,modules:f.pet.modules.map(m=>pets.find(p=>p.name.en===f.pet.name)?.modules.find(x=>x.name.en===m.name)?.id||'')},computing:f.supercomputing.map(n=>({id:computing.nodes.find(x=>x.icon===n.icon)?.id||'',level:n.level})),support:f.spaceSupport.modules.map(m=>({id:m.id,level:m.level}))};
  // Authored realistic loadout (editorial sample, not a player record): Fairy Wreath + Evolution Cube set to Frost
  // give Frost/Volt resonance, Star of Oblivion is the Altered off-field weapon. Stars, levels and matrix
  // advancements differ on purpose; the off-weapon carries a 2+2 mixed set with long names.
  const demoMatrix=(id,stars,level)=>{const matrix=matrices.find(item=>item.id.toLowerCase()===id.toLowerCase());if(!matrix)throw new Error(`Missing ${id} for the authored build example`);return {id:matrix.id,stars,level};};
  const demoWeapon=(id,stars,level,matrixRows,choice={})=>{if(!weapons.some(weapon=>weapon.id===id))throw new Error(`Missing ${id} for the authored build example`);return {id,level,stars,...choice,matrices:matrixRows.map(row=>demoMatrix(...row))};};
  demo.weapons=[
    demoWeapon('gefion',6,200,[['Suit_SSR69',3,100],['Suit_SSR69',1,100],['Suit_SSR69',2,100],['Suit_SSR69',3,100]]),
    demoWeapon('lana',3,180,[['suit_SSR63',2,100],['suit_SSR63',0,80],['suit_SSR63',1,100],['suit_SSR63',2,90]],{element:'Frost'}),
    demoWeapon('nemesis-voidpiercer',1,160,[['suit_SSR22',3,100],['suit_SSR22',0,100],['suit_SSR18',2,70],['suit_SSR18',1,100]]),
  ];
  demo.art.id=artworks.find(art=>art.loading)?.id||'';
  demo.rv={element:'',includeCrit:true,weaponId:'',mode:'grv'};
  // Authored sample choices; these do not assert game defaults.
  for(const chosen of demo.weapons){const weapon=weapons.find(item=>item.id===chosen.id);if(weapon?.selectableElements?.length&&!chosen.element)chosen.element=weapon.elements[0];if(weapon?.selectableModes?.length)chosen.mode=weapon.selectableModes[0].id;}
  // Authored example: Void Pursuit is selected in the supplied Nemesis skill reference.
  const demoNemesis=demo.weapons.find(chosen=>chosen.id==='nemesis-voidpiercer');
  if(demoNemesis) {
    const skill=weapons.find(weapon=>weapon.id===demoNemesis.id)?.selectableModes?.find(mode=>mode.id==='ga_BlackStar_RealSkill2');
    if(!skill)throw new Error('Missing Void Pursuit for the authored build example');
    demoNemesis.mode=skill.id;
  }
  // Authored sample value from the supplied character-screen reference.
  demo.profile.avatarId=avatarAliases[f.weapons[0].id]||avatars[0]?.id||'';
  demo.profile.avatarFrameId=avatarFrames[0]?.id||'';
  // Explicit user-supplied mark contract; coefficients stay in generated data.
  markMedia.nanYin.name=require('./build-weapon-mark-name.cjs')({raw:sitePaths.rawDir});
  markMedia.nanYin.rules={outsideBase:.01,inBuildBase:.09,perAdvancement:.01,allMarksMinAdvancement:1,source:'User contract: 1% + marked weapon advancements; equipped Nan Yin: 9% + her advancements; all marks from A1'};
  demo.combat.endurance=1300;
  demo.gear=require('./build-demo-gear.cjs')(demo.gear,reference);
  // Authored universal ATK: each element's displayed base is one universal value plus that element's
  // flat ATK from equipped gear, so the sample card can show Universal ATK like a captured card.
  const demoUniversalAttack=32850;
  for(const element of demo.combat.elements)element.attack=demoUniversalAttack+demo.gear.filter(item=>item.equipped)
    .flatMap(item=>[...item.rows,...item.augments]).filter(stat=>stat.type===`${element.id} Attack`).reduce((sum,stat)=>sum+stat.value,0);
  // This authored combat state has no external Crit Rate buffs: only equipped gear.
  demo.combat.additionalCritRate=demo.gear.filter(item=>item.equipped).flatMap(item=>[...item.rows,...(item.titan||item.augmented?item.augments:[])]).filter(stat=>stat.type==='Crit Rate %').reduce((sum,stat)=>sum+stat.value,0);
  const raw=sitePaths.rawDir;
  const tableRows=relative=>JSON.parse(fs.readFileSync(path.join(raw,relative),'utf8')).find(item=>item.Rows)?.Rows||{};
  const csRules=require('./build-cs-rules.cjs')({raw});
  const playerMax=Math.max(...Object.keys(reference.critFormula.denominators).map(Number));
  const rowLevel=key=>Number(key.match(/_(\d+)$/)?.[1]||0);
  const defaultLevels={
    weapon:Math.max(0,...Object.entries(tableRows('Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/DT_WeaponUpgrade_Overseas.json')).filter(([,row])=>row.ModifyPack&&row.ModifyPack!=='None').map(([key])=>rowLevel(key))),
    matrix:Math.max(0,...Object.entries(tableRows('Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponData/WeaponMatrix/MatrixStrengthenData.json')).filter(([,row])=>row.NeedLevel<=playerMax).map(([key])=>rowLevel(key))),
    pet:Math.max(0,...Object.entries(tableRows('Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/PetUpgradeDataTable.json')).filter(([,row])=>row.NeedPlayerLevel<=playerMax).map(([key])=>rowLevel(key))),
  };
  // Authored example: Leia's two exclusive modules and Fortify fill her Load budget.
  const demoPet=pets.find(p=>p.id===petIdByEnglishName('Leia'));
  if(!demoPet)throw new Error('Missing Leia for the authored build example');
  const demoModules=['ssr_16','ssr_17','ssr_3'].map(id=>demoPet.modules.find(m=>m.id===id));
  if(demoModules.some(m=>!m))throw new Error('Missing Leia example modules');
  demo.pet={id:demoPet.id,stars:demoPet.maxStars,level:defaultLevels.pet,modules:[...demoModules.map(m=>m.id),''],moduleLevels:[...demoModules.map(m=>Math.max(...m.levels.map(l=>l.level))),0]};
  const weaponStats=require('./build-weapon-stats.cjs')({pub,weapons,raw});
  const matrixStats=require('./build-matrix-stats.cjs')({raw,matrices,pub});
  const demoConsumables=['Power Nutripaste','Enhanced Blade Shot','Enhancement Shot','Piercing Shot'];
  demo.consumables=consumables.map((group,index)=>{
    const item=group.items.find(item=>item.name.en===demoConsumables[index]);
    if(!item)throw new Error(`Missing ${demoConsumables[index]} for the authored build example`);
    return item.id;
  });
  // Editorial remaining lifetime for the sample, not a game's full buff duration.
  // The UI anchors this to the instant the user loads Test data.
  const demoConsumableRemainingSeconds=Object.fromEntries(consumables.flatMap((group,index)=>group.id==='food'?[]:[[demo.consumables[index],(2*24+6)*60*60]]));
  demo.relics=['Bubble Gun','Buff Dealer'].map((name,index)=>{
    const relic=relics.find(item=>item.id===relicIdByEnglishName(name));
    if(!relic)throw new Error(`Missing ${name} for the authored build example`);
    return {id:relic.id,stars:demo.relics[index].stars};
  });
  // Invented manual A4 totals for the sample only, not verified game facts.
  demo.relicDamage={Frost:.125,Volt:.178,Flame:.143,Physical:.192};
  // Invented account counters and Titan clicks for the sample only (the name tooltip and the Titan click bubbles);
  // real values come from a .tofbuild (docs/imports.md, "Augmentation Count").
  demo.account={totalRecharge:12500000,totalRechargeValue:46000,totalRechargeValueByRmbTicket:0,activityRecharge:0,activityRechargeByRmbTicket:0,
    paymentFakeDiamond:0,buyGemCount:3,buyFashionCount:1,monthCardLeftDays:12,tyroMonthCardLeftDays:0,totalLoginDays:640,continueLoginDays:9,
    reportCount:1,antiPluginReportCount:0};
  demo.gear.forEach((gear,index)=>{gear.augmentCount=gear.titan?60+index*11:null;});
  // Authored test state: no external HP% or resistance% buffs.
  const demoCurrentStats=demo.gear.filter(g=>g.equipped).flatMap(g=>[...g.rows,...(g.titan||g.augmented?g.augments:[])]);
  demo.combat.hpPercent=demoCurrentStats.filter(s=>s.type==='HP %').reduce((n,s)=>n+s.value,0);
  for(const element of demo.combat.elements)element.resistancePercent=demoCurrentStats.filter(s=>s.type===element.id+' Resistance %'||s.type==='Resistance %').reduce((n,s)=>n+s.value,0);
  const roleResonances=require('./build-role-resonances.cjs')({raw:sitePaths.rawDir});
  const systemCs=require('./build-system-cs.cjs')({raw:sitePaths.rawDir,research:JSON.parse(require('node:fs').readFileSync(require('node:path').join(pub,'game-data/build-cs-research.json'),'utf8')),weaponIds:weapons.map(item=>item.weaponId).filter(Boolean)});
  const computingExp=JSON.parse(require('node:fs').readFileSync(require('node:path').join(pub,'game-data/build-progression-costs.json'),'utf8')).supercomputing.progression.map(step=>({level:step.targetLevel,exp:step.requiredExp}));
  const output={titanMark,computingExp,systemCs,roleResonances,csRules,consumables,demoConsumableRemainingSeconds,artworks,weaponStats,matrixStats,schemaVersion:1,defaultLevels,weapons,avatars,avatarFrames,avatarAliases,matrices,relics,pets,gear,reference,suppressors,enhancementResonance,statIcons:statMedia.attributes,statTypeIcons,displayIcons,elementIcons,resistanceIcons,weaponMark:markMedia.nanYin,computing:nodes,support:{...supportData,reset:require('./build-support-reset.cjs')({raw})},demoDraft:demo,
    synthesis:{ids:fixtures.en.synthesis.map(s=>s.id),maxStage:reference.synthesisPreview.maxStage,source:reference.synthesisPreview.source,effects:synthesisEffects.effects,effectsSource:synthesisEffects.source}};
  require('./build-demo-damage.cjs')(output);
  // User-authored combat state: Night City at five stacks; +15% Frost/Volt resonance.
  require('./build-demo-attack-percent.cjs')(output,{matrixStacks:{suit_SSR18:5},resonance:[{elements:['Frost','Volt'],value:.15}]});
  require('./build-optimizer-demo.cjs')(output,pub);
  const target=path.join(pub,'game-data/build-page.json');
  output.titles=require('./build-title-names.cjs')({titles:JSON.parse(fs.readFileSync(path.join(pub,'game-data/capture-card-map.json'),'utf8')).titles,raw:sitePaths.rawDir});
  // Each patch-exporter culture lane runs this generator against its localized food,
  // cosmetics and simulacra projections. Keep the same ID-based overlay in standalone runs.
  require('./build-page-locales.cjs').localizeBuildPage(output,pub,catalog,process.env.TOF_GAME_LOCALE);
  const temporary=target+'.tmp';
  fs.writeFileSync(temporary,JSON.stringify(output)+'\n');
  fs.renameSync(temporary,target);
  // The portable pipeline ships build-capture-example pre-bundled (TOF_CAPTURE_EXAMPLE_JS).
  if(process.env.TOF_CAPTURE_EXAMPLE_JS)require('node:child_process').execFileSync(process.execPath,[process.env.TOF_CAPTURE_EXAMPLE_JS,'--catalog',target],{stdio:'inherit'});
  else if(fs.existsSync(path.join(sitePaths.generatorDataDir,'build-example.json')))require('node:child_process').execFileSync(process.execPath,
    [require.resolve('tsx/cli'),'--tsconfig',path.resolve(__dirname,'../../apps/web/tsconfig.json'),path.resolve(__dirname,'build-capture-example.ts'),'--catalog',target],{stdio:'inherit',env:{...process.env,NODE_PATH:[path.resolve(__dirname,'../../apps/web/node_modules'),process.env.NODE_PATH].filter(Boolean).join(path.delimiter)}});
  if(process.argv.includes('--test-fixture')) {
    const weaponIds=new Set([markMedia.nanYin.simulacrumId,...f.weapons.map(w=>w.id),...demo.weapons.map(w=>w.id),demo.art.id,demo.traitId,...demo.synthesis.map(s=>s.id)]);
    const matrixIds=new Set([...demo.weapons.flatMap(w=>w.matrices.map(m=>m.id)),...f.weapons.map(w=>matrices.find(m=>m.name.en===w.matrix)?.id)]);
    const fixture={...output,weapons:weapons.filter(w=>weaponIds.has(w.id)),matrices:matrices.filter(m=>matrixIds.has(m.id)),relics:relics.filter(r=>demo.relics.some(d=>d.id===r.id)),pets:pets.filter(p=>p.id===demo.pet.id),
      support:{systemLevels:supportData.systemLevels,reset:require('./build-support-reset.cjs')({raw:sitePaths.rawDir}),modules:supportData.modules.map(({id,name_en,name_ru,icon,base,maxLevel,levels,damageScope,conditional,attackStat})=>({id,name_en,name_ru,icon,base,maxLevel,levels,damageScope,conditional,attackStat}))}};
    const fixtureDirectory=path.join(pub,'../src/features/build/__fixtures__');
    fs.mkdirSync(fixtureDirectory,{recursive:true});
    fs.writeFileSync(path.join(fixtureDirectory,'catalog.json'),JSON.stringify(fixture,null,2)+'\n');
  }
  console.log('Generated build-page.json');
};
