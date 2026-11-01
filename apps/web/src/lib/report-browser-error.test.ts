import { afterEach, expect, it, vi } from 'vitest';
import { reportBrowserError } from './report-browser-error';
afterEach(() => { vi.unstubAllGlobals(); });
it('reports a bounded sanitized error without stack, query or browser state and suppresses repeated reports', () => {
  const fetcher = vi.fn().mockResolvedValue(new Response());
  vi.stubGlobal('fetch', fetcher);
  window.history.replaceState({}, '', '/tools/build/?access_token=private');
  const error = new Error('Bearer private-token');
  reportBrowserError('boundary', error);
  reportBrowserError('boundary', error);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.route).toBe('/tools/build/');
  expect(body.message).not.toContain('private-token');
  expect(body).not.toHaveProperty('stack');
  expect(body).not.toHaveProperty('cookies');
});
