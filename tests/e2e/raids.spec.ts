import { expect, test } from '@playwright/test';

for (const [locale, width] of [['en', 1440], ['ru', 390]] as const) {
  test(`raid title rewards follow the selected season and start collapsed (${locale})`, async ({page, context}) => {
    const ru = locale === 'ru';
    await page.setViewportSize({width, height: 900});
    await context.addCookies([{name: 'tof_locale', value: locale, domain: 'localhost', path: '/'}]);
    await page.goto('/datamine/raids/?season=S1', {waitUntil: 'domcontentloaded'});
    await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
    const details = page.locator('[data-raid-titles]');
    await expect(details).toHaveAttribute('data-raid-titles', 'S1');
    await expect(details).not.toHaveAttribute('open', '');
    const summary = details.locator('summary');
    await summary.focus(); await summary.press('Enter');
    await expect(details).toHaveAttribute('open', '');
    await expect(details.locator('dt b')).toHaveText(['1–8', '9–24', '25–100']);
    await expect(details.locator('dd > strong')).toHaveText(ru ? ['Заклятый враг Таоте', 'Порицатель обжорства', 'Воин умеренности'] : ["Taotie's Nemesis", 'Gluttony Judgment', 'Abstinence Warrior']);
    await expect(details.locator('dd').first()).toContainText(ru ? 'после подсчета результатов' : 'results tally');
    const technical = page.getByText(ru ? 'Технические детали' : 'Technical details', {exact: true});
    expect(await technical.evaluate(element => Boolean(element.parentElement?.previousElementSibling?.hasAttribute('data-raid-titles')))).toBe(true);
    await details.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `ignore/documentation-media/generated/raid-title-rewards-${locale}.png`, animations: 'disabled'});
    const raidChoices = page.getByRole('navigation', {name: ru ? 'Выбор рейда оригинального сервера' : 'Original raid selection'});
    await raidChoices.getByRole('button', {name: /^Team8P_21 ·/}).click();
    await expect(details).toHaveAttribute('data-raid-titles', 'S15');
    await expect(details).not.toHaveAttribute('open', '');
    await details.locator('summary').click();
    await expect(details.locator('dd > strong').first()).toHaveText(ru ? 'Легендарный истребитель демонов' : 'Legend Demonslayer');
  });
}

