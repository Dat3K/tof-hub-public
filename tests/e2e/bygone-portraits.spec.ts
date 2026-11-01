import {expect, test} from '@playwright/test';

for (const [locale, width] of [['en', 1440], ['ru', 390]] as const) {
  test(`MMO Bygone crops wide portraits like Gacha Sequential (${locale})`, async ({page, context}) => {
    test.setTimeout(90000);
    const floorLabel = locale === 'ru' ? 'Этаж' : 'Floor';
    await page.setViewportSize({width, height: 900});
    await context.addCookies([{name: 'tof_locale', value: locale, domain: 'localhost', path: '/'}]);
    await page.goto('/datamine/bygone/?mode=mmo&floor=193', {waitUntil: 'domcontentloaded'});
    await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
    const floor = page.getByRole('article', {name: `${floorLabel} 193`, exact: true});
    const wide = floor.getByRole('listitem').first().locator('img').first();
    await wide.scrollIntoViewIfNeeded();
    await expect.poll(() => wide.evaluate(image => ({
      loaded: (image as HTMLImageElement).naturalWidth > (image as HTMLImageElement).naturalHeight,
      fit: getComputedStyle(image).objectFit,
      position: getComputedStyle(image).objectPosition,
    }))).toEqual({loaded: true, fit: 'cover', position: '50% 50%'});
    const box = (await wide.boundingBox())!;
    expect(box.width).toBe(box.height);
    await floor.screenshot({path: `ignore/documentation-media/generated/bygone-wide-portraits-${locale}.png`, animations: 'disabled'});
    // A state update reuses the cached image/ref without reverting its crop.
    await floor.getByRole('button', {name: new RegExp(`^${floorLabel} 193$`)}).click();
    await expect.poll(() => wide.evaluate(image => getComputedStyle(image).objectFit)).toBe('cover');
    const boss = page.getByRole('article', {name: `${floorLabel} 199`, exact: true}).getByRole('listitem').locator('img').first();
    await boss.scrollIntoViewIfNeeded();
    await expect.poll(() => boss.evaluate(image => ({
      loaded: (image as HTMLImageElement).naturalWidth > 0,
      landscape: (image as HTMLImageElement).naturalWidth > (image as HTMLImageElement).naturalHeight,
      fit: getComputedStyle(image).objectFit,
    }))).toEqual({loaded: true, landscape: false, fit: 'contain'});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
