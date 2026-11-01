import {afterEach,describe,it,expect} from 'vitest';
import {constants,createCipheriv,generateKeyPairSync,publicEncrypt,randomBytes} from 'node:crypto';
import {InspectImportService,playersImportQueueSummary} from './inspect-import.service';
import {IMPORT_KEY_ID} from '../import/sealed-envelope';
import {scanFixture} from '../import/scan-session.fixture';
import fixture from '../../../../packages/contracts/src/__fixtures__/build-capture.json';
const pair=generateKeyPairSync('rsa',{modulusLength:2048}),original=process.env.WISH_IMPORT_PRIVATE_KEY_PEM;
afterEach(()=>{if(original===undefined)delete process.env.WISH_IMPORT_PRIVATE_KEY_PEM;else process.env.WISH_IMPORT_PRIVATE_KEY_PEM=original;});
function seal(value:unknown) {
  const key=randomBytes(32),nonce=randomBytes(12),format='tof-hub-players-sealed',cipher=createCipheriv('aes-256-gcm',key,nonce);
  cipher.setAAD(Buffer.from(`${format}:1:${IMPORT_KEY_ID}`));
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return Buffer.from(JSON.stringify({format,version:1,key_id:IMPORT_KEY_ID,
    wrapped_key:publicEncrypt({key:pair.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64url'),
    nonce:nonce.toString('base64url'),ciphertext:ciphertext.toString('base64url'),tag:cipher.getAuthTag().toString('base64url')}));
}
describe('inspect environment gate',()=>{
  it('normalizes the observer and owner of a Capture 2.0.0 file before storage',async()=>{
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    const snapshots:unknown[]=[];
    const service=new InspectImportService({store:async(snapshot:unknown)=>{snapshots.push(snapshot);return {duplicate:false};}} as never);
    const owner={uid:'1300701214',role_id:'55864639620286',name:'stalkill',level:100,cs:123,max_cs:456,guild:null,title:null,
      captured_at:'2026-10-10T12:00:00Z',gear:[]};
    const result=await service.import(seal({version:1,export_metadata:{exporter_name:'tof-live-capture',exporter_version:'2.0.0',scan:scanFixture('live')},
      observer:{uid:owner.uid,role_id:owner.role_id,server_id:'13007'},players:[],owner}));
    expect(result.collectorUid).toBe('130071214');
    expect(result.players[0]?.uid).toBe('130071214');
    expect(snapshots[0]).toMatchObject({player:{uid:'130071214',roleId:owner.role_id}});
  });
  it.each(['idle','capturing','interrupted','completed'] as const)('accepts %s own gear without changing scan boundaries',async status=>{
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    const snapshots:unknown[]=[];
    const service=new InspectImportService({store:async(snapshot:unknown)=>{snapshots.push(snapshot);return {duplicate:false};}} as never);
    const scan={...scanFixture('live'),status,finishedAt:status==='completed'?scanFixture('live').finishedAt:null};
    const owner={uid:'130214471',role_id:'123',name:'Owner',level:100,cs:123,max_cs:456,guild:null,title:null,
      captured_at:'2026-10-10T12:00:00Z',gear:[]};
    const result=await service.import(seal({version:1,export_metadata:{exporter_name:'fixture',exporter_version:'2.0.0',scan},
      observer:{uid:owner.uid,role_id:owner.role_id,server_id:null},players:[],owner}));
    expect(result).toMatchObject({stored:1,rejected:0});
    expect(snapshots[0]).toMatchObject({source:'self'});
  });
  it('archives after authentication and source checks, before profile persistence',async()=>{
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    const accepted:unknown[]=[];
    const service=new InspectImportService({store:async()=>({duplicate:false})} as never,null,null,null,null,null,null,
      {acceptedImport:async(kind:string,envelope:unknown,owner:unknown)=>{accepted.push([kind,envelope,owner]);}} as never);
    const owner={uid:'130214471',role_id:'123',name:'Owner',level:100,cs:123,max_cs:456,guild:null,title:null,
      captured_at:'2026-10-10T12:00:00Z',gear:[]};
    const payload={version:1,export_metadata:{exporter_name:'fixture',exporter_version:'2.0.0',scan:scanFixture('live')},
      observer:{uid:owner.uid,role_id:owner.role_id,server_id:null},players:[],owner};
    const envelope=seal(payload);
    const damaged=JSON.parse(envelope.toString());damaged.tag='A'.repeat(22);
    await expect(service.import(Buffer.from(JSON.stringify(damaged)))).rejects.toThrow();
    await expect(service.import(seal({...payload,observer:{...payload.observer,uid:'130214472'}}))).rejects.toThrow('Owner');
    expect(accepted).toHaveLength(0);
    await service.import(envelope);
    expect(accepted).toEqual([['players',JSON.parse(envelope.toString()),{uid:owner.uid,nickname:owner.name}]]);
    const observed={...owner,properties:{},last_seen_at:owner.captured_at,profile_captured_at:owner.captured_at};
    await service.import(seal({...payload,owner:undefined,players:[observed]}));
    expect((accepted[1] as unknown[])[2]).toEqual({uid:owner.uid,nickname:owner.name});
    await service.import(seal({...payload,owner:undefined,players:[{...observed,uid:'130214472',name:'Another player'}]}));
    expect((accepted[2] as unknown[])[2]).toEqual({uid:owner.uid,nickname:null});
  });
  it('records raw negative CS for owner and inspected profiles across live, Pioneer and KR/TW marks-only imports',async()=>{
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    const observations:unknown[]=[];
    const service=new InspectImportService({store:async()=>({duplicate:false})} as never,null,
      {store:async()=>({duplicate:false}),invalidateGlobal:()=>{}} as never,{observe:async()=>2} as never,
      {observe:async(rows:unknown)=>{observations.push(rows);return 2;}} as never);
    for(const distribution of ['global-live','global-pioneer','korea-dev','taiwan-dev'] as const) {
      const scan={...scanFixture(distribution==='global-live'?'live':'test'),distribution};
      const owner={uid:'130214471',role_id:'123',name:'Owner',level:100,cs:-100,max_cs:456,guild:null,title:null,
        captured_at:'2026-10-10T12:00:00Z',gear:[]};
      const player={...owner,uid:'130214472',role_id:'124',cs:-900,properties:{},last_seen_at:owner.captured_at,profile_captured_at:owner.captured_at,scan};
      await expect(service.import(seal({version:1,export_metadata:{exporter_name:'fixture',exporter_version:'2.0.0',scan},
        observer:{uid:owner.uid,role_id:owner.role_id,server_id:null},players:[player],owner}))).resolves.toMatchObject({rejected:0});
    }
    expect(observations).toHaveLength(4);
    expect(observations[0]).toMatchObject([{uid:'130214471',cs:-100},{uid:'130214472',cs:-900}]);
  });
  it('keeps only the player summary fields in private queue history',()=>{
    expect(playersImportQueueSummary({files:2,stored:1,duplicates:0,rejected:1,region:'EU',server:'Aida',players:[
      {uid:'130214471',name:'Player',gear:8,status:'new'},
      {uid:null,name:null,gear:0,status:'rejected'},
    ],debug:'discard me'} as never)).toEqual({total:2,stored:1,duplicates:0,rejected:1,region:'EU',server:'Aida',players:[
      {uid:'130214471',name:'Player',gear:8,status:'new'},
      {uid:null,name:null,gear:0,status:'rejected'},
    ]});
  });

  it('imports an owner-only file and prefers owner gear when either UID or RoleID duplicates an inspected profile',async()=>{
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    const writes:unknown[]=[];
    const service=new InspectImportService({store:async(snapshot:unknown)=>{writes.push(snapshot);return {duplicate:false};}} as never);
    const owner={uid:'130214471',role_id:'55924769165687',name:' blank ',level:100,cs:123,max_cs:456,guild:null,title:null,
      captured_at:'2026-10-10T12:00:00Z',gear:fixture.gear};
    const bundle={version:1,export_metadata:{exporter_name:'tof-live-capture',exporter_version:'2.0.0',scan:scanFixture('live')},
      observer:{uid:owner.uid,role_id:owner.role_id,server_id:'13021'},players:[],owner};
    await expect(service.import(seal(bundle))).resolves.toMatchObject({files:1,stored:1,rejected:0});
    expect(writes[0]).toMatchObject({source:'self',player:{uid:owner.uid,nickname:' blank ',maxCombatScore:456}});
    expect(writes[0]).not.toHaveProperty('build');
    const player={...owner,properties:{},last_seen_at:owner.captured_at,profile_captured_at:null};
    await expect(service.import(seal({...bundle,players:[player,{...player,uid:'130214472'}]}))).resolves.toMatchObject({files:1,stored:1});
    expect(writes).toHaveLength(2);
    await expect(service.import(seal({...bundle,owner:{...owner,uid:'1302104499'}}))).rejects.toThrow('observer');
    expect(writes).toHaveLength(2);
  });
  it('accepts KR DEV marks including the observer without writing live gear',async()=>{
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    const observed:unknown[]=[];
    const service=new InspectImportService({store:async()=>{throw new Error('must not store');}} as never,null,null,
      {observe:async(rows:unknown)=>{observed.push(rows);return 2;}} as never);
    const scan={...scanFixture(),distribution:'korea-dev'};
    const player={uid:'9999005123456',role_id:null,name:'Fixture',level:null,cs:null,max_cs:null,guild:null,title:null,properties:{},last_seen_at:scan.startedAt,profile_captured_at:null,scan};
    await expect(service.import(seal({version:1,export_metadata:{exporter_name:'tof-live-capture',exporter_version:'2.0.0',scan},observer:{uid:'9999005999999',role_id:null,server_id:'9999005'},players:[player]}))).resolves.toMatchObject({observationsOnly:true,observed:2,stored:0,rejected:0});
    expect(observed[0]).toMatchObject([{uid:'9999005999999'}, {uid:'9999005123456',nickname:'Fixture'}]);
  });
  it('prefers an exact owner observation to the same UID in observer scan boundaries',async()=>{
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    const observed:unknown[]=[];
    const service=new InspectImportService(null,null,null,{observe:async(rows:unknown)=>{observed.push(rows);return 1;}} as never);
    const scan={...scanFixture(),distribution:'korea-dev'};
    const owner={uid:'9999005123456',role_id:'123',name:'Owner',level:null,cs:null,max_cs:null,guild:null,title:null,captured_at:'2026-10-10T12:00:00Z',gear:[]};
    await service.import(seal({version:1,export_metadata:{exporter_name:'tof-live-capture',exporter_version:'2.0.0',scan},
      observer:{uid:owner.uid,role_id:owner.role_id,server_id:null},owner,players:[]}));
    expect(observed[0]).toEqual([{uid:owner.uid,roleId:owner.role_id,nickname:owner.name,scan,capturedAt:owner.captured_at}]);
  });
  it('stores Pioneer via its own pool, keeping collector identity and requiring each source scan',async()=>{
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    let normal=0;const received:unknown[]=[];
    const service=new InspectImportService({store:async()=>{normal++;}} as never,null,
      {store:async(snapshot:unknown,provenance:unknown)=>{received.push({snapshot,provenance});return {duplicate:false,gearStored:0};}} as never);
    const scan={...scanFixture(),distribution:'global-pioneer'};
    const player={uid:'10000002',role_id:null,name:'Fixture',level:null,cs:null,max_cs:null,guild:null,title:null,properties:{},last_seen_at:'2026-10-09T12:00:00Z',profile_captured_at:null,scan};
    const bundle={version:1,export_metadata:{exporter_name:'tof-live-capture',exporter_version:'2.0.0',scan},observer:{uid:'10000001',role_id:null,server_id:null},players:[player]};
    await expect(service.import(seal(bundle))).resolves.toMatchObject({stored:1,rejected:0});
    expect(normal).toBe(0);expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({provenance:{collectorUid:'10000001',scan:{distribution:'global-pioneer'}}});
    await expect(service.import(seal({...bundle,players:[{...player,scan:undefined}]}))).rejects.toThrow('source scan');
    await expect(service.import(seal({...bundle,players:[player,{...player,scan:{...scan,distribution:'korea-dev'}}]}))).rejects.toThrow('cannot enter Ranking');
    expect(received).toHaveLength(1);
  });
  it('accepts TW DEV marks without the scoring catalog/store and rejects mixed clients before ledger writes',async()=>{
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    const observed:unknown[]=[];
    const service=new InspectImportService(null,null,null,{observe:async(rows:unknown)=>{observed.push(rows);return 1;}} as never);
    const scan={...scanFixture(),distribution:'taiwan-dev'};
    const player={uid:'1150001365216',role_id:null,name:'TW fixture',level:null,cs:null,max_cs:null,guild:null,title:null,properties:{},
      first_seen_at:'2026-10-10T10:00:00Z',last_seen_at:'2026-10-10T12:00:00Z',profile_captured_at:null,scan};
    const bundle={version:1,export_metadata:{exporter_name:'tof-live-capture',exporter_version:'2.0.0',scan},
      observer:{uid:null,role_id:null,server_id:null},players:[player]};
    const result=await service.import(seal(bundle));
    expect(result).toMatchObject({observationsOnly:true,observed:1,stored:0,rejected:0,region:'TW DEV'});
    expect(playersImportQueueSummary(result)).toMatchObject({observationsOnly:true,observed:1,files:1});
    expect(observed[0]).toMatchObject([{}, {firstSeenAt:player.first_seen_at,lastSeenAt:player.last_seen_at}]);
    await expect(service.import(seal({...bundle,players:[{...player,scan:{...scan,distribution:'korea-dev'}}]}))).rejects.toThrow('Mixed test-client sources');
    expect(observed).toHaveLength(1);
  });
  it('refuses test bundles and mixed source sessions before storing any player',async()=>{
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    let writes=0;const service=new InspectImportService({store:async()=>{writes++;}} as never);
    const base={version:1,export_metadata:{exporter_name:'tof-live-capture',exporter_version:'2.0.0'},
      observer:{uid:null,role_id:null,server_id:null},players:[{}]};
    await expect(service.import(seal({...base,export_metadata:{...base.export_metadata,scan:scanFixture()}}))).rejects.toThrow('cannot enter Ranking');
    await expect(service.import(seal({...base,export_metadata:{...base.export_metadata,scan:scanFixture('live')},players:[{}, {scan:scanFixture()}]}))).rejects.toThrow('cannot enter Ranking');
    expect(writes).toBe(0);
  });
});
