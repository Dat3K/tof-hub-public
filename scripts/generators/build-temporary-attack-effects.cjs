// Temporary (HasDuration) gameplay effects that modify ATK, for capture legitimacy (docs/imports.md).
// ATK% with a constant magnitude can be subtracted from a capture; flat ATK or unknown magnitudes cannot.
const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');
const {buildCapturePolicy}=require('./build-capture-build-policy.cjs');
const raw=sitePaths.rawDir;
const root=path.join(raw,'Hotta/Content/Resources/Abilities');
const out=path.join(sitePaths.publicDir,'game-data/temporary-attack-effects.json');
// Attribute prefix → card element; Common applies to every element.
const ELEMENTS={Common:['Physical','Flame','Frost','Volt','Altered'],Fire:['Flame'],Ice:['Frost'],Thunder:['Volt'],Phy:['Physical'],Physical:['Physical'],Superpower:['Altered']};
const ATTRIBUTE=/^(Common|Fire|Ice|Thunder|Phy|Physical|Superpower)(?:Atk|Attack)(Mult|Added)$/;

function* files(directory) {
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())yield* files(file);
    else if(entry.name.endsWith('.json')&&/^(buff|ge)_/i.test(entry.name))yield file;
  }
}
// Locale lanes and re-runs share one scan of the ~20k raw ability files (keyed by the export version).
const SCAN_VERSION=1;
function scanCacheFile() {
  const dir=process.env.TOF_GENERATOR_CACHE_DIR;
  if(!dir)return null;
  try{
    const versionFile=path.join(raw,'export-version.json');
    const key=require('node:crypto').createHash('sha256').update(JSON.stringify([SCAN_VERSION,path.resolve(root),fs.statSync(versionFile).mtimeMs]))
      .update(fs.readFileSync(versionFile)).digest('hex').slice(0,16);
    return path.join(dir,`temporary-attack-effects-${key}.json`);
  }catch{return null;}
}
async function scanEffects() {
  const cacheFile=scanCacheFile();
  if(cacheFile&&fs.existsSync(cacheFile))return JSON.parse(fs.readFileSync(cacheFile,'utf8'));
  // Read through the thread pool, then parse in walk order so the output order is unchanged.
  const list=[...files(root)];
  const texts=new Array(list.length);
  let next=0;
  await Promise.all(Array.from({length:Math.min(64,list.length)},async()=>{
    while(next<list.length){const index=next++;texts[index]=await fs.promises.readFile(list[index],'utf8');}
  }));
  const effects={};
  list.forEach((file,index)=>{
    const text=texts[index];
    if(!text)return;
  let objects;try{objects=JSON.parse(text);}catch{return;}
  if(!Array.isArray(objects))return;
  const effect=objects.find(o=>typeof o?.Name==='string'&&o.Name.startsWith('Default__')&&o.Properties);
  const props=effect?.Properties;
  if(!props||props.DurationPolicy!=='EGameplayEffectDurationType::HasDuration'||!Array.isArray(props.Modifiers))return;
  const modifiers=props.Modifiers.flatMap(modifier=>{
    const match=ATTRIBUTE.exec(modifier?.Attribute?.AttributeName??'');
    if(!match||modifier.ModifierOp!=='EGameplayModOp::Additive')return [];
    const magnitude=modifier.ModifierMagnitude;
    const scalable=magnitude?.MagnitudeCalculationType==='EGameplayEffectMagnitudeCalculation::ScalableFloat'&&magnitude.ScalableFloatMagnitude?.Curve?.CurveTable==null;
    return [{attribute:match[0],elements:ELEMENTS[match[1]],kind:match[2]==='Mult'?'percent':'flat',magnitude:scalable?magnitude.ScalableFloatMagnitude.Value:null}];
  });
  if(!modifiers.length)return;
  const duration=props.DurationMagnitude?.ScalableFloatMagnitude?.Value??null;
  effects[effect.Name]={source:path.relative(raw,file).split(path.sep).join('/'),duration,modifiers};
  });
  if(cacheFile){
    fs.mkdirSync(path.dirname(cacheFile),{recursive:true});
    const temporary=`${cacheFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporary,JSON.stringify(effects));
    fs.renameSync(temporary,cacheFile);
  }
  return effects;
}
(async()=>{
const effects=await scanEffects();
const foodFile='Hotta/Content/Resources/CoreBlueprints/DataTable/cooking/CookingFoodDataTable.json';
const foodRows=JSON.parse(fs.readFileSync(path.join(raw,foodFile),'utf8')).find(object=>object.Name==='CookingFoodDataTable'&&object.Rows)?.Rows;
if(!foodRows)throw new Error('Missing CookingFoodDataTable');
const foodCatalog=JSON.parse(fs.readFileSync(path.join(sitePaths.publicDir,'game-data/en/food.json'),'utf8'));
const itemPath='Hotta/Content/Resources/CoreBlueprints/DataTable/Item/ItemConfigs.json';
const itemRows=JSON.parse(fs.readFileSync(path.join(raw,itemPath),'utf8')).find(object=>object.Name==='ItemConfigs'&&object.Rows)?.Rows;
if(!itemRows)throw new Error('Missing ItemConfigs');
const policy=buildCapturePolicy(foodRows,foodCatalog,{effects},itemRows);
const captureFood=require('./build-capture-food.cjs')({raw,pub:sitePaths.publicDir,effects});
policy.provenance.itemFoods=captureFood.provenance;
fs.writeFileSync(path.join(path.dirname(out),'capture-food.json'),JSON.stringify(captureFood,null,2)+'\n');
const json=JSON.stringify({schemaVersion:1,
  source:'Hotta/Content/Resources/Abilities/**/{Buff,GE}_*.json: Properties.DurationPolicy=HasDuration, Modifiers[].Attribute.AttributeName, ModifierMagnitude.ScalableFloatMagnitude.Value',
  effects,allowed:policy.allowed},null,0)+'\n';
fs.writeFileSync(out,json);
const policyJson=JSON.stringify(policy,null,2)+'\n';
fs.writeFileSync(path.join(path.dirname(out),'capture-build-policy.json'),policyJson);
const list=Object.values(effects).flatMap(e=>e.modifiers);
console.log(JSON.stringify({effects:Object.keys(effects).length,percentKnown:list.filter(m=>m.kind==='percent'&&m.magnitude!==null).length,
  percentUnknown:list.filter(m=>m.kind==='percent'&&m.magnitude===null).length,flat:list.filter(m=>m.kind==='flat').length}));
})().catch(error=>{console.error(error);process.exit(1);});
