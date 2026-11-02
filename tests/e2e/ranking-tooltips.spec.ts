import {test,expect} from '@playwright/test';

for(const locale of ['en','ru'] as const)for(const width of [1440,390]){
  test(`Ranking action hints stay compact and dismiss on action: ${locale}, ${width}px`,async({page,context,baseURL})=>{
    test.setTimeout(120000);
    await context.addCookies([{name:'tof_locale',value:locale,url:baseURL!}]);
    await page.setViewportSize({width,height:1000});
    await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:true,entries:[],total:0,overall:0}}));
    for(const board of ['players','gear']){
      await page.goto(`/tools/ranking/?board=${board}`,{waitUntil:'domcontentloaded',timeout:90000});
      await page.addStyleTag({content:'nextjs-portal {display:none}'});
      await expect(page.locator('[data-tool-rail]>button')).toBeEnabled({timeout:60000});
      const verified=page.getByRole('checkbox',{name:locale==='en'?'Verified only':'Только verified',exact:true});
      await expect(verified).toBeVisible();
      await verified.locator('..').hover();
      const tooltip=page.getByRole('tooltip');
      await expect(tooltip).toBeVisible();
      await expect(tooltip.locator('[data-inspection-heading]')).toHaveCount(0);
      if(board==='players')await expect(tooltip).toHaveText(locale==='en'?'Imported capture':'Импорт из захвата');
      else await expect(tooltip).toContainText('.tofbuild');
      const box=(await tooltip.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(width);
      await page.keyboard.press('Escape');
      await expect(tooltip).toHaveCount(0);
      await page.mouse.move(0,0);
      await verified.focus();
      await expect(tooltip).toBeVisible();
      await verified.press('Space');
      await expect(tooltip).toHaveCount(0);
      await expect(verified).toBeChecked();
      const perfect=page.locator('button[data-tone="perfect"]');
      await perfect.hover();
      await expect(tooltip).toContainText('100 %');
      await perfect.click();
      await expect(tooltip).toHaveCount(0);
      await page.mouse.move(0,0);
      await verified.focus();
      await perfect.focus();
      await expect(tooltip).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(tooltip).toHaveCount(0);
    }
    await page.screenshot({path:`ignore/documentation-media/generated/wide-layout/ranking-hints-${locale}-${width}.png`,animations:'disabled'});
  });
}
