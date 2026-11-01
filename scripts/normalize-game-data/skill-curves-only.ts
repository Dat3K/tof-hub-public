import fs from 'node:fs';
import path from 'node:path';
import {findProjectRoot,loadPipelineEnv,tryGetRawGameSourceDir} from '../_shared';
import {loadSkillTipCurves,restoreSkillCurveTimes} from './skill-parameter-curves';

const projectRoot=findProjectRoot();
loadPipelineEnv(projectRoot);
const argument=process.argv.indexOf('--raw-source');
const rawRoot=argument>=0?process.argv[argument+1]:tryGetRawGameSourceDir({projectRoot});
if(!rawRoot)throw new Error('Raw source is required to restore skill curve coordinates.');
const curves=loadSkillTipCurves(rawRoot);
if(!curves.size)throw new Error('No SkillUpdateTips source curves were found.');
for(const base of ['apps/web/public/game-data','apps/web/public'])for(const locale of ['en','ru']){
  const file=path.join(projectRoot,base,locale,'simulacra.json');
  if(!fs.existsSync(file))continue;
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  let changed=0;
  for(const list of [data.gacha,data.items])if(Array.isArray(list))for(const item of list){
    if(item.server_mode==='mmo'||item.edition==='mmo'||String(item.id).endsWith('-mmo'))continue;
    changed+=restoreSkillCurveTimes(item.weapon,curves);
  }
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
  console.log(`${path.relative(projectRoot,file)}: ${changed} parameter curves restored`);
}
