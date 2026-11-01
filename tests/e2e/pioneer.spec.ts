import {test,expect} from '@playwright/test';

test('Pioneer is exclusive, restores its address, and shows synthetic builds and regional owners in EN/RU/mobile',async({page})=>{
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  const gear={id:'11111111-1111-4111-8111-111111111111',slot:'helmet',itemId:'helmet',stars:5,enhancement:0,titan:false,augmented:false,
    rareId:null,rareLevel:null,stats:[{type:'Physical Attack',value:1000}],statsBeforeTitan:null,augments:[],augmentCount:null,lastSeenAt:'2026-10-09T12:00:00Z'};
  const synthetic=(kind:'pioneer'|'global')=>({rank:kind==='pioneer'?1:2,synthetic:kind,score:kind==='pioneer'?60:65,maxScore:100,track:'Physical',
    player:{nickname:kind==='pioneer'?'Pioneer Best':'Global Best',uid:null,region:kind==='pioneer'?'PIONEER':'GLOBAL',serverId:null,combatScore:null,maxCombatScore:null},
    gear:[{...gear,ownerRegion:kind==='pioneer'?'AP':'TW',ownerNickname:kind==='pioneer'?'Phantom\u200b':'Global owner with a very long nickname 長いプレイヤー名',source:kind==='pioneer'?'pioneer':'global-reference',id:kind==='pioneer'?gear.id:'22222222-2222-4222-8222-222222222222'}],buildId:null,updatedAt:gear.lastSeenAt,...(kind==='global'?{comparisonDelta:5}:{})});
  await page.route('**/api/v1/ranking/**',route=>{
    const url=new URL(route.request().url()),pioneer=url.searchParams.get('dataset')==='pioneer';
    if(url.pathname.endsWith('/rank'))return route.fulfill({json:{available:true,rank:1}});
    if(url.pathname.endsWith('/ranks'))return route.fulfill({json:{available:true,ranks:{}}});
    const regional={...synthetic('global'),synthetic:'regional',rank:3,comparisonDelta:undefined,player:{...synthetic('global').player,nickname:'EU Best',region:'EU'},gear:[{...synthetic('global').gear[0],ownerRegion:'EU',ownerNickname:' EU  owner \u200b '}]};
    const real={...synthetic('global'),synthetic:undefined,player:{...synthetic('global').player,nickname:'Player\u200b',uid:'123456789',region:'EU'}};
    return route.fulfill({json:{available:true,entries:pioneer?[synthetic('pioneer'),synthetic('global'),regional]:[real],total:pioneer?3:1,overall:pioneer?3:1,databaseEmpty:false}});
  });
  await page.goto('/tools/ranking/?board=players&track=Physical&dataset=pioneer');
  const pioneer=page.getByRole('button',{name:'Pioneer',exact:true}),all=page.getByRole('button',{name:'All',exact:true}).first();
  await expect(pioneer).toHaveAttribute('aria-pressed','true');await expect(all).toHaveAttribute('aria-pressed','false');
  await expect(page.getByText('Pioneer Best',{exact:true})).toBeVisible();await expect(page.getByText('Global Best',{exact:true})).toBeVisible();
  await expect(page.getByText('Synthetic build',{exact:true})).toHaveCount(3);
  await expect(page.getByText(/RV pp vs Pioneer/)).toHaveCount(0);
  await expect(page.locator('.sim-sort-trigger')).toHaveCount(0);
  await page.getByRole('button',{name:'Show details',exact:true}).first().click();
  await expect(page.getByRole('button',{name:'Hide details',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'EU',exact:true}).click();
  await expect(page).toHaveURL(/region=EU/);await expect(page).not.toHaveURL(/dataset=/);
  await expect(page.getByText('Pioneer Best',{exact:true})).toHaveCount(0);
  await pioneer.click();await expect(page).toHaveURL(/dataset=pioneer/);await expect(page).not.toHaveURL(/region=/);
  await expect(page.getByText('Global Best',{exact:true})).toBeVisible();
  await page.reload();await expect(pioneer).toHaveAttribute('aria-pressed','true');
  await page.getByText('Global Best',{exact:true}).dblclick();
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe('Global Best');
  expect(await page.evaluate(()=>window.getSelection()?.toString())).toBe('Global Best');
  for(const name of ['Pioneer Best','Global Best','EU Best']){
    const row=page.getByRole('row').filter({has:page.getByText(name,{exact:true})});
    await row.getByRole('button',{name:'Show details',exact:true}).click();
    const rawOwner=name==='Pioneer Best'?'Phantom\u200b':name==='Global Best'?'Global owner with a very long nickname 長いプレイヤー名':' EU  owner \u200b ';
    const owner=name==='Pioneer Best'?'Phantomblank':name==='Global Best'?rawOwner:'blankEU owner blank';
    const ownerName=page.getByText(owner,{exact:true}).first();
    await expect(ownerName).toBeVisible();
    await ownerName.dblclick();
    await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(rawOwner);
    expect(await ownerName.evaluate(el=>{const selection=window.getSelection();return !!selection?.rangeCount&&selection.getRangeAt(0).toString()===el.textContent;})).toBe(true);
    await page.keyboard.press('Control+c');
    await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(rawOwner);
    if(name==='Pioneer Best'){
      await expect(ownerName.locator('[class*=blankName]')).toHaveCSS('font-style','italic');
      await expect(ownerName.locator('[class*=blankName]')).toHaveCSS('font-weight','500');
      await expect(ownerName.locator('[class*=blankName]')).toHaveCSS('color','rgb(147, 161, 182)');
    }
    const card=ownerName.locator('xpath=ancestor::div[contains(@class,"slotCard")]');
    expect(await ownerName.evaluate(el=>{const small=el.parentElement!,name=el.getBoundingClientRect(),column=small.getBoundingClientRect();return name.right<=column.right+.5;})).toBe(true);
    if(name==='Global Best')for(const width of [1440,1280,900,390]){
      await page.setViewportSize({width,height:844});
      expect(await ownerName.evaluate(el=>{
        const column=el.closest('small')!.parentElement!,score=column.nextElementSibling!;
        const bounds=column.getBoundingClientRect(),rating=score.getBoundingClientRect();
        return bounds.right<=rating.left&&getComputedStyle(column).overflow==='hidden'
          &&getComputedStyle(el).textOverflow==='ellipsis'&&el.scrollWidth>el.clientWidth;
      })).toBe(true);
    }
    await page.setViewportSize({width:1280,height:844});
    await row.getByRole('button',{name:'Hide details',exact:true}).focus();
    await card.focus();
    await expect(page.getByRole('tooltip').getByText(owner,{exact:true})).toBeVisible();
    if(name==='Pioneer Best')await expect(page.getByRole('tooltip').getByText(owner,{exact:true}).locator('[class*=blankName]')).toHaveCSS('color','rgb(147, 161, 182)');
    const region=name==='Pioneer Best'?'AP':name==='Global Best'?'TW':'EU';
    await expect(page.getByRole('tooltip').locator(`[data-region="${region}"]`)).toHaveText(region);
    await expect(page.getByRole('tooltip').locator(`[data-region="${region}"]`)).toHaveCSS('color',region==='AP'?'rgb(168, 85, 247)':region==='TW'?'rgb(236, 72, 153)':'rgb(245, 158, 11)');
    await row.getByRole('button',{name:'Hide details',exact:true}).focus();
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
  await page.locator('[data-datamine-language="ru"]').click();
  await expect(page.getByText('Синтетический комплект',{exact:true})).toHaveCount(3);
  await expect(page.getByText(/п.п. RV к Pioneer/)).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Все',exact:true}).first().click();
  await expect(page).not.toHaveURL(/dataset=/);await expect(page.getByText('Pioneer Best',{exact:true})).toHaveCount(0);
  const nickname=page.getByText('Playerblank',{exact:true});
  await nickname.hover();
  await expect(page.getByRole('tooltip').getByText('UID: 123456789',{exact:true})).toBeVisible();
  await nickname.dblclick();
  await expect(page.getByRole('tooltip').getByText('Ник скопирован',{exact:true})).toBeVisible();
  await expect(page.getByRole('tooltip').getByText('UID: 123456789',{exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>window.getSelection()?.toString())).toBe('Playerblank');
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe('Player\u200b');
  await expect(page.getByRole('tooltip').getByText('UID: 123456789',{exact:true})).toBeVisible();
});
