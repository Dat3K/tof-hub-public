import {test,expect} from '@playwright/test';

for(const locale of ['en','ru'] as const)for(const loaded of [false,true])test(`Ranking Me ${locale}: owner ${loaded?'already loaded':'outside the first page'}`,async({page,context,baseURL})=>{
  if(locale==='ru')await page.setViewportSize({width:390,height:844});
  await context.addCookies([{name:'tof_locale',value:locale,url:baseURL!}]);
  const uid='1302104471';let ownerRequests=0;
  await page.addInitScript(({uid})=>localStorage.setItem('tof-build-draft-v1',JSON.stringify({
    captureSource:{kind:'file',capture:{capture:{subject:{uid}},profile:{name:'My owner'}}},
  })),{uid});
  const gear={id:'owner-piece',slot:'helmet',itemId:'helmet',stars:5,enhancement:80,titan:true,augmented:true,rareId:null,rareLevel:null,
    source:'self',stats:[{type:'Physical Attack',value:1000}],statsBeforeTitan:[800],augments:[],lastSeenAt:'2026-10-18T00:00:00Z'};
  const owner={rank:347,score:80,maxScore:100,track:'Physical',player:{uid,nickname:'My owner',region:'EU',serverId:'13021'},
    gear:[gear],buildId:null,updatedAt:gear.lastSeenAt};
  await page.route('**/api/v1/ranking/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith('/gear/ranks'))return route.fulfill({json:{available:true,ranks:{'owner-piece':7}}});
    if(url.pathname.endsWith('/rank'))return route.fulfill({json:{available:true,rank:300}});
    if(url.searchParams.get('q')===uid){
      ownerRequests++;
      expect(url.searchParams.get('track')).toBe('Physical');expect(url.searchParams.get('region')).toBe('EU');
      return route.fulfill({json:{available:true,total:1,entries:[owner]}});
    }
    return route.fulfill({json:{available:true,total:loaded?2:1,overall:400,entries:[
      {...owner,rank:1,player:{...owner.player,uid:'1302100000',nickname:'Top player'}},...(loaded?[owner]:[]),
    ]}});
  });
  await page.goto('/tools/ranking/?track=Physical&region=EU');
  await expect(page.getByText('Top player',{exact:true})).toBeVisible();
  const me=page.getByRole('button',{name:locale==='ru'?'Я':'Me',exact:true});
  await expect(me.locator('svg')).toHaveCount(1);
  await expect(me).toHaveAttribute('aria-pressed','false');
  await me.focus();await page.keyboard.press('Enter');
  const row=page.locator('[role="row"][data-me]');
  await expect(row).toHaveCount(1);await expect(row).toContainText('347');await expect(row).toContainText('My owner');
  await expect(row).toBeFocused();
  await expect(page.getByText('My owner',{exact:true})).toHaveCount(1);
  await row.getByRole('button',{name:locale==='ru'?'Показать детали':'Show details',exact:true}).click();
  const details=page.locator(loaded?'#player-top-347':'#player-top-me-347');
  await expect(details).toBeVisible();
  await expect(details).toHaveAttribute('data-me','true');
  await expect(details.locator('[class*="slotCard"]').first()).toBeVisible();
  await expect.poll(()=>details.evaluate(node=>node.closest<HTMLElement>('.tof-collapsible')?.style.height)).toBe('auto');
  await expect(me).toHaveAttribute('aria-pressed','true');
  if(locale==='en'&&!loaded)await page.screenshot({path:'ignore/documentation-media/generated/ranking-me-expanded.png'});
  expect(ownerRequests).toBe(loaded?0:1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await me.click();
  await expect(me).toHaveAttribute('aria-pressed','false');await expect(row).toHaveCount(0);
  await expect(page.getByText('My owner',{exact:true})).toHaveCount(loaded?1:0);
  await me.click();await expect(me).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('My owner',{exact:true})).toHaveCount(1);
  // A changed element creates another board; no stale personal rank is retained.
  await page.getByRole('radio',{name:locale==='ru'?'Танк':'Tank',exact:true}).click();
  await expect(row).toHaveCount(0);
});

test('Ranking has no Me button without an imported identity',async({page})=>{
  await page.route('**/api/v1/ranking/players?**',route=>route.fulfill({json:{available:true,entries:[],total:0,overall:0,databaseEmpty:true}}));
  await page.goto('/tools/ranking/');
  await expect(page.getByRole('button',{name:'Me',exact:true})).toHaveCount(0);
});

