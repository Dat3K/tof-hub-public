import {test,expect,type Page} from '@playwright/test';
import {fullMmoCapture as capture} from '../../apps/web/src/features/build/mmo/__fixtures__/capture';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {compareSimulacraRelease} from '../../apps/web/src/features/info-sections/common/catalog-release-order';
test.setTimeout(120000);

async function importedCard(page:Page) {
  await page.addInitScript(data=>{
    if(sessionStorage.getItem('mmo-editor-seeded'))return;
    sessionStorage.setItem('mmo-editor-seeded','1');
    sessionStorage.setItem('tof-hub:build-import-handoff',JSON.stringify({data,source:{digest:'a'.repeat(64),signature:'b'.repeat(64)}}));
  },capture);
  await page.route('**/api/v1/build/mmo-profiles/*',route=>route.fulfill({json:{available:true,profiles:[]}}));
  await page.goto('/tools/build/mmo/',{waitUntil:'domcontentloaded',timeout:120000});
  await expect(page.locator('[data-mmo-card] .player')).toContainText('kritik',{timeout:60000});
  await expect(page.locator('[data-mmo-card] .demo-cta')).toHaveCount(0);
}

for(const locale of ['en','ru'] as const)test(`MMO weapon picker follows the complete Info roster (${locale})`,async({page,context})=>{
  await context.addCookies([{name:'tof_locale',value:locale,url:new URL(test.info().project.use.baseURL as string).origin}]);
  if(locale==='ru')await page.setViewportSize({width:844,height:390});
  const reference=JSON.parse(readFileSync(resolve('apps/web/public/game-data/en/runtime/simulacra.json'),'utf8'));
  const expected=[...reference.mmo].sort((a,b)=>compareSimulacraRelease(a,b,true)).map(item=>item.id);
  await importedCard(page);
  await page.getByRole('checkbox',{name:locale==='ru'?'Заблокировать редактирование':'Lock editing',exact:true}).uncheck();
  const trigger=page.locator('[data-mmo-card] [data-build-edit="weapon:0"] button.inspect-trigger').first();
  await trigger.focus();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('[data-id]')).toHaveCount(expected.length);
  expect(await dialog.locator('[data-id]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-id')))).toEqual(expected);
  await dialog.getByRole('textbox').first().fill('no-matching-weapon');
  await expect(dialog.locator('[data-id]')).toHaveCount(0);
  await dialog.getByRole('textbox').first().fill('');
  await expect(dialog.locator('[data-id]')).toHaveCount(expected.length);
  await dialog.locator('[data-id]').first().focus();await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-hub:build-mmo-draft')||'{}').weapons?.[0]?.id)).toBe(expected[0]);
});

for(const locale of ['en','ru'] as const)test(`MMO Smart Servant picker shows portraits and filters by element (${locale})`,async({page,context})=>{
  await context.addCookies([{name:'tof_locale',value:locale,url:new URL(test.info().project.use.baseURL as string).origin}]);
  if(locale==='ru')await page.setViewportSize({width:844,height:390});
  const {pets}=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-mmo-page.json'),'utf8'));
  await importedCard(page);
  await page.getByRole('checkbox',{name:locale==='ru'?'Заблокировать редактирование':'Lock editing',exact:true}).uncheck();
  await page.locator('[data-mmo-card] h3[data-build-edit="pet"]').focus();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('[data-id]')).toHaveCount(pets.length);
  for(const pet of pets){
    const card=dialog.locator(`[data-id="${pet.id}"]`),art=card.locator('.tool-picker-card-art img');
    await expect(art).toHaveAttribute('src',pet.portrait||pet.icon);
    await expect.poll(()=>art.evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0)).toBe(true);
    await expect(card.locator('.tool-picker-card-badges [data-variant="altered"]')).toHaveText(/\S/);
  }
  const filters=dialog.locator('details');
  if(!await filters.evaluate(node=>node.hasAttribute('open')))await filters.locator('summary').click();
  await filters.locator('[data-val="Altered"]').click();
  await expect(dialog.locator('[data-id]')).toHaveCount(pets.length);
  await filters.locator('[data-val="Altered"]').click();
  await filters.locator('[data-val="Flame"]').click();
  await expect(dialog.locator('[data-id]')).toHaveCount(0);
  await filters.locator('[data-val="all"]').click();
  await expect(dialog.locator('[data-id]')).toHaveCount(pets.length);
  await page.screenshot({path:`ignore/documentation-media/generated/mmo-pet-picker-${locale}.png`,animations:'disabled'});
  await dialog.locator('[data-id]').first().focus();await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-hub:build-mmo-draft')||'{}').pet?.id)).toBe(pets[0].id);
});

