import { test, expect } from '@playwright/test';

test('Gefion flat skill damage continues growing after level 110 using the raw sparse curve',async({page})=>{
  test.setTimeout(90000);
  await page.goto('/info/simulacra/?server=gacha&char=gefion',{waitUntil:'domcontentloaded'});
  const slider=page.locator('#sim-skill-level-slider');
  await expect(slider).toBeVisible();
  const skill=page.locator('[data-skill-id="GA_FPlayerGefionMelee_AirMelee"]');
  // A visible server-rendered range can accept native keys before React hydrates.
  // Confirm a React-driven tab change before exercising the controlled slider.
  const skillTab=page.getByRole('tab',{name:/^Skill/});
  await expect(async()=>{
    await skillTab.click();
    await expect(skillTab).toHaveAttribute('aria-selected','true',{timeout:1000});
  }).toPass({timeout:30000});
  await page.getByRole('tab',{name:/^Normal/}).click();
  await expect(skill).toBeVisible();
  const selectLevel=async(level:number)=>{
    await slider.press('End');
    await expect(slider).toHaveValue('200');
    // Page Down is the range control's coarse step in Chromium.
    for(let current=200;current>level;){
      const coarse=current-level>=20;
      await slider.press(coarse?'PageDown':'ArrowLeft');
      current-=coarse?20:1;
      await expect(slider).toHaveValue(String(current));
    }
    await expect(slider.locator('..')).toContainText(`Lv. ${level}`);
  };
  await selectLevel(118);
  await expect(skill).toContainText('1118% of ATK + 3525');
  await expect(skill).toContainText('1417% of ATK + 4467');
  await selectLevel(190);
  await expect(skill).toContainText('1417% of ATK + 8053');
  await selectLevel(200);
  await expect(skill).toContainText('1417% of ATK + 8949');
  await page.screenshot({path:'ignore/documentation-media/generated/gefion-skill-curve-max.png',animations:'disabled'});
});

test('Food search rarity remains usable on desktop and narrow EN/RU screens',async({page,context,baseURL})=>{
  test.setTimeout(180000);
  for(const locale of ['en','ru']){
    await context.addCookies([{name:'tof_locale',value:locale,url:baseURL!}]);
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:900});
      await page.goto('/info/food/?view=potions',{waitUntil:'domcontentloaded'});
      const controls=page.locator('#food-controls-bar');
      const search=controls.locator('.sim-search-input');
      const rarity=controls.locator('[data-filter-group="rarity"]');
      await expect(rarity).toBeVisible();
      await expect(controls.locator('[data-filter-group="potion-sub"]')).toBeVisible();
      if(width>640)await expect.poll(()=>search.evaluate(input=>{
        const accessory=input.parentElement!.querySelector('.sim-search-accessory')!;
        return parseFloat(getComputedStyle(input).paddingRight)-Math.ceil(accessory.getBoundingClientRect().width);
      }),{timeout:60000}).toBeGreaterThanOrEqual(35);
      await expect(controls.locator('.sim-search-box [data-filter-group="rarity"]')).toHaveCount(1);
      const inputBox=(await search.boundingBox())!,rarityBox=(await rarity.boundingBox())!;
      if(width>640)expect(Math.abs(inputBox.y-rarityBox.y)).toBeLessThan(10);
      else expect(rarityBox.y).toBeGreaterThanOrEqual(inputBox.y+inputBox.height);
      if(width>640){
        const categoryBox=(await controls.locator('[data-filter-group="category"]').boundingBox())!;
        const effects=controls.locator('[data-filter-group="effects"]');
        const effectsBox=(await effects.locator('button').first().boundingBox())!;
        const sortBox=(await controls.locator('.sim-sort-box').boundingBox())!;
        const filtersBox=(await controls.locator('.sim-filter-groups__left').last().boundingBox())!;
        expect(Math.abs(categoryBox.y-effectsBox.y)).toBeLessThan(3);
        expect(Math.abs(filtersBox.y+filtersBox.height/2-sortBox.y-sortBox.height/2)).toBeLessThan(3);
        expect(effectsBox.x).toBeGreaterThan(categoryBox.x+categoryBox.width);
        const nextLine=await effects.locator('button').evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect()).filter(rect=>rect.y>buttons[0].getBoundingClientRect().y+5).map(rect=>rect.x));
        expect(Math.min(...nextLine)).toBeLessThan(categoryBox.x+5);
        const chipGap=await effects.locator('button').evaluateAll(buttons=>{
          const first=buttons[0].getBoundingClientRect(),second=buttons[1].getBoundingClientRect();
          return second.x-first.right;
        });
        expect(chipGap).toBe(6);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
      await rarity.locator('button[data-val="SR"]').click();
      await expect(rarity.locator('button[data-val="SR"]')).toHaveAttribute('aria-pressed','true');
      await search.fill('Chocolate');
      await search.press('Enter');
      await expect(search).toHaveValue('Chocolate');
      await controls.locator('.sim-search-clear').click();
      await expect(search).toHaveValue('');
      await expect(search).toBeFocused();
      await page.screenshot({path:`ignore/documentation-media/generated/food-controls-${locale}-${width}.png`,animations:'disabled'});
    }
  }
  await page.goto('/info/food/?view=dishes',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#food-controls-bar')).toBeVisible();
  await expect(page.locator('[data-filter-group="recipe"]')).toHaveCount(0);
});

