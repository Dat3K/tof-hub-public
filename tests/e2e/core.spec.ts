import { test, expect } from '@playwright/test';

/**
 * End-to-End Core Test Suite for tof-hub against prod-like :8080.
 * Covers:
 * - deploy/README.md & deploy/nginx/default.conf (reverse proxy, cache policies, health endpoints)
 */

test.describe('Root Main Hub & Navigation', () => {
  test('direct GET / returns 200 OK with SSR metadata and accessible landmark heading', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // Verify accessible landmark heading
    const heading = page.locator('h1');
    await expect(heading).toBeAttached();
    await expect(heading).toContainText(/Tower of Fantasy Hub|База данных и знаний TOF/i);

    // Verify page title
    await expect(page).toHaveTitle(/Tower of Fantasy Hub/i);
  });

  test('renders 3 primary entrypoint cards (Info, Datamine, Tools) with interactive navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify semantic navigation cards
    const infoCard = page.getByRole('main').locator('h2 a[href="/info/"]');
    const datamineCard = page.getByRole('main').locator('h2 a[href="/datamine/"]');
    const toolsCard = page.getByRole('main').locator('h2 a[href="/tools/"]');

    await expect(infoCard).toBeAttached();
    await expect(datamineCard).toBeAttached();
    await expect(toolsCard).toBeAttached();

    // Verify keyboard navigation & click: Info Hub
    await infoCard.click();
    await page.waitForURL('**/info/');
    expect(page.url()).toContain('/info/');

    // Return to main hub and navigate to Datamine
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('main').locator('h2 a[href="/datamine/"]').click();
    await page.waitForURL('**/datamine/');
    expect(page.url()).toContain('/datamine/');

    // Return to main hub and navigate to the Tools hub
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('main').locator('h2 a[href="/tools/"]').click();
    await page.waitForURL('**/tools/');
    expect(page.url()).toContain('/tools/');
  });
});

test.describe('Unified Site Shell & Responsive Viewports', () => {
  test('header renders brand, main navigation links, language trigger, and version status', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const header = page.locator('header[data-site-header]');
    await expect(header).toBeVisible();

    // Brand home link
    const brandLink = header.locator('a[href="/"]').first();
    await expect(brandLink).toBeAttached();

    // Main section nav links
    await expect(header.locator('a[href="/info/"]').first()).toBeAttached();
    await expect(header.locator('a[href="/datamine/"]').first()).toBeAttached();
    await expect(header.locator('a[href="/tools/"]').first()).toBeAttached();

    // Language selector trigger
    const langTrigger = header.locator('button[data-info-lang-trigger]');
    await expect(langTrigger).toBeAttached();

    // Version status export info component
    const versionComponent = header.locator('[data-datamine-export-info="true"], [data-version-status-state]').first();
    await expect(versionComponent).toBeAttached();
  });

  test('footer renders the editorial links and project story, external GitHub link, and contextual info changelog', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const footer = page.locator('footer[data-footer], footer').first();
    await expect(footer).toBeAttached();

    // Core promoted root editorial pages present in shared footer navigation
    const expectedEditorial = [
      '/about/',
      '/story/',
      '/changelog/',
      '/contribute/',
      '/privacy/',
      '/projects/',
    ];

    for (const href of expectedEditorial) {
      const link = footer.locator(`a[href="${href}"]`).first();
      await expect(link).toBeAttached();
    }

    // External GitHub link
    const githubLink = footer.locator('a[href="https://github.com/smilekritik/tof-hub-public"]').first();
    await expect(githubLink).toBeAttached();
    await expect(githubLink).toHaveAccessibleName(/GitHub/);
    await expect(githubLink).toHaveAttribute('target', '_blank');
    await expect(githubLink).toHaveAttribute('rel', /noopener noreferrer/);

    // On root page, contextual /info/simulacra/changelog/ link should NOT be present in footer
    const infoChangelogOnRoot = footer.locator('a[href="/info/simulacra/changelog/"]');
    await expect(infoChangelogOnRoot).toHaveCount(0);

    // On /info/ page, contextual link should be attached
    await page.goto('/info/');
    await page.waitForLoadState('domcontentloaded');
    const infoFooter = page.locator('footer[data-footer], footer').first();
    const infoChangelogLink = infoFooter.locator('a[href="/info/simulacra/changelog/"]').first();
    await expect(infoChangelogLink).toBeAttached();
  });

  test('responsive viewport checks on desktop and mobile without horizontal overflow', async ({ page }) => {
    // Desktop Viewport (1280x720)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(desktopOverflow).toBe(true);

    // Mobile Viewport (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const mobileScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(mobileScrollWidth).toBeLessThanOrEqual(395);
  });
});

