import {test,expect} from '@playwright/test';

const entry=(index:number,nickname=`Player ${index}`)=>({rank:index,score:70,maxScore:300,track:'Physical',
  player:{nickname,uid:String(index),region:'EU',serverId:null},
  gear:{id:`piece-${index}`,slot:'helmet',itemId:'helmet',stars:5,enhancement:0,titan:false,augmented:false,
    rareId:null,rareLevel:null,stats:[{type:'Physical Attack',value:1000}],statsBeforeTitan:null,augments:[],augmentCount:null,lastSeenAt:'2026-10-09T00:00:00Z',source:'inspect'}});

test('search links load directly, typing is debounced, former names survive server matches and clearing reuses the board',async({page})=>{
  const searches:string[]=[];
  const slotSearches:(string|null)[]=[];
  await page.route('**/api/v1/ranking/gear?**',route=>{
    const params=new URL(route.request().url()).searchParams,q=params.get('q')??'';searches.push(q);slotSearches.push(params.get('slots'));
    const entries=q==='\u200b\u200b'?[]:[entry(1,q==='phantom'?'Renamed player':'Alex')];
    return route.fulfill({json:{available:true,total:entries.length,overall:1,databaseEmpty:false,entries}});
  });
  await page.goto('/tools/ranking/?board=gear&track=Physical&q=Alex');
  await expect(page.getByText('Alex',{exact:true})).toBeVisible();
  expect(searches).toEqual(['Alex']);
  const search=page.getByPlaceholder('Search player, UID, server or item…');
  await search.fill('ph');await search.fill('phan');await search.fill('phantom');
  await expect(page.getByText('Renamed player',{exact:true})).toBeVisible();
  expect(searches).toEqual(['Alex','phantom']);
  await expect(page).toHaveURL(/q=phantom/);
  await page.getByRole('button',{name:'Clear search',exact:true}).click();
  await expect(page.getByText('Alex',{exact:true})).toBeVisible();
  expect(searches).toEqual(['Alex','phantom','']);
  await search.fill('phantom');
  await expect(page.getByText('Renamed player',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Clear search',exact:true}).click();
  await expect(page.getByText('Alex',{exact:true})).toBeVisible();
  expect(searches).toEqual(['Alex','phantom','']);
  await page.setViewportSize({width:390,height:844});
  await search.fill('\u200b\u200b');
  await expect(page).toHaveURL(/q=%E2%80%8B%E2%80%8B/);
  await expect.poll(()=>searches.at(-1)).toBe('\u200b\u200b');
  await expect(page.getByText('Alex',{exact:true})).toHaveCount(0);
  expect(slotSearches.at(-1)).toBeNull();
  await page.getByRole('button',{name:'Clear search',exact:true}).click();
  await expect(search).toHaveValue('');
  await expect(page.getByText('Alex',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('pagination waits for scrolling, can retry a failed page and cancels it when filters change',async({page})=>{
  const offsets:number[]=[];
  let failed=false,release:(()=>void)|undefined;
  const aborted:string[]=[];
  page.on('requestfailed',request=>aborted.push(request.url()));
  await page.route('**/api/v1/ranking/gear?**',async route=>{
    const url=new URL(route.request().url()),offset=Number(url.searchParams.get('offset')??0);
    if(url.searchParams.get('region')==='EU')return route.fulfill({json:{available:true,total:1,overall:200,databaseEmpty:false,entries:[entry(1,'EU filtered')]}});
    offsets.push(offset);
    if(offset&&!failed){failed=true;return route.fulfill({status:503});}
    if(offset){await new Promise<void>(resolve=>{release=resolve;});await route.fulfill({json:{available:true,entries:[entry(101,'Stale page')]}}).catch(()=>{});return;}
    return route.fulfill({json:{available:true,total:200,overall:200,databaseEmpty:false,entries:Array.from({length:100},(_,i)=>entry(i+1))}});
  });
  await page.goto('/tools/ranking/?board=gear&track=Physical');
  await expect(page.getByRole('table',{name:'Gear',exact:true}).getByRole('row')).toHaveCount(101);
  expect(offsets).toEqual([0]);
  await page.getByText('Player 100',{exact:true}).scrollIntoViewIfNeeded();
  const retry=page.getByRole('button',{name:'Retry loading',exact:true});
  await expect(retry).toBeVisible();expect(offsets).toEqual([0,100]);
  await retry.click();
  await expect.poll(()=>offsets.length).toBe(3);
  expect(offsets).toEqual([0,100,100]);
  await page.getByRole('button',{name:'EU',exact:true}).click();
  await expect(page.getByText('EU filtered',{exact:true})).toBeVisible();
  await expect.poll(()=>aborted.some(url=>new URL(url).searchParams.get('offset')==='100')).toBe(true);
  release?.();
  await expect(page.getByText('Stale page',{exact:true})).toHaveCount(0);
});
