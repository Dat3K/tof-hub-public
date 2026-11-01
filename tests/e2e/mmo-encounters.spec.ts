import { expect, test } from '@playwright/test';

for (const locale of ['en', 'ru'] as const) for (const width of [1440, 390, 320]) {
  test(`MMO encounter pages and Brainfield work in ${locale} at ${width}px`, async ({page, context, baseURL}) => {
    test.setTimeout(180000);
    await context.addCookies([{name: 'tof_locale', value: locale, url: baseURL!}]);
    await page.setViewportSize({width, height: 1000});
    const ru = locale === 'ru';
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const screenshot = async (name: string) => {
      await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await expect.poll(() => page.locator('main img:visible').evaluateAll(images => images.filter(image => {
        const box = image.getBoundingClientRect();
        let visible = box.top < innerHeight && box.bottom > 0 && box.left < innerWidth && box.right > 0;
        for (let parent = image.parentElement; visible && parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent), clip = parent.getBoundingClientRect();
          if (style.overflowX !== 'visible' && (box.left >= clip.right || box.right <= clip.left)) visible = false;
          if (style.overflowY !== 'visible' && (box.top >= clip.bottom || box.bottom <= clip.top)) visible = false;
        }
        return visible && (!(image as HTMLImageElement).complete || (image as HTMLImageElement).naturalWidth === 0);
      }).map(image => image.getAttribute('src')))).toEqual([]);
      await page.screenshot({path: `ignore/documentation-media/generated/handbook-review/${name}-${locale}-${width}.png`, fullPage: true, animations: 'disabled'});
    };
    await page.goto('/datamine/bygone/?mode=mmo&floor=200', {waitUntil: 'networkidle', timeout: 90000});
    await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
    await expect(page.getByRole('article', {name: ru ? 'Этаж 200' : 'Floor 200', exact: true})).toBeVisible();
    await page.getByRole('button', {name: ru ? 'Предыдущий этаж' : 'Previous floor', exact: true}).click();
    await expect(page).toHaveURL(/floor=199/);
    await page.getByRole('button', {name: ru ? 'Следующий этаж' : 'Next floor', exact: true}).click();
    await expect(page.getByRole('button', {name: ru ? 'Этаж 200 · Босс' : 'Floor 200 · Boss', exact: true})).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.getByRole('button', {name: ru ? 'Этаж 200 · Босс' : 'Floor 200 · Boss', exact: true}).evaluate(element => {
      const item = element.closest('article')!.getBoundingClientRect();
      const panel = element.closest('[role="region"]')!.getBoundingClientRect();
      return item.top >= panel.top && item.bottom <= panel.bottom;
    })).toBe(true);
    await screenshot('bygone');
    await page.goto('/datamine/seq/?mode=mmo', {waitUntil: 'networkidle', timeout: 90000});
    await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
    await expect(page.getByRole('heading', {name: ru ? 'Биохимический коллапс' : 'Biochemical Collapse', exact: true})).toBeVisible();
    await expect(page.getByRole('combobox', {name: ru ? 'Сезон' : 'Season', exact: true})).toHaveCount(0);
    await expect(page.getByText(ru ? 'Выберите инкубатор, чтобы посмотреть эффекты, дополнительные условия и противников.' : 'Select a Culture Pod to inspect its effects, bonus objectives and enemies.', {exact: true})).toHaveCount(0);
    await page.getByRole('complementary', {name: ru ? 'Сезоны' : 'Seasons', exact: true}).getByRole('button').nth(1).click();
    await expect(page).toHaveURL(/season=Activity2/);
    await expect.poll(() => page.getByRole('complementary', {name: ru ? 'Сезоны' : 'Seasons', exact: true}).locator('[aria-pressed="true"]').evaluate(element => {
      const item = element.getBoundingClientRect(), panel = element.parentElement!.getBoundingClientRect();
      return item.left >= panel.left && item.right <= panel.right && item.top >= panel.top && item.bottom <= panel.bottom;
    })).toBe(true);
    const pods = page.getByRole('region', {name: ru ? 'Состав инкубаторов' : 'Culture Pod lineup', exact: true}).getByRole('button');
    await expect(pods).toHaveCount(6);
    await pods.nth(1).click();
    await expect(page).toHaveURL(/pod=/);
    await screenshot('biochemical');
    await page.goto('/datamine/raids/?stage=Team8P_06_D', {waitUntil: 'networkidle', timeout: 90000});
    await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
    await expect(page.getByRole('heading', {name: ru ? 'Рейды' : 'Raids', exact: true})).toBeVisible();
    await page.getByRole('button', {name: ru ? 'Испытание' : 'Challenge', exact: true}).click();
    await expect(page).toHaveURL(/stage=Team8P_06_D_II/);
    await expect(page.locator('dl').first()).toContainText('52');
    await page.getByRole('button', {name: ru ? 'Нижний уровень' : 'Lower level', exact: true}).click();
    await expect(page).toHaveURL(/stage=Team8P_17_D_II/);
    await page.getByRole('button', {name: ru ? 'Этап 2' : 'Stage 2', exact: true}).click();
    await expect(page).toHaveURL(/stage=Team8P_18_D_II/);
    await page.getByRole('button', {name: ru ? 'Открыть иллюстрацию босса' : 'Open boss artwork', exact: true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await screenshot('raids');
    await page.goto('/datamine/handbook/?server=mmo#brainfield', {waitUntil: 'networkidle', timeout: 90000});
    await page.getByRole('button', {name: ru ? 'Вся цепь на максимум' : 'Max chain', exact: true}).click();
    await expect(page.getByRole('heading', {name: /75\s*\/\s*75/})).toBeVisible();
    await page.getByRole('button', {name: ru ? 'Сбросить цепь' : 'Reset chain', exact: true}).click();
    const slider = page.getByRole('slider', {name: ru ? 'Планируемый уровень' : 'Planned level', exact: true});
    await slider.focus();
    await slider.press('End');
    await expect(slider).toHaveValue('5');
    await expect(page.getByRole('heading', {name: /5\s*\/\s*75/})).toBeVisible();
    const graph = page.getByRole('region', {name: ru ? 'Граф нейронов, доступна горизонтальная прокрутка' : 'Neuron graph, scroll horizontally to explore', exact: true});
    await expect.poll(() => graph.locator('[aria-pressed="true"]').evaluate(element => {
      const item = element.getBoundingClientRect();
      const panel = element.closest('[role="region"]')!.getBoundingClientRect();
      return item.left >= panel.left && item.right <= panel.right;
    })).toBe(true);
    await screenshot('brainfield');
    await page.getByRole('button', {name: ru ? 'Нейронная цепь III' : 'Neuron Chain III', exact: true}).click();
    await page.getByRole('button', {name: /Talent302/}).click();
    const neuron = page.getByRole('region', {name: ru ? 'Выбранный нейрон' : 'Selected neuron', exact: true});
    const flameEffect = neuron.getByText(ru ? 'Атака огнем' : 'Flame Attack', {exact: true}).first().locator('..');
    await expect(flameEffect.locator('img')).toBeVisible();
    await expect(flameEffect.locator('img')).toHaveAttribute('src', /AttributeIcon\/icon_atk_huo\.webp/);
    await screenshot('brainfield-flame');
    await page.goto('/datamine/handbook/?server=mmo#suppressor', {waitUntil: 'networkidle', timeout: 90000});
    await expect(page.getByRole('table', {name: ru ? 'Боевые бафы супрессора' : 'Suppressor combat buffs', exact: true})).toBeVisible();
    await screenshot('suppressor');
    expect(errors).toEqual([]);
  });
}

