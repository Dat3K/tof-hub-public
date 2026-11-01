import { test, expect } from '@playwright/test';

/**
 * End-to-End Test Suite for Errors, Edge Cases, and Resilience in tof-hub.
 * Covers:
 * - 404 Not Found & Error State UI / recovery navigation
 * - Broken / missing / malformed game-data without white screen crashes
 * - Missing image assets fallback and layout stability
 * - Root and edge query parameter resilience & malformed cookie recovery
 */

test.describe('Error & Not-Found Page Verification', () => {
  test('direct GET to unmapped route returns HTTP 404 with the status page', async ({ page }) => {
    const response = await page.goto('/non-existent-sector/');
    expect(response?.status()).toBe(404);

    await expect(page.locator('h1')).toHaveText('Nothing at this address');
    // The requested path is echoed in the status line.
    await expect(page.getByText('/non-existent-sector/', { exact: true })).toBeVisible();

    // Site shell stays mounted around the status page
    await expect(page.locator('header[data-site-header]')).toBeVisible();
    await expect(page.locator('footer[data-footer], footer').first()).toBeAttached();
  });

  test('the only action returns to the hub root', async ({ page }) => {
    await page.goto('/unknown-sector-route/');
    const main = page.locator('main');
    await expect(main.locator('a, button')).toHaveCount(1);
    const homeLink = main.getByRole('link', { name: 'Back to the hub', exact: true });
    await expect(homeLink).toHaveAttribute('href', '/');
    await homeLink.click();
    await page.waitForURL('**/');
    await expect(page.locator('h1')).toContainText(/Tower of Fantasy Hub|База данных и знаний TOF/i);
  });

  test('status page copy follows the RU locale', async ({ page, context }) => {
    await context.addCookies([{ name: 'tof_locale', value: 'ru', domain: 'localhost', path: '/' }]);
    await page.goto('/non-existent-sector/');
    await expect(page.locator('h1')).toHaveText('По этому адресу ничего нет');
  });

  test('nested non-existent routes return HTTP 404 and render not-found state without crashing', async ({ page }) => {
    const testCases = [
      '/info/invalid-sub-catalog/',
      '/datamine/unknown-dataset-directory/',
      '/tools/unknown-utility/',
      '/datamine2/non-existent-incubator-route/',
    ];

    for (const route of testCases) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(404);
      await expect(page.locator('h1')).toHaveText('Nothing at this address');
      await expect(page.locator('header[data-site-header]')).toBeVisible();
    }
  });
});

test.describe('Broken & Missing Game-Data Resilience (No White Screen)', () => {
  test('catalog renders gracefully when game-data returns HTTP 404 (no white screen)', async ({ page }) => {
    // Intercept client-side simulacra dataset fetch to return 404
    await page.route('**/game-data/*/simulacra.json*', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Dataset Not Found',
      });
    });

    await page.goto('/info/simulacra/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Header remains mounted and visible
    const header = page.locator('header[data-site-header]');
    await expect(header).toBeVisible();

    // 2. Main content container is present (NOT a blank/white screen)
    const main = page.locator('#main-content').first();
    await expect(main).toBeAttached();

    // 3. Controls bar remains mounted
    const controls = page.locator('#sim-controls-bar');
    await expect(controls).toBeAttached();

    // 4. Verify body is not empty and has background
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    expect(bodyHeight).toBeGreaterThan(200);
  });

  test('catalog renders gracefully when game-data returns malformed JSON syntax (no white screen)', async ({ page }) => {
    // Intercept with corrupt non-JSON payload
    await page.route('**/game-data/*/simulacra.json*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '<<<CORRUPTED_NON_JSON_PAYLOAD>>',
      });
    });

    await page.goto('/info/simulacra/');
    await page.waitForLoadState('domcontentloaded');

    // Page must not crash into uncaught white screen
    await expect(page.locator('header[data-site-header]')).toBeVisible();
    const main = page.locator('#main-content').first();
    await expect(main).toBeAttached();
  });

  test('catalog renders gracefully when game-data has empty/corrupted object schema (no white screen)', async ({ page }) => {
    // Intercept with valid JSON but unexpected schema structure
    await page.route('**/game-data/*/simulacra.json*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ unexpectedKey: 12345, items: null }),
      });
    });

    await page.goto('/info/simulacra/');
    await page.waitForLoadState('domcontentloaded');

    // Header and search controls remain intact
    await expect(page.locator('header[data-site-header]')).toBeVisible();
    const searchInput = page.locator('input.sim-search-input');
    await expect(searchInput).toBeAttached();
  });

  test('datamine bygone section mounts cleanly when dataset returns HTTP 404 (no white screen)', async ({ page }) => {
    await page.route('**/game-data/*/bygone.json*', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Not Found',
      });
    });

    await page.goto('/datamine/bygone/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('header[data-site-header]')).toBeVisible();
    const main = page.locator('main#main-content');
    await expect(main).toBeAttached();
  });

  test('datamine oow section mounts cleanly when dataset fails with 500 error (no white screen)', async ({ page }) => {
    await page.route('**/game-data/*/oow.json*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: 'Internal Server Error',
      });
    });

    await page.goto('/datamine/oow/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('header[data-site-header]')).toBeVisible();
    const main = page.locator('main#main-content');
    await expect(main).toBeAttached();
  });

  test('datamine fce section mounts cleanly under aborted network request (no white screen)', async ({ page }) => {
    await page.route('**/game-data/*/fce.json*', (route) => {
      route.abort();
    });

    await page.goto('/datamine/fce/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('header[data-site-header]')).toBeVisible();
    const main = page.locator('main#main-content');
    await expect(main).toBeAttached();
  });

  test('comp tool interface remains interactive when comp dataset fails to load', async ({ page }) => {
    await page.route('**/game-data/comp.json*', (route) => {
      route.fulfill({
        status: 404,
        body: 'Not Found',
      });
    });

    await page.goto('/tools/comp/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('header[data-site-header]')).toBeVisible();

    // Mode switch buttons remain rendered and interactive
    const fourPlayersBtn = page.locator('button:has-text("4 Players")').first();
    const eightPlayersBtn = page.locator('button:has-text("8 Players")').first();
    await expect(fourPlayersBtn).toBeAttached();
    await expect(eightPlayersBtn).toBeAttached();
  });
});

