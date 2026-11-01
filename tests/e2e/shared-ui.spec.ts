import { test, expect } from "@playwright/test";
import fs from 'node:fs';

test('OoW enemy cards open their detailed stats from the keyboard', async ({page}) => {
  await page.goto('/datamine/oow/?s=23&floor=22');
  const card = page.locator('#oow-floor-23-22 [data-enemy-kind][role="button"]').first();
  await expect(card).toBeVisible({timeout: 45000});
  await card.screenshot({path: 'ignore/documentation-media/generated/oow-shared-enemy-card.png', animations: 'disabled'});
  await card.focus();
  await card.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').locator('img.resistance-icon')).toHaveCount(5);
  await page.screenshot({path: 'ignore/documentation-media/generated/oow-shared-enemy-dialog.png', animations: 'disabled'});
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const locale of ['en', 'ru'] as const) for (const hasOriginal of [false, true]) {
  test(`OoW ${locale}: ${hasOriginal ? 'verified PNG downloads' : 'WebP without a PNG original'} in the enemy lightbox`, async ({ page, context, baseURL }) => {
    const pngUrl = '/game-assets/png/Hotta/Content/Resources/UI/void/boss/mon_hum_049.png';
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
    // Synthetic 2x2 WebP: this format test must not depend on installed game artwork.
    const webp = Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvAUAAAAdQxM6Uuf+BiOh/AAA=', 'base64');
    await context.addCookies([{ name: 'tof_locale', value: locale, url: baseURL! }]);
    await page.setViewportSize({ width: locale === 'ru' ? 390 : 1280, height: 900 });
    await page.route('**/game-data/*/oow/seasons/mmo_s04.json', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      const enemy = data.floors.find((floor: { floor: number }) => floor.floor === 9).enemies
        .find((entry: { codeName: string }) => entry.codeName === '049_Balance');
      enemy.imagePng = hasOriginal ? pngUrl : null;
      enemy.detailImagePng = hasOriginal ? pngUrl : null;
      await route.fulfill({ response, json: data });
    });
    await page.route(`**${pngUrl}`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: png }));
    await page.route(/\/(?:game-assets\/webp|datamine\/shared\/media)\/Hotta\/Content\/Resources\/UI\/void\/boss\/mon_hum_049\.webp$/,
      (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: webp }));
    await page.goto('/datamine/oow/?mode=mmo&s=4&floor=9&mob=S2_F9_W1_elite');
    const portrait = page.locator('[aria-labelledby="oow-boss-dialog-title"] img[role="button"]');
    await expect(portrait).toBeVisible({ timeout: 45000 });
    await portrait.focus();
    await portrait.press('Enter');
    const lightbox = page.locator('.sim-lightbox');
    await expect(lightbox).toBeVisible();
    await expect.poll(() => lightbox.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    const downloadPng = lightbox.getByRole('button', { name: locale==='ru'?'Скачать PNG':'Download PNG', exact: true });
    if (hasOriginal) {
      await expect(downloadPng).toBeVisible();
      const [download] = await Promise.all([page.waitForEvent('download'), downloadPng.click()]);
      expect(download.suggestedFilename()).toMatch(/\.png$/);
      expect(fs.readFileSync((await download.path())!)).toEqual(png);
    } else {
      await expect(downloadPng).toHaveCount(0);
    }
    await expect(lightbox.getByRole('button', { name: locale==='ru'?'Скачать WebP':'Download WebP', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(lightbox).toHaveCount(0);
  });
}

for (const reducedMotion of ['no-preference','reduce'] as const) test(`OoW first floor opening animates from zero height and closing retains the panel (${reducedMotion})`, async ({page}) => {
  await page.emulateMedia({reducedMotion});
  await page.goto('/datamine/oow/?s=23');
  const trigger=page.locator('[aria-controls="oow-floor-23-22"]');
  await expect(trigger).toBeVisible({timeout:45000});
  await trigger.scrollIntoViewIfNeeded();
  await page.evaluate(()=>{
    const samples:number[]=[];
    (window as unknown as {oowHeights:number[]}).oowHeights=samples;
    const end=performance.now()+1500;
    const sample=()=>{
      const panel=document.getElementById('oow-floor-23-22');
      if(panel)samples.push(panel.getBoundingClientRect().height);
      if(performance.now()<end)requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await trigger.click();
  const panel=page.locator('#oow-floor-23-22');
  await expect(panel).toHaveAttribute('data-open','');
  await expect.poll(async()=>page.evaluate(()=>{
    const heights=(window as unknown as {oowHeights:number[]}).oowHeights;
    const maximum=Math.max(...heights);
    return maximum>0&&heights.some(height=>height===0)&&heights.some(height=>height>0&&height<maximum-1);
  })).toBe(true);
  await expect(page).toHaveURL(/floor=22/);
  await trigger.click();
  await expect(panel).toHaveAttribute('inert','');
  await expect.poll(()=>panel.evaluate(el=>el.getBoundingClientRect().height)).toBe(0);
  await expect(page).not.toHaveURL(/floor=22/);
});

for (const section of ["matrices", "relics", "pets", "food", "cosmetics", "arts"]) {
  test(`${section}: shared mobile controls stay inside viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/info/${section}/`);
    const search = page.locator(".info-ui .sim-search-input");
    await expect(search).toBeVisible();
    await expect(page.locator(".info-ui .sim-sort-trigger")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await search.fill("no-result-qzx987");
    await expect(search).toHaveValue("no-result-qzx987");
    await search.fill("");
  });
}

test("matrix ranks, shared preview, Escape and restored dialog", async ({ page }) => {
  await page.goto("/info/matrices/");
  await page.locator('[id^="matrix-card-"]').first().click();
  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  const rank = page.getByRole("tab", { name: "★0", exact: true });
  await rank.click();
  await expect(rank).toHaveAttribute("aria-selected", "true");
  await detail.getByRole("button", { name: /Click to zoom and download/ }).click();
  await expect(page.locator(".sim-lightbox")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".sim-lightbox")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toBeVisible();
});
