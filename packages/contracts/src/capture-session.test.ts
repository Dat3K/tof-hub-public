import {describe,it,expect} from 'vitest';
import {CaptureSessionSchema,captureOrigin,canPublishCapture,canPublishGearCapture,canSaveBuildCapture,isPioneerCapture,isBlockedCaptureClient} from './capture-session';
import {BuildCaptureSchema,MIN_CAPTURE_APP_VERSION,exporterVersionAtLeast} from './build-capture';
import capture from './__fixtures__/build-capture.json';
import {scanFixture} from './__fixtures__/scan-session';
describe('scan provenance and publication',()=>{
  it('accepts finite raw gear attributes without a magnitude cap and rejects nonfinite values',()=>{
    for(const value of [Number.MAX_VALUE,-Number.MAX_VALUE,NaN,Infinity,-Infinity]) {
      const gear=capture.gear.map((item,index)=>index===0?{...item,stats:[{attribute:'raw-attribute',value,tag:null}],beforeTitan:[{attribute:'raw-attribute',value}]}:item);
      const inventory=[{itemId:capture.gear[0].itemId,stats:[{attribute:'raw-attribute',value,tag:null}],beforeTitan:[{attribute:'raw-attribute',value}],rolls:0,augmentCount:0}];
      expect(BuildCaptureSchema.safeParse({...capture,gear}).success).toBe(Number.isFinite(value));
      expect(BuildCaptureSchema.safeParse({...capture,inventory}).success).toBe(Number.isFinite(value));
    }
  });
  it('accepts both PWG sources while rejecting unknown sources and mismatched character identifiers',()=>{
    const roleId=((13021n<<32n)+4471n).toString();
    const value={...capture,capture:{...capture.capture,subject:{uid:'1302104471',roleId}},
      pwg:{uid:'60832888',roleId,serverId:'13021',appId:'1000129',observedAt:capture.capture.capturedAt,source:'game-login-packet'}};
    for(const source of ['HottaBrowser.log','game-login-packet'])expect(BuildCaptureSchema.safeParse({...value,pwg:{...value.pwg,source}}).success).toBe(true);
    expect(BuildCaptureSchema.safeParse({...value,pwg:{...value.pwg,source:'arbitrary'}}).success).toBe(false);
    expect(BuildCaptureSchema.safeParse({...value,pwg:{...value.pwg,roleId:'1'}}).success).toBe(false);
    // An unrecognised client install (no app ID) or an unparsed server ID must not reject the whole file.
    const {appId:_appId,serverId:_serverId,...partial}=value.pwg;
    expect(BuildCaptureSchema.safeParse({...value,pwg:partial}).success).toBe(true);
    expect(BuildCaptureSchema.safeParse({...value,pwg:{...partial,serverId:'13022'}}).success).toBe(false);
  });
  it('allows signed live build profiles without requiring a finished recording, preserving ranking gates',()=>{
    expect(canSaveBuildCapture(undefined)).toBe(true);
    for(const status of ['completed','capturing','interrupted'] as const) {
      const scan={...scanFixture('live'),status,finishedAt:status==='completed'?scanFixture('live').finishedAt:null};
      
      expect(canSaveBuildCapture(scan)).toBe(status==='completed');
      expect(canPublishGearCapture(scan)).toBe(true);
      expect(canPublishCapture(scan)).toBe(status==='completed'||status==='capturing');
    }
    expect(canSaveBuildCapture(scanFixture('test'))).toBe(false);
    expect(canSaveBuildCapture(scanFixture('unknown'))).toBe(false);
  });
  it('accepts Pioneer gear independently of scan status in the isolated pool and rejects TW/KR development clients',()=>{
    const pioneer={...scanFixture(),distribution:'global-pioneer' as const};
    expect(CaptureSessionSchema.parse(pioneer)).toEqual(pioneer);
    expect(isPioneerCapture(pioneer)).toBe(true);expect(canPublishCapture(pioneer)).toBe(false);
    expect(isPioneerCapture({...pioneer,status:'interrupted',finishedAt:null})).toBe(true);
    expect(isPioneerCapture(scanFixture())).toBe(false);
    for(const distribution of ['taiwan-dev','korea-dev'] as const) {
      expect(isBlockedCaptureClient({...scanFixture(),distribution})).toBe(true);
      expect(CaptureSessionSchema.safeParse({...scanFixture('live'),distribution}).success).toBe(false);
    }
  });
  it('keeps legacy compatibility and accepts version 3 only with bounded scan metadata',()=>{
    expect(BuildCaptureSchema.parse(capture)).toEqual(capture);
    expect(canPublishCapture(undefined)).toBe(true);
    expect(BuildCaptureSchema.safeParse({...capture,schemaVersion:3}).success).toBe(false);
    const value={...capture,schemaVersion:3,capture:{...capture.capture,scan:scanFixture()}};
    expect(BuildCaptureSchema.parse(value)).toEqual(value);
    expect(BuildCaptureSchema.safeParse({...value,capture:{...value.capture,scan:{...scanFixture(),commandLine:'not permitted'}}}).success).toBe(false);
  });
  it('separates test, unknown, unfinished and completed live scans',()=>{
    expect(captureOrigin(scanFixture())).toBe('test');
    expect(canPublishCapture(scanFixture())).toBe(false);
    expect(canPublishCapture(scanFixture('unknown'))).toBe(false);
    expect(canPublishCapture(scanFixture('live'))).toBe(true);
    expect(canPublishCapture({...scanFixture('live'),status:'capturing',finishedAt:null})).toBe(true);
    expect(canPublishCapture({...scanFixture('live'),status:'interrupted',finishedAt:null})).toBe(false);
  });
  it('accepts the detected install and publishes Taiwan Live, but never a detected test client as live',()=>{
    const install={status:'verified' as const,distribution:'global-live' as const,resourceBranch:'OBPC_2_5',launcherBranch:'HTIntlOB',appId:'1000129',
      cdn:'global' as const,appVersion:'2.5.0',resVersion:'6.3.1',reasons:[]};
    expect(CaptureSessionSchema.safeParse({...scanFixture('live'),environmentSource:'verified-rule',distribution:'global-live',install}).success).toBe(true);
    const taiwan=CaptureSessionSchema.parse({...scanFixture('live'),distribution:'taiwan-live',install:{...install,distribution:'taiwan-live',appId:'2000003',cdn:'taiwan',launcherBranch:'HTTwOB'}});
    expect(canPublishCapture(taiwan)).toBe(true);expect(isBlockedCaptureClient(taiwan)).toBe(false);
    expect(CaptureSessionSchema.safeParse({...scanFixture('live'),install:{...install,distribution:'korea-dev'}}).success).toBe(false);
    expect(CaptureSessionSchema.safeParse({...scanFixture('live'),install:{...install,path:'D:/game'}}).success).toBe(false);
  });
  it('accepts IPv4 game-server endpoints only',()=>{
    const servers={gateway:'43.131.4.91:30031',zone:null,player:'192.168.0.11',observedAt:'2026-10-22T10:00:00Z'};
    expect(CaptureSessionSchema.parse({...scanFixture(),servers}).servers).toEqual(servers);
    expect(CaptureSessionSchema.safeParse({...scanFixture(),servers:{...servers,zone:'game.example:1'}}).success).toBe(false);
    expect(CaptureSessionSchema.safeParse({...scanFixture(),servers:{...servers,player:'192.168.0.11:5000'}}).success).toBe(false);
  });
  it('accepts MMO weapon +N up to 15 only with the mmo block',()=>{
    const weapons=[{slot:0,itemId:'Salidy_fire',level:15,stars:15}];
    const mmo={weaponMode:'fixed',panel:{MaxHP:1},slotCards:null,brainfield:null};
    expect(BuildCaptureSchema.safeParse({...capture,weapons,mmo}).success).toBe(true);
    expect(BuildCaptureSchema.safeParse({...capture,weapons}).success).toBe(false);
  });
  it('compares capture-app versions numerically',()=>{
    expect(exporterVersionAtLeast('1.3.0','1.1.0')).toBe(true);
    expect(exporterVersionAtLeast('1.1.0','1.1.0')).toBe(true);
    expect(exporterVersionAtLeast('1.10.0','1.9.0')).toBe(true);
    expect(exporterVersionAtLeast('1.0.9','1.1.0')).toBe(false);
    expect(exporterVersionAtLeast('1.3.0',MIN_CAPTURE_APP_VERSION)).toBe(false);expect(exporterVersionAtLeast('2.0.0',MIN_CAPTURE_APP_VERSION)).toBe(true);
    expect(exporterVersionAtLeast('dev','1.1.0')).toBe(false);
  });
  it('rejects invented boundaries and environment without evidence',()=>{
    for(const patch of [{startedAt:null},{finishedAt:null},{finishedAt:'2026-10-08T10:00:00Z'},{environmentSource:'unknown'}])
      expect(CaptureSessionSchema.safeParse({...scanFixture(),...patch}).success).toBe(false);
    expect(CaptureSessionSchema.safeParse({...scanFixture(),status:'interrupted',finishedAt:null}).success).toBe(true);
    const pc={platform:'win32',architecture:'x64',osVersion:'fixture',cpuModel:'Fixture CPU',logicalCores:8,memoryMiB:16384};
    expect(CaptureSessionSchema.parse({...scanFixture(),pc}).pc).toEqual(pc);
    expect(CaptureSessionSchema.safeParse({...scanFixture(),pc:{...pc,hostname:'not permitted'}}).success).toBe(false);
    expect(CaptureSessionSchema.safeParse({...scanFixture(),pc:{...pc,memoryMiB:-1}}).success).toBe(false);
  });
});
