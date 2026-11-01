import { expect, test } from '@playwright/test';

test('Space Support has one level slider per module and shared requirements', async ({ page }) => {
  await page.goto('/datamine/handbook/#space-support/levels');
  const base = page.getByRole('group', {name: 'Base modules', exact: true});
  const mode = page.getByRole('group', {name: 'Mode modules', exact: true});
  await expect(base.getByRole('slider')).toHaveCount(8);
  await expect(mode.getByRole('slider')).toHaveCount(10);
  await expect(page.getByRole('slider')).toHaveCount(18);
  const physical = base.getByRole('group', {name: 'Physical Attack', exact: true});
  const slider = physical.getByRole('slider');
  for (const level of [0, 5, 10]) {
    await page.getByRole('button', {name: `All ${level}`, exact: true}).click();
    for (const input of await page.getByRole('slider').all()) await expect(input).toHaveValue(String(level));
  }
  await page.getByRole('button', {name: 'All 0', exact: true}).click();
  await slider.focus();
  await slider.press('End');
  await expect(slider).toHaveValue('10');
  await expect(physical).toContainText('1,500');
  await expect(page.locator('dl')).toContainText('1,700');
  const requirements = page.getByRole('table', {name: 'Module level requirements', exact: true});
  await expect(requirements.locator('tbody tr')).toHaveCount(10);
  await expect(requirements.locator('tbody tr').last()).toContainText('475');
  await expect(requirements.locator('tbody tr').nth(5)).toContainText('All base modules at level 5');
  await expect(page.getByRole('region', {name: 'Selected module', exact: true})).toHaveCount(0);
  await page.setViewportSize({width: 390, height: 844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('Supercomputer separates compact costs, EXP-dependent chances and working slot bonuses', async ({ page }) => {
  await page.goto('/datamine/handbook/#supercomputer/cost');
  const costs = page.getByRole('table', { name: 'Supercomputer levels', exact: true });
  await expect(costs.getByRole('columnheader')).toHaveText(['Level', 'Experience', 'Total exp.', 'Avg. attempts', 'Max. attempts']);
  await expect(page.getByText('Algorithm Data', { exact: true })).toHaveCount(0);
  const chanceButton = page.getByRole('button', { name: 'Upgrade chances', exact: true });
  const costButton = page.getByRole('button', { name: 'Upgrade cost', exact: true });
  expect((await chanceButton.boundingBox())!.x).toBeLessThan((await costButton.boundingBox())!.x);
  await expect(costs.locator('tbody tr')).toHaveCount(20);
  expect(await costs.locator('tbody tr').first().evaluate(row => row.getBoundingClientRect().height)).toBeLessThan(35);
  await page.getByRole('button', { name: 'Upgrade chances', exact: true }).click();
  const chances = page.getByRole('table', { name: 'Supercomputer upgrade chances', exact: true });
  const fourth = chances.locator('tbody tr').filter({ has: page.getByRole('cell', { name: '4', exact: true }) });
  await expect(fourth).toHaveCount(2);
  await expect(fourth.first().getByRole('cell').nth(1)).toHaveText('0–67');
  await expect(fourth.last().getByRole('cell').nth(1)).toHaveText('68–87');
  await expect(chances).not.toContainText('(+0)');
  await page.getByRole('button', { name: 'Bonuses by level', exact: true }).click();
  const slots = page.getByRole('group', { name: 'Slot', exact: true }).getByRole('radio');
  await expect(slots).toHaveText(['Combat Engine', 'Microreactor', 'Exoskeleton', 'Eyepiece']);
  const eyepiece = page.getByRole('radio', { name: 'Eyepiece', exact: true });
  await expect(eyepiece).toHaveClass(/sim-filter-btn--function/);
  await expect(slots.first().locator('img')).toHaveAttribute('src', /Icon_NewEqui2-2\.webp/);
  await expect(eyepiece.locator('img')).toHaveAttribute('src', /Icon_NewEqui1-1\.webp/);
  await eyepiece.click();
  const bonuses = page.getByRole('table', { name: 'Supercomputer bonuses', exact: true });
  await expect(bonuses.getByRole('columnheader')).toContainText(['Level', 'Elemental DMG', 'All ATK', 'Shatter']);
  const columnPositions = () => bonuses.getByRole('columnheader').evaluateAll(headers => headers.map(header => {
    const box = header.getBoundingClientRect();
    return { x: Math.round(box.x), width: Math.round(box.width) };
  }));
  const initialColumns = await columnPositions();
  for (const slot of await slots.all()) {
    await slot.click();
    expect(await columnPositions()).toEqual(initialColumns);
    const icons = bonuses.getByRole('columnheader').locator('img');
    for (const icon of await icons.all()) await expect(icon).toHaveCSS('filter', 'brightness(0) invert(1)');
  }
  const engine = page.getByRole('radio', { name: 'Combat Engine', exact: true });
  await engine.focus();
  await page.keyboard.press('Enter');
  await expect(engine).toHaveAttribute('aria-checked', 'true');
  await expect(bonuses.getByRole('columnheader')).toContainText(['Level', 'Elemental DMG', 'All resistances', 'Healing']);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('Handbook shares Gear stat order and Titan property presentation across sections', async ({ page }) => {
  await page.goto('/datamine/handbook/#random-stats/ranges');
  const gear = page.getByRole('table', { name: 'Stat ranges', exact: true });
  await expect(gear).toBeVisible();
  const names = await gear.locator('tbody td:first-child').allTextContents();
  await page.goto('/datamine/handbook/#cs/weights');
  const weights = page.getByRole('table', { name: 'Attribute weights', exact: true });
  await expect(weights).toBeVisible();
  const weightNames = await weights.locator('tbody td:first-child').allTextContents();
  for (const name of ['Resistance %', 'Altered Attack %', 'Altered Damage %']) {
    expect(weightNames).not.toContain(name);
  }
  const shared = names.filter(name => weightNames.includes(name));
  expect(weightNames.filter(name => shared.includes(name))).toEqual(shared);
  await page.goto('/datamine/handbook/#titan/values');
  const values = page.getByRole('table', { name: 'Rare property values', exact: true });
  await expect(values).toBeVisible();
  const titanNames = await values.locator('tbody td:first-child').allTextContents();
  const iconFilter = await values.locator('tbody td:first-child img').first().evaluate(icon => getComputedStyle(icon).filter);
  await page.goto('/datamine/handbook/#cs/titan');
  const titanCs = page.getByRole('table', { name: 'Titan rare property weights', exact: true });
  await expect(titanCs).toBeVisible();
  await expect(titanCs.locator('tbody td:first-child')).toHaveText(titanNames);
  await expect(titanCs.locator('tbody td:first-child img').first()).toHaveCSS('filter', iconFilter);
  await expect(titanCs.getByRole('columnheader')).toHaveCount(6);
  const block = titanCs.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Block', exact: true }) });
  await expect(block.getByRole('cell')).toHaveText(['Block', '20,000', '6%', '1,200', '34.8%', '6,960']);
  await block.getByRole('cell').last().locator('[tabindex="0"]').hover();
  await expect(page.getByRole('tooltip')).toContainText('34.8% × 20,000 = 6,960 CS');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('CS examples distinguish flat stats, percentage bases and fixed percentage weights', async ({ page }) => {
  await page.goto('/datamine/handbook/#cs/weights');
  const table = page.getByRole('table', { name: 'Attribute weights', exact: true });
  const row = (name: string) => table.getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) });
  await expect(row('ATK').getByRole('cell').last()).toHaveText('2,000');
  await expect(row('HP').getByRole('cell').last()).toHaveText('25');
  await expect(row('Physical Attack %').getByRole('cell').last()).toHaveText('1,500');
  await expect(row('Crit Rate %').getByRole('cell').last()).toHaveText('7,520');
  await row('Physical Attack %').getByRole('cell').last().locator('[tabindex="0"]').hover();
  await expect(page.getByRole('tooltip')).toContainText('10,000 Physical Attack');
  await expect(page.getByRole('tooltip')).toContainText('10% × 10,000 × 1.500 = 1,500 CS');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('Titan added stats retain Build fill order with HP first for Crit', async ({ page }) => {
  await page.goto('/datamine/handbook/#titan/added');
  const table = page.getByRole('table', { name: 'Added stats', exact: true });
  const crit = table.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Crit', exact: true }) });
  await expect(crit.getByRole('cell').nth(1)).toHaveText('—');
  await expect(crit.getByRole('cell').nth(2)).toHaveText(/^HP\s*Flame Resistance\s*Frost Resistance\s*Physical Resistance\s*Volt Resistance\s*Resistance$/);
  const physical = table.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Physical Resistance', exact: true }) });
  await expect(physical.getByRole('cell').nth(2)).toHaveText(/^HP\s*Resistance$/);
});

test('Titan property values compare levels with pinned property names', async ({ page }) => {
  await page.goto('/datamine/handbook/#titan/values');
  const table = page.getByRole('table', { name: 'Rare property values', exact: true });
  await expect(table.getByRole('columnheader').last()).toHaveText('Lv. 30');
  await expect(table.getByRole('columnheader').nth(18)).toContainText('Lv. 18');
  await expect(table.getByRole('columnheader').nth(18)).toContainText('MAX');
  await expect(table.getByRole('columnheader').nth(19)).toHaveAttribute('data-divider', 'neutral');
  expect(await table.getByRole('columnheader').nth(19).evaluate(cell => getComputedStyle(cell, '::before').left)).toBe('12px');
  const firstCell = table.locator('tbody tr').first().getByRole('cell').first();
  await firstCell.locator('[tabindex="0"]').hover();
  await expect(page.getByRole('tooltip')).toContainText('every 0.5 seconds');
  await expect(page.getByRole('tooltip')).toContainText('{value}% of ATK');
  await expect(page.getByRole('tooltip').locator('.sim-keyword-hl')).toContainText('{value}%');
  await expect(page.getByRole('tooltip')).not.toContainText('Lv. 18');
  await page.mouse.move(0, 0);
  await firstCell.locator('[tabindex="0"]').focus();
  await expect(page.getByRole('tooltip')).toContainText('every 0.5 seconds');
  await firstCell.locator('[tabindex="0"]').blur();
  await table.locator('tbody tr').first().getByRole('cell').nth(9).hover();
  await expect(table.getByRole('columnheader').nth(9)).toHaveAttribute('data-column-hover', 'true');
  await table.locator('tbody tr').first().getByRole('cell').nth(8).hover();
  await expect(table.getByRole('columnheader').nth(9)).not.toHaveAttribute('data-column-hover');
  await expect(table.getByRole('columnheader').nth(8)).toHaveAttribute('data-column-hover', 'true');
  await page.mouse.move(0, 0);
  await expect(table.locator('th[data-column-hover]')).toHaveCount(0);
  await expect(table.locator('tbody tr').first().getByRole('cell').nth(3)).toHaveText('2.429%');
  await expect(page.getByRole('slider', { name: 'Property level', exact: true })).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await firstCell.boundingBox();
    await table.evaluate(element => { element.parentElement!.scrollLeft = 1500; });
    const after = await firstCell.boundingBox();
    expect(after!.x).toBeCloseTo(before!.x, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
});

test('Titan rare-property levels share one line within each augmentation period', async ({ page }) => {
  await page.goto('/datamine/handbook/#titan/rare');
  const table = page.getByRole('table', { name: 'Rare property chances', exact: true });
  await expect(table).toBeVisible();
  const row = table.locator('tbody tr').first();
  const layout = await row.evaluate(element => {
    const levels = [...element.querySelectorAll('td:last-child > span > span')];
    return {height: element.getBoundingClientRect().height,
      centers: levels.map(level => { const box = level.getBoundingClientRect(); return box.y + box.height / 2; })};
  });
  expect(layout.height).toBeLessThan(55);
  expect(layout.centers).toHaveLength(3);
  expect(new Set(layout.centers).size).toBe(1);
  const columnPositions = () => table.getByRole('columnheader').evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().x));
  const initialPositions = await columnPositions();
  for (const name of ['Eyepiece', 'Combat Engine', 'Helmet']) {
    await page.getByRole('radio', { name, exact: true }).click();
    expect(await columnPositions()).toEqual(initialPositions);
  }
});

test('pool category buttons retain sources, element icons and distinct guaranteed variants', async ({ page }) => {
  await page.goto('/datamine/handbook/#random-stats/chances');
  const initialTable = page.getByRole('table', { name: 'Stat chances', exact: true });
  await expect(initialTable.getByRole('columnheader')).toHaveText(['Stat', 'Weight', 'One draw', 'On item', 'Without stat']);
  const columnPositions = () => initialTable.getByRole('columnheader').evaluateAll(headers => headers.map(header => {
    const box = header.getBoundingClientRect();
    return {x: Math.round(box.x), width: Math.round(box.width)};
  }));
  const originalColumns = await columnPositions();
  const hp = initialTable.getByRole('row').filter({ has: page.getByRole('cell', {name: 'HP', exact: true}) });
  await expect(hp.getByRole('cell').nth(3)).toContainText('85.11%');
  await expect(hp.getByRole('cell').nth(4)).toHaveText('14.89%');
  await expect(page.getByRole('group', { name: 'Standard', exact: true }).getByRole('button')).toHaveCount(1);
  const promo = page.getByRole('group', { name: 'Promo', exact: true });
  await expect(promo.getByRole('button')).toHaveCount(4);
  await expect(promo.getByRole('button', { name: 'Arc', exact: true }).locator('img')).toHaveAttribute('src', /icon_element_lei\.webp/);
  await expect(promo.getByRole('button', { name: 'Arc', exact: true })).toHaveClass(/sim-filter-btn--volt/);
  await expect(promo.getByRole('button', { name: 'Overload', exact: true })).toHaveClass(/sim-filter-btn--phys/);
  const premium = page.getByRole('group', { name: '50 USD', exact: true });
  await expect(premium.getByRole('button', { name: 'Burst', exact: true })).toHaveClass(/sim-filter-btn--flame/);
  await premium.getByRole('button', { name: 'Burst', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(premium.getByRole('button', { name: 'Burst', exact: true })).toHaveAttribute('title', /Metaload Equipment Box/);
  await expect(page.getByText(/^Source:/)).toHaveCount(0);
  const table = page.getByRole('table', { name: 'Stat chances', exact: true });
  await expect(table.getByRole('row').filter({ hasText: 'Guaranteed' })).toHaveCount(2);
  expect(await columnPositions()).toEqual(originalColumns);
  for (const row of await table.getByRole('row').filter({ hasText: 'Guaranteed' }).all()) {
    await expect(row.getByRole('cell').nth(3)).toContainText('100%');
    await expect(row.getByRole('cell').nth(4)).toHaveText('0%');
  }
  await page.getByRole('radio', { name: 'Eyepiece', exact: true }).click();
  await expect(premium).toHaveCount(0);
  await page.getByRole('group', { name: '100 USD', exact: true }).getByRole('button', { name: 'Burst', exact: true }).click();
  const variants = page.getByRole('group', { name: 'Guaranteed stats', exact: true });
  await expect(variants.getByRole('button')).toHaveCount(4);
  const labels = await variants.getByRole('button').evaluateAll(buttons => buttons.map(button => button.getAttribute('title')));
  expect(new Set(labels).size).toBe(4);
  for (const button of await variants.getByRole('button').all()) {
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(table.getByRole('row').filter({ hasText: 'Guaranteed' })).toHaveCount(3);
  }
  await page.getByRole('radio', { name: 'Blue', exact: true }).click();
  const ordinary = page.getByRole('group', { name: 'Standard', exact: true });
  await expect(ordinary.getByRole('button')).toHaveText(['Standard']);
  await expect(promo.getByRole('button')).toHaveText(['Overload', 'Glaze', 'Burst', 'Arc']);
  const ordinaryBox = await ordinary.boundingBox();
  const promoBox = await promo.boundingBox();
  expect(ordinaryBox!.x).toBeLessThan(promoBox!.x);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('direct sub-tab links never mount the default stat ranges table', async ({ page }) => {
  await page.addInitScript(() => {
    const observed: string[] = [];
    Object.assign(window, { handbookTables: observed });
    new MutationObserver(() => {
      for (const caption of document.querySelectorAll('table caption')) {
        if (caption.textContent) observed.push(caption.textContent);
      }
    }).observe(document, { subtree: true, childList: true });
  });
  await page.goto('/datamine/handbook/#random-stats/chances');
  await expect(page.getByRole('table', { name: 'Stat chances', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chances by slot', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => (window as unknown as { handbookTables: string[] }).handbookTables))
    .not.toContain('Stat ranges');
  await page.reload();
  await expect(page.getByRole('table', { name: 'Stat chances', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { handbookTables: string[] }).handbookTables))
    .not.toContain('Stat ranges');
});

test('servers separate Korea and retain compact regional columns and UID lookup', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/datamine/handbook/#servers');
  const regions = ['Asia Pacific', 'North America', 'Europe', 'South America', 'Southeast Asia'];
  for (const region of regions) await expect(page.getByRole('heading', { name: region, exact: true })).toBeVisible();
  const uidInput = page.getByRole('textbox', { name: 'UID', exact: true });
  await expect(page.getByRole('group', { name: 'Servers', exact: true }).getByRole('radio')).toHaveText(['Global', 'Korea', 'Taiwan', 'PlayStation', 'Warp', 'China']);
  await expect(page.getByRole('radio', { name: 'Test', exact: true })).toHaveCount(0);
  expect((await uidInput.boundingBox())!.x).toBeGreaterThan((await page.getByRole('radio', { name: 'China', exact: true }).boundingBox())!.x);
  await expect(page.getByRole('table', { name: '에스페리아', exact: true })).toHaveCount(0);
  const positions = await Promise.all(regions.map(region => page.getByRole('heading', { name: region, exact: true }).boundingBox()));
  expect(new Set(positions.map(box => box!.y)).size).toBe(1);
  await page.getByRole('radio', { name: 'Korea', exact: true }).click();
  const korean = page.getByRole('table', { name: '에스페리아', exact: true });
  await expect(korean.getByRole('row')).toHaveCount(9);
  await expect(korean).toContainText('9999101');
  await page.getByRole('radio', { name: 'Global', exact: true }).click();
  await page.getByRole('textbox', { name: 'UID', exact: true }).fill('9999101001234');
  await expect(page.getByRole('radio', { name: 'Korea', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(korean.getByRole('row').filter({ hasText: '9999101' })).toBeVisible();
  await page.screenshot({ path: 'ignore/documentation-media/generated/handbook-servers-korea.png' });
  await page.getByRole('radio', { name: 'Global', exact: true }).click();
  await page.screenshot({ path: 'ignore/documentation-media/generated/handbook-servers-regions.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await context.addCookies([{ name: 'tof_locale', value: 'ru', url: 'http://localhost:3000' }]);
  await page.reload();
  await page.getByRole('radio', { name: 'Корея', exact: true }).click();
  await expect(korean.getByRole('columnheader')).toHaveText(['Название сервера', 'ID']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('removed Handbook content stays absent and Supercomputer opens chances first', async ({ page }) => {
  await page.goto('/datamine/handbook/#enhancement/stars');
  await expect(page.getByRole('button', { name: 'Main stats by level', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Stars', exact: true })).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Star experience', exact: true })).toHaveCount(0);
  await page.evaluate(() => { location.hash = 'cs/weights'; });
  await expect(page.getByRole('table', { name: 'Attribute weights', exact: true })).toBeVisible();
  await expect(page.getByText(/Weights are from AttributeStaticDataTable/)).toHaveCount(0);
  await page.evaluate(() => { location.hash = 'supercomputer'; });
  await expect(page.getByRole('button', { name: 'Upgrade chances', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('enhancement groups scale costs and keep compact milestones without an empty suppressor column', async ({ page }) => {
  await page.goto('/datamine/handbook/#enhancement/cost');
  const choices = page.getByRole('group', {name: 'Slots', exact: true});
  await expect(choices.getByRole('radio')).toHaveText(['Normal (1)', 'Vera (1)', 'Full round (8)', 'Vera only (4)', 'All (12)']);
  const table = page.getByRole('table', {name: 'Enhancement milestones', exact: true});
  await expect(table.getByRole('columnheader')).toHaveText(['Level', 'Total from +0', 'Player level']);
  expect(await table.locator('tbody tr').first().evaluate(row => row.getBoundingClientRect().height)).toBeLessThan(35);
  await choices.getByRole('radio', {name: 'Full round (8)', exact: true}).click();
  await expect(table.locator('tbody tr').last()).toContainText('24,608,000');
  await choices.getByRole('radio', {name: 'Vera only (4)', exact: true}).click();
  await expect(table.locator('tbody tr').last()).toContainText('12,304,000');
  await choices.getByRole('radio', {name: 'All (12)', exact: true}).click();
  await expect(table.locator('tbody tr').last()).toContainText('36,912,000');
  await page.setViewportSize({width: 390, height: 844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('Suppressor opens Build stats first and keeps upgrade controls compact', async ({ page }) => {
  await page.goto('/datamine/handbook/#suppressor', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('button', {name: 'Stats by level', exact: true})).toHaveAttribute('aria-pressed', 'true');
  const stats = page.getByRole('table', {name: 'Suppressor stats', exact: true});
  await expect(stats.getByRole('columnheader')).toHaveCount(5);
  await expect(stats.getByRole('row').filter({hasText: 'V1.1'})).toContainText('2,088');
  await page.getByRole('button', {name: 'Upgrade cost', exact: true}).click();
  const costs = page.getByRole('table', {name: 'Suppressor versions', exact: true});
  await expect(costs).toBeVisible();
  expect(await costs.locator('tbody tr').first().evaluate(row => row.getBoundingClientRect().height)).toBeLessThan(35);
  await expect(page.getByRole('slider')).toHaveCount(2);
  await page.setViewportSize({width: 390, height: 844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('table headers follow page scrolling, remain bounded and keep horizontal alignment', async ({ page }) => {
  await page.setViewportSize({width: 1280, height: 600});
  await page.goto('/datamine/handbook/#suppressor/stats', {waitUntil: 'domcontentloaded'});
  const table = page.getByRole('table', {name: 'Suppressor stats', exact: true});
  await expect(table).toBeVisible();
  await page.evaluate(() => {document.body.style.paddingBottom = '900px';});
  await table.evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + scrollY + 200));
  await expect.poll(() => table.locator('thead').evaluate(element => {
    const inset = Math.max(0, document.querySelector('[data-site-header]')!.getBoundingClientRect().bottom);
    return Math.abs(element.getBoundingClientRect().top - inset);
  })).toBeLessThan(2);
  await table.evaluate(element => window.scrollTo(0, element.getBoundingClientRect().bottom + scrollY + 30));
  await expect.poll(() => table.locator('thead').evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThan(1);
  await page.evaluate(() => {location.hash = 'titan/values'; window.scrollTo(0, 0);});
  const wide = page.getByRole('table', {name: 'Rare property values', exact: true});
  await expect(wide).toBeVisible();
  await wide.evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + scrollY + 80));
  await wide.evaluate(element => {element.parentElement!.scrollLeft = 400;});
  await expect.poll(() => wide.evaluate(element => {
    const heading = element.querySelectorAll('th')[5]!.getBoundingClientRect();
    const cell = element.querySelectorAll('tbody tr:first-child td')[5]!.getBoundingClientRect();
    return Math.abs(heading.x - cell.x);
  })).toBeLessThan(2);
  const pinned = wide.getByRole('columnheader').first();
  expect((await pinned.boundingBox())!.x).toBeGreaterThanOrEqual(0);
});

test('formula calculators expose inputs, live calculations, validation and level references', async ({ page, context }) => {
  await page.goto('/datamine/handbook/#combat-formulas/crit', {waitUntil: 'domcontentloaded'});
  const result = page.getByRole('status').filter({hasText: 'Calculated crit chance'});
  await expect(result).toContainText('35.44%');
  await page.getByRole('textbox', {name: 'Bonus Crit Rate', exact: true}).fill('5');
  await expect(result).toContainText('40.44%');
  const crit = page.getByRole('textbox', {name: 'Your Crit', exact: true});
  await crit.fill('');
  await expect(result).toContainText('Enter valid values');
  await crit.fill('-5');
  await expect(crit).toHaveAttribute('aria-invalid', 'true');
  await expect(result).toContainText('Enter valid values');
  await page.getByRole('button', {name: 'Reset example', exact: true}).click();
  await expect(crit).toHaveValue('10000');
  await page.getByText('Level reference table', {exact: true}).click();
  await expect(page.getByRole('table', {name: 'Crit denominators', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Damage reduction', exact: true}).click();
  await page.getByRole('textbox', {name: 'Target resistance', exact: true}).fill('0');
  await expect(page.getByRole('status').filter({hasText: 'Damage reduction'})).toContainText('0%');
  await page.getByRole('button', {name: 'Ignore & shred', exact: true}).click();
  await page.getByRole('button', {name: 'Reset example', exact: true}).click();
  await page.getByRole('textbox', {name: 'Resistance shred', exact: true}).fill('30');
  await expect(page.getByRole('status').filter({hasText: 'More damage'})).toContainText('3,675');
  await page.getByRole('textbox', {name: 'Resistance ignore', exact: true}).fill('101');
  await expect(page.getByRole('status').filter({hasText: 'More damage'})).toContainText('Enter valid values');
  await page.getByRole('textbox', {name: 'Resistance ignore', exact: true}).fill('30,5');
  await expect(page.getByRole('textbox', {name: 'Resistance ignore', exact: true})).not.toHaveAttribute('aria-invalid', 'true');
  await page.setViewportSize({width: 320, height: 700});
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await context.addCookies([{name: 'tof_locale', value: 'ru', url: 'http://localhost:3000'}]);
  await page.reload({waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('textbox', {name: 'Игнор сопротивления', exact: true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('MMO stat labels show localized game descriptions on hover and keyboard focus', async ({ page, context }) => {
  await page.goto('/datamine/handbook/?server=mmo#random-stats/ranges', {waitUntil: 'domcontentloaded'});
  const table = page.getByRole('table', {name: 'Stat ranges', exact: true});
  const weak = table.getByRole('row').filter({has: page.getByRole('cell', {name: 'Weak Point Damage Boost', exact: true})});
  await weak.getByRole('cell').first().locator('[tabindex="0"]').hover();
  await expect(page.getByRole('tooltip')).toContainText('weak points matching');
  await expect(page.getByRole('tooltip')).toContainText('{value}');
  await page.mouse.move(0, 0);
  const healing = table.getByRole('row').filter({has: page.getByRole('cell', {name: 'Healing', exact: true})});
  await healing.getByRole('cell').first().locator('[tabindex="0"]').focus();
  await expect(page.getByRole('tooltip')).toContainText('Healing');
  await expect(weak.locator('[data-accent]')).toHaveAttribute('data-accent', 'gold');
  await expect(healing.locator('[data-accent]')).toHaveAttribute('data-accent', 'green');
  expect(await healing.locator('img').evaluate(element => getComputedStyle(element).filter)).not.toBe('brightness(0) invert(1)');
  await context.addCookies([{name: 'tof_locale', value: 'ru', url: 'http://localhost:3000'}]);
  await page.reload({waitUntil: 'domcontentloaded'});
  await page.getByRole('table').first().locator('tbody [tabindex="0"]').first().focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.setViewportSize({width: 390, height: 844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('direct section links and hash navigation keep the expected section', async ({ page }) => {
  await page.goto('/datamine/handbook/#servers');
  await expect(page.getByRole('tab', { name: 'Servers', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('table', { name: 'Stat ranges', exact: true })).toHaveCount(0);
  await page.evaluate(() => { window.location.hash = 'random-stats/chances'; });
  await expect(page.getByRole('table', { name: 'Stat chances', exact: true })).toBeVisible();
  await page.evaluate(() => { window.location.hash = 'invalid-section'; });
  await expect(page.getByRole('table', { name: 'Stat ranges', exact: true })).toBeVisible();
});
