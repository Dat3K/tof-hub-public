import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {constants,createCipheriv,createHash,generateKeyPairSync,publicEncrypt,randomBytes,verify} from 'node:crypto';
import rawFixture from '../../../../packages/contracts/src/__fixtures__/build-capture.json';
import {canonicalJson,PlayerSnapshotSchema} from '@tof-hub/contracts';
import {BuildImportService} from './build-import.service';
import {scanFixture} from '../import/scan-session.fixture';
import {buildFixture as fixture,oldBuild} from '../import/capture-import-policy.fixture';

const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const original=process.env.WISH_IMPORT_PRIVATE_KEY_PEM;
let service:BuildImportService;
// Rankable cards are stored before the import succeeds; tests that do not inspect storage use no-op stores.
const noopStore={store:async()=>({})},noopPioneer={store:async()=>({}),invalidateGlobal:()=>{}};
beforeEach(()=>{process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();service=new BuildImportService(noopStore as never,null,noopPioneer as never);});
afterEach(()=>{if(original===undefined)delete process.env.WISH_IMPORT_PRIVATE_KEY_PEM;else process.env.WISH_IMPORT_PRIVATE_KEY_PEM=original;});
function seal(value:unknown,format='tof-hub-build-sealed') {
  const key=randomBytes(32),nonce=randomBytes(12),keyId=service.getPublicKey().key_id!;
  const cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(Buffer.from(`${format}:1:${keyId}`));
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return {format,version:1,key_id:keyId,wrapped_key:publicEncrypt({key:pair.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64url'),
    nonce:nonce.toString('base64url'),ciphertext:ciphertext.toString('base64url'),tag:cipher.getAuthTag().toString('base64url')};
}
describe('encrypted card import',()=>{
  it('normalizes Capture 2.0.0 UID before storage and signing the returned card',async()=>{
    const snapshots:unknown[]=[];
    const importer=new BuildImportService({store:async(snapshot:unknown)=>{snapshots.push(snapshot);return {};}} as never);
    const payload={...fixture,capture:{...fixture.capture,exporterVersion:'2.0.0',subject:{uid:'1300701214',roleId:'55864639620286'}}};
    const result=await importer.import(seal(payload));
    expect(result.uid).toBe('130071214');
    expect(result.data.capture.subject.uid).toBe('130071214');
    expect(snapshots[0]).toMatchObject({player:{uid:'130071214',roleId:'55864639620286'}});
    expect(result.source.digest).toBe(createHash('sha256').update(canonicalJson(result.data)).digest('hex'));
  });
  it.each(['idle','capturing','interrupted'] as const)('accepts %s gear without creating a verified combat build',async status=>{
    const snapshots:unknown[]=[];
    const importer=new BuildImportService({store:async(snapshot:unknown)=>{snapshots.push(snapshot);return {};}} as never);
    const payload={...fixture,capture:{...fixture.capture,scan:{...scanFixture('live'),status,finishedAt:null}}};
    await expect(importer.import(seal(payload))).resolves.toMatchObject({success:true,data:{capture:{scan:{status}}}});
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({source:'self'});
    expect(snapshots[0]).not.toHaveProperty('build');
  });
  it('archives only validated envelopes, including view-only cards, before ranking storage can fail',async()=>{
    const accepted:unknown[]=[];
    const importer=new BuildImportService({store:async()=>{throw new Error('database unavailable');}} as never,
      null,null,null,null,null,null,null,{acceptedImport:async(kind:string,envelope:unknown,owner:unknown)=>{accepted.push([kind,envelope,owner]);}} as never);
    const envelope=seal(fixture);
    await expect(importer.import({...envelope,tag:'A'.repeat(22)})).rejects.toThrow();
    await expect(importer.import(seal({...fixture,gear:[...fixture.gear,fixture.gear[0]]}))).rejects.toThrow();
    expect(accepted).toHaveLength(0);
    await expect(importer.import(envelope)).rejects.toThrow('Could not save');
    expect(accepted).toEqual([['build',envelope,{uid:fixture.capture.subject.uid,nickname:fixture.profile.name}]]);
    const viewOnly=seal({...fixture,capture:{...fixture.capture,scan:scanFixture('unknown')}});
    await expect(importer.import(viewOnly)).resolves.toMatchObject({success:true});
    expect(accepted).toEqual([['build',envelope,{uid:fixture.capture.subject.uid,nickname:fixture.profile.name}],['build',viewOnly,{uid:fixture.capture.subject.uid,nickname:fixture.profile.name}]]);
  });
  it('preserves optional PWG data, stores it by game UID, and rejects mismatched identities or unavailable storage',async()=>{
    const pwg={uid:'60832888',roleId:'55924769165687',serverId:'13021',appId:'1000129',observedAt:fixture.capture.capturedAt,source:'HottaBrowser.log'};
    const payload={...fixture,capture:{...fixture.capture,subject:{uid:'130214471',roleId:pwg.roleId}},pwg};
    await expect(service.import(seal(payload))).rejects.toThrow('PWG identity storage');
    const records:{uid:string;pwg:unknown;digest:string}[]=[];
    const stored=new BuildImportService(noopStore as never,null,null,null,null,{remember:async(card:typeof payload,digest:string)=>{records.push({uid:card.capture.subject.uid,pwg:card.pwg,digest});}} as never);
    const result=await stored.import(seal(payload));
    expect(result.data.pwg).toEqual(pwg);
    expect(records).toEqual([{uid:'130214471',pwg,digest:result.source.digest}]);
    await expect(stored.import(seal({...payload,pwg:{...pwg,roleId:'55924769165688'}}))).rejects.toThrow('The capture data format is not supported');
    expect(records).toHaveLength(1);
    await expect(service.import(seal(fixture))).resolves.toMatchObject({success:true});
  });
  it('records negative current CS for live, Pioneer and DEV files before ranking gates and keeps live snapshots valid',async()=>{
    const observations:unknown[]=[],snapshots:unknown[]=[];
    const stored=new BuildImportService({store:async(snapshot:unknown)=>{snapshots.push(snapshot);return {};}} as never,null,
      {store:async(snapshot:unknown)=>{snapshots.push(snapshot);return {};},invalidateGlobal:()=>{}} as never,null,
      {observe:async(rows:unknown)=>{observations.push(rows);return 1;}} as never);
    for(const distribution of ['global-live','global-pioneer','korea-dev','taiwan-dev'] as const) {
      const payload={...fixture,profile:{...fixture.profile,cs:-900},capture:{...fixture.capture,
        scan:{...scanFixture(distribution==='global-live'?'live':'test'),distribution}}};
      await expect(stored.import(seal(payload))).resolves.toMatchObject({data:{profile:{cs:-900}}});
    }
    expect(observations).toHaveLength(4);
    expect(observations[0]).toMatchObject([{uid:fixture.capture.subject.uid,cs:-900,capturedAt:fixture.capture.capturedAt}]);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toMatchObject({build:{combatScore:null}});
    expect(snapshots[1]).not.toHaveProperty('build');
    for(const snapshot of snapshots) {
      expect(PlayerSnapshotSchema.safeParse(snapshot).success).toBe(true);
      expect((snapshot as {player:object}).player).not.toHaveProperty('combatScore',-900);
    }
  });
  it('stores a compact queue summary instead of the private card, inventory and signature',async()=>{
    let handler:((payload:Buffer,context:{ip:string})=>Promise<unknown>)|undefined;
    const queue={register:(_kind:string,run:typeof handler)=>{handler=run;}};
    const queued=new BuildImportService(noopStore as never,queue as never);
    queued.onModuleInit();
    const inventory=[{itemId:'visor_OS_red',stats:[{attribute:'FireAtkAdded',value:1274.852539,tag:null}],beforeTitan:[{attribute:'FireAtkAdded',value:886.617493}],rolls:1,augmentCount:249}];
    const result=await handler!(Buffer.from(JSON.stringify(seal({...fixture,inventory}))),{ip:'192.0.2.1'});
    const output=result as {result:unknown;delivery:{data:unknown;inventory:unknown;source:unknown}};
    expect(output.result).toEqual({success:true,uid:fixture.capture.subject.uid,name:fixture.profile.name,region:'EU',server:'Kuura',gear:fixture.gear.length});
    expect(output.result).not.toHaveProperty('data');
    expect(output.result).not.toHaveProperty('inventory');
    expect(output.result).not.toHaveProperty('source');
    expect(output.delivery).toHaveProperty('data');
    expect(output.delivery).toHaveProperty('inventory',inventory);
    expect(output.delivery).toHaveProperty('source.digest');
  });

  it('accepts a completed partial build with permitted food and shots and keeps the actual login date',async()=>{
    const observed:unknown[]=[];
    const stored=new BuildImportService({store:async(snapshot:unknown)=>{observed.push(snapshot);return {};}} as never);
    const capturedAt='2026-10-11T10:00:00.000Z';
    const scan={...scanFixture('live'),startedAt:'2026-10-11T09:00:00.000Z',finishedAt:'2026-10-11T10:05:00.000Z'};
    const records=['Default__buff_AddFireAtkFoodBase_C','Default__Buff_Jiuyu_Cooking34_C','Default__Buff_Jiuyu_Cooking35_C']
      .map(definition=>({definition,stackCount:1,durationSeconds:900,remainingSeconds:800,expiresAt:null}));
    const payload={...fixture,schemaVersion:3,capture:{...fixture.capture,capturedAt,exporterVersion:'2.0.0',scan},
      availability:{equippedMatrices:{state:'waiting',observedAt:null}},weapons:[],gear:[],matrices:[],buffs:{...fixture.buffs,records}};
    const imported=await stored.import(seal(payload));
    expect(imported.data.matrices).toEqual([]);expect(imported.data.gear).toEqual([]);
    expect(imported.data.availability.equippedMatrices).toMatchObject({state:'waiting'});
    expect(observed[0]).toMatchObject({capturedAt,gear:[],player:{nickname:fixture.profile.name}});
  });
  it('accepts older capture apps and unfinished gear without creating complete cards',async()=>{
    const normal:unknown[]=[],pioneer:unknown[]=[];
    const stored=new BuildImportService({store:async(snapshot:unknown)=>{normal.push(snapshot);return {};}} as never,null,
      {store:async(snapshot:unknown,provenance:unknown)=>{pioneer.push({snapshot,provenance});return {};},invalidateGlobal:()=>{}} as never);
    const build=oldBuild();
    const imported=await stored.import(seal(build));
    expect(imported.data.capture.scan?.status).toBe('capturing');
    expect(imported).not.toHaveProperty('outdatedExporter');expect(imported.source.signature).toBeTruthy();
    await stored.import(seal(oldBuild('global-pioneer')));
    expect(normal).toHaveLength(1);expect(pioneer).toHaveLength(1);
    const current=await stored.import(seal({...build,capture:{...build.capture,exporterVersion:'2.0.0'}}));
    expect(current).not.toHaveProperty('outdatedExporter');
    expect(normal).toHaveLength(2);expect(normal[1]).not.toHaveProperty('build');
    await stored.import(seal({...build,capture:{...build.capture,exporterVersion:'2.0.0',scan:{...build.capture.scan!,status:'interrupted',finishedAt:null}}}));
    expect(normal).toHaveLength(3);expect(normal[2]).not.toHaveProperty('build');
  });
  it('shows a live card of an unknown or Warp (MMO) server without storing anything',async()=>{
    let writes=0;
    const stored=new BuildImportService({store:async()=>{writes++;return {};}} as never,null,noopPioneer as never);
    for(const [uid,refusal] of [[rawFixture.capture.subject.uid,'unknown-server'],['888810312345','unsupported-game']] as const) {
      const imported=await stored.import(seal({...fixture,capture:{...fixture.capture,subject:{...fixture.capture.subject,uid}}}));
      expect(imported).toMatchObject({success:true,serverRefusal:refusal});expect(imported.source.signature).toBeTruthy();
    }
    expect(writes).toBe(0);
  });
  it('stores a Warp (MMO) card with its mmo block as a player profile only',async()=>{
    const calls:{snapshot:Record<string,unknown>;upload:{kind:string};options:unknown}[]=[];
    const stored=new BuildImportService({store:async(snapshot:Record<string,unknown>,upload:{kind:string},options:unknown)=>{calls.push({snapshot,upload,options});return {};}} as never,null,noopPioneer as never);
    const mmo={weaponMode:'fixed' as const,panel:{MaxHP:2786640.75},slotCards:null,brainfield:null};
    const imported=await stored.import(seal({...fixture,capture:{...fixture.capture,subject:{...fixture.capture.subject,uid:'888810312345'}},mmo}));
    expect(imported).toMatchObject({success:true,serverRefusal:'unsupported-game'});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.upload.kind).toBe('build-mmo');expect(calls[0]!.options).toEqual({profileOnly:true});
    expect(calls[0]!.snapshot).not.toHaveProperty('gear');expect(calls[0]!.snapshot).not.toHaveProperty('build');
  });
  it('records test UIDs of a DEV file and shows its card without storing it',async()=>{
    const observed:unknown[]=[];
    const stored=new BuildImportService(null,null,null,{observe:async(rows:unknown)=>{observed.push(rows);return 1;}} as never);
    const build=oldBuild();build.capture.scan={...scanFixture(),distribution:'korea-dev'};
    await expect(stored.import(seal(build))).resolves.toMatchObject({source:{signature:expect.any(String)}});
    expect(observed[0]).toMatchObject([{uid:fixture.capture.subject.uid,scan:{distribution:'korea-dev'}}]);
  });
  it('routes Pioneer gear separately and shows TW/KR DEV cards without any write',async()=>{
    let normal=0;const received:unknown[]=[];
    const stored=new BuildImportService({store:async()=>{normal++;return {};}} as never,null,
      {store:async(snapshot:unknown,provenance:unknown)=>{received.push({snapshot,provenance});return {};}} as never);
    const payload=(distribution:string)=>({...fixture,schemaVersion:3,capture:{...fixture.capture,scan:{...scanFixture(),distribution}}});
    await stored.import(seal(payload('global-pioneer')));
    expect(normal).toBe(0);expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({provenance:{collectorUid:fixture.capture.subject.uid,scan:{distribution:'global-pioneer'}}});
    for(const distribution of ['taiwan-dev','korea-dev'])await expect(stored.import(seal(payload(distribution)))).resolves.toMatchObject({data:{capture:{scan:{distribution}}}});
    expect(normal).toBe(0);expect(received).toHaveLength(1);
  });
  it('opens and signs test and unresolved captures without writing a player, gear or Ranking',async()=>{
    let writes=0;
    const stored=new BuildImportService({store:async()=>{writes++;return {};}} as never);
    for(const environment of ['test','unknown'] as const) {
      const scan=scanFixture(environment),payload={...fixture,schemaVersion:3,capture:{...fixture.capture,scan}};
      const imported=await stored.import(seal(payload));
      expect(imported.data.capture.scan).toEqual(scan);expect(imported.source.signature).toBeTruthy();
    }
    expect(writes).toBe(0);
    await stored.import(seal({...fixture,schemaVersion:3,capture:{...fixture.capture,scan:scanFixture('live')}}));
    expect(writes).toBe(1);
  });
  it('returns exactly the validated card payload and a file digest, including unknown fields',async()=>{
    const result=await service.import(seal(fixture));expect(result.data).toEqual(fixture);
    expect(result.source).toMatchObject({kind:'file'});expect(result.source.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.data.support).toBeNull();expect(result.data.weaponSettings.nanYinMark).toBeNull();
    expect(service.getPublicKey().public_key_pem).not.toContain('PRIVATE');
  });
  it('returns the backpack beside the card, outside its digest and signature',async()=>{
    const inventory=[{itemId:'visor_OS_red',stats:[{attribute:'FireAtkAdded',value:1274.852539,tag:null}],beforeTitan:[{attribute:'FireAtkAdded',value:886.617493}],rolls:1,augmentCount:249}];
    const result=await service.import(seal({...fixture,inventory}));
    expect(result.inventory).toEqual(inventory);expect(result.data).toEqual(fixture);
    expect(result.source.digest).toBe((await service.import(seal(fixture))).source.digest);
    expect('inventory' in await service.import(seal(fixture))).toBe(false);
  });
  it('preserves large finite raw attributes through encrypted import and the stored build document',async()=>{
    const snapshots:unknown[]=[];
    const importer=new BuildImportService({store:async(snapshot:unknown)=>{snapshots.push(snapshot);return {};}} as never);
    const stats=[{attribute:'unmapped-capture-attribute',value:-3.708781352818919e26,tag:null}];
    const beforeTitan=[{attribute:'unmapped-capture-attribute',value:Number.MAX_VALUE}];
    const gear=fixture.gear.map((item,index)=>index===0?{...item,stats,beforeTitan}:item);
    const inventory=[{itemId:fixture.gear[0].itemId,stats,beforeTitan,rolls:1,augmentCount:0}];
    const result=await importer.import(seal({...fixture,gear,inventory}));
    expect(result.data.gear[0]).toMatchObject({stats,beforeTitan});
    expect(result.inventory).toEqual(inventory);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({build:{draft:{gear}}});
    expect(result.source.digest).toBe(createHash('sha256').update(canonicalJson(result.data)).digest('hex'));
  });
  it('signs the capture digest for the PNG provenance check with the published key',async()=>{
    const result=await service.import(seal(fixture));
    // The browser recomputes this digest from the stored capture (card-verification.ts, canonical key order).
    expect(result.source.digest).toBe(createHash('sha256').update(canonicalJson(result.data)).digest('hex'));
    const valid=(digest:string)=>verify('sha256',Buffer.from(`tof-hub-build-capture:1:${digest}`),
      {key:service.getPublicKey().public_key_pem!,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32},Buffer.from(result.source.signature,'base64url'));
    expect(valid(result.source.digest)).toBe(true);
    expect(valid('0'.repeat(64))).toBe(false);
  });
  it('rejects corruption, wrong keys and Wish envelopes',async()=>{
    const encrypted=seal(fixture);
    await expect(service.import({...encrypted,ciphertext:encrypted.ciphertext.slice(1)})).rejects.toThrow();
    await expect(service.import({...encrypted,key_id:'another-key'})).rejects.toThrow();
    await expect(service.import(seal(fixture,'tof-hub-wish-sealed'))).rejects.toThrow();
    await expect(service.import({...seal(fixture,'tof-hub-wish-sealed'),format:'tof-hub-build-sealed'})).rejects.toThrow();
  });
  it('rejects extra research data and duplicate slots instead of overwriting them',async()=>{
    await expect(service.import(seal({...fixture,rawHex:'deadbeef'}))).rejects.toThrow('The capture data format is not supported');
    await expect(service.import(seal({...fixture,weapons:[fixture.weapons[0],fixture.weapons[0]]}))).rejects.toThrow('Duplicate build slot');
    await expect(service.import(seal({...fixture,profile:{...fixture.profile,cs:NaN}}))).resolves.toBeTruthy(); // JSON encodes unavailable values as null.
    await expect(service.import(seal({...fixture,gear:[{...fixture.gear[0],enhancement:10000}]}))).rejects.toThrow();
  });
  it('stores every accepted card as a player snapshot with its file digest, and asks for a retry on storage errors',async()=>{
    const calls:{snapshot:{source:string;player:{uid?:string};gear?:unknown[]};upload:{kind:string;fileSha256:string}}[]=[];
    const store={store:async(snapshot:never,upload:never)=>{calls.push({snapshot,upload});return {};}};
    const stored=new BuildImportService(store as never);
    const result=await stored.import(seal(fixture),'192.0.2.1');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.snapshot).toMatchObject({source:'self',player:{uid:fixture.capture.subject.uid}});
    expect(calls[0]!.upload).toMatchObject({kind:'build',fileSha256:result.source.digest});
    expect(PlayerSnapshotSchema.safeParse(calls[0]!.snapshot).error).toBeUndefined();
    // A rankable card is stored before the import reports success; a storage failure is a retryable 503.
    const failing=new BuildImportService({store:async()=>{throw new Error('database down');}} as never);
    await expect(failing.import(seal(fixture))).rejects.toThrow('Please retry the import');
  });
});
