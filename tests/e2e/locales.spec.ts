import { test, expect } from '@playwright/test';
import { LANGUAGES, SUPPORTED_LOCALES, getLanguageMenuLocale } from '../../packages/i18n/src/constants';

for (const locale of SUPPORTED_LOCALES) {
  test(`Simulacra accepts the exact ${locale} culture and retains a usable catalog`, async ({ page, context, baseURL }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.addCookies([{ name: 'tof_locale', value: locale, url: baseURL! }]);
    await page.goto('/info/simulacra/');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    const menuLocale = getLanguageMenuLocale(locale);
    await expect(page.locator('.info-header__lang-current-code')).toHaveText(LANGUAGES[menuLocale].short);
    await expect(page.locator('input[type="search"], input[placeholder]').first()).toBeVisible();
    await expect(page.locator('[id^="sim-card-"]').first()).toBeVisible({ timeout: 45000 });
    const trigger = page.locator('[data-info-lang-trigger]');
    await expect(trigger.locator('svg[data-language-flag]')).toBeVisible();
    await trigger.click();
    const menu = page.locator('#info-header-lang-menu');
    await expect(menu.getByRole('menuitem')).toHaveCount(11);
    await expect(menu.locator('svg[data-language-flag]')).toHaveCount(11);
    await expect(menu.getByRole('menuitem', { name: LANGUAGES[menuLocale].label, exact: true })).toHaveAttribute('aria-current', 'true');
    await expect(menu.locator('[data-info-lang^="zh-"]')).toHaveCount(1);
    expect((await context.cookies()).find(cookie => cookie.name === 'tof_locale')?.value).toBe(locale);
    expect(errors).toEqual([]);
  });
}

test('Japanese remains active in the encyclopedia, tools and datamine hubs', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'tof_locale', value: 'ja', url: baseURL! }]);
  for (const [route, title] of [
    ['/info/', 'Tower of Fantasy 百科事典'],
    ['/tools/', 'Tower of Fantasy ツール'],
    ['/datamine/', 'Tower of Fantasy アーカイブ'],
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  }
});

test('the language menu fits mobile and supports keyboard selection', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/info/simulacra/?server=mmo&char=salidy');
  const trigger = page.locator('[data-info-lang-trigger]');
  await trigger.focus();
  await trigger.press('ArrowDown');
  const menu = page.locator('#info-header-lang-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveCount(11);
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem').last()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(trigger).toBeFocused();
  await trigger.click();
  const bounds = await menu.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
