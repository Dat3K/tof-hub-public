import {test,expect} from '@playwright/test';

for(const route of ['/tools/ranking/','/tools/build/','/tools/build/mmo/','/tools/optimizer/','/tools/wish/']){
  test(`Mobile tool actions are collapsed and reveal at bottom centre: ${route}`,async({page})=>{
    test.setTimeout(120000);
    await page.setViewportSize({width:390,height:844});
    await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:true,entries:[],total:0}}));
    await page.goto(route,{waitUntil:'domcontentloaded',timeout:90000});
    // Next's development badge occupies the same bottom-left corner; it is absent in production.
    await page.addStyleTag({content:'nextjs-portal {display:none}'});
    const rail=page.locator('[data-tool-rail]'),toggle=rail.locator(':scope > button'),actions=rail.locator('nav');
    // Build shows portrait guidance; its actions are available after rotating.
    if(route.startsWith('/tools/build/'))await page.setViewportSize({width:844,height:390});
    await expect(toggle).toBeVisible({timeout:60000});
    await expect(actions).not.toBeVisible();
    await toggle.click();
    await expect(actions).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded','true');
    await page.screenshot({path:`ignore/documentation-media/generated/wide-layout/mobile-actions-${route.split('/').filter(Boolean).join('-')}.png`,animations:'disabled'});
    const viewport=page.viewportSize()!,box=(await actions.boundingBox())!;
    expect(Math.abs(box.x+box.width/2-viewport.width/2)).toBeLessThan(2);
    expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.y+box.height).toBeGreaterThan(viewport.height-40);
    await page.keyboard.press('Escape');
    await expect(actions).not.toBeVisible();
    await expect(toggle).toBeFocused();
    await toggle.press('Enter');
    await expect(actions).toBeVisible();
    await page.mouse.click(viewport.width-5,5);
    await expect(actions).not.toBeVisible();
    await page.setViewportSize({width:1440,height:900});
    await expect(actions).toBeVisible();
    await expect(toggle).not.toBeVisible();
  });
}

test('Ranking sort and maximum score share one mobile row',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:true,entries:[],total:0}}));
  await page.goto('/tools/ranking/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-tool-rail]>button')).toBeEnabled({timeout:60000});
  const sort=page.locator('.sim-sort-box');
  await expect(sort).toBeVisible();
  const max=page.locator('[class*="ranking_maxGrv"]').first();
  const a=(await sort.boundingBox())!,b=(await max.boundingBox())!;
  expect(Math.abs(a.y+a.height/2-b.y-b.height/2)).toBeLessThan(5);
  await sort.locator('button.sim-sort-trigger').click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({path:'ignore/documentation-media/generated/wide-layout/ranking-mobile-sort.png',animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const route of ['/tools/ranking/','/info/simulacra/','/info/matrices/','/info/food/']){
  test(`Mobile filter rows scroll horizontally without a label highlight: ${route}`,async({page})=>{
    test.setTimeout(120000);
    await page.setViewportSize({width:390,height:844});
    await page.goto(route,{waitUntil:'domcontentloaded',timeout:90000});
    const panel=page.locator('.sim-controls-bar').first();
    await expect(panel).toBeVisible();
    const groups=panel.locator('.sim-filter-group');
    expect(await groups.count()).toBeGreaterThan(0);
    for(const group of await groups.all()){
      const label=group.locator(':scope > .sim-filter-label');
      if(!await label.isVisible())continue;
      expect(await label.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe(await panel.evaluate(node=>getComputedStyle(node).backgroundColor));
      const chips=group.locator(':scope > .sim-filter-btn');
      if(await chips.count()>1){
        const ys=await chips.evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().top));
        expect(Math.max(...ys)-Math.min(...ys)).toBeLessThan(2);
      }
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`ignore/documentation-media/generated/wide-layout/filters-${route.split('/').filter(Boolean).join('-')}.png`,animations:'disabled'});
  });
}

