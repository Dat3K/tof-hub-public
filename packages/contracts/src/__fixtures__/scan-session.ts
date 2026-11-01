import type {CaptureSession} from '../capture-session';
import fixture from './scan-session.json';
export const scanFixture=(environment:CaptureSession['environment']='test'):CaptureSession=>({
  ...structuredClone(fixture) as CaptureSession,environment,environmentSource:environment==='unknown'?'unknown':'manual',
});
