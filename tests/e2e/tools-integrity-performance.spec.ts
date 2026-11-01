import { test, expect } from '@playwright/test';
import { constants, createHash, generateKeyPairSync, sign } from 'node:crypto';
import { BuildCaptureSchema, canonicalJson } from '../../packages/contracts/src';
import fixture from '../../packages/contracts/src/__fixtures__/build-capture.json';

test('Build ignores DevTools HTML edits on repeated offline PNG export', async ({ page, context }) => {
  test.setTimeout(90_000);
  const data = BuildCaptureSchema.parse(fixture);
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const digest = createHash('sha256').update(canonicalJson(data)).digest('hex');
  const signature = sign('sha256', Buffer.from(`tof-hub-build-capture:1:${digest}`), {
    key: keys.privateKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32,
  }).toString('base64url');
  await page.route('**/api/v1/build/import/public-key', route => route.fulfill({ json: {
    ready: true, public_key_pem: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  } }));
  await page.route('**/api/v1/build/import', route => route.fulfill({ json: {
    id: '319d693a-2d99-40c1-8a21-2ad943962142', seq: 1, kind: 'build-import', state: 'complete',
    result: { data, source: { kind: 'file', digest, signature } },
  } }));
  await page.route('**/api/v1/build/import/ranking', route => route.fulfill({ json: { available: false } }));
  await page.goto('/tools/build/');
  await page.getByLabel('Build capture file').setInputFiles({ name: 'fixture.tofbuild', mimeType: 'application/octet-stream',
    buffer: Buffer.from('{"format":"tof-hub-build-sealed","version":1}') });
  const preview = page.locator('article.card').first();
  await expect(preview.locator('[data-build-edit="profile:name"]')).toHaveText(data.profile.name!);
  await page.evaluate(() => {
    const target = window as typeof window & { exportedCards: Array<{ name: string | null; badge: string | null }> };
    target.exportedCards = [];
    target.htmlToImage = { toPng: async node => {
      target.exportedCards.push({ name: node.querySelector('[data-build-edit="profile:name"]')?.textContent
        ?? node.querySelector('.player')?.textContent ?? null,
      badge: node.querySelector('[data-export-active]')?.getAttribute('data-export-provenance') ?? null });
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9lVl8AAAAASUVORK5CYII=';
    } };
  });
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { exportedCards: unknown[] }).exportedCards.length)).toBe(1);
  await context.setOffline(true);
  await preview.locator('[data-build-edit="profile:name"]').evaluate(node => { node.textContent = 'FORGED IN DEVTOOLS'; });
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { exportedCards: unknown[] }).exportedCards.length)).toBe(2);
  const exports = await page.evaluate(() => (window as unknown as { exportedCards: Array<{ name: string; badge: string }> }).exportedCards);
  expect(exports.map(card => card.badge)).toEqual(['verified', 'verified']);
  expect(exports.every(card => card.name === data.profile.name)).toBe(true);
  await expect(preview).toContainText('FORGED IN DEVTOOLS');
});

test('Ranking keeps Titan motion visible and pauses offscreen frames without idle polling', async ({ page }) => {
  let calls = 0;
  const gear = { id: 'piece', slot: 'helmet', itemId: 'helmet', enhancement: 60, stars: 5, titan: true, augmented: true,
    rareId: null, rareLevel: null, stats: [{ type: 'Physical Attack', value: 999999 }], statsBeforeTitan: [1000],
    augments: [], lastSeenAt: '2026-10-18T00:00:00Z', source: 'self' };
  await page.route('**/api/v1/ranking/players?**', route => {
    calls++;
    return route.fulfill({ json: { available: true, total: 100, overall: 100,
      entries: Array.from({ length: 100 }, (_, index) => ({ rank: index + 1, score: 95, maxScore: 100, track: 'Physical',
        player: { uid: String(1302100000 + index), nickname: `Player ${index}`, region: 'EU', serverId: '13021' },
        gear: [{ ...gear, id: `piece-${index}` }] })) } });
  });
  await page.goto('/tools/ranking/?track=Physical');
  await expect(page.getByText('Player 0', { exact: true })).toBeVisible();
  await page.getByText('Player 0', { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  const before = calls;
  await page.waitForTimeout(2000);
  expect(calls).toBe(before);
  await expect.poll(() => page.locator('[data-titan-visible]').count()).toBeGreaterThan(0);
  const animation = await page.evaluate(() => {
    const frames = document.getAnimations().filter(animation => 'animationName' in animation && String(animation.animationName).includes('titanRun'));
    return { all: frames.length, running: frames.filter(frame => frame.playState === 'running').length };
  });
  expect(animation.running).toBeGreaterThan(0);
  expect(animation.running).toBeLessThan(animation.all);
});