for(const locale of ['en','ru'] as const){
  test(`Ranking roles do not overlap and actions scroll in one row: ${locale}`,async({page,context,baseURL})=>{
    test.setTimeout(120000);
    await context.addCookies([{name:'tof_locale',value:locale,url:baseURL!}]);
    await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:true,entries:[],total:0}}));
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      await page.goto('/tools/ranking/',{waitUntil:'domcontentloaded',timeout:90000});
      await page.addStyleTag({content:'nextjs-portal {display:none}'});
      await expect(page.locator('[data-tool-rail]>button')).toBeEnabled({timeout:60000});
      const roles=page.locator('[class*="roleMobile"] .sim-mode-btn');
      await expect(roles).toHaveCount(3);
      const roleBoxes=await roles.evaluateAll(nodes=>nodes.map(node=>({box:node.getBoundingClientRect().toJSON(),fits:node.scrollWidth<=node.clientWidth+1})));
      for(let index=0;index<roleBoxes.length;index++){
        expect(roleBoxes[index].fits).toBe(true);
        if(index)expect(roleBoxes[index].box.left).toBeGreaterThanOrEqual(roleBoxes[index-1].box.right);
      }
      const actions=page.locator('[class*="ranking_barActions"]');
      const actionButtons=actions.locator('button,label');
      const tops=await actionButtons.evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().top));
      expect(Math.max(...tops)-Math.min(...tops)).toBeLessThan(2);
      await actionButtons.last().focus();
      await expect(actionButtons.last()).toBeInViewport({ratio:.99});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.mouse.move(0,0);
      await page.keyboard.press('Escape');
      await actions.evaluate(node=>{node.scrollLeft=0;});
      await page.screenshot({path:`ignore/documentation-media/generated/wide-layout/ranking-roles-actions-${locale}-${width}.png`,animations:'disabled'});
    }
  });
}

test('Datamine seasons and item names stay inside narrow cards',async({page})=>{
  test.setTimeout(180000);
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    await page.goto('/datamine/',{waitUntil:'domcontentloaded',timeout:90000});
    const dates=page.locator('[class*="oowSeasonDates"]');
    await expect(dates.first()).toBeVisible();
    expect(await dates.evaluateAll(nodes=>nodes.every(node=>{const box=node.getBoundingClientRect(),tile=node.closest('button,a')!.getBoundingClientRect();return box.left>=tile.left&&box.right<=tile.right+1;}))).toBe(true);
    await page.screenshot({path:`ignore/documentation-media/generated/wide-layout/datamine-mobile-${width}.png`,animations:'disabled'});
    await page.goto('/datamine/items/',{waitUntil:'domcontentloaded',timeout:90000});
    const item=page.locator('tbody tr').first();
    await expect(item).toBeVisible();
    const cells=item.locator('td');
    const row=(await item.boundingBox())!,name=(await cells.nth(3).boundingBox())!,id=(await cells.nth(2).boundingBox())!;
    expect(name.x+name.width).toBeLessThanOrEqual(row.x+row.width+1);
    expect(id.y).toBeGreaterThanOrEqual(name.y+name.height-1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`ignore/documentation-media/generated/wide-layout/items-mobile-${width}.png`,animations:'disabled'});
  }
  await page.setViewportSize({width:2560,height:1440});
  await expect(page.locator('thead th')).toHaveCount(7);
  const table=page.locator('table');
  expect(await table.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  await page.screenshot({path:'ignore/documentation-media/generated/wide-layout/items-desktop.png',animations:'disabled'});
});

