// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {expect,it} from 'vitest';

it('regenerates link previews from changed normalized data in an isolated public tree', () => {
  const parent = path.resolve('ignore');
  fs.mkdirSync(parent,{recursive:true});
  const root = fs.mkdtempSync(path.join(parent,'seo-pipeline-'));
  const dataRoot = path.join(root,'game-data');
  fs.mkdirSync(path.join(dataRoot,'en'),{recursive:true});
  const write = (name:string, value:unknown) => fs.writeFileSync(path.join(dataRoot,name),JSON.stringify(value));
  const run = () => {
    execFileSync(process.execPath,['scripts/generators/build-link-previews.cjs'],{cwd:process.cwd(),env:{...process.env,TOF_PUBLIC_DIR:root},windowsHide:true});
    const manifest = JSON.parse(fs.readFileSync(path.join(dataRoot,'link-previews.json'),'utf8'));
    const entities = Object.values(manifest.datasets).flatMap(dataset => JSON.parse(fs.readFileSync(path.join(dataRoot,`${dataset}.json`),'utf8')).entities);
    return {...manifest,entities};
  };
  try {
    const character = {id:'sample',name_en:'Sample',name_ru:'Русское имя',rarity:'SSR',element:'Frost',role:'DPS',detail_art:'/generated/sample.webp'};
    write('en/simulacra.json',{gacha:[character],mmo:[]});
    write('en/food.json',{items:[{id:'dish',name_en:'Dish',effect_text:'<blue>Restores</blue> 5 Satiety &amp; energy.',icon:'/generated/dish.webp'}]});
    const first = run();
    expect(first.entities).toHaveLength(2);
    expect(first.entities.find((r:{section:string})=>r.section==='Simulacra')).toMatchObject({title:'Sample',image:'/generated/sample.webp'});
    expect(first.entities.find((r:{section:string})=>r.section==='Food').description).toBe('Restores 5 Satiety & energy.');
    expect(JSON.stringify(first)).not.toContain('Русское');
    write('en/simulacra.json',{gacha:[{...character,name_en:'Updated',detail_art:'/generated/new.webp'}],mmo:[]});
    expect(run().entities.find((r:{section:string})=>r.section==='Simulacra')).toMatchObject({title:'Updated',image:'/generated/new.webp'});
    expect(run()).toEqual(run());
  } finally {
    if(path.dirname(path.resolve(root))!==parent)throw new Error('Unexpected fixture root');
    fs.rmSync(root,{recursive:true,force:true});
  }
});
