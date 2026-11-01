const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');
const sharp=sitePaths.sharp();

// Preserve the legacy Global AttributeID -> ModifyData join and SignIcon media.
module.exports=async function suppressorPreview({pub,raw}) {
  const source='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/DT_Suppressor_Overseas.json';
  const statsSource='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/ModifyDataTable_Overseas.json';
  const rows=JSON.parse(fs.readFileSync(path.join(raw,source),'utf8'))[0].Rows;
  const attributes=JSON.parse(fs.readFileSync(path.join(raw,statsSource),'utf8'))[0].Rows;
  const fields={CommonAtkAdded:'atk',MaxHealthAdded:'hp',CritAdded:'crit',ElementDef:'res'};
  const tiers=[];
  for(const id of Object.keys(rows).sort((a,b)=>{
    const [majorA,minorA]=a.split('_').map(Number),[majorB,minorB]=b.split('_').map(Number);
    return majorA-majorB||minorA-minorB;
  })) {
    const row=rows[id],mods=attributes[row.AttributeID]?.ModifyData||[];
    const stats=mods.length?{atk:0,hp:0,crit:0,res:0}:null;
    for(const mod of mods)if(fields[mod.PropName]) {
      const value=Number(mod.PropValue);
      if(!Number.isFinite(value))throw new Error('Invalid suppressor stat '+id);
      stats[fields[mod.PropName]]=mod.PropName==='MaxHealthAdded'?Math.round(value):Number(value.toFixed(1));
    }
    const ref=row.SignIcon.AssetPathName;
    if(!ref.startsWith('/Game/'))throw new Error('Invalid suppressor icon '+id);
    const relative='Hotta/Content/'+ref.slice(6).split('.')[0];
    const icon='/game-assets/webp/'+relative+'.webp',target=path.join(pub,icon);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    await sharp(path.join(raw,relative+'.png')).webp({lossless:true}).toFile(target);
    tiers.push({id,version:row.SuppressorVersion.SourceString,icon,stats});
  }
  fs.writeFileSync(path.join(pub,'game-data/build-suppressors.json'),JSON.stringify({schemaVersion:1,source,statsSource,tiers},null,2)+'\n');
  return tiers;
};