test('MMO demo has the shared import guide and the third rail action explains verification',async({page})=>{
  await page.goto('/tools/build/mmo/',{waitUntil:'domcontentloaded',timeout:120000});
  const card=page.locator('[data-mmo-card]');
  await expect(card).toBeVisible({timeout:60000});
  await expect(card.locator('.demo-cta')).toContainText('Demo profile preview');
  await card.getByRole('button',{name:'Import your build',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toContainText('Capture');
  await page.keyboard.press('Escape');
  await expect(card.getByRole('button',{name:'Import your build',exact:true})).toBeFocused();
  const fields=page.getByRole('navigation',{name:'MMO build card help'}).getByRole('button').nth(2);
  await expect(fields).toHaveAttribute('aria-label','What you can edit');
  await fields.click();await expect(page.getByRole('dialog')).toContainText('Stays Verified');
  await expect(page.getByRole('dialog')).toContainText('Build role');
  await page.keyboard.press('Escape');
  await expect(card.locator('[data-level="1"]').first()).toBeVisible();
  await card.getByRole('button',{name:'MMO season',exact:true}).click();
  await page.getByRole('option',{name:'Season 1',exact:true}).click();
  await expect(card.getByRole('button',{name:'MMO season',exact:true})).toContainText('Season 1');
  const weapon=card.locator('.weapon').first();
  const layout=await weapon.evaluate(node=>{
    const box=node.getBoundingClientRect(),progress=node.querySelector('[role="progressbar"]')!.getBoundingClientRect();
    const score=node.lastElementChild!.getBoundingClientRect();
    return {bottomGap:(box.bottom-score.bottom)/box.height,center:((progress.top+progress.bottom)/2-box.top)/box.height};
  });
  expect(layout.bottomGap).toBeLessThan(.15);expect(layout.center).toBeGreaterThan(.35);expect(layout.center).toBeLessThan(.7);
  await card.locator('[data-build-edit="stat:DefenseIntensityMMO"]').hover();
  await expect(weapon.locator('[data-stat-match="true"]')).toHaveCount(0);
  await expect.poll(()=>weapon.locator('.weapon-art').evaluate(node=>Number(getComputedStyle(node).opacity))).toBeLessThan(1);
  await page.getByRole('button',{name:'Export PNG',exact:true}).hover();
  await page.screenshot({path:'ignore/documentation-media/generated/mmo-editor-demo-en.png',animations:'disabled'});
});

for(const locale of ['en','ru'] as const)test(`MMO footer shows the known roll quality (${locale})`,async({page,context})=>{
  await context.addCookies([{name:'tof_locale',value:locale,url:new URL(test.info().project.use.baseURL as string).origin}]);
  if(locale==='ru')await page.setViewportSize({width:844,height:390});
  const catalog=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-mmo-page.json'),'utf8'));
  const item=catalog.gear.find((gear:{slot:string;pool:string;quality:string})=>gear.slot==='helmet'&&catalog.pools[gear.pool]?.filter((prop:string)=>{
    const range=catalog.randomStats[prop]?.ranges[gear.quality];return range&&range.max>range.min;
  }).length>=3);
  const rolls=catalog.pools[item.pool].filter((prop:string)=>{
    const range=catalog.randomStats[prop]?.ranges[item.quality];return range&&range.max>range.min;
  }).slice(0,3).map((prop:string)=>{const range=catalog.randomStats[prop].ranges[item.quality];return {prop,value:(range.min+range.max)/2};});
  await importedCard(page);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-hub:build-mmo-draft')||'{}').profile?.name??'')).toContain('kritik');
  // Seed after the old page flushes its draft on pagehide.
  await page.addInitScript(({item,rolls})=>{
    const draft=JSON.parse(localStorage.getItem('tof-hub:build-mmo-draft')!);
    draft.gear={helmet:{itemId:item.id,rolls,card:null}};
    localStorage.setItem('tof-hub:build-mmo-draft',JSON.stringify(draft));
  },{item,rolls});
  await page.reload({waitUntil:'domcontentloaded'});
  const card=page.locator('[data-mmo-card]');
  for(const roll of rolls){
    const total=card.locator(`.gear-stat-total[data-attribute="${catalog.randomStats[roll.prop].attribute}"]`);
    await expect(total.locator('[data-roll-quality]')).toContainText('50');
    await expect(total.locator('.gear-stat-rolls')).toContainText('×1');
  }
  await card.locator('.gear-stat-total').first().focus();
  await expect(card.locator('.gear-stat-total').first()).toBeFocused();
  await card.locator('footer.footer').screenshot({path:`ignore/documentation-media/generated/mmo-footer-quality-${locale}.png`,animations:'disabled'});
});

test('MMO card catalogs, advancement, slot expansion, stats, undo and advanced form share the draft',async({page})=>{
  test.setTimeout(120000);
  await importedCard(page);
  const card=page.locator('[data-mmo-card]');
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
  await expect(page.getByRole('checkbox',{name:'Advanced editor',exact:true})).not.toBeChecked();
  const stars=card.locator('[data-build-edit="weapon-stars:0"]').first();
  await stars.focus();await page.keyboard.press('Enter');
  await page.getByRole('dialog').getByRole('button',{name:'+7',exact:true}).click();
  await expect(stars).toHaveText('+7');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(stars).toHaveText('+15');
  await card.locator('[data-build-edit="gear:visor"] button.inspect-trigger').first().click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Item',exact:true}).click();
  await expect(dialog.getByRole('textbox').first()).toBeVisible();
  await dialog.getByRole('textbox').first().fill('no-matching-equipment');await expect(dialog).toContainText('No results');
  await dialog.getByRole('textbox').first().fill('');
  const choice=dialog.locator('[data-id="S2_T2_Glisten_visor_def"]');
  await choice.click();
  await dialog.getByRole('spinbutton',{name:'Card stars',exact:true}).fill('2');
  await page.keyboard.press('Escape');
  await expect(card.locator('[data-build-edit="card:visor"]')).toContainText('★2');
  await card.locator('[data-build-edit="stat:MaxHP"]').click();
  await page.getByRole('dialog').getByRole('spinbutton').fill('123456');await page.keyboard.press('Escape');
  await expect(card.locator('[data-build-edit="stat:MaxHP"]')).toContainText('123');
  await card.locator('h3[data-build-edit="pet"]').click();
  await dialog.locator('[data-id="FightPet_13"]').click();
  await card.locator('[data-build-edit="pet-details"]').first().click();
  await dialog.getByRole('spinbutton',{name:'Stars',exact:true}).fill('1');
  await dialog.getByRole('button',{name:'Module 1',exact:true}).click();
  await expect(dialog.locator('[data-id="SkillModule_ssr_1_1"]')).toContainText('Crimson: Ignite I');
  await dialog.locator('[data-id="SkillModule_ssr_1_1"]').click();
  await page.keyboard.press('Escape');
  await expect(card.locator('[data-build-edit="pet-module:0"] img').first()).toBeVisible();
  await page.getByRole('checkbox',{name:'Advanced editor',exact:true}).check();
  await expect(page.getByRole('region',{name:'MMO build editor'})).toBeVisible();
  await page.getByRole('textbox',{name:'Name',exact:true}).fill('MMO edited');
  await expect(card.locator('.player')).toHaveText('MMO edited');
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
  await expect(page.getByRole('region',{name:'MMO build editor'})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-hub:build-mmo-draft')||'{}').profile?.name)).toBe('MMO edited');
  await page.reload({waitUntil:'domcontentloaded'});await expect(card.locator('.player')).toHaveText('MMO edited');
  await expect(card.locator('[data-build-edit="card:visor"]')).toContainText('★2');
  await expect(card.locator('[data-build-edit="pet-module:0"] img').first()).toBeVisible();
  await page.screenshot({path:'ignore/documentation-media/generated/mmo-editor-en.png',animations:'disabled'});
});

test('MMO RU landscape supports empty-slot selection and keyboard dialogs without page overflow',async({page,context})=>{
  await context.addCookies([{name:'tof_locale',value:'ru',url:new URL(test.info().project.use.baseURL as string||'http://localhost:3000').origin}]);
  await page.setViewportSize({width:844,height:390});
  await importedCard(page);
  await page.getByRole('checkbox',{name:'Заблокировать редактирование',exact:true}).uncheck();
  await page.locator('[data-mmo-card] [data-build-edit="card:visor"]').focus();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog');await expect(dialog.getByRole('textbox').first()).toBeVisible();
  await expect(dialog).toContainText('Карта расширения');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await dialog.getByRole('button',{name:'Убрать',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.locator('[data-mmo-card] [data-build-edit="card:visor"]').focus();await page.keyboard.press('Enter');
  const choice=dialog.locator('[data-id="orange_Skill_15"]');
  await choice.focus();
  await page.screenshot({path:'ignore/documentation-media/generated/mmo-editor-ru-mobile.png',animations:'disabled'});
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('spinbutton',{name:'Звёзды карты',exact:true})).toHaveValue('0');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-mmo-card] [data-build-edit="card:visor"]')).toBeFocused();
});
