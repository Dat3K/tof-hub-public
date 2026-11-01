import { test, expect } from '@playwright/test';
import { constants, createCipheriv, publicEncrypt, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

test('imports a sealed Capture file through the page and keeps repeat imports idempotent', async ({ page, request }) => {
  const keyResponse = await request.get('/api/v1/wish/import/public-key');
  expect(keyResponse.ok()).toBe(true);
  const key = await keyResponse.json();
  expect(key.ready).toBe(true);
  const catalog = JSON.parse(await readFile('apps/web/public/game-data/build-page.json', 'utf8'));
  const avatar = catalog.avatars.find((item: {icon:string}) => item.icon);
  const frame = catalog.avatarFrames.find((item: {icon:string}) => item.icon);
  const payload = {
    version: 2,
    export_metadata: { exported_at: '2026-09-29T00:00:00.000Z', exporter_name: 'tof-live-capture', exporter_version: '0.1.0' },
    account: { uid: '1300299999999', avatar_id:avatar.id, avatar_frame_id:frame.id, region: 'unknown', server_id: null, nickname: null, timezone: 'UTC' },
    batches: [
      { batch_id: 'batch_weapon', banner_id: 'WeaponLottery_2', raw_banner_code: 'WeaponLottery_2', banner_type: 'standard_weapon',
        group_ticks: '638947000000000000', timestamp: '2026-09-29T00:00:00.000Z',
        pulls: [{ index_in_batch: 0, item_id: 'digger_thunder', rarity: null, is_featured: null }] },
      { batch_id: 'batch_matrix', banner_id: 'ArtifactLottery_1', raw_banner_code: 'ArtifactLottery_1', banner_type: 'weapon_limited',
        group_ticks: '638947000000000001', timestamp: '2026-09-29T00:00:00.000Z',
        pulls: [{ index_in_batch: 0, item_id: 'Matrix_SSR37_1', rarity: null, is_featured: null }] },
      { batch_id: 'batch_event_anchor', banner_id: 'weapon-zoey', raw_banner_code: 'WeaponLottery_ZY_1', banner_type: 'weapon_limited',
        group_ticks: '638947000000000002', timestamp: '2026-09-29T00:00:00.000Z',
        pulls: [{ index_in_batch: 0, item_id: 'Zoey_Phy', rarity: null, is_featured: null, track_pull_number: 23 }] },
    ],
  };
  const aesKey = randomBytes(32), nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey, nonce);
  cipher.setAAD(Buffer.from(`tof-hub-wish-sealed:1:${key.key_id}`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  const buffer = process.env.WISH_IMPORT_TEST_FILE
    ? await readFile(process.env.WISH_IMPORT_TEST_FILE)
    : Buffer.from(JSON.stringify({
      format: 'tof-hub-wish-sealed', version: 1, key_id: key.key_id,
      wrapped_key: publicEncrypt({ key: key.public_key_pem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, aesKey).toString('base64url'),
      nonce: nonce.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'),
    }));
  const readiness = page.waitForResponse((response) => response.url().includes('/wish/import/public-key') && response.request().method() === 'GET' && response.status() !== 308);
  await page.goto('/tools/wish/import/');
  const readyResponse = await readiness;
  expect(readyResponse.ok(), `Readiness response: ${readyResponse.status()}`).toBe(true);
  await page.locator('input[type=file]').setInputFiles({ name: 'wish-history.tofwish', mimeType: 'application/json', buffer });
  if (process.env.WISH_IMPORT_WEAPON_PITY) await page.getByTestId('wish-pity-0').fill(process.env.WISH_IMPORT_WEAPON_PITY);
  if (process.env.WISH_IMPORT_MATRIX_PITY) await page.getByTestId('wish-pity-1').fill(process.env.WISH_IMPORT_MATRIX_PITY);
  const submit = page.getByRole('button', { name: /Start import|Начать импорт/ });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText(/Import complete|Импорт завершён/, { exact: true })).toBeVisible({ timeout: 30000 });
  const profileLink = page.getByRole('link', { name: /Open profile history|Открыть историю профиля/ });
  const href = await profileLink.getAttribute('href');
  const profileId = new URL(href!, 'http://localhost').searchParams.get('profileId');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tof-wish-imported-profile-ids') ?? '[]'))).toContain(profileId);
  await submit.click();
  await expect(page.getByText(/0 new records|0 новых записей/)).toBeVisible({ timeout: 30000 });
  await expect(profileLink).toHaveAttribute('href', href!);
  await profileLink.click();
  await expect(page).toHaveURL(/profileId=import-.*tab=history/);
  await expect(page.locator('main')).toContainText(/UID/);
  await page.reload();
  await expect(page.locator('main')).toContainText(/UID/);
  if (!process.env.WISH_IMPORT_TEST_FILE) {
    await expect(page.locator(`img.avatar[src="${avatar.icon}"]`)).toBeVisible();
    await expect(page.locator(`img.avatar-frame[src="${frame.icon}"]`)).toBeVisible();
    await expect(page.locator('main')).not.toContainText('13002 (Global)');
    await expect(page.getByRole('note').filter({ hasText: /Missing: 22 pulls|Пропуск: 22 круток/ })).toBeVisible();
    await expect(page.locator('main')).not.toContainText('50.00x');
    await page.screenshot({ path: 'ignore/documentation-media/generated/wish-anchored-desktop.png', fullPage: true });
    await page.setViewportSize({width: 390, height: 844});
    await expect(page.getByRole('note').filter({ hasText: /Missing: 22 pulls|Пропуск: 22 круток/ })).toBeVisible();
    await page.screenshot({ path: 'ignore/documentation-media/generated/wish-anchored-mobile.png', fullPage: true });
  } else if (process.env.WISH_IMPORT_WEAPON_PITY) {
    await expect(page.getByRole('note').filter({ hasText: /Missing: 18 pulls|Пропуск: 18 круток/ })).toBeVisible();
    await expect(page.getByRole('note').filter({ hasText: /Missing: 30 pulls|Пропуск: 30 круток/ })).toBeVisible();
    await expect(page.locator('main')).toContainText(/1300506653/);
    await page.screenshot({ path: 'ignore/documentation-media/generated/wish-current-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'ignore/documentation-media/generated/wish-current-mobile.png', fullPage: true });
  } else {
    await expect(page.getByRole('note').filter({ hasText: /Partial history:|Неполная история:/ })).toBeVisible();
    await expect(page.locator('main')).not.toContainText('-1/');
  }
});
