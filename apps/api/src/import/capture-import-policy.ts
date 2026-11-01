import {MIN_CAPTURE_APP_VERSION,canPublishGearCapture,exporterVersionAtLeast,isPioneerCapture,type BuildCapture,type CaptureSession} from '@tof-hub/contracts';

/** Pre-fix 0.1.0 exported a running scan. Accept its gear, never claim a completed scan or verified combat. */
export function legacyBuildGear(capture:{capture:Pick<BuildCapture['capture'],'scan'|'exporterVersion'|'exportedAt'>}):boolean {
  const scan=capture.capture.scan,exported=Date.parse(capture.capture.exportedAt??'');
  return capture.capture.exporterVersion==='0.1.0'&&Number.isFinite(exported)&&exported<Date.parse('2026-10-11T00:00:00Z')
    &&!!scan?.startedAt&&Date.parse(scan.startedAt)<=exported&&scan.source==='native'&&scan.status==='capturing'
    &&scan.environmentSource==='verified-rule'&&scan.install?.status==='verified'
    &&scan.install.distribution===scan.distribution
    &&((scan.environment==='live'&&['global-live','taiwan-live'].includes(scan.distribution??''))
      ||(scan.environment==='test'&&scan.distribution==='global-pioneer'));
}

/** Server enforcement of MIN_CAPTURE_APP_VERSION. Off while the 2.0 app is in development (docs/imports.md). */
export const ENFORCE_CAPTURE_APP_VERSION=false;

/** The minimum version a file's capture app falls short of, or null when it is current or the gate is off. */
export function outdatedCaptureApp(version:string,enforce=ENFORCE_CAPTURE_APP_VERSION):string|null {
  return enforce&&!exporterVersionAtLeast(version,MIN_CAPTURE_APP_VERSION)?MIN_CAPTURE_APP_VERSION:null;
}

export function buildGearDestination(capture:BuildCapture,enforce=ENFORCE_CAPTURE_APP_VERSION):'live'|'pioneer'|null {
  // Gear verification needs a supported capture app; older files stay viewable.
  if(outdatedCaptureApp(capture.capture.exporterVersion,enforce))return null;
  if(isPioneerCapture(capture.capture.scan))return 'pioneer';
  if(canPublishGearCapture(capture.capture.scan))return 'live';
  return legacyBuildGear(capture)?capture.capture.scan!.distribution==='global-pioneer'?'pioneer':'live':null;
}

/** Old detector conflicts are evidence of test participation only, never permission to publish live gear. */
export function testCaptureDistribution(scan:CaptureSession|undefined):string|null {
  if(!scan)return null;
  const install=scan.install;
  const known=['global-pioneer','taiwan-dev','korea-dev'];
  if(install?.status==='verified'&&known.includes(install.distribution)&&known.includes(scan.distribution??'')&&install.distribution!==scan.distribution)return null;
  if(install?.status==='verified'&&['global-pioneer','taiwan-dev','korea-dev'].includes(install.distribution))return install.distribution;
  if(scan.environment==='test'&&scan.environmentSource!=='unknown')return known.includes(scan.distribution??'')?scan.distribution!:'test';
  if(install?.resourceBranch&&install.resourceBranch===install.launcherBranch) {
    if(/^TestPC_KR(?:2New|New)$/.test(install.resourceBranch))return 'legacy-korea-dev';
    if(/^TestPC_IW_(?:3_0_0|2_5_0)$/.test(install.resourceBranch))return 'legacy-taiwan-dev';
    if(install.resourceBranch==='OBPC_Xianqian')return 'legacy-global-pioneer';
  }
  return null;
}
