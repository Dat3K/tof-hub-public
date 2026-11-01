import { expect, test, type Page } from '@playwright/test';

async function inspectBuffCard(page: Page, screenshot: string) {
  const cards = page.locator('article[class*="affixCard"]');
  if (page.url().includes('/seq/')) {
    await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 30000});
    await page.locator('[role="button"][aria-controls^="culture-pod-"]').first().click();
  }
  const inspect = cards.getByRole('button').first();
  await inspect.scrollIntoViewIfNeeded();
  await expect(inspect).toBeEnabled({timeout: 30000});
  const src = await inspect.locator('img').getAttribute('src');
  await inspect.focus();
  await inspect.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img')).toHaveAttribute('src', src!);
  await page.screenshot({path: `ignore/documentation-media/generated/${screenshot}.png`, animations: 'disabled'});
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(inspect).toBeFocused();
}

for (const [locale, width] of [['en', 1440], ['ru', 390]] as const) {
  test(`OoW complete effect disclosure isolates modes and fits ${locale} ${width}`, async ({ page, context }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    await context.addCookies([{ name: 'tof_locale', value: locale, domain: 'localhost', path: '/' }]);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.goto('/datamine/oow/?mode=standard&s=23&floor=17', { waitUntil: 'domcontentloaded' });
    await inspectBuffCard(page, `oow-buff-standard-preview-${locale}`);
    const title = locale === 'ru' ? 'Все эффекты контента' : 'All content effects';
    const disclosure = page.locator('details').filter({ has: page.locator('summary', { hasText: title }) });
    await expect(disclosure).toBeVisible();
    await expect(disclosure.locator('table')).toBeHidden();
    await disclosure.locator('summary').focus();
    await disclosure.locator('summary').press('Enter');
    await expect(disclosure.locator('tbody tr')).toHaveCount(186);
    await expect(disclosure.locator('table')).toBeVisible();
    await disclosure.locator('summary').evaluate(element => { element.scrollIntoView({ block: 'start' }); window.scrollBy(0, -100); });
    await expect.poll(() => disclosure.locator('img').evaluateAll(images => images.filter(image => {
      const box = image.getBoundingClientRect();
      return box.top < innerHeight && box.bottom > 0 && (!image.complete || image.naturalWidth === 0);
    }).length), {timeout: 30000}).toBe(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `ignore/documentation-media/generated/oow-effects-${locale}-${width}.png`, animations: 'disabled' });
    await disclosure.locator('summary').press('Enter');
    await expect(disclosure.locator('table')).toBeHidden();
    await page.route('**/game-assets/webp/**/btn_xinzeng_FHQ.webp', route => route.fulfill({ status: 404, body: '' }));
    await page.goto('/datamine/oow/?s=4&mode=mmo&floor=25', { waitUntil: 'domcontentloaded' });
    await inspectBuffCard(page, `oow-buff-mmo-preview-${locale}`);
    await disclosure.locator('summary').click();
    await expect(disclosure.locator('tbody tr')).toHaveCount(87);
    await expect(disclosure.locator('tbody tr').first()).toContainText(locale === 'ru' ? 'Стена огня' : 'Firewall');
    const missing = disclosure.locator('tbody tr').first();
    await missing.scrollIntoViewIfNeeded();
    await expect(missing.locator('img')).toHaveCount(0, {timeout: 30000});
    await expect(missing.getByRole('button')).toHaveCount(0);
    expect((await missing.locator('td').first().locator('[aria-hidden="true"]').boundingBox())?.width).toBe(22);
    const flame = disclosure.locator('tbody tr').filter({ hasText: locale === 'ru' ? 'Усиление огня ур. 1' : 'Flame Boost Lv. 1' });
    await expect(flame.locator('img')).toHaveCount(1);
    await flame.scrollIntoViewIfNeeded();
    await expect.poll(() => flame.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(disclosure.getByText(locale === 'ru' ? 'Усиление огня ур. 1' : 'Flame Boost Lv. 1', { exact: true })).toBeVisible();
    const inspect = flame.getByRole('button');
    await expect(inspect).toBeEnabled();
    await inspect.focus();
    await inspect.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('img')).toHaveAttribute('src', await flame.locator('img').getAttribute('src') || '');
    await expect(dialog.getByRole('button', {name: locale === 'ru' ? 'Скачать PNG' : 'Download PNG', exact: true})).toHaveCount(0);
    await page.screenshot({path: `ignore/documentation-media/generated/oow-effect-lightbox-${locale}.png`, animations: 'disabled'});
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(inspect).toBeFocused();
    await page.goto('/datamine/seq/?mode=mmo', { waitUntil: 'domcontentloaded' });
    await inspectBuffCard(page, `seq-buff-mmo-preview-${locale}`);
    await disclosure.locator('summary').click();
    await expect(disclosure.locator('table')).toBeVisible();
    await expect(disclosure.locator('tbody tr')).toHaveCount(67);
    expect(errors).toEqual([]);
  });
}
