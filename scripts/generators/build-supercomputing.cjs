// Materialize original build-system UI media. No game bonuses are inferred.
const sitePaths=require('../lib/site-paths.cjs');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const sharp = sitePaths.sharp();
const root = path.resolve(__dirname,'../..');
const raw = path.resolve(sitePaths.rawDir);
const pub = sitePaths.publicDir;
const blueprint = 'Hotta/Content/SevenForest/Blueprint/UI/Equip/UI_EquipSlotEvolutionForm.json';
const source = fs.readFileSync(path.join(raw,blueprint),'utf8');
// UI texture families verified in the raw form; compact variants visually
// matched to the supplied in-game screenshot. They do not imply gear-slot ids.
const variants = ['2-2','3-1','1-1','4-1'];
async function main() {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(),'tof-supercomputing-'));
  const nodes = variants.map((variant,index)=>{
    const family = variant.split('-')[0];
    const base = `Hotta/Content/Resources/UI/Evolution/Icon_NewEqui${family}`;
    if (!source.includes(`${base}.0`)) throw new Error(`Unverified UI texture family: ${base}`);
    const relative = `${base.split('/').slice(0,-1).join('/')}/Icon_NewEqui${variant}`;
    const input = path.join(raw,relative+'.png');
    if (!fs.existsSync(input)) throw new Error(`Missing raw asset: ${input}`);
    return {id:`supercomputing-${family}`,label_en:`Node ${index+1}`,label_ru:`Узел ${index+1}`,icon:`/game-assets/webp/${relative}.webp`,source:`${relative}.png`,uiSource:blueprint};
  });
  const manifest = {schemaVersion:1,source:blueprint,assets:nodes.map(n=>({rawPath:n.source,url:n.icon,processing:'webp-lossless',role:'supercomputing-node'}))};
  const supportTable = 'Hotta/Content/Resources/CoreBlueprints/DataTable/OuterSpaceSupport/';
  const readRows = name => JSON.parse(fs.readFileSync(path.join(raw,supportTable+name+'.json'),'utf8'))[0].Rows;
  const legacyRoot = sitePaths.legacyDir;
  // Only editorial translations are migrated; values and limits come from raw.
  const labels = JSON.parse(fs.readFileSync(path.join(legacyRoot,'datamine2/gear/data/space-support.json'),'utf8'));
  function supportImage(ref) {
    const assetPath = ref?.AssetPathName;
    if (!assetPath?.startsWith('/Game/')) throw new Error('Missing original UI texture reference');
    const relative = 'Hotta/Content/'+assetPath.slice(6).split('.')[0];
    const image = {source:relative+'.png',icon:'/game-assets/webp/'+relative+'.webp'};
    if (!fs.existsSync(path.join(raw,image.source))) throw new Error('Missing original UI image '+image.source);
    return image;
  }
  const modules = Object.entries(readRows('DT_OuterSpaceSupportModule')).map(([id,row])=>{
    const label = labels.modules.find(m=>m.id===id);
    if (!Number.isInteger(row.ModuleMaxLevel) || !Array.isArray(row.ModuleLevelData)) throw new Error('Missing module level data '+id);
    return {id,name_en:label?.name_en || row.ModuleText.SourceString,name_ru:label?.name_ru || row.ModuleText.SourceString,
      base:row.BaseModule,maxLevel:row.ModuleMaxLevel,levels:row.ModuleLevelData.map(l=>({level:Number(l.Key),...l.Value})),...supportImage(row.ModuleIcon)};
  });
  const systemLevels = Object.entries(readRows('DT_OuterSpaceSupportSystemLevel')).map(([id,row])=>({
    id,name_en:labels.systemLevels.find(l=>String(l.level)===id)?.name_en || row.LevelText.SourceString,
    name_ru:labels.systemLevels.find(l=>String(l.level)===id)?.name_ru || row.LevelText.SourceString,
    maxModuleLevel:row.MaxModuleLevel,needAllModuleLevel:row.NeedAllModuleLevel,...supportImage(row.SystemLevelBg)}));
  const support = {schemaVersion:1,source:supportTable,modules,systemLevels};
  const supportManifest = {schemaVersion:1,source:supportTable,assets:[...modules,...systemLevels].map(n=>({rawPath:n.source,url:n.icon,processing:'webp-lossless',role:'space-support'}))};
  const attributeSource = 'Hotta/Content/Resources/CoreBlueprints/DataTable/AttributeStaticDataTable.json';
  const attributeRows = JSON.parse(fs.readFileSync(path.join(raw,attributeSource),'utf8'))[0].Rows;
  const reference = JSON.parse(fs.readFileSync(path.join(pub,'game-data/build-reference.json'),'utf8'));
  const statIds = ['MaxHealth','MaxEnergy','CritAdded','CritDam','CommonAtkAdded','ElementDef','IceAtkAdded','ThunderAtkAdded','FireAtkAdded','PhyAtkAdded','SuperpowerAtkAdded','IceDefAdded','ThunderDefAdded','PhyDefAdded','SuperpowerDefAdded','FireDefAdded','CommonAggravatingInjury',...reference.titanRare.items.map(r=>r.id)];
  const attributes = Object.fromEntries([...new Set(statIds)].map(id=>{
    const row=attributeRows[id];
    if(!row)throw new Error('Missing raw attribute '+id);
    return [id,{id,...supportImage(row.AttributeIcon)}];
  }));
  // Reuse the element filter registry Comp builds COMP_ELEMENT_ICONS from; validate against original textures.
  const elementSource = fs.readFileSync(path.join(sitePaths.webDir,'src/features/simulacra/constants.ts'),'utf8');
  const registry = elementSource.match(/export const ELEMENT_FILTER_OPTIONS[^=]*=\s*\[([\s\S]*?)\r?\n\];/);
  if(!registry)throw new Error('Missing canonical element filter registry');
  const elements = Object.fromEntries([...registry[1].matchAll(/id:\s*'(\w+)'[^}]*?iconPath:\s*'([^']+)'/g)].map(([,option,iconPath])=>{
    const id=option.charAt(0).toUpperCase()+option.slice(1);
    const relative=iconPath.replace(/^\/datamine\/shared\/media\//,'').replace(/\.webp$/,'')+'.png';
    if(!fs.existsSync(path.join(raw,relative)))throw new Error('Missing element texture '+relative);
    return [id,{id,source:relative,icon:'/game-assets/webp/'+relative.replace(/\.png$/,'.webp')}];
  }));
  if(Object.keys(elements).length<5)throw new Error('Incomplete element filter registry');
  const statIcons = {schemaVersion:1,source:attributeSource,elementRegistry:'apps/web/src/features/simulacra/constants.ts#ELEMENT_FILTER_OPTIONS (Comp COMP_ELEMENT_ICONS)',attributes,elements};
  const markSource='Hotta/Content/SevenForest/Blueprint/UI/Weapon/UI_WeaponWarehouseSlot.json';
  const markBlueprint=JSON.parse(fs.readFileSync(path.join(raw,markSource),'utf8'));
  const markImage=markBlueprint.find(r=>r.Type==='Image' && r.Properties?.Brush?.ResourceObject?.ObjectName==="Texture2D'tips_wqjs_icon_mark'");
  const markPath=markImage?.Properties.Brush.ResourceObject.ObjectPath?.split('.')[0];
  if(!markPath)throw new Error('Missing original Nan Yin weapon mark reference');
  const catalog=JSON.parse(fs.readFileSync(path.join(pub,'tools/data/catalog.json'),'utf8'));
  const nanYin=catalog.simulacra.find(r=>r.id==='nan-yin');
  if(!nanYin?.weapon_id)throw new Error('Missing Nan Yin weapon identity');
  const weaponMarks={schemaVersion:1,source:markSource,nanYin:{simulacrumId:nanYin.id,weaponId:nanYin.weapon_id,...supportImage({AssetPathName:'/Game/'+markPath.replace('Hotta/Content/','')})}};
  const computingStatsSource='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/EquipSlotEvolutionDataTable_Overseas.json';
  const computingRows=JSON.parse(fs.readFileSync(path.join(raw,computingStatsSource),'utf8'))[0].Rows;
  const computingStatMedia=Object.values(computingRows).flatMap(row=>row.EquipSlotSimulatedProps.map(prop=>({id:prop.PropIcon.AssetPathName.split('.').at(-1),...supportImage(prop.PropIcon)})));
  const statMedia=[...computingStatMedia,...Object.values(attributes),...Object.values(elements),{id:'nan-yin-mark',...weaponMarks.nanYin}];
  const statManifest={schemaVersion:1,source:attributeSource,assets:statMedia.map(n=>({rawPath:n.source,url:n.icon,processing:'webp-lossless',role:n.id==='nan-yin-mark'?'weapon-mark':'build-stat-icon'}))};
  const media = [...new Map([...nodes,...modules,...systemLevels,...statMedia].map(n=>[n.icon,n])).values()];
  // Manifest exists before conversion. All staged assets validate before promotion.
  fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(stage,'support-manifest.json'),JSON.stringify(supportManifest,null,2)+'\n');
  fs.writeFileSync(path.join(stage,'stat-manifest.json'),JSON.stringify(statManifest,null,2)+'\n');
  for (const node of media) {
    const output = path.join(stage,node.icon);
    fs.mkdirSync(path.dirname(output),{recursive:true});
    await sharp(path.join(raw,node.source)).webp({lossless:true}).toFile(output);
    const metadata = await sharp(output).metadata();
    if (metadata.format !== 'webp' || !metadata.width || !metadata.height) throw new Error(`Invalid converted asset ${node.id}`);
  }
  const data = {schemaVersion:1,source:blueprint,nodes,mechanicsStatus:'Unverified: presentation media only; no bonus formula or equipment-slot mapping'};
  for (const node of media) {
    const output = path.join(pub,node.icon);
    fs.mkdirSync(path.dirname(output),{recursive:true});
    sitePaths.copyMedia(path.join(stage,node.icon),output);
  }
  const dataDir = path.join(pub,'game-data');
  fs.mkdirSync(dataDir,{recursive:true});
  fs.writeFileSync(path.join(dataDir,'supercomputing.json'),JSON.stringify(data,null,2)+'\n');
  fs.copyFileSync(path.join(stage,'manifest.json'),path.join(dataDir,'supercomputing-media.json'));
  fs.writeFileSync(path.join(dataDir,'space-support.json'),JSON.stringify(support,null,2)+'\n');
  fs.copyFileSync(path.join(stage,'support-manifest.json'),path.join(dataDir,'space-support-media.json'));
  fs.writeFileSync(path.join(dataDir,'build-weapon-marks.json'),JSON.stringify(weaponMarks,null,2)+'\n');
  fs.writeFileSync(path.join(dataDir,'build-stat-icons.json'),JSON.stringify(statIcons,null,2)+'\n');
  const relicResistanceIcons=Object.fromEntries(Object.entries({phys:'PhyDefAdded',flame:'FireDefAdded',frost:'IceDefAdded',volt:'ThunderDefAdded',altered:'SuperpowerDefAdded'}).map(([element,id])=>[element,attributes[id].icon]));
  fs.writeFileSync(path.join(dataDir,'relic-resistance-icons.json'),JSON.stringify(relicResistanceIcons,null,2)+'\n');
  fs.copyFileSync(path.join(stage,'stat-manifest.json'),path.join(dataDir,'build-stat-icons-media.json'));
  for (const node of media) if (!fs.existsSync(path.join(pub,node.icon))) throw new Error(`Missing promoted asset ${node.id}`);
  console.log(`Generated Supercomputing, Space Support and stat-icon data, manifests and ${media.length} verified WebP images`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
