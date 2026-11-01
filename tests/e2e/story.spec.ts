import {test, expect} from '@playwright/test';

test('project story preserves navigation, screenshots, stickers and acknowledgements', async ({page, context, baseURL}) => {
  await context.addCookies([{name:'tof_locale', value:'en', url:baseURL!}]);
  const response = await page.goto('/story/', {waitUntil:'domcontentloaded'});
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', {level:1})).toHaveText('My journey in Tower of Fantasy');
  await expect(page.locator('footer a[href="/story/"]')).toHaveText('Project story');
  await expect(page.locator('a[href^="screenshots/"], img[src^="stickers/"]')).toHaveCount(0);
  await page.getByRole('button', {name:'Pause stickers'}).click();
  await expect(page.getByRole('button', {name:'Play stickers'})).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('[data-story-sticker] source').first().getAttribute('media')).toBe('all');
  const preview = page.locator('[data-story-image]').first();
  await preview.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator('nav[aria-label="Contents"]:visible').getByRole('link', {name:'10.08.2023 - 119.99',exact:true}).click();
  await expect(page.getByRole('heading', {name:'10.08.2023 - 119.99',exact:true})).toBeInViewport();
  await page.locator('nav[aria-label="Contents"]:visible a[href="#credits"]').click();
  await expect(page.getByRole('heading', {name:'Credits', exact:true})).toBeInViewport();
  await expect(page.getByText("If I haven't mentioned you by name, I'm sorry.", {exact:false})).toBeVisible();
});

test('mobile reading follows the header language and stickers autoplay until manually paused', async ({page, context, baseURL}) => {
  await context.addCookies([{name:'tof_locale', value:'ru', url:baseURL!}]);
  await page.setViewportSize({width:390, height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/story/#part-6-engineering-decisions', {waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading', {name:'Часть 6. Технические решения', exact:true})).toBeInViewport();
  await expect(page.getByRole('button', {name:'Приостановить стикеры'})).toBeAttached();
  expect(await page.locator('[data-story-sticker] source').first().getAttribute('media')).toBe('not all');
  await page.getByRole('button', {name:'Приостановить стикеры'}).click();
  await page.locator('[data-story-sticker] img').first().evaluate((image: HTMLImageElement) => {image.loading = 'eager';});
  await expect.poll(() => page.locator('[data-story-sticker] img').first().evaluate((image: HTMLImageElement) => image.currentSrc)).toMatch(/\.poster(?:\.[a-z0-9]+)?\.webp/);
  expect(await page.locator('[data-story-sticker] source').first().getAttribute('media')).toBe('all');
  await page.goto('/story/');
  await page.locator('details summary').click();
  await page.locator('details nav a[href="#part-9-why-i-still-build-and-maintain-tof-hub"]').click();
  await expect(page.getByRole('heading', {name:'Часть 9. Почему я продолжаю делать и поддерживать ToF Hub', exact:true})).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('footer a[href="/story/"]')).toHaveText('История проекта');
  await page.locator('[data-info-lang-trigger]').click();
  await expect(page.locator('[data-info-lang-trigger]')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('[data-datamine-language="en"]').click();
  await expect(page).toHaveURL(/story\/#part-9-why-i-still-build-and-maintain-tof-hub/);
  await expect(page.getByRole('heading', {name:'Part 9. Why I still build and maintain ToF Hub', exact:true})).toBeInViewport();
  await expect(page.getByRole('button', {name:'Pause stickers'})).toBeAttached();
});

test('other site languages use the English article', async ({page, context, baseURL}) => {
  await context.addCookies([{name:'tof_locale',value:'de',url:baseURL!}]);
  await page.goto('/story/');
  await expect(page.getByRole('heading', {level:1})).toHaveText('My journey in Tower of Fantasy');
  await expect(page.getByRole('button', {name:'Pause stickers'})).toBeVisible();
  await expect(page.locator('a[href*="/story/?lang="]')).toHaveCount(0);
});

test('scrolling updates the saved reading anchor without adding history entries', async ({page, context, baseURL}) => {
  await context.addCookies([{name:'tof_locale', value:'en', url:baseURL!}]);
  await page.goto('/story/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-story-ready="true"]')).toBeAttached();
  const historyLength = await page.evaluate(() => history.length);
  const chapter = page.getByRole('heading', {name:'Part 4. Formulas, measured and corrected', exact:true});
  await chapter.evaluate(heading => heading.scrollIntoView({behavior:'instant', block:'start'}));
  await expect(page).toHaveURL(/#part-4-formulas-measured-and-corrected$/);
  const topic = page.getByRole('heading', {name:'How much is a stat worth?', exact:true});
  await topic.evaluate(heading => heading.scrollIntoView({behavior:'instant', block:'start'}));
  await expect(page).toHaveURL(/#how-much-is-a-stat-worth$/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(topic).toBeInViewport();
});