test('Old Handbook encounter bookmarks reach the dedicated pages', async ({page}) => {
  test.setTimeout(120000);
  for (const [hash, destination] of [['bygone-phantasm', '/datamine/bygone/'], ['biochemical-collapse', '/datamine/seq/'], ['mmo-raids', '/datamine/raids/']]) {
    await page.goto(`/datamine/handbook/?server=mmo#${hash}`, {waitUntil: 'domcontentloaded'});
    await expect(page).toHaveURL(new RegExp(destination));
    await expect(page.getByRole('heading', {level: 1})).toBeVisible();
  }
});

test('Gacha pages expose the OOW mode switch and keep mode-specific floor state separate', async ({page, context, baseURL}) => {
  test.setTimeout(120000);
  await context.addCookies([{name: 'tof_locale', value: 'en', url: baseURL!}]);
  for (const path of ['/datamine/bygone/', '/datamine/seq/']) {
    await page.goto(path, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.getByRole('button', {name: 'MMO', exact: true}).click();
    await expect(page).toHaveURL(/mode=mmo/);
    await page.getByRole('button', {name: 'Gacha', exact: true}).click();
    await expect(page).not.toHaveURL(/mode=mmo/);
  }
});

test('MMO Bygone omits classless slots from lineups, counts and the selected-range export', async ({page, context, baseURL}) => {
  test.setTimeout(120000);
  await context.addCookies([{name: 'tof_locale', value: 'en', url: baseURL!}]);
  await page.goto('/datamine/bygone/?mode=mmo&floor=1', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
  const floor = page.getByRole('article', {name: 'Floor 1', exact: true});
  await expect(floor.getByRole('listitem')).toHaveCount(2);
  await expect(floor.getByRole('listitem').getByText('×1', {exact: true})).toHaveCount(2);
  await expect(floor.locator('dt').filter({hasText: /^Enemies$/}).locator('..').locator('dd')).toHaveText('2');
  await expect(floor.locator('dd').filter({hasText: /^\s*(?:—|0)?\s*$/})).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Bygone MMO: maximum known enemy HP', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Bygone MMO: required damage growth', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: /recommended CS by floor|enemy level curve/})).toHaveCount(0);
  const slider = page.getByRole('slider', {name: /maximum known enemy HP/});
  await slider.focus();
  await slider.press('End');
  await expect(page).toHaveURL(/floor=20/);
  await page.getByRole('searchbox', {name: 'Find a floor or enemy', exact: true}).fill('1');
  await expect(page.getByRole('region', {name: 'Floor lineups', exact: true}).getByRole('article')).toHaveCount(1);
  const csvEvent = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download CSV', exact: true}).first().click();
  const csv = await csvEvent;
  expect(csv.suggestedFilename()).toBe('bygone-mmo-1-20.csv');
  const stream = await csv.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8');
  expect(text).toContain('"Enemy","Class","Count","BaseHP","BaseATK"');
  expect(text).toContain('"MaxKnownEnemyBaseHP","RequiredDamageGrowthPercent","PreviousFloor","MissingHPEnemyCount"');
  const firstRows = text.split('\r\n').filter(line => line.startsWith('"1",'));
  expect(firstRows).toHaveLength(2);
  expect(firstRows.every(line => line.split('","')[4] === '0')).toBe(true);
  const knownHp = firstRows.map(line => Number(line.match(/,"([^"]*)","[^"]*"$/)?.[1])).filter(value => value > 0);
  const maximum = Number(firstRows[0].match(/^"1","([^"]*)"/)?.[1]);
  expect(maximum).toBe(Math.max(...knownHp));
  expect(maximum).toBeLessThan(knownHp.reduce((sum, value) => sum + value, 0));
  const pngEvent = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download PNG', exact: true}).first().click();
  expect((await pngEvent).suggestedFilename()).toBe('bygone-mmo-hp-1-20.png');
  await page.goto('/datamine/bygone/?mode=mmo&floor=200', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
  const gunner = page.getByRole('article', {name: 'Floor 200', exact: true}).getByRole('listitem');
  await gunner.scrollIntoViewIfNeeded();
  await expect(gunner).toContainText('Defender: Gunner');
  await expect(gunner.locator('img')).toBeVisible();
  await expect.poll(() => gunner.locator('img').evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  const windowEvent = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download CSV', exact: true}).first().click();
  const windowStream = await (await windowEvent).createReadStream();
  const windowChunks: Buffer[] = [];
  for await (const chunk of windowStream!) windowChunks.push(Buffer.from(chunk));
  // The first visible floor still compares against the preceding floor outside the chart window.
  expect(Buffer.concat(windowChunks).toString('utf8')).toMatch(/"181","[^"]+","[^"]+","180"/);
});

