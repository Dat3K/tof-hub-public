const sitePaths=require('../lib/site-paths.cjs');
// Elemental weapon resonance ATK% and RES% from the resonance skill: the raw numeric ATK / DEF parameter when exported,
// otherwise the game's English skill text ("Increase flame ATK by 15% and flame resistance by 25%" / "Frost ATK +15%, Frost resistance +25%").
// Standalone: `node scripts/generators/build-resonance-attack.cjs` patches generated build-page.json and the test fixture.
const fs=require('node:fs');
const path=require('node:path');
function resonanceAttackPercent({parameterValue,description}) {
  if(Number.isFinite(parameterValue))return parameterValue/100;
  const match=/ATK (?:by |\+)(\d+(?:\.\d+)?)%/i.exec(description??'');
  return match?Number(match[1])/100:null;
}
function resonanceResistancePercent({parameterValue,description}) {
  if(Number.isFinite(parameterValue))return parameterValue/100;
  const match=/resistance (?:by |\+)(\d+(?:\.\d+)?)%/i.exec(description??'');
  return match?Number(match[1])/100:null;
}
module.exports=resonanceAttackPercent;
module.exports.resistance=resonanceResistancePercent;
if(require.main===module) {
  const web=sitePaths.webDir;
  for(const file of [path.join(sitePaths.publicDir,'game-data/build-page.json'),...(sitePaths.writesRepoFixtures?[path.join(web,'src/features/build/__fixtures__/catalog.json')]:[])]) {
    if(!fs.existsSync(file))continue;
    const catalog=JSON.parse(fs.readFileSync(file,'utf8'));
    let missing=0;
    for(const weapon of catalog.weapons)for(const resonance of weapon.resonances??[]) {
      const value=resonanceAttackPercent({description:resonance.description?.en});
      if(value===null){missing++;delete resonance.attackPercent;}else resonance.attackPercent=value;
      const resistance=resonanceResistancePercent({description:resonance.description?.en});
      if(resistance===null)delete resonance.resistancePercent;else resonance.resistancePercent=resistance;
    }
    fs.writeFileSync(file,JSON.stringify(catalog,null,file.includes('__fixtures__')?2:0)+'\n');
    console.log('Patched',path.relative(process.cwd(),file),missing?`(${missing} without ATK%)`:'');
  }
}
