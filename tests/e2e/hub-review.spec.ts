import {test, expect} from '@playwright/test';
import fs from 'node:fs';
const seed = JSON.parse(fs.readFileSync('apps/web/public/game-data/version-tracker.json','utf8'));
// Synthetic monitor observations keep these tests independent of local monitor history.
const fixture = {...seed, branches: seed.branches.map((branch:any) => ({...branch,
 version:'1.0.0', changedAt:'2026-10-16T12:30:00Z',
 history:[{id:'fixture-'+branch.id,version:'1.0.0',observedAt:'2026-10-16T12:30:00Z',precision:'instant',origin:'monitor',resourceBranch:branch.branch,sourceUrl:branch.sourceUrl}],
}))};
test('versions do not flash archived rows or empty placeholders while the first request is pending', async ({page}) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => release = resolve);
  await page.route('**/api/v1/version-status/tracker', async route => {await held; await route.fulfill({json:{...fixture,mode:'live'}});});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const tracker = page.getByRole('region',{name:'Game versions'});
  await expect(tracker.getByRole('status')).toContainText('Loading versions');
  await expect(tracker.getByRole('button')).toHaveCount(0);
  await expect(tracker).not.toContainText('5.2.54');
  await expect(tracker).not.toContainText('No observations yet');
  release();
  await expect(tracker.getByRole('button',{name:/^Global Live/})).toBeVisible();
  await expect(tracker).not.toContainText('No observations yet');
});
test('sub-day observations display minutes or hours rather than Today',async({page})=>{
  await page.clock.install({time:new Date('2026-10-16T14:30:00Z')});
  const data=structuredClone(fixture); const branch=data.branches.find((branch:any)=>branch.id==='live-global');
  branch.changedAt='2026-10-16T12:30:00Z';branch.history=[{id:'hours',version:branch.version,observedAt:branch.changedAt,precision:'instant',origin:'monitor'}];
  await page.route('**/api/v1/version-status/tracker',route=>route.fulfill({json:{...data,mode:'live'}}));
  await page.goto('/');await expect(page.getByRole('button',{name:/^Global Live/})).toContainText('2 hours ago');
});
for(const locale of ['en','ru']){
 test(`MMO Bosses renders every generated season and the regular Devourer card: ${locale}`,async({page,context,baseURL})=>{
  await context.addCookies([{name:'tof_locale',value:locale,url:baseURL!}]);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/datamine/fce/?mode=mmo#chaos-armor');
  const cards=JSON.parse(fs.readFileSync('apps/web/public/game-data/fce-cards.json','utf8')).mmo as {season:number}[];
  const seasons=[...new Set(cards.map(boss=>boss.season))];
  expect(seasons).toEqual(expect.arrayContaining([1,2]));
  await expect(page.locator('[data-season]')).toHaveCount(seasons.length);
  for(const season of seasons) {
    await expect(page.locator(`[data-season="${season}"] button`)).toHaveCount(cards.filter(boss=>boss.season===season).length);
  }
  await expect(page.locator('[data-season="0"]')).toHaveCount(0);
  const firstBoss=page.locator('[data-season="1"] button').first();
  await firstBoss.click();
  await expect(firstBoss).toHaveAttribute('aria-pressed','true');
  await page.goto('/datamine/fce/#devourer');
  await expect(page.locator('main')).toContainText(locale==='ru'?'10 попаданий':'10 instances');
  expect(errors).toEqual([]);
 });
 test(`Gold MMO food has its own filter and detail colour: ${locale}`,async({page,context,baseURL})=>{
  await context.addCookies([{name:'tof_locale',value:locale,url:baseURL!}]);
  await page.goto('/info/food/?server=mmo&rarity=GOLD');
  const cards=page.locator('[data-dish-id]'); await expect(cards.first()).toBeVisible();
  for(const card of await cards.all())await expect(card).toContainText(locale==='ru'?'Золото':'Gold');
  await cards.first().click();await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(locale==='ru'?'Золото':'Gold');
 });
}
test('MMO S4 floor buffs match the game screenshots',async({page})=>{
 await page.goto('/datamine/oow/?mode=mmo&s=4&floor=3');
 await page.getByRole('button',{name:'All Floors',exact:true}).click();
 const floor=page.locator('#oow-floor-4-3');await expect(floor).toBeVisible();
 await expect(floor).toContainText('Judgment Lv. 1');await expect(floor).toContainText('160%');
 await expect(page.locator('main')).toContainText('03.08');
});

test('Datamine hub includes Devourer as its last boss preview',async({page})=>{
  await page.goto('/datamine/');
  const chip=page.locator('a[title="Devourer"]').last();
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute('href',/\/datamine\/fce\/(?:#devourer|\?boss=devourer)$/);
  await chip.click();
  await expect(page.locator('main')).toContainText('Devourer');
});