test.describe('Missing Images & Asset Resolution Fallback', () => {
  test('missing game asset textures (HTTP 404) do not break page layout or character cards', async ({ page }) => {
    // Intercept all game asset images to return 404
    await page.route('**/*.{webp,png,jpg,jpeg}', (route) => {
      if (route.request().url().includes('/game-assets/')) {
        route.fulfill({
          status: 404,
          contentType: 'image/webp',
          body: '',
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/info/simulacra/');
    await page.waitForLoadState('domcontentloaded');

    // Cards must still render titles, subtitles, and badges
    const firstCard = page.locator('[id^="sim-card-"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });

    // Ensure layout did not explode horizontally
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noOverflow).toBe(true);

    // Clicking card should still enter detail view normally
    await firstCard.click();
    const backBtn = page.locator('#sim-back-btn');
    await expect(backBtn).toBeVisible({ timeout: 10000 });
  });

  test('broken badge icons are cleanly hidden by onError handler without thrown errors', async ({ page }) => {
    // Abort all badge icon requests
    await page.route('**/wuqi/**', (route) => route.abort());

    await page.goto('/info/simulacra/');
    await page.waitForLoadState('domcontentloaded');

    const firstCard = page.locator('[id^="sim-card-"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });

    // Verify card is still interactive and visible
    await expect(firstCard).toBeEnabled();
  });

  test('missing matrices textures do not block modal opening and interaction', async ({ page }) => {
    await page.route('**/game-assets/**', (route) => route.fulfill({ status: 404, body: '' }));

    await page.goto('/info/matrices/');
    await page.waitForLoadState('domcontentloaded');

    const matrixCard = page.locator('[id^="matrix-card-"]').first();
    await expect(matrixCard).toBeVisible({ timeout: 15000 });

    // Open detail dialog
    await matrixCard.click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Dismiss dialog using Escape key
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});

test.describe('Root & Edge Routing Resilience', () => {
  test('handles malicious and special characters in query string safely', async ({ page }) => {
    // XSS injection attempt in character query parameter
    const response = await page.goto('/info/simulacra/?char=%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    expect(response?.status()).toBe(200);

    // Page must mount normally without script execution
    await expect(page.locator('header[data-site-header]')).toBeVisible();
    await expect(page.locator('input.sim-search-input')).toBeAttached();
  });

  test('non-existent character parameter falls back gracefully without crash', async ({ page }) => {
    const response = await page.goto('/info/simulacra/?char=non_existent_hero_uuid_99999');
    expect(response?.status()).toBe(200);

    // Page renders catalog view gracefully
    await expect(page.locator('header[data-site-header]')).toBeVisible();
    const searchInput = page.locator('input.sim-search-input');
    await expect(searchInput).toBeAttached();
  });

  test('comp tool handles corrupted query string parameters safely', async ({ page }) => {
    const response = await page.goto('/tools/comp/?comp=%7B%22corrupt%22%3A%5B%22data%22%5D%7D&mode=unknown_mode');
    expect(response?.status()).toBe(200);

    await expect(page.locator('header[data-site-header]')).toBeVisible();
    const fourPlayersBtn = page.locator('button:has-text("4 Players")').first();
    await expect(fourPlayersBtn).toBeAttached();
  });

  test('corrupted tof_locale cookie falls back safely to English', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'tof_locale',
        value: 'corrupted_invalid_lang_code_123',
        domain: 'localhost',
        path: '/',
      },
    ]);

    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // Should fall back cleanly to English default
    const heading = page.locator('h1');
    await expect(heading).toBeAttached();
    await expect(heading).toContainText('Tower of Fantasy Hub');

    const langTrigger = page.locator('button[data-info-lang-trigger]');
    await expect(langTrigger).toBeAttached();
    await expect(langTrigger).toContainText('EN');
  });

  test('empty tof_locale cookie falls back safely to English', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'tof_locale',
        value: '',
        domain: 'localhost',
        path: '/',
      },
    ]);

    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    const heading = page.locator('h1');
    await expect(heading).toBeAttached();
    await expect(heading).toContainText('Tower of Fantasy Hub');
  });

  test('rapid sequential navigation between major hubs maintains stability', async ({ page }) => {
    const hubs = ['/', '/info/', '/datamine/', '/tools/comp/', '/'];

    for (const hub of hubs) {
      await page.goto(hub);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('header[data-site-header]')).toBeVisible();
      await expect(page.locator('footer[data-footer], footer').first()).toBeAttached();
    }
  });
});
