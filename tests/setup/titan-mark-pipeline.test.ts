import {afterEach,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const generate=require('../../scripts/generators/build-titan-mark.cjs');
const sharp=require(require.resolve('sharp',{paths:[require.resolve('next',{paths:[path.resolve('apps/web')]})]}));
sharp.cache(false);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'tof-titan-pipeline-'));
afterEach(()=>{
  // Delete only the exact temporary directory created above.
  if(path.dirname(root)!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('tof-titan-pipeline-'))throw new Error('Unsafe test cleanup');
  fs.rmSync(root,{recursive:true,force:true});
});
it('restores the legacy icon in a clean output, preserves current game media, and regenerates losslessly',async()=>{
  const current=path.join(root,'game-assets/webp/Hotta/Content/Resources/Icon/zujian/equiptupo_coin.webp');
  fs.mkdirSync(path.dirname(current),{recursive:true});
  const sentinel=Buffer.from('current game texture must not be replaced');fs.writeFileSync(current,sentinel);
  const url=await generate({pub:root});
  const target=path.join(root,url);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'game-data/build-titan-mark.json'),'utf8'));
  expect(manifest.url).toBe(url);
  expect(fs.readFileSync(current)).toEqual(sentinel);
  const original=await sharp(path.resolve('scripts/data/media/legacy-titan/equiptupo_coin.png')).ensureAlpha().raw().toBuffer();
  const generated=await sharp(target).ensureAlpha().raw().toBuffer();
  expect(generated.length).toBe(original.length);
  let mismatches=0;
  for(let i=0;i<original.length;i+=4){
    if(generated[i+3]!==original[i+3])mismatches++;
    // WebP may discard RGB beneath fully transparent pixels; these cannot be displayed.
    if(original[i+3]>0)for(let channel=0;channel<3;channel++)if(generated[i+channel]!==original[i+channel])mismatches++;
  }
  expect(mismatches).toBe(0);
  const first=fs.readFileSync(target);
  fs.writeFileSync(target,Buffer.from('stale overwritten generated file'));
  expect(await generate({pub:root})).toBe(url);
  expect(fs.readFileSync(target).equals(first)).toBe(true);
});
