import type {CaptureSession} from '@tof-hub/contracts';
import fixture from '../../../../packages/contracts/src/__fixtures__/scan-session.json';
export const scanFixture=(environment:CaptureSession['environment']='test'):CaptureSession=>({
  ...structuredClone(fixture) as CaptureSession,environment,environmentSource:environment==='unknown'?'unknown':'manual',
});
