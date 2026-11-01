import {test,expect} from '@playwright/test';

test('test server observations do not display tester badges in EN desktop and RU mobile rankings',async({page})=>{
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  const nickname='  Marked player\u200b';
  const entry={rank:1,score:70,maxScore:80,track:'Physical',buildId:null,updatedAt:'2026-10-10T12:00:00Z',gear:[],
    player:{nickname,uid:'1302104471',region:'EU',serverId:null,combatScore:123,maxCombatScore:null,testServers:[
      {distribution:'global-pioneer',firstSeenAt:'2026-10-01T12:00:00Z',lastSeenAt:'2026-10-10T12:00:00Z'},
      {distribution:'korea-dev',firstSeenAt:'2026-10-05T12:00:00Z',lastSeenAt:'2026-10-09T12:00:00Z'},
      {distribution:'taiwan-dev',firstSeenAt:null,lastSeenAt:null},
    ]}};
  await page.route('**/api/v1/ranking/players?**',route=>route.fulfill({json:{available:true,total:1,overall:1,databaseEmpty:false,entries:[entry]}}));
  await page.goto('/tools/ranking/?board=players&track=Physical');
  const badge=page.getByRole('button',{name:'Seen on a test server',exact:true});
  const name=page.getByRole('table',{name:'Players',exact:true}).getByRole('row').nth(1).getByRole('cell').nth(2).locator('b').first();
  await expect(name).toBeVisible();await expect(badge).toHaveCount(0);
  await name.dblclick();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(nickname);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
  await page.locator('[data-datamine-language="ru"]').click();
  await expect(page.getByRole('table',{name:'Игроки',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Замечен на тестовом сервере',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
