import {test,expect} from '@playwright/test';

test.skip(process.env.PLAYWRIGHT_ANALYTICS_TEST !== 'true','Requires a production web build configured for localhost analytics');

test('tracks page navigation once and removes private tool state',async({page})=>{
  const events:Array<{type:string;payload:Record<string,unknown>}>=[];
  await page.route('https://analytics.smilekritik.beer/api/send',async route=>{
    events.push(route.request().postDataJSON());
    await route.fulfill({json:{cache:'browser-test'}});
  });
  await page.goto('/tools/ranking/?q=private-search#private-fragment');
  await expect.poll(()=>events.length).toBe(1);
  expect(events[0]).toMatchObject({type:'event',payload:{url:'/tools/ranking/',title:'/tools/ranking/'}});
  await expect(page.locator('script[data-website-id]')).toHaveCount(1);
  await page.evaluate(()=>history.pushState({},'', '/tools/build/1300500001/1/?token=private-token#private-capture'));
  await expect.poll(()=>events.length).toBe(2);
  expect(events[1].payload.url).toBe('/tools/build/profile/');
  expect(JSON.stringify(events)).not.toMatch(/1300500001|private-|token=|capture/);
  const suppressed=await page.evaluate(()=>{
    const callback=(window as unknown as {tofHubAnalytics:(type:string,payload:Record<string,unknown>)=>unknown}).tofHubAnalytics;
    return [callback('identify',{url:location.href,id:'player'}),callback('event',{url:location.href,name:'import',data:{uid:'player'}})];
  });
  expect(suppressed).toEqual([false,false]);
});

test('respects Global Privacy Control',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('script[data-website-id]')).toHaveCount(0);
});
