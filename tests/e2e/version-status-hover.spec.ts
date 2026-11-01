import { test, expect } from '@playwright/test';

for (const locale of ['en', 'ru']) {
  test(`Snapshot details open on hover in every header (${locale})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'tof_locale', value: locale, url: baseURL! }]);
    for (const route of ['/info/simulacra/?server=gacha&char=gefion', '/tools/build/', '/datamine/oow/?s=23']) {
      await page.goto(route);
      const badge = page.locator('[data-version-status-state]').first();
      const popup = page.locator('#site-header-popover');
      // Header HTML can arrive before hydration attaches its pointer handlers.
      await expect.poll(async () => {
        await page.mouse.move(0, 0);
        await badge.hover();
        return popup.isVisible();
      }).toBe(true);
      await popup.hover();
      await expect(popup).toBeVisible();
      await page.mouse.move(0, 800);
      await expect(popup).toBeHidden();
      await badge.focus();
      await badge.press('Enter');
      await expect(popup).toBeVisible();
      await badge.press('Escape');
      await expect(popup).toBeHidden();
    }
  });
}

test.describe('Touch snapshot details', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('a single tap opens and a second tap closes the popup', async ({ page }) => {
    await page.goto('/tools/build/');
    const badge = page.locator('[data-version-status-state]').first();
    const popup = page.locator('#site-header-popover');
    await badge.tap();
    await expect(popup).toBeVisible();
    await badge.tap();
    await expect(popup).toBeHidden();
  });
});
