import {afterEach,describe,expect,it} from 'vitest';
import {BuildProfilesService,parseProfileSlot,profileSlot} from './build-profiles.service';
import {constants,createHash,generateKeyPairSync,sign} from 'node:crypto';
import {BuildCaptureSchema} from '@tof-hub/contracts';
import captureFixture from '../../../../packages/contracts/src/__fixtures__/build-capture.json';
import {scanFixture} from '../import/scan-session.fixture';

const driver=process.env.WISH_DB_DRIVER;
afterEach(()=>{if(driver===undefined)delete process.env.WISH_DB_DRIVER;else process.env.WISH_DB_DRIVER=driver;});

describe('build profiles',()=>{
  it('saves a signed live Warp card as the MMO build of a role and refuses Global or edited cards',async()=>{
    const previous=process.env.WISH_IMPORT_PRIVATE_KEY_PEM,pair=generateKeyPairSync('rsa',{modulusLength:2048});
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    try {
      const sealed=(value:unknown)=>{
        const capture=BuildCaptureSchema.parse(value),digest=createHash('sha256').update(JSON.stringify(capture)).digest('hex');
        return {capture,digest,signature:sign('sha256',Buffer.from(`tof-hub-build-capture:1:${digest}`),{key:pair.privateKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64url')};
      };
      const mmo={weaponMode:'regular',panel:{MaxHP:1},slotCards:null,brainfield:null};
      const warp=sealed({...captureFixture,mmo,capture:{...captureFixture.capture,subject:{uid:'888810112345',roleId:''},scan:scanFixture('live')}});
      let row:Record<string,unknown>|null=null;
      const service=new BuildProfilesService(null,{mmoBuildProfile:{findUnique:async()=>row,upsert:async({create}:{create:Record<string,unknown>})=>{row=create;return row;}}} as never);
      await expect(service.saveMmo({mode:'mmo',...warp,role:'balance'})).resolves.toMatchObject({uid:'888810112345',role:'balance',overwritten:false});
      expect(row).toMatchObject({uid:'888810112345',role:'balance'});
      await expect(service.saveMmo({mode:'mmo',...warp,role:'balance'})).rejects.toThrow('already saved');
      const restored=await service.getMmo('888810112345','balance');
      expect(service.verifySignedCapture(restored.capture,restored.source.digest,restored.source.signature).mmo).toEqual(mmo);
      // A Global (non-Warp) character and a DEV/test scan are refused; an edited capture fails the signature.
      await expect(service.saveMmo({mode:'mmo',...sealed({...captureFixture,mmo,capture:{...captureFixture.capture,scan:scanFixture('live')}}),role:'dps'})).rejects.toThrow('Warp');
      await expect(service.saveMmo({mode:'mmo',...sealed({...captureFixture,mmo,capture:{...captureFixture.capture,subject:{uid:'888810112345',roleId:''},scan:scanFixture('test')}}),role:'dps'})).rejects.toThrow('cannot be saved');
      await expect(service.saveMmo({mode:'mmo',...warp,capture:{...warp.capture,profile:{...warp.capture.profile,cs:1}},role:'dps',overwrite:true})).rejects.toThrow('not an unedited import');
    }finally{if(previous===undefined)delete process.env.WISH_IMPORT_PRIVATE_KEY_PEM;else process.env.WISH_IMPORT_PRIVATE_KEY_PEM=previous;}
  });
  it('retains the login-packet PWG identity when saving and reopening a signed profile',async()=>{
    const previous=process.env.WISH_IMPORT_PRIVATE_KEY_PEM,pair=generateKeyPairSync('rsa',{modulusLength:2048});
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    try {
      const roleId=((13021n<<32n)+4471n).toString();
      const capture=BuildCaptureSchema.parse({...captureFixture,capture:{...captureFixture.capture,subject:{uid:'1302104471',roleId},scan:scanFixture('live')},
        pwg:{uid:'60832888',roleId,serverId:'13021',appId:'1000129',observedAt:captureFixture.capture.capturedAt,source:'game-login-packet'}});
      const digest=createHash('sha256').update(JSON.stringify(capture)).digest('hex');
      const signature=sign('sha256',Buffer.from(`tof-hub-build-capture:1:${digest}`),{key:pair.privateKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64url');
      let row:Record<string,unknown>|null=null;
      const service=new BuildProfilesService(null,{buildProfile:{findUnique:async()=>row,upsert:async({create}:{create:Record<string,unknown>})=>{row=create;return row;}}} as never);
      await service.save({capture,digest,signature,role:'dps',element:'Physical'});
      expect(row).toMatchObject({uid:'130214471'});
      const restored=await service.get('1302104471','dps-physical');
      expect(restored.uid).toBe('130214471');
      expect((restored.capture as typeof capture).capture.subject.uid).toBe('1302104471');
      expect((restored.capture as {pwg:unknown}).pwg).toEqual(capture.pwg);
      expect(service.verifySignedCapture(restored.capture,restored.source.digest,restored.source.signature).pwg).toEqual(capture.pwg);
    }finally{if(previous===undefined)delete process.env.WISH_IMPORT_PRIVATE_KEY_PEM;else process.env.WISH_IMPORT_PRIVATE_KEY_PEM=previous;}
  });
  it('saves and queues signed partial live profiles without a pet and rejects tampering',async()=>{
    const originalKey=process.env.WISH_IMPORT_PRIVATE_KEY_PEM,pair=generateKeyPairSync('rsa',{modulusLength:2048});
    let writes=0,queued=0;
    try {
      process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
      const service=new BuildProfilesService({enqueue:async()=>{queued++;return {};}} as never,
        {buildProfile:{findUnique:async()=>null,upsert:async()=>{writes++;return {};}}} as never);
      const capture=BuildCaptureSchema.parse({...captureFixture,schemaVersion:3,pet:null,matrices:[],
        capture:{...captureFixture.capture,subject:{uid:'1300506653',roleId:''},scan:scanFixture('live')}});
      const digest=createHash('sha256').update(JSON.stringify(capture)).digest('hex');
      const signature=sign('sha256',Buffer.from(`tof-hub-build-capture:1:${digest}`),{key:pair.privateKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64url');
      const request={capture,digest,signature,role:'dps',element:'Frost'};
      await expect(service.save(request)).resolves.toMatchObject({slot:'dps-frost'});
      await expect(service.enqueue(request,'192.0.2.1')).resolves.toEqual({});
      capture.combat.hp=(capture.combat.hp??0)+1;
      await expect(service.save(request)).rejects.toThrow('not an unedited import');
      expect(writes).toBe(1);expect(queued).toBe(1);
    }finally {if(originalKey===undefined)delete process.env.WISH_IMPORT_PRIVATE_KEY_PEM;else process.env.WISH_IMPORT_PRIVATE_KEY_PEM=originalKey;}
  });
  it('rejects signed test captures in direct saves and queued submissions before any database write',async()=>{
    const originalKey=process.env.WISH_IMPORT_PRIVATE_KEY_PEM,pair=generateKeyPairSync('rsa',{modulusLength:2048});
    let databaseCalls=0,queueCalls=0;
    try {
      process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
      const service=new BuildProfilesService({enqueue:async()=>{queueCalls++;}} as never,
        {buildProfile:{findUnique:async()=>{databaseCalls++;},upsert:async()=>{databaseCalls++;}}} as never);
      for(const scan of [scanFixture('test'),scanFixture('unknown'),...(['idle','capturing','interrupted'] as const).map(status=>({...scanFixture('live'),status,finishedAt:null}))]) {
        const capture=BuildCaptureSchema.parse({...captureFixture,schemaVersion:3,capture:{...captureFixture.capture,scan}});
        const digest=createHash('sha256').update(JSON.stringify(capture)).digest('hex');
        const signature=sign('sha256',Buffer.from(`tof-hub-build-capture:1:${digest}`),{key:pair.privateKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64url');
        const request={capture,digest,signature,role:'dps',element:'Frost'};
        await expect(service.save(request)).rejects.toThrow('cannot be saved');
        await expect(service.enqueue(request,'192.0.2.1')).rejects.toThrow('cannot be saved');
      }
      expect(databaseCalls).toBe(0);expect(queueCalls).toBe(0);
    }finally {if(originalKey===undefined)delete process.env.WISH_IMPORT_PRIVATE_KEY_PEM;else process.env.WISH_IMPORT_PRIVATE_KEY_PEM=originalKey;}
  });
  it('names slots role-element and rejects unknown ones',()=>{
    expect(profileSlot('dps','Frost')).toBe('dps-frost');
    expect(parseProfileSlot('tank-physical')).toEqual({role:'tank',element:'Physical'});
    for(const slot of ['dps','dps-fire','support-frost','DPS-Frost',''])expect(parseProfileSlot(slot)).toBeNull();
  });
  it('lists nothing without Postgres and refuses saving there',async()=>{
    delete process.env.WISH_DB_DRIVER;
    const service=new BuildProfilesService();
    await expect(service.list('1300506653')).resolves.toEqual({available:false,profiles:[]});
    await expect(service.list('../etc')).rejects.toThrow();
    await expect(service.save({})).rejects.toThrow('Profiles are not available here');
  });
});
