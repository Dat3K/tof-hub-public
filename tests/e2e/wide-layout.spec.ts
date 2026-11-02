import {test,expect} from '@playwright/test';

for(const entry of [
  {route:'/',frame:'[class*="main-hub_layout"]',text:'[data-main-hub] h2'},
  {route:'/info/simulacra/',frame:'.simulacra-main',text:'.sim-controls-bar .sim-filter-btn'},
  {route:'/tools/ranking/',frame:'[class*="ranking_page"]',text:'button[data-tone="update"]'},
  {route:'/datamine/items/',frame:'[class*="items_container"]',text:'tbody td:nth-child(4)'},
]){
  test(`Wide workspace scales content and typography without page overflow: ${entry.route}`,async({page})=>{
    test.setTimeout(180000);
    await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:true,entries:[],total:0}}));
    await page.setViewportSize({width:1920,height:1080});
    await page.goto(entry.route,{waitUntil:'domcontentloaded',timeout:120000});
    const frame=page.locator(entry.frame).first(),text=page.locator(entry.text).first();
    await expect(text).toBeVisible({timeout:60000});
    const baseWidth=(await frame.boundingBox())!.width;
    const baseFont=await text.evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
    await page.setViewportSize({width:2560,height:1440});
    await expect.poll(async()=>(await frame.boundingBox())!.width).toBeGreaterThan(baseWidth+200);
    await expect.poll(async()=>await text.evaluate(node=>parseFloat(getComputedStyle(node).fontSize))/baseFont).toBeCloseTo(4/3,2);
    expect(await page.locator('.sim-controls-bar .sim-filter-btn').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1))).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`ignore/documentation-media/generated/wide-layout/fluid-${entry.route==='/'?'home':entry.route.split('/').filter(Boolean).join('-')}-2560.png`,animations:'disabled'});
    await page.setViewportSize({width:3840,height:2160});
    expect((await frame.boundingBox())!.width/baseWidth).toBeCloseTo(2,1);
    expect(await text.evaluate(node=>parseFloat(getComputedStyle(node).fontSize))/baseFont).toBeCloseTo(2,2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.setViewportSize({width:2560,height:768});
    await expect.poll(()=>text.evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeLessThanOrEqual(baseFont);
  });
}

for(const route of ['/datamine/fce/','/datamine/raids/']){
  test(`Encounter scene uses a tall QHD viewport and fits a short window: ${route}`,async({page})=>{
    test.setTimeout(180000);
    await page.setViewportSize({width:2560,height:1440});
    await page.goto(route,{waitUntil:'domcontentloaded',timeout:120000});
    const frame=page.locator('[class*="cardViewport"]').first();
    await expect(frame).toHaveAttribute('data-ready','true',{timeout:60000});
    await expect.poll(async()=>(await frame.boundingBox())!.width).toBeGreaterThan(1600);
    const choice=page.locator('.encounter-choice').first();
    await expect(choice).toBeVisible();
    const choiceSize=await choice.evaluate(node=>({font:parseFloat(getComputedStyle(node).fontSize),height:node.getBoundingClientRect().height,icon:node.querySelector('img')!.getBoundingClientRect().height}));
    expect(choiceSize.font).toBeCloseTo(11*4/3,1);
    expect(choiceSize.height).toBeCloseTo(32*4/3,1);
    expect(choiceSize.icon).toBeCloseTo(22*4/3,1);
    const roster=choice.locator('..');
    expect(await roster.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
    expect(await roster.locator('button').evaluateAll(nodes=>{
      const bounds=nodes[0].parentElement!.getBoundingClientRect();
      return nodes.every(node=>{const box=node.getBoundingClientRect();return box.left>=bounds.left-1&&box.right<=bounds.right+1;});
    })).toBe(true);
    expect(await frame.locator('article').evaluate(node=>({width:node.clientWidth,height:node.clientHeight}))).toEqual({width:1920,height:1080});
    expect((await frame.boundingBox())!.y+(await frame.boundingBox())!.height).toBeLessThanOrEqual(1440);
    await page.screenshot({path:`ignore/documentation-media/generated/wide-layout/fluid-${route.split('/').filter(Boolean).join('-')}-2560.png`,animations:'disabled'});
    await page.setViewportSize({width:3840,height:2160});
    await expect.poll(()=>choice.evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeCloseTo(22,1);
    const controls=page.locator('[class*=exportBar]').first();
    await expect.poll(async()=>{const box=(await frame.boundingBox())!;return box.y+box.height;}).toBeLessThanOrEqual((await controls.boundingBox())!.y);
    await page.setViewportSize({width:1920,height:768});
    await expect.poll(async()=>{const box=(await frame.boundingBox())!;return box.y+box.height;}).toBeLessThanOrEqual(768);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