test.describe('Info Navigation: Hub -> Section -> Detail', () => {
  test('renders /info hub with all 7 encyclopedia section cards and links', async ({ page }) => {
    const response = await page.goto('/info/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    // 1. Verify accessible landmark heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeAttached();
    await expect(heading).toContainText(/Tower of Fantasy encyclopedia|Энциклопедия Tower of Fantasy/i);

    // 2. Check the hub cards themselves, independently of header navigation.
    const sections = page.getByRole('region', { name: /Encyclopedia sections|Разделы энциклопедии/i });
    await expect(sections.getByRole('article')).toHaveCount(7);
    const expectedRoutes = [
      '/info/simulacra',
      '/info/matrices',
      '/info/relics',
      '/info/pets',
      '/info/food',
      '/info/cosmetics',
      '/info/arts',
    ];

    for (const route of expectedRoutes) {
      const link = sections.locator(`a[href="${route}"], a[href="${route}/"]`).first();
      await expect(link).toBeVisible();
    }
  });

  test('navigates from hub to simulacra section and enters character detail view', async ({ page }) => {
    await page.goto('/info');
    await page.waitForLoadState('domcontentloaded');

    // Click Simulacra & Weapons card link
    const simLink = page.locator('a[href="/info/simulacra"], a[href="/info/simulacra/"]').first();
    await simLink.click();
    await page.waitForURL(/\/info\/simulacra\/?$/);

    // Verify catalog controls are present
    const searchInput = page.locator('input.sim-search-input');
    await expect(searchInput).toBeVisible();

    // Verify character cards are rendered
    const cards = page.locator('[id^="sim-card-"]');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThan(0);

    // Filter by search query "Saki"
    await searchInput.fill('Saki');
    const sakiCard = page.locator('[id^="sim-card-"]').filter({ hasText: 'Saki Fuwa' }).first();
    await expect(sakiCard).toBeVisible({ timeout: 10000 });

    // Click character card to enter Detail View
    await sakiCard.click();

    // Verify Detail View navigation and elements
    const backBtn = page.locator('#sim-back-btn');
    await expect(backBtn).toBeVisible({ timeout: 20000 });

    // Verify character detail content (hero card or tabs)
    const mainContent = page.locator('.simulacra-main');
    await expect(mainContent).toContainText(/Saki Fuwa/i);

    // Test pager next character button if available
    const nextBtn = page.locator('#sim-next-char-btn');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(300);
      await expect(backBtn).toBeVisible();
    }

    // Click back button to return to Catalog Grid
    await backBtn.click();
    await expect(searchInput).toBeVisible();
    await expect(cards.first()).toBeVisible();
  });

  test('navigates to matrices catalog and opens/closes detail modal', async ({ page }) => {
    await page.goto('/info/matrices');
    await page.waitForLoadState('domcontentloaded');

    const matrixCards = page.locator('[id^="matrix-card-"]');
    await expect(matrixCards.first()).toBeVisible({ timeout: 15000 });

    // Click the first matrix card
    await matrixCards.first().click();

    // Detail modal dialog appears
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Close modal via Escape key
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5000 });
  });

  test('navigates to relics catalog and opens/closes detail modal', async ({ page }) => {
    await page.goto('/info/relics');
    await page.waitForLoadState('domcontentloaded');

    const relicCards = page.locator('[id^="relic-card-"]');
    await expect(relicCards.first()).toBeVisible({ timeout: 15000 });

    // Click the first relic card
    await relicCards.first().click();

    // Detail modal appears
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Close modal via Escape key
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5000 });
  });

  test('uses resistance icons for relic defense while preserving Physical filtering',async({page})=>{
    await page.goto('/info/relics/?server=gacha&elem=phys');
    const icons=await (await page.request.get('/game-data/relic-resistance-icons.json')).json();
    const defense=page.locator('[id^="relic-card-"] [data-passive-type="def"]');
    await expect(defense.first()).toBeVisible();
    for(const badge of await defense.all()){
      await expect(badge).toContainText('Phys DEF');
      await expect(badge.locator('img')).toHaveAttribute('src',icons.phys);
    }
    await defense.first().locator('xpath=ancestor::*[starts-with(@id,"relic-card-")]').click();
    await expect(page.getByRole('dialog').locator('[data-passive-type="def"] img').first()).toHaveAttribute('src',icons.phys);
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await expect(defense.first()).toContainText('Физ. защита');
    await expect(defense.first().locator('img')).toHaveAttribute('src',icons.phys);
  });

  test('keeps the food catalog visible after closing a detail card on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/info/food');
    await page.waitForLoadState('domcontentloaded');

    const cards = page.locator('[id^="dish-card-"]');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    await cards.first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Close modal' }).click();
    await expect(dialog).toBeHidden({ timeout: 5000 });
    await expect(cards.first()).toBeVisible();

    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('navigates to simulacra changelog and back to catalog', async ({ page }) => {
    await page.goto('/info/simulacra/changelog');
    await page.waitForLoadState('domcontentloaded');

    const backLink = page.locator('a[href="/info/simulacra"], a[href="/info/simulacra/"]').first();
    await expect(backLink).toBeVisible();

    await backLink.click();
    await page.waitForURL(/\/info\/simulacra\/?$/);
    await expect(page.locator('input.sim-search-input')).toBeVisible();
  });
});

