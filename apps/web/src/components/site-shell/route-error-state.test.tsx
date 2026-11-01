import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { RouteErrorState } from './route-error-state';
vi.mock('@/lib/i18n', () => ({useI18n: () => ({t: (key: string) => key})}));
afterEach(() => vi.unstubAllEnvs());
it('production error pages expose only the support reference, never the message or stack', () => {
  vi.stubEnv('NODE_ENV', 'production');
  const error = Object.assign(new Error('private crash message'), {digest: 'public-ref-123'});
  error.stack = 'private filesystem stack';
  const html = renderToStaticMarkup(<RouteErrorState error={error} />);
  expect(html).toContain('public-ref-123');
  expect(html).not.toContain('private crash message');
  expect(html).not.toContain('private filesystem stack');
  expect(html).not.toContain('<details');
});
it('local development retains collapsible diagnostics', () => {
  vi.stubEnv('NODE_ENV', 'development');
  const error = new Error('local message'); error.stack = 'local stack';
  expect(renderToStaticMarkup(<RouteErrorState error={error} />)).toContain('local stack');
});
