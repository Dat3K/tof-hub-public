import {describe,it,expect} from 'vitest';
import {canSaveBuildCapture} from '@tof-hub/contracts';
import {ENFORCE_CAPTURE_APP_VERSION,buildGearDestination,legacyBuildGear,outdatedCaptureApp,testCaptureDistribution} from './capture-import-policy';
import {scanFixture} from './scan-session.fixture';
import {oldBuild} from './capture-import-policy.fixture';
describe('capture import compatibility',()=>{
  it('does not assign a client when verified install and declared test distributions conflict',()=>{
    const scan=oldBuild('global-pioneer').capture.scan!;
    expect(testCaptureDistribution({...scan,distribution:'korea-dev'})).toBeNull();
    expect(testCaptureDistribution({...scan,distribution:'unknown'})).toBe('global-pioneer');
    expect(testCaptureDistribution({...scan,distribution:undefined,install:undefined})).toBe('test');
  });
  it('recognizes pre-fix unfinished build gear; its 0.1.0 exporter is below the minimum once the gate is on',()=>{
    for(const distribution of ['global-live','global-pioneer','taiwan-live'] as const) {
      const build=oldBuild(distribution);
      expect(legacyBuildGear(build)).toBe(true);
      expect(buildGearDestination(build,true)).toBeNull();
      expect(buildGearDestination(build,false)).toBe(distribution==='global-pioneer'?'pioneer':'live');
      expect(build.capture.scan?.status).toBe('capturing');
      expect(legacyBuildGear({capture:{...build.capture,exporterVersion:'0.1.1'}})).toBe(false);
      expect(legacyBuildGear({capture:{...build.capture,exportedAt:'2026-10-11T00:00:00Z'}})).toBe(false);
      expect(legacyBuildGear({capture:{...build.capture,scan:{...build.capture.scan!,status:'interrupted'}}})).toBe(false);
      expect(legacyBuildGear({capture:{...build.capture,scan:{...build.capture.scan!,install:{...build.capture.scan!.install!,status:'conflict'}}}})).toBe(false);
    }
  });
  it('ranks unfinished Steam captures that recorded the Global Live launcher as a conflict',()=>{
    const build=oldBuild();
    build.capture={...build.capture,exporterVersion:'2.0.0',exportedAt:'2026-10-22T19:51:00Z',scan:{...build.capture.scan!,distribution:undefined,
      environment:'unknown',environmentSource:'unknown',install:{status:'conflict',distribution:'unknown',resourceBranch:'OBPC_2_5',launcherBranch:'HTIntlSteam',
        appId:'1000129',cdn:'global',appVersion:'2.5.0',resVersion:'6.4.1',reasons:['launcher channel HTIntlSteam contradicts the resource branch']}}};
    expect(buildGearDestination(build)).toBe('live');
    expect(buildGearDestination({...build,capture:{...build.capture,exporterVersion:'1.0.9'}},true)).toBeNull();
    expect(canSaveBuildCapture(build.capture.scan)).toBe(false);
    const scan=build.capture.scan!,install=scan.install!;
    expect(buildGearDestination({...build,capture:{...build.capture,scan:{...scan,install:{...install,resourceBranch:'OBPC_Xianqian'}}}})).toBeNull();
    expect(buildGearDestination({...build,capture:{...build.capture,scan:{...scan,install:{...install,reasons:[...install.reasons,'another client was detected earlier in this scan']}}}})).toBeNull();
    // Another Global store channel (e.g. Epic) the same way; Pioneer's channel never.
    const store=(channel:string)=>({...build,capture:{...build.capture,scan:{...scan,install:{...install,launcherBranch:channel,reasons:[`launcher channel ${channel} contradicts the resource branch`]}}}});
    expect(buildGearDestination(store('HTIntlEpicStore'))).toBe('live');
    expect(buildGearDestination(store('HTIntlPTR'))).toBeNull();
  });
  it('keeps the capture-app version gate off on the server for now',()=>{
    expect(ENFORCE_CAPTURE_APP_VERSION).toBe(false);
    expect(outdatedCaptureApp('1.3.0')).toBeNull();
    expect(outdatedCaptureApp('1.3.0',true)).toBe('2.0.0');expect(outdatedCaptureApp('2.0.0',true)).toBeNull();
  });
  it('records older KR branch conflicts as test participation without making them a rankable scan',()=>{
    const build=oldBuild();build.capture.scan={...build.capture.scan!,distribution:'unknown',environment:'unknown',environmentSource:'unknown',
      install:{...build.capture.scan!.install!,distribution:'unknown',status:'conflict',resourceBranch:'TestPC_KR2New',launcherBranch:'TestPC_KR2New'}};
    expect(testCaptureDistribution(build.capture.scan)).toBe('legacy-korea-dev');
    expect(buildGearDestination(build)).toBeNull();
    expect(testCaptureDistribution(scanFixture('live'))).toBeNull();
  });
});