test.describe('Language Switching & Cookie Persistence', () => {
  test('switches language between EN and RU and persists across reloads and navigation', async ({ page, context }) => {
    // 1. Initial visit to /info in default English
    await page.goto('/info');
    await page.waitForLoadState('domcontentloaded');

    const langTrigger = page.locator('button[data-info-lang-trigger]');
    await expect(langTrigger).toBeVisible();
    await expect(langTrigger).toContainText('EN');

    // 2. Open dropdown and select Russian
    await langTrigger.click();
    const ruOption = page.locator('button[data-datamine-language="ru"]');
    await expect(ruOption).toBeVisible();
    await ruOption.click();

    // Verify trigger updates to RU
    await expect(langTrigger).toContainText('RU');

    // Verify cookie tof_locale is set to 'ru'
    let cookies = await context.cookies();
    let localeCookie = cookies.find((c) => c.name === 'tof_locale');
    expect(localeCookie?.value).toBe('ru');

    // Verify localized heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toContainText('Энциклопедия Tower of Fantasy');

    // 3. Reload page and assert Russian persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await expect(langTrigger).toContainText('RU');
    await expect(heading).toContainText(
      'Энциклопедия Tower of Fantasy'
    );

    // 4. Navigate to /info/simulacra and verify Russian copy persists
    await page.goto('/info/simulacra');
    await page.waitForLoadState('domcontentloaded');

    await expect(langTrigger).toContainText('RU');
    const searchInput = page.locator('input.sim-search-input');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', /поиск/i);

    // 5. Switch back to English
    await langTrigger.click();
    const enOption = page.locator('button[data-datamine-language="en"]');
    await expect(enOption).toBeVisible();
    await enOption.click();

    await expect(langTrigger).toContainText('EN');
    await expect(searchInput).toHaveAttribute('placeholder', /search/i);

    // Verify cookie tof_locale is now 'en'
    cookies = await context.cookies();
    localeCookie = cookies.find((c) => c.name === 'tof_locale');
    expect(localeCookie?.value).toBe('en');

    // Reload and verify English persists
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(langTrigger).toContainText('EN');
  });
});