for (const locale of ['en', 'ru'] as const) for (const width of [1440, 390, 320]) {
  test(`MMO Sequential presents source grades and objective tables in ${locale} at ${width}px`, async ({page, context, baseURL}) => {
    test.setTimeout(120000);
    const ru = locale === 'ru';
    await context.addCookies([{name: 'tof_locale', value: locale, url: baseURL!}]);
    await page.setViewportSize({width, height: 1000});
    await page.goto('/datamine/seq/?mode=mmo&season=Activity1', {waitUntil: 'networkidle', timeout: 90000});
    await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
    const podName = ru ? 'Инкубатор I' : 'Culture Pod I';
    const row = page.getByRole('region', {name: ru ? 'Состав инкубаторов' : 'Culture Pod lineup', exact: true})
      .getByRole('button', {name: podName, exact: true});
    await row.focus();
    await row.press('Enter');
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    const header = page.getByRole('heading', {name: podName, level: 3, exact: true}).locator('..');
    await expect(header.locator('dt')).toHaveText(ru ? ['ОЗ', 'защита', 'щит', 'атака'] : ['HP', 'Defense', 'Shield', 'Attack']);
    await expect(header.getByRole('img', {name: 'A', exact: true})).toHaveCount(1);
    await expect(header.getByRole('img', {name: 'B', exact: true})).toHaveCount(2);
    await expect(header.getByRole('img', {name: 'S', exact: true})).toHaveCount(1);
    await expect(header).toContainText(ru ? 'Рекомендуется ур.' : 'Recommended Lv.');
    await expect.poll(() => header.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    const objectives = page.getByRole('table', {name: ru ? 'Дополнительные условия' : 'Bonus objectives', exact: true});
    await expect(objectives.getByRole('columnheader')).toHaveText(ru ? ['Условие', 'Очки'] : ['Condition', 'Score']);
    await expect(objectives.locator('tbody tr')).toHaveCount(3);
    await expect(objectives.locator('tbody td:last-child')).toHaveText(['+300', '+400', '+500']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await header.screenshot({path: `ignore/documentation-media/generated/seq-grades-${locale}-${width}.png`, animations: 'disabled'});
    await objectives.screenshot({path: `ignore/documentation-media/generated/seq-objectives-${locale}-${width}.png`, animations: 'disabled'});
    const enemies = page.getByRole('region', {name: ru ? 'Противники и базовые характеристики' : 'Enemy lineup and base stats', exact: true});
    const card = enemies.getByRole('button').first();
    await expect(card).toContainText(ru ? 'Базовые ОЗ' : 'Base HP');
    await expect(card.locator('img[data-tone]')).toHaveCount(4);
    await card.screenshot({path: `ignore/documentation-media/generated/seq-enemy-card-${locale}-${width}.png`, animations: 'disabled'});
    await card.focus();
    await card.press('Enter');
    const dialog = page.getByRole('dialog', {name: ru ? 'Аберрант Франкен' : 'Aberrant Franken', exact: true});
    await expect(dialog).toBeVisible();
    const primary = dialog.getByRole('region', {name: ru ? 'Основные боевые характеристики' : 'Primary combat stats', exact: true});
    await expect(primary).toContainText(ru ? '2\u00a0408\u00a0450' : '2,408,450');
    await expect(primary).toContainText(ru ? '8\u00a0891' : '8,891');
    await expect(primary).toContainText('30%');
    const elements = dialog.getByRole('region', {name: ru ? 'Базовая защита от стихий' : 'Base elemental defense', exact: true});
    await expect(elements.locator('img[data-resistance-element]')).toHaveCount(5);
    await expect(elements).not.toContainText('%');
    await expect(dialog.getByRole('region', {name: ru ? 'Эффекты инкубатора' : 'Culture Pod effects', exact: true})).toBeVisible();
    expect(await dialog.evaluate(element => Array.from(element.children).every(child => child.scrollWidth <= child.clientWidth + 1))).toBe(true);
    await dialog.screenshot({path: `ignore/documentation-media/generated/seq-enemy-dialog-${locale}-${width}.png`, animations: 'disabled'});
    await dialog.getByRole('button', {name: ru ? 'Открыть изображение противника' : 'Open enemy artwork', exact: true}).click();
    await expect(page.locator('.sim-lightbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.sim-lightbox')).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(card).toBeFocused();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
  });
}

for (const locale of ['en', 'ru'] as const) {
  test(`MMO Sequential shows the verified large Armored Defense Force portrait in ${locale}`, async ({page, context, baseURL}) => {
    test.setTimeout(120000);
    const ru = locale === 'ru';
    await context.addCookies([{name: 'tof_locale', value: locale, url: baseURL!}]);
    await page.setViewportSize({width: ru ? 390 : 1440, height: 1000});
    await page.goto('/datamine/seq/?mode=mmo&season=Activity24&pod=BalanceLevel_11_1', {waitUntil: 'networkidle', timeout: 90000});
    await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
    const row = page.getByRole('region', {name: ru ? 'Состав инкубаторов' : 'Culture Pod lineup', exact: true})
      .getByRole('button', {name: ru ? 'Инкубатор I' : 'Culture Pod I', exact: true});
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    await expect(row.locator('img[src$="/TX_mon_hum_201.webp"]')).toHaveCount(2);
    const enemy = page.getByRole('region', {name: ru ? 'Противники и базовые характеристики' : 'Enemy lineup and base stats', exact: true})
      .getByRole('listitem').filter({hasText: ru ? 'Силы обороны в броне' : 'Armored Defense Force'});
    const portrait = enemy.locator('img[src$="/TX_mon_hum_201.webp"]');
    await expect(portrait).toBeVisible();
    await expect(portrait).toHaveCSS('object-fit', 'contain');
    await expect.poll(() => portrait.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(512);
    await expect(enemy.getByRole('img', {name: ru ? 'Полное изображение отсутствует' : 'Full artwork unavailable', exact: true})).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({path: `ignore/documentation-media/generated/seq-enemy-art-${locale}.png`, animations: 'disabled'});
  });
}

test('Sequential enemy dialog fits a long-value summary on one row', async ({page, context, baseURL}) => {
  test.setTimeout(120000);
  await context.addCookies([{name: 'tof_locale', value: 'en', url: baseURL!}]);
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('/datamine/seq/?mode=mmo&season=Activity31&pod=BalanceLevel_18_2', {waitUntil: 'networkidle', timeout: 90000});
  await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
  await page.getByRole('region', {name: 'Enemy lineup and base stats', exact: true}).getByRole('button').filter({hasText: 'Rockwing'}).click();
  const dialog = page.getByRole('dialog', {name: 'Rockwing', exact: true});
  const summary = dialog.getByText('Base HP', {exact: true}).first().locator('..').locator('..');
  await expect(summary).not.toContainText('Crit');
  expect(await summary.evaluate(element => {
    const boxes = Array.from(element.children).map(child => child.getBoundingClientRect());
    return boxes.length === 3 && boxes.every(box => Math.abs(box.top - boxes[0].top) < 1);
  })).toBe(true);
  await expect(dialog.getByRole('region', {name: 'Primary combat stats', exact: true})).toContainText('30%');
  await expect.poll(() => dialog.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await dialog.locator(':scope > div').screenshot({path: 'ignore/documentation-media/generated/seq-rockwing-details-final.png', animations: 'disabled'});
});

test('MMO Sequential compares all pods and opens effects, objectives and enemies with the keyboard', async ({page, context, baseURL}) => {
  test.setTimeout(120000);
  await context.addCookies([{name: 'tof_locale', value: 'en', url: baseURL!}]);
  await page.goto('/datamine/seq/?mode=mmo&season=Activity1', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
  const rail = page.getByRole('complementary', {name: 'Seasons', exact: true});
  const orderedLabels = await rail.getByRole('button').allTextContents();
  expect(orderedLabels.slice(0, 3)).toEqual([expect.stringMatching(/^Activity 1/), expect.stringMatching(/^Season 2/), expect.stringMatching(/^Season 3/)]);
  expect(orderedLabels.findIndex(label => label.startsWith('Season 23'))).toBeLessThan(orderedLabels.findIndex(label => label.startsWith('Season 24')));
  await expect(rail.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');
  const secondSeason = rail.getByRole('button', {name: /^Season 2 /});
  await secondSeason.focus();
  await secondSeason.press('Enter');
  await expect(page).toHaveURL(/season=Activity2/);
  const table = page.getByRole('region', {name: 'Culture Pod lineup', exact: true});
  await expect(table.getByRole('button')).toHaveCount(6);
  const pod = table.getByRole('button', {name: 'Culture Pod II', exact: true});
  await expect(pod).toContainText('Sentry');
  await expect(pod).toContainText('Calamity');
  await expect(pod).toContainText('×2');
  await pod.focus();
  await pod.press('Enter');
  await expect(pod).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', {name: 'Combat effects', exact: true})).toContainText('Warning');
  await expect(page.getByRole('heading', {name: 'Bonus objectives', exact: true})).toBeVisible();
  const enemies = page.getByRole('region', {name: 'Enemy lineup and base stats', exact: true});
  await expect(enemies.getByRole('listitem')).toHaveCount(2);
  await expect(enemies).toContainText('Base HP');
  await enemies.getByRole('button').first().focus();
  await enemies.getByRole('button').first().press('Enter');
  await expect(page.getByRole('dialog').getByRole('region', {name: 'Base elemental defense', exact: true})).toContainText('Physical');
  await page.keyboard.press('Escape');
  await pod.press('Space');
  await expect(pod).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('textbox', {name: 'Find a pod, enemy or effect…', exact: true}).fill('Calamity');
  await expect(table.getByRole('button')).toHaveCount(1);
  await rail.getByRole('button', {name: /^Season 32 /}).click();
  await expect(table.getByRole('button')).toHaveCount(6);
  await expect(table.getByRole('button').first()).toContainText('Yi Hu Dark Wretch');
  await table.getByRole('button').first().click();
  const primary = enemies.getByRole('listitem').filter({hasText: 'Yi Hu Dark Wretch'});
  const add = enemies.getByRole('listitem').filter({hasText: 'Tie Yuan Dark Wretch'});
  await expect(primary.locator('img').first()).toBeVisible();
  await expect(add.locator('img').first()).toBeVisible();
  await page.goto('/datamine/seq/?mode=mmo&pod=BalanceLevel_19_1', {waitUntil: 'domcontentloaded'});
  await expect(rail.getByRole('button', {name: /^Season 32 /})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', {name: 'Culture Pod I', exact: true})).toHaveAttribute('aria-expanded', 'true');
});

for (const locale of ['en', 'ru'] as const) for (const width of [1440, 390, 320]) {
  test(`Sequential regional season and row presentation work in ${locale} at ${width}px`, async ({page, context, baseURL}) => {
    test.setTimeout(120000);
    const ru = locale === 'ru';
    await context.addCookies([{name: 'tof_locale', value: locale, url: baseURL!}]);
    await page.clock.setFixedTime(new Date('2026-10-23T12:00:00Z'));
    await page.setViewportSize({width, height: 1000});
    await page.goto('/datamine/seq/?mode=mmo', {waitUntil: 'networkidle', timeout: 90000});
    await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
    const rail = page.getByRole('complementary', {name: ru ? 'Сезоны' : 'Seasons', exact: true});
    await expect(rail.getByRole('button', {name: new RegExp(`^${ru ? 'Сезон' : 'Season'} 31`)})).toHaveAttribute('aria-pressed', 'true');
    const heading = page.getByRole('heading', {level: 2, name: ru ? 'Сезон 31' : 'Season 31', exact: true});
    await expect(heading.locator('..')).toContainText('19.10 → 23.11');
    await expect(heading.locator('..')).not.toContainText('2026');
    await expect(heading.locator('..')).not.toContainText('21:00');
    const table = page.getByRole('region', {name: ru ? 'Состав инкубаторов' : 'Culture Pod lineup', exact: true});
    const rows = table.locator('[aria-controls^="culture-pod-"]');
    await expect(rows).toHaveCount(6);
    await expect(rows.first()).toContainText(ru ? 'Аберрант-голиаф' : 'Aberrant Goliath');
    expect(await rail.locator('button > span:first-child > img').evaluateAll(images => images.every(image => {
      const rect = image.getBoundingClientRect(), frame = image.parentElement!.getBoundingClientRect();
      return rect.left >= frame.left && rect.right <= frame.right + 1 && rect.top >= frame.top && rect.bottom <= frame.bottom + 1;
    }))).toBe(true);
    if (width > 700) expect(await rows.evaluateAll(elements => elements.every(row => {
      const bounds = row.getBoundingClientRect(), arrow = row.querySelector(':scope > div:last-child svg')!.getBoundingClientRect();
      return Math.abs((arrow.top + arrow.bottom - bounds.top - bounds.bottom) / 2) < 1 && Math.abs(bounds.right - (arrow.left + arrow.right) / 2 - 22) < 1;
    }))).toBe(true);
    if (width > 700) expect(await rows.evaluateAll(elements => elements.every(row => {
      const cells = [row.children[5], ...Array.from(row.children[1].children)];
      return cells.every(cell => {
        const parts = Array.from(cell.children).map(part => part.getBoundingClientRect()).filter(box => box.width > 0);
        const frame = cell.getBoundingClientRect();
        return parts.length === 0 || Math.abs((Math.min(...parts.map(box => box.left)) + Math.max(...parts.map(box => box.right)) - frame.left - frame.right) / 2) < 1;
      });
    }))).toBe(true);
    await rail.getByRole('button', {name: new RegExp(`^${ru ? 'Сезон' : 'Season'} 2 `)}).click();
    const pod = table.getByRole('button', {name: ru ? 'Инкубатор II' : 'Culture Pod II', exact: true});
    await pod.click();
    const effects = page.getByRole('region', {name: ru ? 'Боевые эффекты' : 'Combat effects', exact: true});
    const advantage = effects.getByRole('article').filter({hasText: ru ? 'Преимущество' : 'Advantage'}).first();
    const disadvantage = effects.getByRole('article').filter({hasText: ru ? 'Недостаток' : 'Disadvantage'}).first();
    await expect(advantage).toHaveCSS('border-left-color', 'rgb(79, 227, 193)');
    await expect(disadvantage).toHaveCSS('border-left-color', 'rgb(255, 107, 139)');
    await expect(effects.getByRole('heading', {name: ru ? 'Преимущества' : 'Advantages', exact: true})).toHaveCount(1);
    await expect(effects.getByRole('heading', {name: ru ? 'Недостатки' : 'Disadvantages', exact: true})).toHaveCount(1);
    await expect(effects.getByRole('article').last()).toContainText(ru ? 'Недостаток' : 'Disadvantage');
    if (width > 700) expect(await effects.getByRole('article').evaluateAll(cards => {
      const heights = cards.map(card => card.getBoundingClientRect().height);
      return Math.max(...heights) - Math.min(...heights);
    })).toBeLessThanOrEqual(1);
    if (width > 700) expect(await effects.getByRole('article').evaluateAll(cards => {
      const widths = cards.map(card => card.getBoundingClientRect().width);
      return Math.max(...widths) - Math.min(...widths);
    })).toBeLessThanOrEqual(1);
    await expect(page.getByText('Base values before level and difficulty scaling. DEF is not a resistance percentage.', {exact: true})).toHaveCount(0);
    await expect(page.getByText('Базовые значения до масштабирования уровня и сложности. Защита не является процентом сопротивления.', {exact: true})).toHaveCount(0);
    await expect(page.getByText('Global dates use the client’s regional schedule. Other configurations retain their default client dates.', {exact: true})).toHaveCount(0);
    await page.locator('summary').filter({hasText: ru ? 'Все эффекты контента' : 'All content effects'}).click();
    await expect(page.getByRole('table', {name: ru ? 'Все эффекты контента' : 'All content effects', exact: true})).toBeVisible();
    await expect(page.getByRole('table', {name: ru ? 'Пороги наград сезона' : 'Season reward thresholds', exact: true})).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await effects.screenshot({path: `ignore/documentation-media/generated/seq-buff-cards-${locale}-${width}.png`, animations: 'disabled'});
    await page.screenshot({path: `ignore/documentation-media/generated/seq-row-layout-${locale}-${width}.png`, animations: 'disabled'});
  });
}

for (const locale of ['en', 'ru'] as const) for (const width of [1440, 390, 320]) {
  test(`Brainfield maximum defaults and total stats update in ${locale} at ${width}px`, async ({page, context, baseURL}) => {
    test.setTimeout(120000);
    await context.addCookies([{name: 'tof_locale', value: locale, url: baseURL!}]);
    await page.setViewportSize({width, height: 1000});
    const ru = locale === 'ru';
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/datamine/handbook/?server=mmo#brainfield', {waitUntil: 'networkidle', timeout: 90000});
    await expect(page.getByText('Choose a neuron and set its level to plan the upgrade materials. Each chain follows the game’s node layout.', {exact: true})).toHaveCount(0);
    await expect(page.getByRole('heading', {name: /75\s*\/\s*75/})).toBeVisible();
    const summary = page.getByRole('region', {name: ru ? 'Сумма статов прокачки' : 'Total upgrade stats', exact: true});
    await expect(summary.locator('dt').first()).toBeVisible();
    for (const icon of ['icon_atk', 'icon_atk_bing', 'icon_atk_huo', 'icon_atk_dian']) {
      await expect(summary.locator(`img.resistance-icon[src$="AttributeIcon/${icon}.webp"]`)).toBeVisible();
    }
    const maxTotals = await summary.locator('dl').textContent();
    const slider = page.getByRole('slider', {name: ru ? 'Планируемый уровень' : 'Planned level', exact: true});
    await expect(slider).toHaveValue('5');
    await slider.focus();
    await slider.press('Home');
    await expect(summary.locator('dl')).not.toHaveText(maxTotals!);
    const changedTotals = await summary.locator('dl').textContent();
    await page.getByRole('button', {name: ru ? 'Нейронная цепь II' : 'Neuron Chain II', exact: true}).click();
    await expect(page.getByRole('heading', {name: /165\s*\/\s*165/})).toBeVisible();
    await expect(summary.locator('dl')).toHaveText(changedTotals!);
    for (const chain of ['III', 'IV']) {
      await page.getByRole('button', {name: `${ru ? 'Нейронная цепь' : 'Neuron Chain'} ${chain}`, exact: true}).click();
      await expect(page.getByRole('heading', {name: /127\s*\/\s*127/})).toBeVisible();
    }
    await page.getByRole('button', {name: ru ? 'Нейронная цепь I' : 'Neuron Chain I', exact: true}).click();
    await expect(slider).toHaveValue('0');
    await page.getByRole('button', {name: ru ? 'Вся цепь на максимум' : 'Max chain', exact: true}).click();
    await expect(summary.locator('dl')).toHaveText(maxTotals!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await summary.screenshot({path: `ignore/documentation-media/generated/handbook-review/brainfield-totals-${locale}-${width}.png`});
    expect(errors).toEqual([]);
  });
}
