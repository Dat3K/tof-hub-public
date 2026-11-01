import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const seed=JSON.parse(fs.readFileSync('apps/web/public/game-data/version-tracker.json','utf8'));
const tracker={...seed,mode:'live',branches:seed.branches.map((branch:any)=>({...branch,
 version:'1.2.3',changedAt:'2026-10-30T10:00:00Z',
 history:[{id:'fixture-'+branch.id,version:'1.2.3',observedAt:'2026-10-30T10:00:00Z',precision:'instant',origin:'monitor',resourceBranch:branch.branch,sourceUrl:branch.sourceUrl}],
}))};
for(const locale of ['en','ru']){
 test('public main hub navigation and live version dialog: '+locale,async({page,context,baseURL})=>{
  await context.addCookies([{name:'tof_locale',value:locale,url:baseURL!}]);
  await page.route('**/api/v1/version-status/tracker',route=>route.fulfill({json:tracker}));
  await page.goto('/');
  await expect(page.locator('[data-main-hub]')).toHaveCount(3);
  await expect(page.getByRole('main')).toBeVisible();
  for(const href of ['/info/','/tools/','/datamine/'])await expect(page.locator(`main a[href="${href}"]`).first()).toBeVisible();
  const trigger=page.getByRole('button',{name:/^Global Live/});
  await trigger.focus();await trigger.press('Enter');
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();await expect(dialog).toContainText('1.2.3');
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
 });
}