test.describe('Responsive Viewports & Adaptive Shell', () => {
  test('desktop viewport (1280x720): renders multi-column grid and inline header navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/info');
    await page.waitForLoadState('domcontentloaded');

    // Header banner and inline nav
    const header = page.locator('header[data-site-header]');
    await expect(header).toBeVisible();
    const navLinks = page.locator('header[data-site-header] nav a');
    await expect(navLinks.first()).toBeVisible();

    // Section cards in desktop grid
    const simCard = page.locator('a[href="/info/simulacra"], a[href="/info/simulacra/"]').first();
    await expect(simCard).toBeVisible();

    // Verify Simulacra catalog desktop layout
    await page.goto('/info/simulacra');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.locator('input.sim-search-input');
    await expect(searchInput).toBeVisible();
    const simCards = page.locator('[id^="sim-card-"]');
    await expect(simCards.first()).toBeVisible({ timeout: 15000 });

    // Check that multiple cards fit horizontally without viewport overflow
    const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(1280);
  });

  test('tablet viewport (768x1024): maintains responsive 2-row header without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/info');
    await page.waitForLoadState('domcontentloaded');

    const header = page.locator('header[data-site-header]');
    await expect(header).toBeVisible();

    // Verify no unexpected viewport horizontal scroll
    const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(768);
  });

  test('mobile viewport (390x844): stacks cards and preserves interactive detail navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/info');
    await page.waitForLoadState('domcontentloaded');

    const header = page.locator('header[data-site-header]');
    await expect(header).toBeVisible();

    // Verify cards are visible in mobile viewport
    const simCard = page.locator('a[href="/info/simulacra"], a[href="/info/simulacra/"]').first();
    await expect(simCard).toBeVisible();

    // Navigate to simulacra on mobile
    await page.goto('/info/simulacra');
    await page.waitForLoadState('domcontentloaded');

    const simCards = page.locator('[id^="sim-card-"]');
    await expect(simCards.first()).toBeVisible({ timeout: 15000 });

    // Confirm React has hydrated before leaving the catalog. An SSR card link
    // can otherwise navigate to another SSR document before Back has a handler.
    const searchInput = page.locator('input.sim-search-input');
    await expect(async () => {
      await searchInput.fill('Saki');
      await expect(simCards).toHaveCount(1, { timeout: 1000 });
    }).toPass();
    await expect(simCards.first()).toContainText('Saki Fuwa');

    // Open detail view on mobile
    await simCards.first().click();
    const backBtn = page.locator('#sim-back-btn');
    await expect(backBtn).toBeVisible({ timeout: 20000 });

    // Verify back navigation works on mobile
    await backBtn.click();
    await expect(simCards.first()).toBeVisible();
    await expect(searchInput).toHaveValue('Saki');
    await expect(simCards.first()).toContainText('Saki Fuwa');
    await expect(page).not.toHaveURL(/[?&]char=/);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(395);
  });
});