test.describe('Locale Persistence & Language Switching', () => {
  test('switches language between EN and RU with tof_locale cookie persistence across reload and navigation', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const langTrigger = page.locator('button[data-info-lang-trigger]');
    await expect(langTrigger).toBeAttached();
    await expect(langTrigger).toContainText('EN');

    // Switch to Russian
    await langTrigger.click();
    const ruOption = page.locator('button[data-info-lang="ru"]');
    await expect(ruOption).toBeVisible();
    await ruOption.click();

    // Verify UI updates to Russian
    await expect(langTrigger).toContainText('RU');
    await expect(page.locator('h1')).toContainText(/База данных и знаний TOF/);

    // Verify tof_locale cookie is set to 'ru'
    const cookiesAfterRu = await context.cookies();
    const ruCookie = cookiesAfterRu.find((c) => c.name === 'tof_locale');
    expect(ruCookie).toBeDefined();
    expect(ruCookie?.value).toBe('ru');

    // Persistence on reload
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('button[data-info-lang-trigger]')).toContainText('RU');
    await expect(page.locator('h1')).toContainText(/База данных и знаний TOF/);

    // Persistence across navigation to /datamine/
    await page.goto('/datamine/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('button[data-info-lang-trigger]')).toContainText('RU');
    await expect(page.locator('h1')).toContainText(/Архив Tower of Fantasy/);

    // Switch back to English
    const ruTrigger = page.locator('button[data-info-lang-trigger]');
    await ruTrigger.click();
    const enOption = page.locator('button[data-info-lang="en"]');
    await expect(enOption).toBeVisible();
    await enOption.click();

    // Verify English restored
    await expect(page.locator('button[data-info-lang-trigger]')).toContainText('EN');
    const cookiesAfterEn = await context.cookies();
    const enCookie = cookiesAfterEn.find((c) => c.name === 'tof_locale');
    expect(enCookie?.value).toBe('en');
  });

  test('server SSR directly respects tof_locale cookie in initial HTML payload', async ({ request }) => {
    const resRu = await request.get('/', {
      headers: { Cookie: 'tof_locale=ru' },
    });
    expect(resRu.status()).toBe(200);
    const htmlRu = await resRu.text();
    expect(htmlRu).toContain('База данных и знаний TOF');

    const resEn = await request.get('/', {
      headers: { Cookie: 'tof_locale=en' },
    });
    expect(resEn.status()).toBe(200);
    const htmlEn = await resEn.text();
    expect(htmlEn).toContain('Tower of Fantasy Hub');
  });
});

test.describe('/info Public Scope & Catalogs', () => {
  test('renders /info/ hub with all 7 encyclopedia section cards and links', async ({ page }) => {
    const response = await page.goto('/info/');
    expect(response?.status()).toBe(200);

    const heading = page.getByRole('heading', {level: 1});
    await expect(heading).toBeAttached();
    await expect(heading).toContainText(/Tower of Fantasy encyclopedia|Энциклопедия Tower of Fantasy/i);

    const expectedSections = [
      '/info/simulacra/',
      '/info/matrices/',
      '/info/relics/',
      '/info/pets/',
      '/info/food/',
      '/info/cosmetics/',
      '/info/arts/',
    ];

    for (const route of expectedSections) {
      const link = page.locator(`a[href="${route}"]`).first();
      await expect(link).toBeAttached();
    }
  });

  test('direct navigation to all nested info catalogs returns 200 OK', async ({ page }) => {
    const catalogs = [
      { route: '/info/simulacra/', selector: 'input.sim-search-input' },
      { route: '/info/matrices/', selector: '[id^="matrix-card-"]' },
      { route: '/info/relics/', selector: '[id^="relic-card-"]' },
      { route: '/info/pets/', selector: '#main-content' },
      { route: '/info/food/', selector: '#main-content' },
      { route: '/info/cosmetics/', selector: '#main-content' },
      { route: '/info/arts/', selector: '#main-content' },
      { route: '/info/simulacra/changelog/', selector: '#main-content' },
    ];

    for (const { route, selector } of catalogs) {
      const res = await page.goto(route);
      expect(res?.status()).toBe(200);
      await page.waitForLoadState('domcontentloaded');
      const target = page.locator(selector).first();
      await expect(target).toBeAttached();
    }
  });

  test('simulacra catalog filtering by character name', async ({ page }) => {
    await page.goto('/info/simulacra/');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.locator('input.sim-search-input');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('Meryl');
    // Verify filtered card presence
    const merylCard = page.locator('text=Meryl').first();
    await expect(merylCard).toBeAttached();
  });
});

