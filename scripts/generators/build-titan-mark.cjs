// Preserve the original game texture restored by the user-supplied legacy Titan icon mod.
const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=sitePaths.sharp();
module.exports=async function titanMark({pub}) {
  const source='scripts/data/media/legacy-titan/equiptupo_coin.png';
  const input=path.join(sitePaths.generatorDataDir,'media/legacy-titan/equiptupo_coin.png');
  const sha256=crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex');
  if(sha256!=='47841d887a7db8faa9bde1a23e1706bed1e9d122ffe38748b83d0de7680d4e88')throw new Error('Legacy Titan texture changed; review its provenance');
  const url='/game-assets/webp/legacy-titan/Hotta/Content/Resources/Icon/zujian/equiptupo_coin.webp';
  const target=path.join(pub,url);fs.mkdirSync(path.dirname(target),{recursive:true});
  await sharp(input).webp({lossless:true}).toFile(target);
  const metadata=await sharp(target).metadata();
  if(metadata.width!==256||metadata.height!==256||!metadata.hasAlpha)throw new Error('Invalid legacy Titan texture');
  const manifest={schemaVersion:1,source,sha256,url,processing:'webp-lossless',assetPath:'Hotta/Content/Resources/Icon/zujian/equiptupo_coin',
    archive:'Hotta-WindowsNoEditor_OldgeTitanGearICON_P.pak',archiveSha256:'a1d11637c88a2fa18c1e52da1411584680e88c7f0861c136482d531a82fd6d5d',region:'unknown',version:'legacy; exact game version unknown'};
  fs.mkdirSync(path.join(pub,'game-data'),{recursive:true});
  fs.writeFileSync(path.join(pub,'game-data/build-titan-mark.json'),JSON.stringify(manifest,null,2)+'\n');
  return url;
};
if(require.main===module)(async()=>{
  const pub=sitePaths.publicDir;
  const titanMark=await module.exports({pub});
  const file=path.join(pub,'game-data/build-page.json');
  const catalog=JSON.parse(fs.readFileSync(file,'utf8'));catalog.titanMark=titanMark;
  fs.writeFileSync(file,JSON.stringify(catalog)+'\n');
  console.log('Generated legacy Titan mark and updated build-page.json');
})().catch(error=>{console.error(error);process.exitCode=1;});
