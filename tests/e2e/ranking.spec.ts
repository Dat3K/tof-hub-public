import {test,expect,type Locator} from '@playwright/test';

for(const locale of ['en','ru'] as const) {
  test(`own-profile Verified player keeps inspected best gear (${locale})`,async({page})=>{
    const gear={id:'inspected-winner',slot:'helmet',itemId:'helmet',stars:5,enhancement:80,titan:true,augmented:true,
      rareId:null,rareLevel:null,source:'inspect',stats:[{type:'Frost Attack',value:500}],statsBeforeTitan:null,augments:[],lastSeenAt:'2026-10-25T00:00:00Z'};
    const entries=[true,false].map((verified,index)=>({verified,rank:index+17,score:70-index,maxScore:80,track:'Frost',buildId:null,
      updatedAt:gear.lastSeenAt,player:{nickname:index?'Inspect only':'Own profile',uid:String(index+1),region:'EU',serverId:null},gear:[gear]}));
    await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:true,total:2,overall:2,databaseEmpty:false,entries}}));
    await page.goto('/tools/ranking/?track=Frost&verified=1');
    if(locale==='ru') {
      await page.setViewportSize({width:390,height:844});
      await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
      await page.locator('[data-datamine-language="ru"]').click();
    }
    await expect(page.getByText('Own profile',{exact:true})).toBeVisible();
    await expect(page.getByText('Inspect only',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('img',{name:locale==='en'?'Verified. Imported capture':/Импорт/}).first()).toBeVisible();
    await page.getByRole('checkbox').first().uncheck();
    await expect(page.getByText('Inspect only',{exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
import {readFileSync} from 'node:fs';
import {getBuildStatMaximum,getBuildTitanProjection} from '../../packages/game-domain/src/build/stats';
import type {BuildCatalog} from '../../apps/web/src/features/build/types';

for(const [track,winner,other] of [['Physical-Flame','Flame','Physical'],['Volt-Frost','Frost','Volt']]){
  test(`duo ATK chip follows counted ${winner} contribution on ${track}`,async({page})=>{
    const gear={id:'00000000-0000-4000-8000-000000000001',slot:'helmet',itemId:'helmet',stars:5,enhancement:0,titan:true,augmented:true,
      rareId:null,rareLevel:null,stats:[{type:'Attack',value:5006},{type:`${other} Attack`,value:1880},{type:`${winner} Attack`,value:12336}],
      statsBeforeTitan:null,augments:[],lastSeenAt:'2026-10-18T00:00:00Z',source:'inspect',augmentCount:null};
    await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:route.request().url().includes('/players?')
      ?{available:true,total:1,overall:1,databaseEmpty:false,entries:[{rank:1,score:80,maxScore:100,track,player:{nickname:'Duo icon fixture',uid:'1300506653',region:'EU',serverId:'13005',combatScore:null,maxCombatScore:null},buildId:null,updatedAt:gear.lastSeenAt,gear:[gear]}]}
      :{available:true,ranks:{}}}));
    await page.goto(`/tools/ranking/?track=${track}`);
    const row=page.getByRole('row').filter({has:page.getByText('Duo icon fixture',{exact:true})});
    await row.getByRole('button',{name:'Show details',exact:true}).click();
    const chip=page.locator('[class*="statTotals"]').getByLabel(`${winner} ATK 17,342`,{exact:true});
    await expect(chip).toBeVisible();
    await chip.focus();
    const tooltip=page.getByRole('tooltip');
    await expect(tooltip.getByText(`${winner} ATK`,{exact:true}).first()).toBeVisible();
    await expect(tooltip.getByText('12,336',{exact:true})).toBeVisible();
    await expect(tooltip.getByText('5,006',{exact:true})).toBeVisible();
  });
}

test('opens Players first by default and preserves explicit Gear links in EN/RU and on mobile',async({page})=>{
  await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:true,total:0,overall:0,databaseEmpty:false,entries:[]}}));
  await page.goto('/tools/ranking/');
  await expect(page.getByRole('radio',{name:/^(Players|Gear)$/})).toHaveText(['Players','Gear']);
  await expect(page.getByRole('radio',{name:'Players',exact:true})).toHaveAttribute('aria-checked','true');
  await page.getByRole('radio',{name:'Gear',exact:true}).focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/board=gear/);
  await page.reload();
  await expect(page.getByRole('radio',{name:'Gear',exact:true})).toHaveAttribute('aria-checked','true');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
  await page.locator('[data-datamine-language="ru"]').click();
  await page.getByRole('radio',{name:'Игроки',exact:true}).click();
  await expect(page.getByRole('radio',{name:'Игроки',exact:true})).toHaveAttribute('aria-checked','true');
  expect(new URL(page.url()).searchParams.has('board')).toBe(false);
  await page.reload();
  await expect(page.getByRole('radio',{name:'Игроки',exact:true})).toHaveAttribute('aria-checked','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('nickname blank labels preserve ordinary spaces and copy raw leading invisible characters',async({page})=>{
  const raw=' \u200bChef Ars';
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as Window&{copiedNickname?:string}).copiedNickname=text;}}}));
  const gear={id:'blank-name',slot:'helmet',itemId:'helmet',stars:5,enhancement:80,titan:true,augmented:true,rareId:null,rareLevel:null,
    source:'self',stats:[{type:'Frost Attack',value:500}],statsBeforeTitan:[400],augments:[],augmentCount:100,lastSeenAt:'2026-10-08T00:00:00Z'};
  const entries=[raw,'Chef Ars','Player❤️','\u00a0\u3164'].map((nickname,i)=>({rank:i+1,score:70,maxScore:80,track:'Frost',
    player:{nickname,uid:String(i+1),region:'EU',serverId:null},gear:{...gear,id:`blank-name-${i}`}}));
  await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:true,total:4,overall:4,databaseEmpty:false,entries}}));
  await page.goto('/tools/ranking/?board=gear&track=Frost&slot=helmet');
  const table=page.getByRole('table',{name:'Gear',exact:true});
  const name=table.getByText('blankChef Ars',{exact:true});
  await expect(name.locator('span')).toHaveCSS('font-style','italic');
  await expect(table.getByText('Chef Ars',{exact:true})).toBeVisible();
  await expect(table.getByText('Player❤️',{exact:true})).toBeVisible();
  await expect(table.getByText('blank',{exact:true})).toHaveCount(2);
  await expect(table.getByText('blank',{exact:true}).last()).toBeVisible();
  await name.dblclick();
  expect(await page.evaluate(()=>(window as Window&{copiedNickname?:string}).copiedNickname)).toBe(raw);
  expect(await page.evaluate(()=>getSelection()?.toString())).toBe('blankChef Ars');
  await expect(page.getByRole('tooltip').filter({hasText:'Nickname copied'})).toBeVisible();
});

