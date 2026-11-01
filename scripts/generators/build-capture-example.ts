import fs from 'node:fs';
import path from 'node:path';
import {constants,createHash,createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {BuildCaptureSchema} from '@tof-hub/contracts';
import {draftFromCapture,inventoryFromCapture,type CaptureImportCatalog} from '../../apps/web/src/features/build/capture-import';
import {restoreDraft,totalAugmentationSpent} from '../../apps/web/src/features/build/model';
import type {BuildCatalog} from '../../apps/web/src/features/build/types';
import type {TemporaryAttackCatalog} from '@tof-hub/game-domain';
import {decryptEnvelope} from '../../apps/api/src/import/sealed-envelope';

const root=path.resolve(import.meta.dirname,'../..');
const option=(name:string)=>{const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1];};
// The game pipeline runs this pre-bundled; its data directory and output tree are passed in.
const dataDir=process.env.TOF_GENERATOR_DATA_DIR??path.join(root,'scripts/data');
const fixture=path.join(dataDir,'build-example.json');
const input=option('--input');
if(input){
  const envelope=JSON.parse(fs.readFileSync(input,'utf8'));
  const key=createPrivateKey(fs.readFileSync(option('--key')??path.join(root,'apps/api/.data/import-private.pem')));
  const raw=decryptEnvelope(envelope,key,768*1024) as Record<string,unknown>;
  // Keep the account counters shown in the public test example; inventory stays in the separate Optimizer fixture.
  const {inventory,...publicCapture}=raw;void inventory;
  const capture=BuildCaptureSchema.parse(publicCapture);
  const digest=createHash('sha256').update(JSON.stringify(capture)).digest('hex');
  const signature=sign('sha256',Buffer.from(`tof-hub-build-capture:1:${digest}`),{key,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64url');
  fs.mkdirSync(path.dirname(fixture),{recursive:true});
  const publicKeyPem=createPublicKey(key).export({type:'spki',format:'pem'}).toString();
  fs.writeFileSync(fixture,JSON.stringify({sourceFile:path.basename(input),capture,source:{digest,signature},publicKeyPem,inventory:inventory??[]})+'\n');
}
if(fs.existsSync(fixture)){
  const publicRoot=process.env.TOF_PUBLIC_DIR?path.join(process.env.TOF_PUBLIC_DIR,'game-data'):path.join(root,'apps/web/public/game-data');
  const target=option('--catalog')??path.join(publicRoot,'build-page.json');
  const catalog=JSON.parse(fs.readFileSync(target,'utf8')) as BuildCatalog;
  const example=JSON.parse(fs.readFileSync(fixture,'utf8'));
  const mapping=JSON.parse(fs.readFileSync(path.join(publicRoot,'capture-card-map.json'),'utf8')) as CaptureImportCatalog;
  const temporary=JSON.parse(fs.readFileSync(path.join(publicRoot,'temporary-attack-effects.json'),'utf8')) as TemporaryAttackCatalog;
  const draft=draftFromCapture(example.capture,catalog,mapping,'en',example.source.digest,temporary,example.source.signature);
  draft.demo=true;
  const presentationFile=path.join(dataDir,'build-example-presentation.json');
  const presentation=fs.existsSync(presentationFile)?JSON.parse(fs.readFileSync(presentationFile,'utf8')) as {art:BuildCatalog['demoDraft']['art'];markWeaponId?:string;petCustomName?:string}:null;
  if(presentation&&!catalog.artworks.some(art=>art.id===presentation.art.id))throw new Error('Build example artwork is missing from the generated catalog');
  draft.art={...draft.art,...(presentation?.art??catalog.demoDraft.art)};
  if(presentation?.markWeaponId){
    if(!draft.weapons.some(weapon=>catalog.weapons.find(item=>item.id===weapon.id)?.weaponId===presentation.markWeaponId))throw new Error('Example marked weapon is not equipped');
    draft.markWeaponId=presentation.markWeaponId;
  }
  if(presentation?.petCustomName)draft.pet.customName=presentation.petCustomName;
  if(!restoreDraft(draft,catalog))throw new Error('Generated example cannot be restored by the Build page');
  // Captured countdowns belong to their original observation, not the time someone opens an example.
  catalog.demoConsumableRemainingSeconds={};
  const pieces=inventoryFromCapture({...example.capture,inventory:example.inventory},draft,catalog,mapping);
  catalog.demoBackpack=pieces.map(piece=>({augmentCount:piece.gear.augmentCount??null}));
  const augmentationTotal=totalAugmentationSpent(draft,pieces.map(piece=>piece.gear));
  draft.augmentationSpent=augmentationTotal.unknown===0?augmentationTotal.total:null;
  catalog.demoDraft=draft;
  fs.writeFileSync(target,JSON.stringify(catalog)+'\n');
  const optimizerPieces=pieces.slice(0,50);
  fs.writeFileSync(path.join(publicRoot,'optimizer-demo.json'),JSON.stringify({schemaVersion:1,source:'demo',pieces:optimizerPieces})+'\n');
  console.log(`Build example generated from ${example.sourceFile}: ${draft.profile.name}, ${draft.gear.filter(piece=>piece.equipped).length} slots, ${pieces.length} backpack counts for Build, ${optimizerPieces.length} pieces for Optimizer.`);
}