for (const [locale, width] of [['en', 1440], ['ru', 390]] as const) {
  test(`Original raid artwork and selection thumbnails (${locale})`, async ({page, context}) => {
    test.setTimeout(90000);
    const ru = locale === 'ru';
    await page.setViewportSize({width, height: 900});
    await context.addCookies([{name: 'tof_locale', value: locale, domain: 'localhost', path: '/'}]);
    await page.goto('/datamine/raids/?server=original&raid=Team8P_12', {waitUntil: 'domcontentloaded'});
    await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
    const catalog = page.getByRole('navigation', {name: ru ? 'Выбор рейда оригинального сервера' : 'Original raid selection'});
    const data = await (await page.request.get('/game-data/handbook/team-raids.json')).json();
    const available = data.raids.filter((raid: any) => (raid.variants[1] ?? raid.variants[0]).artwork?.thumbnail || (raid.variants[1] ?? raid.variants[0]).artwork?.title);
    await expect(catalog.locator('img')).toHaveCount(available.length);
    const selected = catalog.locator('[aria-pressed="true"]');
    await selected.scrollIntoViewIfNeeded();
    await expect.poll(() => selected.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.screenshot({path: `ignore/documentation-media/generated/raids-art-catalog-${locale}.png`, animations: 'disabled'});
    const artwork = page.getByRole('button', {name: ru ? 'Открыть иллюстрацию босса' : 'Open boss artwork', exact: true});
    await artwork.scrollIntoViewIfNeeded();
    await expect.poll(() => artwork.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const src = await artwork.locator('img').getAttribute('src');
    await artwork.focus();
    await artwork.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('img')).toHaveAttribute('src', src!);
    await expect(dialog.getByRole('button', {name: ru ? 'Скачать WebP' : 'Download WebP', exact: true})).toBeVisible();
    await expect(dialog.getByRole('button', {name: /PNG/})).toHaveCount(0);
    await page.screenshot({path: `ignore/documentation-media/generated/raids-art-viewer-${locale}.png`, animations: 'disabled'});
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(artwork).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const missing = data.raids.find((raid: any) => !(raid.variants[1] ?? raid.variants[0]).artwork?.thumbnail && !(raid.variants[1] ?? raid.variants[0]).artwork?.title);
    if (missing) {
      const button = catalog.getByRole('button', {name: new RegExp(`^${missing.id} ·`)});
      await expect(button.locator('img')).toHaveCount(0);
      await expect(button.locator('[aria-hidden="true"]')).toHaveCount(1);
    }
  });
}

test('Original raid catalog shows Challenge only, mechanics and the matched in-game description', async ({ page, context }) => {
  await context.addCookies([{ name: 'tof_locale', value: 'en', domain: 'localhost', path: '/' }]);
  await page.goto('/datamine/raids/?server=original', {waitUntil: 'domcontentloaded'});

  const ready = page.locator('[data-encounter-ready="true"]');
  await expect(ready).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Original', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('navigation', {name: 'Original raid selection'}).getByRole('button')).toHaveCount(22);
  await expect(page.getByText('Confirmed raid IDs', {exact: true})).toHaveCount(0);
  await expect(page.getByText('Difficulty variants', {exact: true})).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Weekly pool names without raid config' })).toHaveCount(0);

  await expect(page.getByRole('radiogroup', { name: 'Raid difficulty' })).toHaveCount(0);
  await expect(page.getByRole('navigation', {name: 'Original raid selection'})).not.toContainText(/Heroic|Challenge/);

  await page.getByRole('button', { name: /Team8P_22.*Astral Favor/ }).click();
  await expect(page.getByRole('heading', { name: 'Astral Favor', exact: true })).toBeVisible();
  await expect(page.getByText(/^Challenge · Raid 22 · Season 16$/)).toBeVisible();
  await expect(page.getByText('Favored Ironclad', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download raid card as PNG' })).toBeVisible();
  await page.getByText('In-game raid description', { exact: true }).click();
  await expect(page.getByText(/Only those agile enough to dodge it will survive/)).toBeVisible();
  await expect(page.getByText(/The Favored Ironclad turns you into stars/).first()).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/<LblRed14>|<biaoti>/);

  const mechanicImages = page.locator('li').filter({ hasText: 'Fatal Flare:' }).locator('img');
  await expect(mechanicImages).toHaveCount(1);
  await expect.poll(() => mechanicImages.first().evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
  await page.screenshot({path: 'ignore/documentation-media/generated/raids-en-desktop.png'});

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await context.addCookies([{ name: 'tof_locale', value: 'ru', domain: 'localhost', path: '/' }]);
  await page.goto('/datamine/raids/?server=original&raid=Team8P_22', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', { name: 'Астральная благосклонность', exact: true })).toBeVisible();
  await expect(page.locator('article').filter({ hasText: /Смертельная вспышка/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Оригинал', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('main')).not.toContainText(/<LblRed14>|<biaoti>/);
  await expect(page.getByRole('radio', {name: /Геро|Вызов|Heroic|Challenge/})).toHaveCount(0);
  await expect(page.getByRole('navigation', {name: 'Выбор рейда оригинального сервера'})).not.toContainText(/Геро|геро|Вызов/);
  const description = page.getByText('Описание рейда из игры', {exact: true});
  await description.click();
  expect(await description.locator('..').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(200);

  await page.screenshot({path: 'ignore/documentation-media/generated/raids-ru-mobile.png', fullPage: true});
  await page.setViewportSize({width: 1280, height: 800});
  await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
  await page.screenshot({path: 'ignore/documentation-media/generated/raids-ru-desktop.png'});
});

for (const locale of ['en', 'ru'] as const) {
  test(`Original raid events keep their separate localized sequence (${locale})`, async ({ page, context }) => {
    test.setTimeout(90000);
    const ru = locale === 'ru';
    await page.setViewportSize({width: ru ? 390 : 1440, height: 900});
    await context.addCookies([{name: 'tof_locale', value: locale, domain: 'localhost', path: '/'}]);
    await page.goto('/datamine/raids/?server=original&raid=Team8P_07', {waitUntil: 'domcontentloaded'});
    await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 30000});
    const catalog = page.getByRole('navigation', {name: ru ? 'Выбор рейда оригинального сервера' : 'Original raid selection'});
    await expect(catalog.locator('[aria-pressed="true"]')).toHaveAttribute('title', ru ? 'Пир обжорства' : 'Gluttonous Feast');
    const positions = await catalog.getByRole('button').evaluateAll(buttons => buttons.slice(0, 4).map(button => {
      const {x, y} = button.getBoundingClientRect();
      return {x, y};
    }));
    expect(positions[1].x).toBeCloseTo(positions[0].x, 0);
    expect(positions[2].x).toBeCloseTo(positions[0].x, 0);
    expect(positions[1].y).toBeGreaterThan(positions[0].y);
    expect(positions[2].y).toBeGreaterThan(positions[1].y);
    expect(positions[3].x).toBeGreaterThan(positions[0].x);
    expect(positions[3].y).toBeCloseTo(positions[0].y, 0);
    if (!ru) {
      for (const block of [page.locator('article p[data-status]'), page.locator('article h2').locator('..').locator('..')]) {
        await page.mouse.move(0, 0);
        const before = await block.evaluate(element => {
          const {width, height} = element.getBoundingClientRect();
          return {width, height, background: getComputedStyle(element).backgroundColor, image: getComputedStyle(element).backgroundImage, radius: getComputedStyle(element).borderRadius};
        });
        await block.hover();
        await expect.poll(() => block.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(before.background);
        const after = await block.evaluate(element => {
          const {width, height} = element.getBoundingClientRect();
          return {width, height, image: getComputedStyle(element).backgroundImage, radius: getComputedStyle(element).borderRadius};
        });
        expect(after).toEqual({width: before.width, height: before.height, image: before.image, radius: before.radius});
      }
    }
    for (const [raid, event] of [[7, 1], [6, 0], [8, 2], [22, 16], [5, null]] as const) {
      await catalog.getByRole('button', {name: new RegExp(`^Team8P_${String(raid).padStart(2, '0')} ·`)}).click();
      const expected = `${ru ? 'Испытание · Рейд' : 'Challenge · Raid'} ${raid}${event === null ? '' : ` · ${ru ? 'Сезон' : 'Season'} ${event}`}`;
      await expect(page.getByText(expected, {exact: true})).toBeVisible();
      if (raid === 7) await page.screenshot({path: `ignore/documentation-media/generated/raids-column-events-${locale}.png`, animations: 'disabled'});
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`Numbered raid boss names stay plain in every mechanic (${locale})`, async ({ page, context }) => {
    await context.addCookies([{name: 'tof_locale', value: locale, domain: 'localhost', path: '/'}]);
    await page.goto('/datamine/raids/?server=original&raid=Team8P_18', {waitUntil: 'domcontentloaded'});
    await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 30000});
    const mechanics = page.locator('article li .game-rich-text');
    await expect(mechanics).toHaveCount(5);
    await expect(mechanics.first()).toContainText(locale === 'ru' ? 'Дурного глаза № 5' : 'Calamity No. 5');
    await expect(mechanics.locator('.sim-num-hl').filter({hasText: /^5$/})).toHaveCount(0);
  });
}

test('Regular Original raids add the global Challenge rules to their description', async ({ page, context }) => {
  await context.addCookies([{ name: 'tof_locale', value: 'en', domain: 'localhost', path: '/' }]);
  await page.goto('/datamine/raids/?server=original&raid=Team8P_18', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({ timeout: 30000 });
  const description = page.locator('details').filter({ has: page.getByText('In-game raid description', { exact: true }) });
  await description.getByText('In-game raid description', { exact: true }).click();
  await expect(description.getByText(/Invincibility is disabled/)).toBeVisible();
});

test('MMO legacy mode opens the latest Challenge stage and preserves stage/difficulty selection', async ({ page, context }) => {
  await context.addCookies([{ name: 'tof_locale', value: 'en', domain: 'localhost', path: '/' }]);
  await page.goto('/datamine/raids/?mode=mmo', {waitUntil: 'domcontentloaded'});

  const ready = page.locator('[data-encounter-ready="true"]');
  await expect(ready).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'MMO', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const stages = page.getByRole('navigation', { name: 'Raid stage' });
  const difficulty = page.getByRole('group', { name: 'Difficulty selection' });
  await expect(stages.getByRole('button', { name: 'Stage 2 · Lower level', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(difficulty.getByRole('button', { name: 'Challenge', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Calamity No. 5', exact: true })).toBeVisible();

  await difficulty.getByRole('button', { name: 'Heroic', exact: true }).click();
  await stages.getByRole('button', { name: 'Stage 2 · Upper level', exact: true }).click();
  await expect(page).toHaveURL(/stage=Team8P_02_D/);
  await expect(difficulty.getByRole('button', { name: 'Heroic', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await difficulty.getByRole('button', { name: 'Challenge', exact: true }).click();
  await expect(page).toHaveURL(/stage=Team8P_02_D_II/);
  await expect(page.getByRole('heading', { name: 'Phantasmic Zenith', exact: true })).toBeVisible();
  await page.reload({waitUntil: 'domcontentloaded'});
  await expect(stages.getByRole('button', { name: 'Stage 2 · Upper level', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(difficulty.getByRole('button', { name: 'Challenge', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Phantasmic Zenith', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await expect(page).toHaveURL(/server=original/);
  await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Original', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('Raid catalog keeps the selection and fits the mobile catalog', async ({ page, context }) => {
  await context.addCookies([{ name: 'tof_locale', value: 'en', domain: 'localhost', path: '/' }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/datamine/raids/?server=original&raid=Team8P_22', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible();
  const catalog = page.getByRole('navigation', { name: 'Original raid selection' });
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(catalog.getByRole('button')).toHaveCount(22);
  await expect.poll(() => catalog.locator('[aria-pressed="true"]').evaluate(element => {
    const item = element.getBoundingClientRect(), panel = element.parentElement!.getBoundingClientRect();
    return item.left >= panel.left && item.right <= panel.right;
  })).toBe(true);
  expect(await catalog.evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(220);
  await catalog.getByRole('button', { name: /^Team8P_21 ·/ }).press('Enter');
  await expect(page).toHaveURL(/season=S15/);
  await expect(page.getByRole('heading', { name: /^Manic God-Favored/ })).toBeVisible();
  await page.reload({waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', { name: /^Manic God-Favored/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // A legacy Heroic bookmark still lands on the Challenge card.
  await page.goto('/datamine/raids/?server=original&raid=Team8P_22&variant=Team8P_22_D', {waitUntil: 'domcontentloaded'});
  await expect(page.getByText(/^Challenge · Raid 22 · Season 16$/)).toBeVisible();
});

test('Legacy stage bookmarks select MMO unless the server is explicitly Original', async ({ page, context }) => {
  await context.addCookies([{ name: 'tof_locale', value: 'en', domain: 'localhost', path: '/' }]);
  await page.goto('/datamine/raids/?stage=Team8P_02_D_II', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', { name: 'Phantasmic Zenith', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'MMO', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/datamine/raids/?server=original&stage=Team8P_02_D_II', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('button', { name: 'Original', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('navigation', { name: 'Original raid selection' })).toBeVisible();
});

test('Raids and MMO Sequential omit the overview metrics in both languages', async ({ page, context }) => {
  await page.setViewportSize({width: 320, height: 844});
  for (const locale of ['en', 'ru']) {
    await context.addCookies([{name: 'tof_locale', value: locale, domain: 'localhost', path: '/'}]);
    for (const route of ['/datamine/raids/?server=original', '/datamine/raids/?server=mmo', '/datamine/seq/?mode=mmo']) {
      await page.goto(route, {waitUntil: 'domcontentloaded'});
      await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible();
      await expect(page.locator('main dl').filter({hasText: /Confirmed raid IDs|Difficulty variants|Season configurations|Reward thresholds|Подтверждено рейдов|Варианты сложности|Конфигураций сезонов|Пороги наград/})).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    }
  }
});