test('tank comparison shows less damage taken in green and worse gear in red',async({page})=>{
  const gear={id:'reference',slot:'helmet',itemId:'helmet',stars:5,enhancement:80,titan:true,augmented:true,rareId:null,rareLevel:null,
    source:'self',stats:[{type:'Frost Resistance',value:5000}],statsBeforeTitan:[4000],augments:[],augmentCount:100,lastSeenAt:'2026-10-08T00:00:00Z'};
  const entries=[5000,15000,1000].map((value,i)=>({rank:i+1,score:100,maxScore:1000,track:'Frost',player:{nickname:`Tank ${i}`,uid:String(i+1),region:'EU',serverId:null},
    gear:{...gear,id:i===0?'reference':`piece-${i}`,stats:[{type:'Frost Resistance',value}]}}));
  await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:true,total:3,overall:3,databaseEmpty:false,entries}}));
  await page.goto('/tools/ranking/?board=gear&role=tank&track=Frost&slot=helmet&vs=reference');
  const table=page.getByRole('table',{name:'Gear',exact:true});
  const better=table.getByRole('row').filter({has:page.getByText('Tank 1',{exact:true})});
  const worse=table.getByRole('row').filter({has:page.getByText('Tank 2',{exact:true})});
  await expect(better.locator('[data-sign="up"]')).toContainText('−');
  await expect(better.locator('[data-sign="up"]')).toContainText('Damage taken');
  await expect(better.locator('[data-sign="up"]')).toHaveCSS('color','rgb(143, 220, 170)');
  await expect(worse.locator('[data-sign="down"]')).toContainText('+');
  await expect(worse.locator('[data-sign="down"]')).toHaveCSS('color','rgb(240, 163, 163)');
  await better.getByRole('button',{name:'Show details',exact:true}).click();
  await expect(page.locator('#gear-top-2')).toContainText('Damage taken');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
  await page.locator('[data-datamine-language="ru"]').click();
  const betterRu=page.getByRole('row').filter({has:page.getByText('Tank 1',{exact:true})});
  await expect(betterRu.locator('[data-sign="up"]')).toContainText('Получаемый урон');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test.describe('Gear and player ranking',()=>{
  test('filters by element pair and slot, shows the example and expands original, current and Titan maximum',async({page})=>{
    // The API confirms that no gear has been stored, independently of filters.
    await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:true,total:0,overall:0,databaseEmpty:true,entries:[]}}));
    await page.goto('/tools/ranking/?board=gear');
    await expect(page.getByRole('heading',{name:'Gear and player ranking',level:1})).toBeVisible();
    await expect(page.getByText('The rankings are waiting for uploads')).toBeVisible();
    await page.getByRole('button',{name:/^(Frost \/ Volt\s*){1,2}$/}).click();
    await expect(page).toHaveURL(/track=Frost-Volt/);
    await page.getByRole('button',{name:'Show example',exact:true}).click();
    await expect(page.getByText('Example: the sample build card')).toBeVisible();
    const rows=page.getByRole('table',{name:'Gear'}).getByRole('row');
    await expect(rows).toHaveCount(13);
    await page.getByRole('button',{name:/^(Eyepiece\s*){1,2}$/}).click();
    await expect(page).toHaveURL(/slot=visor/);
    await expect(rows).toHaveCount(2);
    await page.getByRole('button',{name:'Show details',exact:true}).click();
    const drawer=page.locator('#gear-top-1');
    await expect(drawer.getByRole('columnheader')).toHaveText(['Stat','Original','Now','Titan maximum','%']);
    await expect(drawer.locator('[role="row"][data-rated]').first()).toBeVisible();
    await page.getByRole('radio',{name:'Players',exact:true}).click();
    expect(new URL(page.url()).searchParams.has('board')).toBe(false);
    await expect(page.getByRole('table',{name:'Players'}).getByRole('row')).toHaveCount(2);
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await expect(page.getByRole('heading',{name:'Рейтинг гира и игроков',level:1})).toBeVisible();
  });
  test('offers an example only for a confirmed empty database',async({page})=>{
    let response={available:true,total:0,overall:2098,databaseEmpty:false,entries:[]};
    await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:response}));
    await page.goto('/tools/ranking/?board=players&region=AP&verified=1');
    await expect(page.getByText('No verified matches',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Show example',exact:true})).toHaveCount(0);
    response={available:false,total:0,overall:0,databaseEmpty:false,entries:[]};
    await page.reload();
    await expect(page.getByText('No verified matches',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Show example',exact:true})).toHaveCount(0);
    response={available:true,total:0,overall:0,databaseEmpty:true,entries:[]};
    await page.reload();
    await expect(page.getByRole('button',{name:'Show example',exact:true})).toBeVisible();
  });
  test('restores filters from a shared address',async({page})=>{
    await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:false,entries:[]}}));
    await page.goto('/tools/ranking/?board=gear&track=Volt-Frost&slot=helmet&region=EU');
    await expect(page.getByRole('heading',{name:/Volt \/ Frost · Helmet/})).toBeVisible();
    await expect(page.getByRole('button',{name:'EU',exact:true})).toHaveAttribute('aria-pressed','true');
  });
  test('shows augmentation counts and preserves places with verified-only and global places',async({page})=>{
    const gear={id:'piece',slot:'helmet',itemId:'helmet',stars:5,enhancement:80,titan:true,augmented:true,rareId:null,rareLevel:null,
      source:'self',stats:[{type:'Physical Attack',value:1000}],statsBeforeTitan:[800],augments:[],augmentCount:142,lastSeenAt:'2026-10-08T00:00:00Z'};
    const entries=[{rank:2,score:70,maxScore:80,track:'Physical',player:{nickname:'Known',uid:'1',region:'EU',serverId:null},gear},
      {rank:10,score:60,maxScore:70,track:'Physical',player:{nickname:'Unknown',uid:'2',region:'EU',serverId:null},gear:{...gear,id:'unknown',statsBeforeTitan:null,augmentCount:null}}];
    await page.route('**/api/v1/ranking/gear?**',route=>{
      const params=new URL(route.request().url()).searchParams;
      const visible=params.get('verified')==='1'?entries.slice(0,1):entries;
      return route.fulfill({json:{available:true,total:visible.length,overall:10,entries:visible.map(row=>({...row,rank:params.get('places')==='global'?row.rank+20:row.rank}))}});
    });
    await page.goto('/tools/ranking/?board=gear&track=Physical&region=EU');
    const table=page.getByRole('table',{name:'Gear',exact:true});
    await expect(table.getByText('★5 · +80 · Aug: 142', {exact:true})).toBeVisible();
    await expect(table.getByText('★5 · +80 · TITAN',{exact:true})).toBeVisible();
    await page.getByRole('checkbox',{name:'Verified only',exact:true}).locator('..').hover();
    await expect(page.getByRole('tooltip')).toContainText('Titan item from the player’s own .tofbuild');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.getByRole('checkbox',{name:'Verified only',exact:true}).check();
    await expect(table.getByText('Unknown',{exact:true})).toHaveCount(0);
    await expect(table.getByRole('row').nth(1).getByRole('cell').first()).toHaveText('2');
    await page.locator('.sim-sort-trigger').click();
    await page.getByRole('option',{name:'GRV: High → Low · Overall',exact:true}).click();
    await expect(table.getByRole('row').nth(1).getByRole('cell').first()).toHaveText('22');
    await expect(page).toHaveURL(/verified=1.*places=global/);
    await page.reload();
    await expect(page.getByRole('checkbox',{name:'Verified only'})).toBeChecked();
    await expect(page.locator('.sim-sort-trigger')).toContainText('GRV: High → Low · Overall');
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('.sim-sort-trigger').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await expect(page.locator('.sim-sort-trigger')).toContainText('In selected region');
  });
  test('CS changes display order and keeps original GRV numbers',async({page})=>{
    const entry=(rank:number,nickname:string,cs:number)=>({rank,score:70,maxScore:80,track:'Physical',buildId:null,updatedAt:'2026-10-08T00:00:00Z',gear:[],
      player:{nickname,uid:nickname,region:'EU',serverId:null,combatScore:cs,maxCombatScore:null}});
    const rows=[entry(2,'Lower CS',100),entry(10,'Higher CS',200)];
    await page.route('**/api/v1/ranking/players?**',route=>route.fulfill({json:{available:true,total:2,overall:2,
      entries:new URL(route.request().url()).searchParams.get('sort')==='cs'?[...rows].reverse():rows}}));
    await page.goto('/tools/ranking/?board=players&track=Physical');
    await expect(page.locator('.sim-sort-trigger')).toContainText('GRV: High → Low');
    await page.getByRole('button',{name:'EU',exact:true}).click();
    await page.locator('.sim-sort-trigger').click();
    await page.getByRole('option',{name:'CS: High → Low · In selected region',exact:true}).click();
    const first=page.getByRole('table',{name:'Players',exact:true}).getByRole('row').nth(1);
    await expect(first.getByText('Higher CS',{exact:true})).toBeVisible();
    await expect(first.getByRole('cell').first()).toHaveText('10');
    await expect(page).toHaveURL(/sort=cs/);
    await page.reload();
    await expect(page.locator('.sim-sort-trigger')).toContainText('CS: High → Low · In selected region');
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await expect(page.getByRole('checkbox',{name:'Только verified',exact:true})).toBeVisible();
    await page.locator('.sim-sort-trigger').click();
    await expect(page.getByRole('option',{name:'CS: по убыванию · В общем рейтинге',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Все',exact:true}).first().click();
    await page.locator('.sim-sort-trigger').click();
    await expect(page.getByRole('option',{name:/В общем рейтинге/})).toHaveCount(0);
    await page.getByRole('option',{name:'Ник: А → Я',exact:true}).click();
    await expect(page).toHaveURL(/sort=name-asc/);
    await page.reload();
    await expect(page.locator('.sim-sort-trigger')).toContainText('Ник: А → Я');
    await page.locator('.sim-sort-trigger').click();
    await page.getByRole('option',{name:'GRV: от худшего',exact:true}).click();
    await expect(page).toHaveURL(/sort=grv-asc/);
    await page.locator('.sim-sort-trigger').click();
    await page.getByRole('option',{name:'CS: по возрастанию',exact:true}).click();
    await expect(page).toHaveURL(/sort=cs-asc/);
    await page.reload();
    await expect(page.locator('.sim-sort-trigger')).toContainText('CS: по возрастанию');
  });
  test('verifies owner gear with known originals and never seals inspected gear',async({page})=>{
    const gear={id:'own',source:'self',slot:'helmet',itemId:'helmet',stars:5,enhancement:80,titan:true,augmented:true,rareId:null,rareLevel:null,
      stats:[{type:'Physical Attack',value:1000}],statsBeforeTitan:[800],augments:[],augmentCount:142,lastSeenAt:'2026-10-08T00:00:00Z'};
    const rows=[{rank:10,player:{nickname:'Own Titan',uid:'1',region:'EU',serverId:null},gear},
      {rank:11,player:{nickname:'Own normal',uid:'2',region:'EU',serverId:null},gear:{...gear,id:'normal',titan:false}},
      {rank:12,player:{nickname:'Inspected normal',uid:'3',region:'EU',serverId:null},gear:{...gear,id:'inspect-normal',source:'inspect',titan:false}},
      {rank:13,player:{nickname:'Inspected Titan',uid:'4',region:'EU',serverId:null},gear:{...gear,id:'inspect-titan',source:'inspect'}},
      {rank:14,player:{nickname:'Unknown source',uid:'5',region:'EU',serverId:null},gear:{...gear,id:'unknown',source:undefined}}]
      .map(row=>({...row,score:70,maxScore:80,track:'Physical'}));
    // Match verification.ts: known originals from the owner are verified, including non-Titan gear.
    await page.route('**/api/v1/ranking/gear?**',route=>route.fulfill({json:{available:true,total:rows.length,overall:rows.length,entries:rows}}));
    await page.goto('/tools/ranking/?board=gear&track=Physical');
    const table=page.getByRole('table',{name:'Gear',exact:true});
    await expect(table.getByRole('img',{name:/^Verified Titan · own \.tofbuild\./})).toHaveCount(2);
    await expect(table.getByText('★5 · +80 · Aug: 142',{exact:true})).toHaveCount(2);
    await expect(table.getByText('★5 · +80',{exact:true})).toHaveCount(1);
    await expect(table.getByText('★5 · +80 · TITAN',{exact:true})).toHaveCount(2);
    await page.getByRole('checkbox',{name:'Verified only',exact:true}).check();
    await expect(table.getByText('Own Titan',{exact:true})).toBeVisible();
    await expect(table.getByText('Own normal',{exact:true})).toBeVisible();
    for(const name of ['Inspected normal','Inspected Titan','Unknown source'])await expect(table.getByText(name,{exact:true})).toHaveCount(0);
    await expect(table.getByRole('row').nth(1).getByRole('cell').first()).toHaveText('10');
  });
});

test('gear stat headings centre over values, slash separates Titan maximum, and progress keeps tenths in EN/RU',async({page})=>{
  const catalog=JSON.parse(readFileSync('apps/web/public/game-data/build-page.json','utf8')) as BuildCatalog;
  const types=catalog.reference.statTypes;
  const originals=['Physical Attack','Attack','HP','Resistance'].map((type,i)=>({type,beforeTitan:types[type]!.randomStatDefaultValue+(i===0?5*types[type]!.randomStatMaxRollValue:0)}));
  const projection=getBuildTitanProjection(originals,types,catalog.reference.titanGrowth,0);
  const gear={id:'aligned',source:'self',slot:'spaulders',itemId:'spaulders',stars:5,enhancement:80,titan:true,augmented:true,rareId:null,rareLevel:null,
    stats:originals.map((row,i)=>({type:row.type,value:row.beforeTitan+(projection.random[i]!-row.beforeTitan)*(i===0?.987:1)})),
    statsBeforeTitan:originals.map(row=>row.beforeTitan),augments:[{type:'Flame Attack',value:projection.added('Flame Attack')!*.963}],augmentCount:558,lastSeenAt:'2026-10-09T00:00:00Z'};
  const entries=[{rank:1,score:80,maxScore:90,track:'Physical',player:{nickname:'Aligned',uid:'1',region:'EU',serverId:null},gear},
    {rank:2,score:70,maxScore:null,track:'Physical',player:{nickname:'Inspected',uid:'2',region:'EU',serverId:null},gear:{...gear,id:'inspected',source:'inspect',statsBeforeTitan:null}}];
  await page.route('**/api/v1/ranking/gear?**',route=>route.fulfill({json:{available:true,total:2,overall:2,entries}}));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/tools/ranking/?board=gear&track=Physical');
  await page.getByRole('button',{name:'Show details',exact:true}).first().focus();await page.keyboard.press('Enter');
  const drawer=page.locator('#gear-top-1'),stats=drawer.getByRole('table');
  const physical=stats.getByRole('row').filter({has:page.getByText('Physical ATK',{exact:true})}),cells=physical.getByRole('cell');
  await expect(stats.getByRole('columnheader')).toHaveText(['Stat','Original','Now','Titan maximum','%']);
  await expect(cells.last()).toHaveText('98.7%');
  await expect(stats.getByRole('row').filter({has:page.getByText('Flame ATK',{exact:true})}).getByRole('cell').last()).toHaveText('96.3%');
  const centred=async(heading:Locator,content:Locator)=>{
    const [a,b]=await Promise.all([heading.boundingBox(),content.boundingBox()]);
    expect(Math.abs(a!.x+a!.width/2-b!.x-b!.width/2)).toBeLessThan(1);
  };
  await centred(stats.getByText('Original',{exact:true}),cells.nth(1));
  await centred(stats.getByText('Now',{exact:true}),cells.nth(2).locator('b'));
  await centred(stats.getByText('Titan maximum',{exact:true}),cells.nth(3));
  await centred(stats.getByText('%',{exact:true}),cells.last().getByText('98.7%',{exact:true}));
  const [now,slash,max]=await Promise.all([cells.nth(2).boundingBox(),physical.getByText('/',{exact:true}).boundingBox(),cells.nth(3).boundingBox()]);
  expect(slash!.x+slash!.width/2).toBeGreaterThan(now!.x+now!.width);
  expect(slash!.x+slash!.width/2).toBeLessThan(max!.x);
  const breakdown=drawer.getByRole('region',{name:'GRV',exact:true}).getByRole('list');
  await centred(breakdown.getByText('GRV pts',{exact:true}),breakdown.getByRole('listitem').nth(1).locator(':scope > *').nth(3).locator('span').last());
  await expect(breakdown.getByRole('listitem').nth(1).locator(':scope > b')).toBeInViewport({ratio:1});
  await drawer.scrollIntoViewIfNeeded();
  await page.screenshot({path:'ignore/documentation-media/generated/ranking/stat-columns-en.png',animations:'disabled'});
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();await page.locator('[data-datamine-language="ru"]').click();
  await expect(stats.getByRole('columnheader')).toHaveText(['Стат','Оригинал','Сейчас','Максимум Titan','%']);
  await expect(stats.getByRole('row').filter({has:page.getByText('Физ. АТК',{exact:true})}).getByRole('cell').last()).toHaveText('98,7 %');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await drawer.scrollIntoViewIfNeeded();
  const viewport=drawer.getByRole('region',{name:'Сравнение статов вещи',exact:true});
  await viewport.focus();const scroll=await page.evaluate(()=>window.scrollY);
  await viewport.press('ArrowRight');
  await expect.poll(()=>viewport.evaluate(node=>node.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.scrollY)).toBe(scroll);
  await viewport.evaluate(node=>node.scrollTo({left:node.scrollWidth,behavior:'instant'}));
  await expect(stats.getByRole('columnheader',{name:'%',exact:true})).toBeInViewport();
  await page.screenshot({path:'ignore/documentation-media/generated/ranking/stat-columns-mobile-ru.png',animations:'disabled'});
  await page.getByRole('button',{name:'Показать детали',exact:true}).last().click();
  const inspected=page.locator('#gear-top-2').getByRole('table');
  await expect(inspected.getByRole('columnheader')).toHaveText(['Стат','Сейчас']);
  await expect(inspected.getByText('/',{exact:true})).toHaveCount(0);
});


test('perfect player toggle includes independent rank 0.5 ATK% reference in EN and RU',async({page})=>{
  await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:true,total:0,overall:0,databaseEmpty:true,entries:[]}}));
  await page.goto('/tools/ranking/?board=players&track=Frost-Volt');
  await page.getByRole('button',{name:'Perfect player',exact:true}).click();
  const table=page.getByRole('table',{name:'Players',exact:true});
  const perfect=table.getByRole('row').filter({has:page.getByText('Perfect player',{exact:true})});
  const attack=table.getByRole('row').filter({has:page.getByText('ATK% player',{exact:true})});
  await expect(perfect.getByRole('cell').first()).toHaveText('0');
  await expect(attack.getByRole('cell').first()).toHaveText('0.5');
  await expect(attack).toContainText('All rolls into ATK% where available');
  await attack.getByRole('button',{name:'Show details',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(attack.getByRole('button')).toHaveAttribute('aria-expanded','true');
  await expect(perfect.getByRole('button')).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#player-top-ideal-attack-percent')).toContainText('Rated stats, all slots');
  await page.getByRole('button',{name:'Hide perfect player',exact:true}).click();
  await expect(table).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
  await page.locator('[data-datamine-language="ru"]').click();
  await page.getByRole('button',{name:'Идеальный игрок',exact:true}).click();
  await expect(page.getByText('Игрок ATK%',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


test('verified gear preview moves Aug to the footer and shows this item’s Titan maxima',async({page})=>{
  const catalog=JSON.parse(readFileSync('apps/web/public/game-data/build-page.json','utf8')) as BuildCatalog;
  const types=catalog.reference.statTypes;
  const makeGear=(slot:string,primary:string,others:string[])=>{
    const rows=[primary,...others].map((type,i)=>({type,beforeTitan:types[type]!.randomStatDefaultValue+(i===0?5*types[type]!.randomStatMaxRollValue:0)}));
    const projection=getBuildTitanProjection(rows,types,catalog.reference.titanGrowth,0);
    const addedType=primary.endsWith('Attack %')?'Volt Attack %':'Volt Attack';
    const addedMaximum=projection.added(addedType)!;
    return {id:slot,source:'self',slot,itemId:slot,stars:5,enhancement:80,titan:true,augmented:true,rareId:null,rareLevel:null,
      stats:rows.map(row=>({type:row.type,value:row.beforeTitan})),statsBeforeTitan:rows.map(row=>row.beforeTitan),
      augments:[{type:addedType,value:addedMaximum*.9}],augmentCount:419,lastSeenAt:'2026-10-09T00:00:00Z'};
  };
  const helmet=makeGear('helmet','Frost Attack',['Attack','HP','Flame Resistance']);
  const visor=makeGear('visor','Frost Attack %',['Attack','HP','Crit Rate %']);
  const entries=[{rank:1,score:70,maxScore:80,track:'Frost',buildId:null,updatedAt:'',gear:[helmet,visor],player:{nickname:'Own',uid:'1',region:'EU',serverId:null}},
    {rank:2,score:60,maxScore:80,track:'Frost',buildId:null,updatedAt:'',gear:[{...helmet,id:'inspect',source:'inspect',statsBeforeTitan:null}],player:{nickname:'Inspect',uid:'2',region:'EU',serverId:null}}];
  await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:true,total:2,overall:2,entries}}));
  await page.goto('/tools/ranking/?board=players&track=Frost');
  const own=page.getByRole('row').filter({has:page.getByText('Own',{exact:true})});
  const chips=own.locator('span[data-grade][tabindex="0"]');
  await chips.first().focus();
  const tip=page.getByRole('tooltip');
  await expect(tip).toContainText('Aug: 419');
  await expect(tip.locator('[data-inspection-heading]')).not.toContainText('Aug');
  const before=helmet.statsBeforeTitan[1]!;
  const maximum=getBuildStatMaximum(before,0,types.Attack!).titan;
  const format=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n);
  await expect(tip.locator('li').filter({has:page.getByText('ATK',{exact:true})}).locator('b')).toHaveText(`${format(before)} / ${format(maximum)}`);
  await expect(tip.locator('[data-stat-value="maximum"]')).toHaveCount(5);
  await tip.screenshot({path:'ignore/documentation-media/generated/ranking-verified-tooltip.png'});
  await page.keyboard.press('Escape');
  await chips.nth(1).focus();
  await expect(tip.getByText('Frost ATK %',{exact:true})).toBeVisible();
  await expect(tip.locator('li').filter({has:page.getByText('Frost ATK %',{exact:true})}).locator('b')).toContainText('% /');
  await page.keyboard.press('Escape');
  await own.getByRole('button',{name:'Show details',exact:true}).click();
  await own.locator('..').locator('#player-top-1 [class*="slotCard"][tabindex="0"]').first().focus();
  await expect(tip).toContainText('Aug: 419');
  await page.keyboard.press('Escape');
  const inspected=page.getByRole('row').filter({has:page.getByText('Inspect',{exact:true})});
  await inspected.locator('span[data-grade][tabindex="0"]').focus();
  await expect(tip).toContainText('Helmet');
  await expect(tip).not.toContainText('Aug:');
  await expect(tip.locator('[data-stat-value="maximum"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
  await page.locator('[data-datamine-language="ru"]').click();
  const drawer=page.locator('#player-top-1');
  if(await own.getByRole('button',{name:'Показать детали',exact:true}).count())
    await own.getByRole('button',{name:'Показать детали',exact:true}).click();
  await drawer.locator('[class*="slotCard"][tabindex="0"]').first().focus();
  await expect(tip).toContainText('Aug: 419');
  await expect(tip.locator('[data-stat-value="maximum"]')).toHaveCount(5);
  const box=await tip.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


test('gear references add independent rank 0.5 rows only to slots with ATK%',async({page})=>{
  await page.route('**/api/v1/ranking/**',route=>route.fulfill({json:{available:true,total:0,overall:0,databaseEmpty:true,entries:[]}}));
  await page.goto('/tools/ranking/?board=gear');
  await page.getByRole('button',{name:'Perfect item',exact:true}).click();
  const table=page.getByRole('table',{name:'Gear',exact:true});
  const attack=table.getByRole('row').filter({has:page.getByText('ATK% item',{exact:true})});
  await expect(table.getByRole('row')).toHaveCount(17);
  await expect(attack).toHaveCount(4);
  await expect(attack.first().getByRole('cell').first()).toHaveText('0.5');
  await attack.first().getByRole('button',{name:'Show details',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#gear-top-attack-percent-visor')).toBeVisible();
  const perfect=table.getByRole('row').filter({has:page.getByText('Perfect item',{exact:true})});
  await expect(perfect.nth(8).getByRole('button')).toHaveAttribute('aria-expanded','false');
  await page.getByRole('button',{name:/^(Eyepiece\s*){1,2}$/}).click();
  await expect(attack).toHaveCount(1);
  await expect(perfect).toHaveCount(1);
  await page.getByRole('button',{name:/^(Helmet\s*){1,2}$/}).click();
  await expect(attack).toHaveCount(0);
  await expect(perfect).toHaveCount(1);
  await page.getByRole('button',{name:/^(Eyepiece\s*){1,2}$/}).click();
  await page.getByRole('button',{name:'Hide perfect item',exact:true}).click();
  await expect(table).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
  await page.locator('[data-datamine-language="ru"]').click();
  await page.getByRole('button',{name:'Идеальная вещь',exact:true}).click();
  await expect(page.getByText('Вещь ATK%',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('All tracks is implicit in page URLs while API requests keep the selected track',async({page})=>{
  const tracks:string[]=[];
  await page.route('**/api/v1/ranking/**',route=>{
    tracks.push(new URL(route.request().url()).searchParams.get('track')??'');
    return route.fulfill({json:{available:true,total:0,overall:0,databaseEmpty:false,entries:[]}});
  });
  await page.goto('/tools/ranking/?track=all');
  await expect(page).toHaveURL(/\/tools\/ranking\/$/);
  await expect.poll(()=>tracks.includes('all')).toBe(true);
  await page.goto('/tools/ranking/?track=Frost');
  await expect(page).toHaveURL(/track=Frost/);
  await expect.poll(()=>tracks.includes('Frost')).toBe(true);
  await page.locator('[class*="elementChips"]').getByRole('button',{name:'All',exact:true}).click();
  await expect(page).toHaveURL(/\/tools\/ranking\/$/);
});
