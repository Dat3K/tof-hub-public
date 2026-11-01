import { test, expect } from '@playwright/test';

test('unhandled browser crashes report sanitized details without query parameters or state', async ({ page }) => {
  await page.route('**/api/v1/notifications/browser', route => route.fulfill({ status: 202, contentType: 'application/json', body: '{"accepted":true}' }));
  await page.goto('/info/simulacra/?server=gacha&char=gefion&access_token=qa-private');
  const badge = page.locator('[data-version-status-state]').first();
  // Verify hydration before generating the crash; the reporter's listeners mount with the root client tree.
  await expect.poll(async () => { await page.mouse.move(0, 0); await badge.hover(); return badge.getAttribute('aria-expanded'); }).toBe('true');
  const request = page.waitForRequest(request => request.url().endsWith('/api/v1/notifications/browser') && request.postData()?.includes('Synthetic monitoring QA') === true);
  await page.evaluate(() => { void Promise.reject(new Error('Synthetic monitoring QA Bearer private-test-token')); });
  const body = (await request).postDataJSON();
  expect(body.source).toBe('promise');
  expect(body.route).toBe('/info/simulacra/');
  expect(body.message).not.toContain('private-test-token');
  expect(body).not.toHaveProperty('stack');
  expect(body).not.toHaveProperty('cookies');
});
