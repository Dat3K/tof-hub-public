import {test,expect} from '@playwright/test';
import {getServersByRegion} from '../../packages/contracts/src';

for(const locale of ['en','ru'])for(const route of ['/tools/ranking/','/info/simulacra/','/datamine/oow/'])test(`header fits ${locale} ${route}`,async({page,context,baseURL})=>{
  test.setTimeout(90_000);
  await context.addCookies([{name:'tof_locale',value:locale,url:baseURL!}]);
  await page.goto(route,{waitUntil:'domcontentloaded'});
  const header=page.locator('[data-site-header]');await expect(header).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  for(const width of [320,390,768,920,921,1024,1100,1280,1281,1440]){
    await page.setViewportSize({width,height:900});
    await expect.poll(()=>header.locator('.info-header__inner').evaluate(node=>{
      const [brand,nav,right]=Array.from(node.children).map(element=>element.getBoundingClientRect());
      const overlap=(a:DOMRect,b:DOMRect)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
      return overlap(brand!,nav!)||overlap(nav!,right!)||overlap(brand!,right!);
    }),{message:`Header overlaps at ${width}px`}).toBe(false);
    expect(await header.evaluate(node=>node.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:1024,height:900});
  const language=header.getByRole('button',{name:/Language selector|Выбор языка/});
  await expect(async()=>{
    await language.press('ArrowDown');
    await expect(header.getByRole('menuitem').filter({hasText:'English'})).toBeVisible({timeout:1000});
  }).toPass({timeout:15000});
  await page.keyboard.press('Escape');await expect(language).toBeFocused();
  if(route==='/tools/ranking/'&&locale==='en')await page.screenshot({path:'ignore/documentation-media/generated/header-tablet.png'});
});

test('long Ranking server names ellipsize before the nickname and keep their full tooltip',async({page})=>{
  const server=getServersByRegion('NA').sort((a,b)=>b.name.length-a.name.length)[0]!;
  expect(server).toBeTruthy();
  await page.route('**/api/v1/ranking/players?**',route=>route.fulfill({json:{available:true,total:1,overall:1,entries:[{
    rank:4,score:80,maxScore:100,track:'Physical',player:{uid:'1200100000',nickname:'Orthy',region:'NA',serverId:server.id},
    gear:[],buildId:null,updatedAt:'2026-10-18T00:00:00Z',
  }]}}));
  await page.goto('/tools/ranking/?track=Physical');
  const row=page.getByRole('row').filter({has:page.getByText('Orthy',{exact:true})});
  const region=row.locator('[class*="regionCell"]'),name=region.locator('small');
  await expect(name).toHaveText(server.name);
  let clipped=false;
  for(const width of [561,640,768,1024]){
    await page.setViewportSize({width,height:900});
    await expect(name).toBeVisible();
    clipped||=await name.evaluate(node=>node.scrollWidth>node.clientWidth);
    const bounds=await name.boundingBox(),next=await row.getByRole('cell').nth(2).boundingBox();
    expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(next!.x);
  }
  expect(clipped).toBe(true);
  await name.hover();await expect(page.getByRole('tooltip')).toContainText(server.name);
  const checkPosition=async(trigger:ReturnType<typeof page.locator>)=>{
    const target=await trigger.boundingBox(),tip=await page.getByRole('tooltip').boundingBox();
    expect(tip!.y+tip!.height).toBeLessThanOrEqual(target!.y);
    expect(Math.abs((tip!.x+tip!.width/2)-(target!.x+target!.width/2))).toBeLessThan(2);
  };
  await checkPosition(name);
  const nickname=row.getByText('Orthy',{exact:true});
  await nickname.hover();await expect(page.getByRole('tooltip')).toContainText('UID: 1200100000');
  await checkPosition(nickname);
  await page.setViewportSize({width:640,height:844});
  await page.screenshot({path:'ignore/documentation-media/generated/ranking-server-ellipsis.png'});
});