test('captures reference states as review artifacts', async ({ page }, testInfo) => {
  for (const [name, url] of [
    ['catalog', '/info/simulacra/?server=gacha'],
    ['gefion', '/info/simulacra/?server=gacha&char=gefion'],
    ['salidy', '/info/simulacra/?server=mmo&char=salidy-mmo'],
  ]) {
    await page.goto(url);
    await expect(page.locator(name === 'catalog' ? '.sim-search-input' : '#sim-back-btn')).toBeVisible();
    await page.screenshot({path: testInfo.outputPath(`${name}.png`)});
  }
});

test('Arts categories persist in query URLs and preserve artwork deep links',async({page})=>{
  await page.goto('/info/arts/?q=');
  await page.waitForLoadState('networkidle');
  const loading=page.locator('.arts-catalog-page button[data-val="loading"]');
  await loading.click();
  await expect(page).toHaveURL(/\?q=&cat=loading$/);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(loading).toHaveAttribute('aria-pressed','true');
  await page.locator('.arts-catalog-page button[data-val="all"]').click();
  await expect(page).toHaveURL(/\?q=$/);
  await page.goto('/info/arts/?cat=character_bg#season_4_huodongzh2_tuozhanbao_bg');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/cat=character_bg$/);
  await page.setViewportSize({width:390,height:844});
  await loading.click();
  await expect(page).toHaveURL(/cat=loading$/);
});

test('Arts shows tracked additions first and keeps the New filter after reload on mobile', async ({page, request, context, baseURL}) => {
  const response = await request.get('/game-data/en/runtime/arts.json');
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const added = data.items.filter((item: {isNew?: boolean}) => item.isNew);
  expect(added.length).toBeGreaterThan(0);
  const titles = added.map((item: {title: string}) => item.title).sort();
  await page.goto('/info/arts/');
  const cards = page.locator('.arts-catalog-page article');
  await expect(cards.first()).toBeVisible();
  const first = await cards.evaluateAll((elements, count) => elements.slice(0, count).map(element => element.getAttribute('aria-label')), added.length);
  expect(first.sort()).toEqual(titles);
  await page.screenshot({path: 'ignore/documentation-media/generated/arts-discovery-desktop.png', fullPage: true});
  await page.locator('.arts-catalog-page button[data-val="new"]').click();
  await expect(page).toHaveURL(/cat=new/);
  await expect(cards).toHaveCount(added.length);
  await page.setViewportSize({width: 390, height: 844});
  await page.reload();
  await expect(page.locator('.arts-catalog-page button[data-val="new"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(cards).toHaveCount(added.length);
  await context.addCookies([{name: 'tof_locale', value: 'ru', url: baseURL!}]);
  await page.reload();
  await expect(page.locator('.arts-catalog-page button[data-val="new"]')).toContainText('Новые');
  await expect(cards).toHaveCount(added.length);
  await page.screenshot({path: 'ignore/documentation-media/generated/arts-discovery-mobile-ru.png', fullPage: true});
});

test('Simulacra disclosures keep their height after closing and reopening',async({page})=>{
  await page.goto('/info/simulacra/?server=gacha&char=gefion',{waitUntil:'domcontentloaded'});
  const item=page.locator('#advancement-4');
  const summary=item.locator('> summary');
  await expect(summary).toBeVisible();
  await expect(item).toHaveAttribute('open','');
  await page.evaluate(()=>document.fonts.ready);
  const original=await item.evaluate(node=>node.getBoundingClientRect().height);
  await expect(async()=>{
    if(await item.getAttribute('open')!==null)await summary.press('Enter');
    await expect(item).not.toHaveAttribute('open','',{timeout:600});
  }).toPass();
  await expect.poll(()=>item.evaluate(node=>node.getBoundingClientRect().height)).toBeLessThan(original);
  await summary.press('Enter');
  await expect(item).toHaveAttribute('open','');
  // A retained animation fill used to leave the panel taller by its padding.
  await expect.poll(()=>item.evaluate(node=>Math.round(node.getBoundingClientRect().height))).toBe(Math.round(original));
  await page.waitForTimeout(500);
  expect(Math.round(await item.evaluate(node=>node.getBoundingClientRect().height))).toBe(Math.round(original));
});
