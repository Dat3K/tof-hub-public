import rawFixture from '../../../../packages/contracts/src/__fixtures__/build-capture.json';
import {scanFixture} from './scan-session.fixture';
import {MIN_CAPTURE_APP_VERSION,type BuildCapture,type CaptureSession} from '@tof-hub/contracts';

/**
 * The shared capture fixture with a UID of a catalog server (13021 Kuura): live data of unknown servers is never stored
 * (playerServerRefusal), so storage tests need a real server. The placeholder UID covers the refusal itself.
 * Its exporter is the verified minimum, so stored gear is not refused for its capture-app version.
 */
export const buildFixture={...rawFixture,capture:{...rawFixture.capture,exporterVersion:MIN_CAPTURE_APP_VERSION,subject:{...rawFixture.capture.subject,uid:'130214471'}}};
const fixture=buildFixture;

export function oldBuild(distribution:'global-live'|'global-pioneer'|'taiwan-live'='global-live'):BuildCapture {
  const scan={...scanFixture(distribution==='global-pioneer'?'test':'live'),distribution,environmentSource:'verified-rule',
    status:'capturing',finishedAt:null,install:{status:'verified',distribution,resourceBranch:null,launcherBranch:null,appId:null,cdn:null,appVersion:null,resVersion:null,reasons:[]}} as CaptureSession;
  return {...fixture,schemaVersion:3,capture:{...fixture.capture,exporterVersion:'0.1.0',exportedAt:'2026-10-10T22:00:00Z',scan}} as BuildCapture;
}
