import { test, expect } from '@playwright/test';

test('OoW enemy resistance icons match Build textures and colors', async ({ page }) => {
  await page.goto('/tools/build/');
  const buildIcons = page.locator('.resistance-total img[data-resistance-element]');
  await expect(buildIcons).toHaveCount(5);
  const reference = await buildIcons.evaluateAll(images => Object.fromEntries(images.map(image => [
    image.getAttribute('data-resistance-element'),
    { src: (image as HTMLImageElement).src, filter: getComputedStyle(image).filter },
  ])));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/datamine/oow/?s=23&floor=28#mob=s23_f28_w1_2');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const icons = dialog.locator('img.resistance-icon');
    await expect(icons).toHaveCount(5);
    for (const [element, expected] of Object.entries(reference)) {
      const icon = dialog.locator(`img.resistance-icon[data-resistance-element="${element}"]`);
      await expect(icon).toHaveAttribute('src', new URL(expected.src).pathname);
      await expect.poll(() => icon.evaluate(image => getComputedStyle(image).filter)).toBe(expected.filter);
      await expect.poll(() => icon.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    await page.screenshot({ path: `ignore/documentation-media/generated/oow-resistance-icons-${width}.png` });
  }
});

for (const locale of ['en', 'ru']) {
  test(`S23 difficulty uses daily ramps and stops at season end (${locale})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'tof_locale', value: locale, url: baseURL! }]);
    await page.setViewportSize({ width: locale === 'ru' ? 390 : 1440, height: 900 });
    await page.goto('/datamine/oow/?s=23&tab=difficulty');
    const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: /^F28 ·/ }) });
    await expect(panel).toBeVisible();
    for (const percentage of [1800, 1600, 1400, 1200, 300, 200]) {
      await expect(panel.getByText(`${percentage}%`, { exact: true })).toBeVisible();
    }
    await expect(panel).toContainText('12.10.2026');
    await expect(panel).toContainText('11.11.2026');
    await expect(panel).not.toContainText('10.12.2026');
    const response = await page.request.get('/game-data/' + locale + '/oow/seasons/s23.json');
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.floors[27].difficultySchedule.rowName).toBe('1_25');
    expect(data.floors[27].difficultySchedule.steps.at(-1).endDay).toBe(61);
    expect(data.floors[22].difficultySchedule.steps).toEqual(data.floors[25].difficultySchedule.steps);
  });
}