test('FCE bosses scroll together in three rows',async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/datamine/fce/?server=gacha',{waitUntil:'domcontentloaded',timeout:90000});
  const roster=page.locator('#bosses nav');
  await expect(roster).toBeVisible();
  await expect(page.locator('[class*="cardViewport"]').first()).toHaveAttribute('data-ready','true',{timeout:60000});
  const buttons=roster.locator('button');
  await expect(buttons.first()).toBeVisible();
  const rows=await buttons.evaluateAll(nodes=>new Set(nodes.map(node=>Math.round(node.getBoundingClientRect().top))).size);
  expect(rows).toBe(3);
  expect(await roster.evaluate(node=>node.scrollWidth>node.clientWidth)).toBe(true);
  await roster.evaluate(node=>{node.scrollLeft=0;});
  const before=await buttons.evaluateAll(nodes=>nodes.slice(0,3).map(node=>node.getBoundingClientRect().left));
  await roster.evaluate(node=>{node.scrollLeft=150;});
  const after=await buttons.evaluateAll(nodes=>nodes.slice(0,3).map(node=>node.getBoundingClientRect().left));
  for(let row=0;row<3;row++)expect(before[row]-after[row]).toBeGreaterThan(100);
  await buttons.first().focus();
  await buttons.first().press('Enter');
  await expect(buttons.first()).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:'ignore/documentation-media/generated/wide-layout/fce-mobile-roster.png',animations:'disabled'});
});

for(const width of [320,390])test(`Narrow directories, comp actions and Bygone filters stay contained: ${width}`,async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.goto('/tools/build/profiles/');
  const sort=page.locator('[class*=boardHead] button[aria-haspopup=listbox]');
  await expect(sort).toBeVisible();
  expect((await sort.boundingBox())!.x+(await sort.boundingBox())!.width).toBeLessThanOrEqual(width);
  await sort.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/tools/comp/');
  const clear=page.getByRole('button',{name:/Clear Player|Очистить игрока/}).first();
  await expect(clear).toBeVisible();
  const row=clear.locator('xpath=../..');
  expect((await clear.boundingBox())!.x+(await clear.boundingBox())!.width).toBeLessThanOrEqual((await row.boundingBox())!.x+(await row.boundingBox())!.width);
  await page.goto('/datamine/bygone/');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const filters=page.getByRole('group',{name:'Floor Filters'}).locator('button');
  const filter=filters.last();
  await filters.first().focus();
  for(let index=1;index<await filters.count();index++)await page.keyboard.press('Tab');
  await expect(filter).toBeFocused();
  await expect(filter).toBeInViewport({ratio:.99});
});

test('Food MMO rarity and the FCE MMO season rows use contained shared scrolling',async({page})=>{
  await page.setViewportSize({width:320,height:844});
  await page.goto('/info/food/?server=mmo');
  const rarity=page.locator('[data-filter-group=rarity]');
  await expect(rarity).toBeVisible();
  const search=page.locator('.sim-search-input');
  expect((await rarity.boundingBox())!.x+(await rarity.boundingBox())!.width).toBeLessThanOrEqual((await search.boundingBox())!.x+(await search.boundingBox())!.width+1);
  await rarity.locator('button[data-val=N]').focus();
  await expect(rarity.locator('button[data-val=N]')).toBeInViewport({ratio:.99});
  await page.goto('/datamine/fce/?mode=mmo');
  await expect(page.locator('[class*=cardViewport]').first()).toHaveAttribute('data-ready','true');
  const roster=page.locator('[class*=mmoSwitcher]'),firstInRows=roster.locator('[data-season] .encounter-choice:first-of-type');
  await expect(firstInRows).toHaveCount(3);
  await expect(roster.locator('[aria-pressed=true]')).toBeInViewport({ratio:.99});
  expect(await firstInRows.evaluateAll(nodes=>{
    const bounds=nodes[0].closest('[class*=mmoSwitcher]')!.getBoundingClientRect();
    return nodes.every(node=>{const box=node.getBoundingClientRect();return box.top>=bounds.top-1&&box.bottom<=bounds.bottom+1;});
  })).toBe(true);
  await roster.evaluate(node=>{node.scrollLeft=0});
  const before=await firstInRows.evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().left));
  await roster.evaluate(node=>{node.scrollLeft=160});
  const after=await firstInRows.evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().left));
  for(let row=0;row<3;row++)expect(before[row]-after[row]).toBeGreaterThan(100);
});