for(const reducedMotion of ['no-preference','reduce'] as const)test(`Me scrolls through intermediate positions (${reducedMotion})`,async({page})=>{
  await page.emulateMedia({reducedMotion});
  const uid='1302104471';
  await page.addInitScript(({uid})=>localStorage.setItem('tof-build-draft-v1',JSON.stringify({captureSource:{kind:'file',capture:{capture:{subject:{uid}},profile:{name:'Owner'}}}})),{uid});
  await page.route('**/api/v1/ranking/players?**',route=>route.fulfill({json:{available:true,total:100,overall:100,entries:Array.from({length:100},(_,index)=>({
    rank:index+1,score:80,maxScore:100,track:'Physical',player:{uid:index===79?uid:String(1302100000+index),nickname:index===79?'Owner':`Player ${index}`,region:'EU',serverId:'13021'},
    gear:[],buildId:null,updatedAt:'2026-10-18T00:00:00Z',
  }))}}));
  await page.goto('/tools/ranking/?track=Physical');
  await expect(page.getByText('Owner',{exact:true})).toHaveCount(1);
  await page.evaluate(()=>{
    const samples:number[]=[];(window as unknown as {meScrollSamples:number[]}).meScrollSamples=samples;
    const end=performance.now()+1500;
    const sample=()=>{samples.push(scrollY);if(performance.now()<end)requestAnimationFrame(sample);};requestAnimationFrame(sample);
  });
  await page.getByRole('button',{name:'Me',exact:true}).click();
  await expect(page.locator('[data-me]')).toBeInViewport();
  await expect.poll(()=>page.locator('[data-me]').evaluate(node=>{
    const rect=node.getBoundingClientRect(),header=document.querySelector('[data-site-header]')!.getBoundingClientRect().bottom;
    return Math.abs(rect.top+rect.height/2-(header+innerHeight)/2);
  })).toBeLessThan(3);
  await expect.poll(()=>page.evaluate(()=>{
    const samples=(window as unknown as {meScrollSamples:number[]}).meScrollSamples;
    const maximum=Math.max(...samples),minimum=Math.min(...samples);
    return maximum-minimum>500&&samples.filter(value=>value>minimum+10&&value<maximum-10).length>=4;
  })).toBe(true);
});

test('Me stays pinned when pagination reaches rank 275 without resetting the scroll position',async({page})=>{
  const uid='1302104471';let pendingThird=false,releaseThird=()=>{};
  const thirdGate=new Promise<void>(resolve=>{releaseThird=resolve;});
  await page.addInitScript(({uid})=>localStorage.setItem('tof-build-draft-v1',JSON.stringify({captureSource:{kind:'file',capture:{capture:{subject:{uid}},profile:{name:'Owner'}}}})),{uid});
  const entry=(index:number)=>({rank:index+1,score:80,maxScore:100,track:'Physical',player:{uid:index===274?uid:String(1302100000+index),nickname:index===274?'Owner':`Player ${index}`,region:'EU',serverId:'13021'},gear:[],buildId:null,updatedAt:'2026-10-18T00:00:00Z'});
  await page.route('**/api/v1/ranking/players?**',async route=>{
    const url=new URL(route.request().url()),offset=Number(url.searchParams.get('offset')??0);
    if(url.searchParams.get('q')===uid)return route.fulfill({json:{available:true,total:1,overall:350,entries:[entry(274)]}});
    if(offset===200){pendingThird=true;await thirdGate;}
    return route.fulfill({json:{available:true,total:350,overall:350,entries:Array.from({length:Math.min(100,350-offset)},(_,index)=>entry(offset+index))}});
  });
  await page.goto('/tools/ranking/?track=Physical');
  await page.getByRole('button',{name:'Me',exact:true}).click();
  await expect(page.getByText('Owner',{exact:true})).toHaveCount(1);
  await page.getByText('Player 85',{exact:true}).scrollIntoViewIfNeeded();
  await expect(page.getByText('Player 185',{exact:true})).toHaveCount(1);
  const anchor=page.getByText('Player 185',{exact:true});
  await anchor.scrollIntoViewIfNeeded();await expect.poll(()=>pendingThird).toBe(true);
  const before=await anchor.evaluate(node=>node.getBoundingClientRect().top);
  releaseThird();
  await expect(page.getByText('Player 285',{exact:true})).toHaveCount(1);
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(5000);
  expect(Math.abs(await anchor.evaluate(node=>node.getBoundingClientRect().top)-before)).toBeLessThan(3);
  await expect(page.getByText('Owner',{exact:true})).toHaveCount(2);
  await expect(page.locator('[role="table"]>[data-me]').first().getByRole('cell').first()).toHaveText('275');
  await expect(page.locator('[role="table"]>[role="row"]').nth(1)).toHaveAttribute('data-me','true');
  const pinned=page.locator('[aria-controls="player-top-me-275"]'),natural=page.locator('[aria-controls="player-top-275"]');
  await natural.click();await expect(natural).toHaveAttribute('aria-expanded','true');await expect(pinned).toHaveAttribute('aria-expanded','false');
  await natural.click();
  const me=page.getByRole('button',{name:'Me',exact:true});
  await me.click();await expect(me).toHaveAttribute('aria-pressed','false');
  await me.click();await expect(page.locator('[data-me]')).toBeInViewport();
  await expect.poll(()=>page.locator('[data-me]').evaluate(node=>{
    const rect=node.getBoundingClientRect(),header=document.querySelector('[data-site-header]')!.getBoundingClientRect().bottom;
    return Math.abs(rect.top+rect.height/2-(header+innerHeight)/2);
  })).toBeLessThan(3);
});
