import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {constants,createHash,generateKeyPairSync,sign} from 'node:crypto';
import capture from '../../../../../packages/contracts/src/__fixtures__/build-capture.json';
import {BuildCaptureSchema} from '@tof-hub/contracts';
import {draftFromCapture,type CaptureImportCatalog} from './capture-import';
import {verifyBuildCard} from './card-verification';
import {restoreDraft} from './model';
import type {BuildCatalog,BuildDraft} from './types';
import {scanFixture} from '../../../../../packages/contracts/src/__fixtures__/scan-session';

const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../public/game-data/build-page.json'),'utf8')) as BuildCatalog;
const mapping=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../public/game-data/capture-card-map.json'),'utf8')) as CaptureImportCatalog;
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const publicKeyPem=keys.publicKey.export({type:'spki',format:'pem'}).toString();
// Mirrors apps/api BuildImportService: digest of the validated payload, signed once per import.
const data=BuildCaptureSchema.parse(capture);
const digest=createHash('sha256').update(JSON.stringify(data)).digest('hex');
const signature=sign('sha256',Buffer.from(`tof-hub-build-capture:1:${digest}`),{key:keys.privateKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64url');
// The page keeps cards in localStorage and restores them on load.
const imported=(locale:'en'|'ru'='en')=>restoreDraft(JSON.parse(JSON.stringify(draftFromCapture(data,catalog,mapping,locale,digest,undefined,signature))),catalog)!;
const verify=(draft:BuildDraft,key=publicKeyPem)=>verifyBuildCard(draft,catalog,{publicKeyPem:key,mapping});

describe('PNG card provenance',()=>{
  it('compares signed unresolved gear locally while keeping export provenance and edit checks',async()=>{
    const unresolved=BuildCaptureSchema.parse({...data,capture:{...data.capture,scan:{...scanFixture('live'),environment:'unknown',environmentSource:'unknown',distribution:undefined,install:undefined}}});
    const hash=createHash('sha256').update(JSON.stringify(unresolved)).digest('hex');
    const proof=sign('sha256',Buffer.from(`tof-hub-build-capture:1:${hash}`),{key:keys.privateKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64url');
    const draft=draftFromCapture(unresolved,catalog,mapping,'en',hash,undefined,proof);
    draft.demo=true;
    const sources={publicKeyPem,mapping};
    expect(await verifyBuildCard(draft,catalog,sources)).toBe('unknown-server');
    expect(await verifyBuildCard(draft,catalog,sources,'ranking')).toBe('verified');
    draft.gear[0].rows[0].value++;
    expect(await verifyBuildCard(draft,catalog,sources,'ranking')).toBe('edited');
  });
  it.each(['idle','completed','capturing','interrupted'] as const)('keeps signing and publication rules for a %s partial capture',async status=>{
    const value=BuildCaptureSchema.parse({...capture,schemaVersion:3,
      capture:{...capture.capture,scan:{...scanFixture('live'),status,finishedAt:status==='completed'?scanFixture('live').finishedAt:null}},
      pet:null,matrices:[],support:null,computing:null,relics:[],
      availability:{selectedPet:{state:'waiting',observedAt:null},equippedMatrices:{state:'partial',observedAt:null}}});
    const hash=createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const signed=sign('sha256',Buffer.from(`tof-hub-build-capture:1:${hash}`),{key:keys.privateKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64url');
    for(const locale of ['en','ru'] as const) {
      const draft=restoreDraft(JSON.parse(JSON.stringify(draftFromCapture(value,catalog,mapping,locale,hash,undefined,signed))),catalog)!;
      expect(draft.pet.id).toBe('');expect(draft.captureSource!.unresolved.length).toBeGreaterThan(0);
      expect(await verify(draft)).toBe(status==='completed'?'verified':'incomplete-capture');
      expect(await verifyBuildCard(draft,catalog,{publicKeyPem,mapping},'ranking')).toBe('verified');
      draft.combat.hp+=1;expect(await verify(draft)).toBe(status==='completed'?'edited':'incomplete-capture');
    }
  });
  it('keeps the Pioneer flag through signed import, localStorage restore and edits',async()=>{
    const value=BuildCaptureSchema.parse({...capture,schemaVersion:3,capture:{...capture.capture,scan:{...scanFixture(),distribution:'global-pioneer'}}});
    const hash=createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const signed=sign('sha256',Buffer.from(`tof-hub-build-capture:1:${hash}`),{key:keys.privateKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64url');
    const draft=restoreDraft(JSON.parse(JSON.stringify(draftFromCapture(value,catalog,mapping,'en',hash,undefined,signed))),catalog)!;
    expect(await verify(draft)).toBe('pioneer-server');draft.weapons[0].level-=1;
    expect(await verify(draft)).toBe('pioneer-server');
  });
  it('retains the test-server export flag after editing, restoring and signing the capture',async()=>{
    for(const environment of ['test','unknown'] as const) {
      const value=BuildCaptureSchema.parse({...capture,schemaVersion:3,capture:{...capture.capture,scan:scanFixture(environment)}});
      const hash=createHash('sha256').update(JSON.stringify(value)).digest('hex');
      const signed=sign('sha256',Buffer.from(`tof-hub-build-capture:1:${hash}`),{key:keys.privateKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64url');
      const draft=restoreDraft(JSON.parse(JSON.stringify(draftFromCapture(value,catalog,mapping,'en',hash,undefined,signed))),catalog)!;
      const expected=environment==='test'?'test-server':'unknown-server';
      expect(await verify(draft)).toBe(expected);
      draft.weapons[0].level-=1;
      expect(await verify(draft)).toBe(expected);
      draft.captureSource!.capture.capture.scan!.environment='live';
      draft.captureSource!.capture.capture.scan!.environmentSource='manual';
      expect(await verify(draft)).toBe('edited');
    }
  });
  it('verifies an imported card in either locale and after allowed presentation edits',async()=>{
    expect(await verify(imported())).toBe('verified');
    expect(await verify(imported('ru'))).toBe('verified');
    const draft=imported();
    draft.enemyLevel=80;draft.profile.role='healer';draft.rv={element:'Volt',includeCrit:true,mode:'prv'};
    draft.art={...draft.art,zoom:1.4};draft.updatedAt='2026-10-06T19:00:00.000Z';
    expect(await verify(draft)).toBe('verified');
  });

  it('marks game-data edits, unsigned cards and a substituted capture as edited',async()=>{
    const gear=imported();gear.gear[0].rows[0].value+=1;
    expect(await verify(gear)).toBe('edited');
    const level=imported();level.weapons[0].level-=1;
    expect(await verify(level)).toBe('edited');
    const unsigned=imported();delete unsigned.captureSource!.signature;
    expect(await verify(unsigned)).toBe('edited');
    // Rewriting the stored capture (and its digest) to match an edit breaks the server signature.
    const forged=imported();forged.captureSource!.capture.profile.cs=(forged.captureSource!.capture.profile.cs??0)+1;
    forged.captureSource!.digest=createHash('sha256').update(JSON.stringify(forged.captureSource!.capture)).digest('hex');
    forged.profile.cs=Math.floor(forged.captureSource!.capture.profile.cs!);
    expect(await verify(forged)).toBe('edited');
    const otherKey=generateKeyPairSync('rsa',{modulusLength:2048}).publicKey.export({type:'spki',format:'pem'}).toString();
    expect(await verify(imported(),otherKey)).toBe('edited');
  });
});
