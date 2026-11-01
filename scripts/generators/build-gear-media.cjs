// Global equipment textures follow the raw SSR -> Augmented -> Titan item links.
const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');
const sharp=sitePaths.sharp();
module.exports=async function gearMedia({pub,raw}) {
  const source='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/EquipmentDataTable_Overseas.json';
  const rows=JSON.parse(fs.readFileSync(path.join(raw,source),'utf8'))[0].Rows;
  const baseIds={helmet:'helmet_orange',spaulders:'shawl_orange',armor:'cloth_orange',bracers:'armband_orange',belt:'belt_orange',pants:'pants_orange',boots:'shoes_orange',gloves:'glove_orange',visor:'visor_OS_orange',core:'core_OS_orange',exoskeleton:'exoskeleton_OS_orange',reactor:'reactor_OS_orange'};
  const assets=new Map();
  const gear=Object.fromEntries(Object.entries(baseIds).map(([id,itemId])=>{
    const base=rows[itemId];if(!base)throw new Error('Missing Global gear '+itemId);
    const icons=Object.fromEntries(Object.entries({normal:itemId,augmented:base.TupoOrangeItemID,titan:base.TupoRedItemID}).map(([stage,rowId])=>{
      const row=rows[rowId];if(!row||row.EquipmentSlotType!==base.EquipmentSlotType)throw new Error('Invalid gear stage '+rowId);
      const ref=row.ItemIcon.AssetPathName;
      if(!ref.startsWith('/Game/'))throw new Error('Invalid gear texture '+rowId);
      const relative='Hotta/Content/'+ref.slice(6).split('.')[0];
      const rawPath=relative+'.png',url='/game-assets/webp/'+relative+'.webp';
      if(!fs.existsSync(path.join(raw,rawPath)))throw new Error('Missing raw gear image '+rawPath);
      assets.set(url,{rawPath,url,processing:'webp-lossless'});
      return [stage,url];
    }));
    return [id,{itemId,itemIds:{normal:itemId,augmented:base.TupoOrangeItemID,titan:base.TupoRedItemID},slot:base.EquipmentSlotType,resonanceEligible:base.StrengthenPackID==='Equip_strengthen_cost',icons}];
  }));
  const manifest={schemaVersion:1,source,region:'Global',assets:[...assets.values()]};
  const directory=path.join(pub,'game-data');fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'build-gear-media.json'),JSON.stringify(manifest,null,2)+'\n');
  for(const asset of assets.values()) {
    const target=path.join(pub,asset.url);fs.mkdirSync(path.dirname(target),{recursive:true});
    await sharp(path.join(raw,asset.rawPath)).webp({lossless:true}).toFile(target);
    const meta=await sharp(target).metadata();if(meta.format!=='webp'||!meta.width||!meta.height)throw new Error('Invalid gear asset '+target);
  }
  fs.writeFileSync(path.join(directory,'build-gear-icons.json'),JSON.stringify({schemaVersion:1,source,region:'Global',gear},null,2)+'\n');
  return gear;
};
