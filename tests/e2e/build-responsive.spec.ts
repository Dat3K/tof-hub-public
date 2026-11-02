import {test,expect} from '@playwright/test';

for(const locale of ['en','ru'] as const)for(const mode of ['gacha','mmo'] as const){
  test(`Build preview uses available space without covering controls: ${mode}, ${locale}`,async({page,context,baseURL})=>{
    test.setTimeout(180000);
    await context.addCookies([{name:'tof_locale',value:locale,url:baseURL!}]);
    await page.setViewportSize({width:2560,height:1440});
    await page.goto(mode==='mmo'?'/tools/build/mmo/':'/tools/build/',{waitUntil:'domcontentloaded',timeout:120000});
    const card=page.locator('article.card');
    await expect(card).toBeVisible({timeout:60000});
    const toolbar=page.locator('[class*="build_exportAction"]');
    for(const viewport of [{width:2560,height:1440},{width:1920,height:1080},{width:3440,height:1440},{width:1920,height:768},{width:844,height:390}]){
      await page.setViewportSize(viewport);
      await expect.poll(async()=>{
        const box=(await card.boundingBox())!;
        const controls=await toolbar.isVisible()?await toolbar.boundingBox():null;
        return box.x>=0&&box.x+box.width<=viewport.width&&(viewport.width<=1023||box.y+box.height<=(controls?.y??viewport.height));
      }).toBe(true);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(viewport.width<=1023)await expect.poll(async()=>(await card.boundingBox())!.width).toBeGreaterThan(viewport.width-30);
      if(viewport.width>=2560){
        await expect.poll(async()=>(await card.boundingBox())!.width).toBeGreaterThan(2250);
        const frame=(await card.boundingBox())!;
        const controls=(await toolbar.boundingBox())!;
        expect(Math.abs(frame.width-controls.width)).toBeLessThan(2);
        await page.screenshot({path:`ignore/documentation-media/generated/wide-layout/build-${mode}-${locale}-${viewport.width}.png`,animations:'disabled'});
      }
    }
    await page.setViewportSize({width:390,height:844});
    await expect(card).not.toBeVisible();
    await expect(page.getByRole('status').filter({hasText:/Turn your device|Поверните устройство/})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