test.describe('/datamine Public Scope & Datasets', () => {
  test('renders /datamine/ hub with all 7 public dataset cards', async ({ page }) => {
    const response = await page.goto('/datamine/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle('Datamine | ToF Hub');

    const heading = page.locator('h1');
    await expect(heading).toBeAttached();

    const expectedDatasets = [
      '/datamine/oow/',
      '/datamine/fce/',
      '/datamine/bygone/',
      '/datamine/seq/',
      '/datamine/multype/',
      '/datamine/items/',
      '/datamine/handbook/',
    ];

    for (const route of expectedDatasets) {
      const link = page.locator(`a[href="${route}"]`).first();
      await expect(link).toBeAttached();
    }
  });

  test('direct navigation to all 7 datamine sections returns 200 OK', async ({ page }) => {
    const sections = [
      { route: '/datamine/oow/', titlePattern: /Origin of War/i },
      { route: '/datamine/fce/', titlePattern: /Bosses/i },
      { route: '/datamine/bygone/', titlePattern: /Bygone Phantasm/i },
      { route: '/datamine/seq/', titlePattern: /Sequential/i },
      { route: '/datamine/multype/', titlePattern: /Damage types/i },
      { route: '/datamine/items/', titlePattern: /Items/i },
      { route: '/datamine/handbook/', titlePattern: /handbook/i },
    ];

    for (const { route, titlePattern } of sections) {
      const res = await page.goto(route);
      expect(res?.status()).toBe(200);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveTitle(titlePattern);
      await expect(page.locator('#main-content, main').first()).toBeAttached();
    }
  });
});

test.describe('/tools/comp Squad & Raid Composition Builder', () => {
  test('renders /tools/comp/ with 200 OK, title, and interactive squad builder interface', async ({ page }) => {
    const response = await page.goto('/tools/comp/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Team planner/i);

    const main = page.locator('#main-content, main').first();
    await expect(main).toBeAttached();

    // Verify mode switches (4 Players vs 8 Players) and controls
    const fourPlayersBtn = page.locator('button:has-text("4 Players"), button:has-text("4 Игрока")').first();
    const eightPlayersBtn = page.locator('button:has-text("8 Players"), button:has-text("8 Игроков")').first();
    await expect(fourPlayersBtn).toBeAttached();
    await expect(eightPlayersBtn).toBeAttached();

    // Verify interactive mode toggle
    await fourPlayersBtn.click();
    await expect(fourPlayersBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Game Data Fetch & Version Status API', () => {
  test('GET /api/v1/health returns 200 OK with healthy status payload', async ({ request }) => {
    const response = await request.get('/api/v1/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('api');
  });

  test('GET /api/v1/version-status returns 200 OK with valid version payload', async ({ request }) => {
    const response = await request.get('/api/v1/version-status');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toBeDefined();
    expect(typeof body).toBe('object');
  });

  test('static game data serving with revalidation headers and no immutable flag', async ({ request }) => {
    test.skip(process.env.PLAYWRIGHT_DIRECT_APP === '1', 'Requires nginx cache policy; this run addresses Next directly.');
    const response = await request.get('/game-data/en/simulacra.json');
    expect(response.status()).toBe(200);

    const headers = response.headers();
    expect(headers['cache-control']).toContain('public');
    expect(headers['cache-control']).toContain('max-age=3600');
    expect(headers['cache-control']).not.toContain('immutable');

    const etag = headers['etag'];
    expect(etag).toBeTruthy();
    expect(headers['last-modified']).toBeTruthy();

    const data = await response.json();
    const items = Array.isArray(data) ? data : data.items;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    // Conditional revalidation with ETag yields 304 Not Modified
    const revalResponse = await request.get('/game-data/en/simulacra.json', {
      headers: { 'If-None-Match': etag },
    });
    expect(revalResponse.status()).toBe(304);
  });

  test('release manifest and changelog baseline headers', async ({ request }) => {
    test.skip(process.env.PLAYWRIGHT_DIRECT_APP === '1', 'Requires nginx cache policy; this run addresses Next directly.');
    // Release manifest
    const manifestRes = await request.get('/game-data/release-manifest.json');
    expect(manifestRes.status()).toBe(200);
    const manifest = await manifestRes.json();
    expect(manifest).toBeDefined();

    // Changelog baseline cache policy (always revalidate with no-cache, no immutable)
    const changelogRes = await request.get('/game-data/changelog/simulacra.json');
    expect(changelogRes.status()).toBe(200);
    const changelogHeaders = changelogRes.headers();
    expect(changelogHeaders['cache-control']).toContain('no-cache');
    expect(changelogHeaders['cache-control']).not.toContain('immutable');
  });
});

test.describe('Confirmed Legacy Redirect Map (Authoritative Table 4.3)', () => {
  const CONFIRMED_REDIRECTS: Array<{ source: string; target: string; desc: string }> = [
    // Catalogs (12 redirects)
    { source: '/datamine/simulacra/', target: '/info/simulacra/', desc: 'R1: /datamine/simulacra/' },
    { source: '/datamine2/simulacra/', target: '/info/simulacra/', desc: 'R2: /datamine2/simulacra/' },
    { source: '/datamine/matrices/', target: '/info/matrices/', desc: 'R3: /datamine/matrices/' },
    { source: '/datamine2/matrices/', target: '/info/matrices/', desc: 'R4: /datamine2/matrices/' },
    { source: '/datamine/relics/', target: '/info/relics/', desc: 'R5: /datamine/relics/' },
    { source: '/datamine2/relics/', target: '/info/relics/', desc: 'R6: /datamine2/relics/' },
    { source: '/datamine/pets/', target: '/info/pets/', desc: 'R7: /datamine/pets/' },
    { source: '/datamine2/pets/', target: '/info/pets/', desc: 'R8: /datamine2/pets/' },
    { source: '/datamine/cosmetics/', target: '/info/cosmetics/', desc: 'R9: /datamine/cosmetics/' },
    { source: '/datamine2/cosmetics/', target: '/info/cosmetics/', desc: 'R10: /datamine2/cosmetics/' },
    { source: '/datamine/arts/', target: '/info/arts/', desc: 'R11: /datamine/arts/' },
    { source: '/datamine2/arts/', target: '/info/arts/', desc: 'R12: /datamine2/arts/' },
    // Editorial root pages (10 redirects)
    { source: '/datamine/about/', target: '/about/', desc: 'R13: /datamine/about/' },
    { source: '/datamine2/about/', target: '/about/', desc: 'R14: /datamine2/about/' },
    { source: '/datamine/changelog/', target: '/changelog/', desc: 'R15: /datamine/changelog/' },
    { source: '/datamine2/changelog/', target: '/changelog/', desc: 'R16: /datamine2/changelog/' },
    { source: '/datamine/contribute/', target: '/contribute/', desc: 'R17: /datamine/contribute/' },
    { source: '/datamine2/contribute/', target: '/contribute/', desc: 'R18: /datamine2/contribute/' },
    { source: '/datamine/privacy/', target: '/privacy/', desc: 'R21: /datamine/privacy/' },
    { source: '/datamine2/privacy/', target: '/privacy/', desc: 'R22: /datamine2/privacy/' },
    { source: '/datamine/projects/', target: '/projects/', desc: 'R23: /datamine/projects/' },
    { source: '/datamine2/projects/', target: '/projects/', desc: 'R24: /datamine2/projects/' },
  ];

  for (const { source, target, desc } of CONFIRMED_REDIRECTS) {
    test(`redirects ${desc} to ${target} with HTTP 301`, async ({ request }) => {
      const res = await request.get(source, { maxRedirects: 0 });
      expect(res.status()).toBe(301);
      const location = res.headers()['location'];
      expect(location).toBeTruthy();
      const destination = new URL(location!, res.url());
      expect(destination.origin).toBe(new URL(res.url()).origin);
      expect(destination.pathname.replace(/\/$/, '')).toBe(target.replace(/\/$/, ''));
    });
  }

  test('preserves query strings and subpaths across confirmed redirects', async ({ request }) => {
    // Query string preservation
    const qsRes = await request.get('/datamine/simulacra/?char=nemesis&star=6', { maxRedirects: 0 });
    expect(qsRes.status()).toBe(301);
    const qsLocation = qsRes.headers()['location'];
    const destination = new URL(qsLocation!, qsRes.url());
    expect(destination.pathname.replace(/\/$/, '')).toBe('/info/simulacra');
    expect(Object.fromEntries(destination.searchParams)).toEqual({char:'nemesis', star:'6'});

    // Use the canonical trailing slash to exercise the legacy redirect itself.
    const subRes = await request.get('/datamine/simulacra/changelog/', { maxRedirects: 0 });
    expect(subRes.status()).toBe(301);
    const subLocation = subRes.headers()['location'];
    expect(subLocation).toContain('/info/simulacra/changelog');
  });

  test('strictly excludes unconfirmed redirects: /datamine/food/ yields genuine 404', async ({ request }) => {
    // food was developed in /info/food/ and NEVER existed in /datamine/ or /datamine2/
    const foodRes = await request.get('/datamine/food/', { maxRedirects: 0 });
    expect(foodRes.status()).toBe(404);

    const food2Res = await request.get('/datamine2/food/', { maxRedirects: 0 });
    expect(food2Res.status()).toBe(404);
  });
});

test.describe('Tools Ranking Rename Redirect', () => {
  test('redirects /tools/tops/ to /tools/ranking/ with HTTP 301', async ({ request }) => {
    const res = await request.get('/tools/tops/', { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    const location = res.headers()['location'];
    expect(location).toBeTruthy();
    const destination = new URL(location!, res.url());
    expect(destination.origin).toBe(new URL(res.url()).origin);
    expect(destination.pathname.replace(/\/$/, '')).toBe('/tools/ranking');
  });

  test('preserves query strings across the tops to ranking redirect', async ({ request }) => {
    const res = await request.get('/tools/tops/?board=players&track=Frost', { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    const location = res.headers()['location'];
    const destination = new URL(location!, res.url());
    expect(destination.pathname.replace(/\/$/, '')).toBe('/tools/ranking');
    expect(Object.fromEntries(destination.searchParams)).toEqual({board:'players', track:'Frost'});
  });
});

test.describe('Public gameplay tools', () => {
  for (const route of ['/tools/build/', '/tools/wish/']) {
    test(`${route} is publicly accessible`, async ({request}) => {
      expect((await request.get(route)).status()).toBe(200);
    });
  }
});

test.describe('Excluded Scope Strict HTTP 404', () => {
  const EXCLUDED_PATHS = [
    '/datamine2/',
    '/datamine2/calculator/',
    '/datamine2/gear/',
    '/datamine/gear/',
    '/info/gear/',
    '/info/tools/',
    '/info/outfits/',
    '/tools/solo/',
    '/datamine-builder/',
  ];

  for (const path of EXCLUDED_PATHS) {
    test(`request to excluded route ${path} yields HTTP 404`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(404);
    });
  }
});

test.describe('SEO Metadata, Robots & Sitemap Parity', () => {
  const PUBLIC_METADATA_ROUTES = [
    { route: '/', expectedTitlePattern: /^Tower of Fantasy Hub$/, canonical: 'https://tof.smilekritik.beer/' },
    { route: '/info/', expectedTitlePattern: /Info/i, canonical: 'https://tof.smilekritik.beer/info/' },
    { route: '/datamine/', expectedTitlePattern: /Datamine/i, canonical: 'https://tof.smilekritik.beer/datamine/' },
    { route: '/tools/comp/', expectedTitlePattern: /Team planner \| ToF Hub/, canonical: 'https://tof.smilekritik.beer/tools/comp/' },
    { route: '/about/', expectedTitlePattern: /^About \| ToF Hub$/, canonical: 'https://tof.smilekritik.beer/about/' },
    { route: '/changelog/', expectedTitlePattern: /^Changelog \| ToF Hub$/, canonical: 'https://tof.smilekritik.beer/changelog/' },
    { route: '/contribute/', expectedTitlePattern: /Contribute \| ToF Hub/, canonical: 'https://tof.smilekritik.beer/contribute/' },
    { route: '/privacy/', expectedTitlePattern: /Privacy \| ToF Hub/, canonical: 'https://tof.smilekritik.beer/privacy/' },
    { route: '/projects/', expectedTitlePattern: /ToF resources \| ToF Hub/, canonical: 'https://tof.smilekritik.beer/projects/' },
  ];

  for (const { route, expectedTitlePattern, canonical } of PUBLIC_METADATA_ROUTES) {
    test(`SSR HTML for ${route} contains metadata, description, and canonical URL`, async ({ request }) => {
      const res = await request.get(route);
      expect(res.status()).toBe(200);
      const html = await res.text();

      // Title assertion
      expect(html.match(/<title>([^<]+)<\/title>/)?.[1]).toMatch(expectedTitlePattern);

      // Canonical link assertion
      expect(html).toContain(`<link rel="canonical" href="${canonical}"/>`);

      // Meta description presence
      expect(html).toMatch(/<meta name="description" content="[^"]+"/);
    });
  }

  test('/robots.txt disallows excluded paths and references canonical sitemap', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();

    expect(body).toContain('Allow: /');
    expect(body).toContain('Disallow: /datamine-builder/');
    expect(body).not.toContain('Disallow: /datamine2/');
    expect(body).toContain('Disallow: /info/tools/');
    expect(body.split(/\r?\n/)).not.toContain('Disallow: /tools/build/');
    expect(body).toContain('Disallow: /tools/solo/');
    expect(body).not.toContain('Disallow: /tools/wish/');
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Sitemap: https://tof.smilekritik.beer/sitemap.xml');
  });

  test('/sitemap.xml includes only public canonical routes and excludes incubator/dev routes', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();

    // Check canonical origin and trailing slash
    expect(xml).toContain('<loc>https://tof.smilekritik.beer/</loc>');
    expect(xml).toContain('<loc>https://tof.smilekritik.beer/info/</loc>');
    expect(xml).toContain('<loc>https://tof.smilekritik.beer/datamine/</loc>');
    expect(xml).toContain('<loc>https://tof.smilekritik.beer/about/</loc>');
    expect(xml).toContain('<loc>https://tof.smilekritik.beer/projects/</loc>');

    // Check strict exclusion of incubator / dev routes
    expect(xml).not.toContain('/datamine2');
    expect(xml).toContain('/tools/build/</loc>');
    expect(xml).not.toContain('/tools/build/profiles/');
    expect(xml).not.toContain('/tools/solo');
    expect(xml).toContain('/tools/wish/</loc>');
    expect(xml).not.toContain('/info/tools');
    expect(xml).not.toContain('/datamine-builder');
  });
});

test('header shows the selected page while navigation is still loading', async ({ page }) => {
  await page.goto('/info/arts/', { waitUntil: 'domcontentloaded' });
  const header = page.locator('[data-site-header]');
  const sectionMenu = header.locator('[data-section-switcher] > button');
  const matrices = header.getByRole('link', { name: 'Matrices', exact: true });
  const arts = page.locator('.arts-catalog-page');
  const loading = page.locator('#main-content > [role="status"]');

  await expect(async () => {
    await sectionMenu.press('ArrowDown');
    await expect(sectionMenu).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await sectionMenu.press('Escape');
  await expect(arts).toBeVisible();

  const releaseMatrices = Promise.withResolvers<void>();
  const releaseDatamine = Promise.withResolvers<void>();
  const isMatricesRequest = (url: URL) => url.pathname === '/info/matrices/' && url.searchParams.has('_rsc');
  const isDatamineRequest = (url: URL) => url.pathname === '/datamine/' && url.searchParams.has('_rsc');
  await page.route(isMatricesRequest, async (route) => {
    await releaseMatrices.promise;
    await route.continue();
  });
  await page.route(isDatamineRequest, async (route) => {
    await releaseDatamine.promise;
    await route.continue();
  });

  try {
    const matricesRequested = page.waitForRequest((request) => isMatricesRequest(new URL(request.url())));
    await matrices.press('Enter');
    await matricesRequested;
    await expect(matrices).toHaveAttribute('aria-current', 'page', { timeout: 3000 });
    await expect(loading).toHaveText('Loading matrices…');
    await expect(arts).toBeHidden();

    await sectionMenu.click();
    const datamineRequested = page.waitForRequest((request) => isDatamineRequest(new URL(request.url())));
    await header.getByRole('menuitem', { name: 'Datamine', exact: true }).click();
    await datamineRequested;
    await expect(header).toHaveAttribute('data-section', 'datamine', { timeout: 3000 });
    await expect(loading).toHaveText('Loading datamine archive…');

    releaseDatamine.resolve();
    await expect(page).toHaveURL(/\/datamine\/$/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Tower of Fantasy archive' })).toBeVisible();
    await expect(loading).toBeHidden();
  } finally {
    releaseMatrices.resolve();
    releaseDatamine.resolve();
  }

  await page.goBack();
  await expect(page).toHaveURL(/\/info\/arts\/$/);
  await expect(arts).toBeVisible();
});

test('Titan Calculator opens from the Tools hub and matches its example preview', async ({page}) => {
  test.setTimeout(90000);
  await page.goto('/tools/', {waitUntil:'domcontentloaded'});
  const preview = page.getByRole('table', {name: 'Example · Damage without Titan'});
  await expect(preview.locator('tbody tr')).toHaveCount(3);
  const previewShares = await preview.locator('tbody td').allTextContents();
  const bestPreview = page.getByText('Best · Without Weak Point', {exact: true}).locator('..');
  await expect(bestPreview).toBeVisible();
  const previewLevels = await bestPreview.locator('strong').allTextContents();
  expect(previewLevels.length).toBeGreaterThan(0);
  await page.getByRole('main').getByRole('link', {name: 'Titan Calculator', exact: true}).click();
  await expect(page).toHaveURL(/\/tools\/titan\/$/);
  const finalLink = page.locator('[data-site-header]').getByRole('navigation', {name: 'Catalog sections'}).getByRole('link').last();
  await expect(finalLink).toHaveText('Titan Calculator');
  await expect(finalLink).toHaveAttribute('aria-current', 'page');
  await expect(page).toHaveTitle('Titan Calculator | ToF Hub');

  await page.getByRole('button', {name: 'Load example', exact: true}).click();
  const summary = page.getByRole('region', {name: 'Parse summary'});
  const shareTable = summary.getByRole('table');
  await expect(shareTable.locator('tbody tr')).toHaveCount(3);
  expect(await shareTable.locator('tbody td:first-of-type').allTextContents()).toEqual(previewShares);
  const bestWithoutWeakPoint = summary.getByRole('heading', {name: 'Without Weak Point', exact: true}).locator('..');
  await expect(bestWithoutWeakPoint.locator('li[data-best="true"] strong')).toHaveText(previewLevels);
  const chart = page.getByRole('region', {name: 'Damage distribution'});
  const weakPoint = page.locator('article[data-weak-point=true]');
  const worn = weakPoint.getByRole('button', {name: /Used in parse/});
  await chart.getByRole('button', {name: 'With Weak Point', exact: true}).click();
  await expect(chart.getByText('94.26g', {exact: true})).toBeVisible();
  await worn.click();
  await expect(chart.getByText('93.78g', {exact: true})).toBeVisible();
  await worn.press('Enter');
  await expect(worn).toHaveAttribute('aria-pressed', 'false');
  await expect(chart.getByText('94.26g', {exact: true})).toBeVisible();
});
