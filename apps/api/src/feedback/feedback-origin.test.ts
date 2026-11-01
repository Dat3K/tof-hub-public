import { afterEach, describe, expect, it, vi } from 'vitest';
import { feedbackOrigin } from './feedback-origin';

const agents = {
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  androidPhoneYandex: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 YaBrowser/24.10.0.0 Mobile Safari/537.36',
};

describe('feedback origin', () => {
  afterEach(() => { vi.unstubAllEnvs(); });
  it('classifies common browsers before their Chromium/Safari base', () => {
    expect(feedbackOrigin({ 'user-agent': agents.windowsEdge })).toEqual({ country: null, device: 'desktop', os: 'Windows', browser: 'Edge' });
    expect(feedbackOrigin({ 'user-agent': agents.iphoneSafari })).toMatchObject({ device: 'mobile', os: 'iOS', browser: 'Safari' });
    expect(feedbackOrigin({ 'user-agent': agents.androidTablet })).toMatchObject({ device: 'tablet', os: 'Android', browser: 'Chrome' });
    expect(feedbackOrigin({ 'user-agent': agents.androidPhoneYandex })).toMatchObject({ device: 'mobile', browser: 'Yandex' });
    expect(feedbackOrigin({})).toEqual({ country: null, device: 'unknown', os: null, browser: null });
  });
  it('reads country only from the configured ingress header', () => {
    expect(feedbackOrigin({ 'cf-ipcountry': 'UA' }).country).toBeNull();
    vi.stubEnv('FEEDBACK_COUNTRY_HEADER', 'CF-IPCountry');
    expect(feedbackOrigin({ 'cf-ipcountry': 'ua' }).country).toBe('UA');
    expect(feedbackOrigin({ 'cf-ipcountry': 'XX' }).country).toBeNull();
    expect(feedbackOrigin({ 'cf-ipcountry': 'Ukraine' }).country).toBeNull();
  });
});
