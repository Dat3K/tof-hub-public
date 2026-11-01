import {test,expect} from '@playwright/test';

test('the shell does not prefetch sibling Tools and footer pages on a cold ranking visit',async({page})=>{
  const background:string[]=[];
  const siblings=new Set(['/','/info/','/tools/','/datamine/','/tools/build/','/tools/wish/','/tools/optimizer/','/tools/comp/','/privacy/']);
  page.on('request',request=>{const url=new URL(request.url());if(url.searchParams.has('_rsc')&&siblings.has(url.pathname))background.push(url.pathname);});
  await page.goto('/tools/ranking/');
  await expect(page.getByRole('radio',{name:'Players',exact:true})).toHaveAttribute('aria-checked','true');
  await expect(page.locator('[class*="playerRow"]:not([data-head])').first()).toBeVisible();
  await page.waitForTimeout(800);
  expect(background).toEqual([]);
});

for(const reopen of [false,true])test(`piece places recover after an early failed request${reopen?' and reopening':''}`,async({page})=>{
  const id='00000000-0000-4000-8000-000000000071';let attempts=0;
  const gear={id,slot:'helmet',itemId:'helmet',stars:5,enhancement:80,titan:true,augmented:true,rareId:null,rareLevel:null,
    source:'self',stats:[{type:'Physical Attack',value:1000}],statsBeforeTitan:[800],augments:[],augmentCount:null,lastSeenAt:'2026-10-18T00:00:00Z'};
  await page.route('**/api/v1/ranking/**',async route=>{
    if(route.request().url().includes('/gear/ranks?')){
      attempts++;if(attempts<=(reopen?1:2)){await new Promise(resolve=>setTimeout(resolve,300));await route.fulfill({status:503,json:{message:'Temporary database outage'}});}
      else await route.fulfill({json:{available:true,ranks:{[id]:7}}});
    }else await route.fulfill({json:{available:true,total:1,overall:1,entries:[{rank:1,score:80,maxScore:100,track:'Physical',
      player:{nickname:'Retry player',uid:'1300506653',region:'EU',serverId:'13005',combatScore:null,maxCombatScore:null},buildId:null,updatedAt:gear.lastSeenAt,gear:[gear]}]}});
  });
  await page.goto('/tools/ranking/?track=Physical&verified=1');
  const row=page.getByRole('row').filter({has:page.getByText('Retry player',{exact:true})});
  await row.getByRole('button',{name:'Show details',exact:true}).click();
  if(reopen){
    await row.getByRole('button',{name:'Hide details',exact:true}).click();
    await expect.poll(()=>attempts).toBe(1);await page.waitForTimeout(400);
    await row.getByRole('button',{name:'Show details',exact:true}).click();
  }
  await expect(page.locator('#player-top-1').getByText('#7',{exact:true})).toBeVisible();
  expect(attempts).toBe(reopen?2:3);
  await page.setViewportSize({width:390,height:844});
  const stats=await page.locator('#player-top-1 [class*="statTotals"]').boundingBox();
  const button=await page.locator('#player-top-1').getByRole('button',{name:'Enable comparison',exact:true}).boundingBox();
  expect(stats).not.toBeNull();expect(button).not.toBeNull();
  expect(button!.y+button!.height/2).toBeGreaterThanOrEqual(stats!.y);
  expect(button!.y+button!.height/2).toBeLessThanOrEqual(stats!.y+stats!.height);
});

test('mobile landscape Build keeps the card clear of the desktop toolbar',async({browser})=>{
  const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  try{
    await page.goto('/tools/build/');
    await expect(page.locator('[class*="exportAction"]').first()).toBeHidden();
    await expect(page.locator('[data-rv-element]')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await page.close();}
});

test('Arts keeps resolution and category badges on the same top line on phones',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/info/arts/');
  const card=page.locator('article[class*="artCard"]').first();await expect(card).toBeVisible();
  const resolution=await card.locator('[class*="resBadge"]').boundingBox(),category=await card.locator('[class*="catBadge"]').boundingBox();
  expect(resolution).not.toBeNull();expect(category).not.toBeNull();
  expect(Math.abs(category!.y-resolution!.y)).toBeLessThan(2);
  expect(category!.x).toBeGreaterThanOrEqual(resolution!.x+resolution!.width);
});
