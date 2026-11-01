import {test,expect} from '@playwright/test';
import capture from '../../packages/contracts/src/__fixtures__/build-capture.json';

for(const locale of ['en','ru'] as const){
  test(`saved card restores a catalog background and saved framing · ${locale}`,async({page})=>{
    const uid='1301564092';
    const catalog=await (await page.request.get('/game-data/build-page.json')).json();
    let art:null|{id:string;zoom:number;x:number;y:number;offsetX:number;offsetY:number}=null;
    await page.route(`**/api/v1/build/profiles/${uid}/dps-frost`,route=>route.fulfill({json:{uid,role:'dps',element:'Frost',savedAt:'2026-10-12T00:00:00Z',capture,source:{digest:'a'.repeat(64),signature:'fixture'},art}}));
    await page.goto(`/tools/build/${uid}/dps-frost/`);
    if(locale==='ru'){
      await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
      await page.locator('[data-datamine-language="ru"]').click();
      await page.setViewportSize({width:844,height:390});
    }
    const hero=page.locator('article.card .hero-art');
    await expect(hero).toHaveCount(1);
    await expect.poll(()=>hero.evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
    const fallback=await hero.getAttribute('src');
    expect(catalog.artworks.some((item:{url:string})=>item.url===fallback)).toBe(true);
    await page.reload();await expect(hero).toHaveAttribute('src',fallback!);
    art={id:catalog.artworks[0].id,zoom:1.4,x:45,y:32,offsetX:3,offsetY:-7};
    await page.reload();
    await expect(hero).toHaveAttribute('src',catalog.artworks[0].url);
    await expect(hero).toHaveAttribute('style',/object-position: 45% 32%/);
    await expect(hero).toHaveAttribute('style',/translate\(3%, -7%\) scale\(1.4\)/);
  });
  test(`saved card share feedback stays near its button · ${locale}`,async({page})=>{
    const uid='1301564092';
    await page.route(`**/api/v1/build/profiles/${uid}/dps-frost`,route=>route.fulfill({json:{uid,role:'dps',element:'Frost',savedAt:'2026-10-12T00:00:00Z',capture,source:{digest:'a'.repeat(64),signature:'fixture'},art:null}}));
    await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}},configurable:true}));
    await page.goto(`/tools/build/${uid}/dps-frost/`);
    if(locale==='ru'){
      await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
      await page.locator('[data-datamine-language="ru"]').click();
      await page.setViewportSize({width:844,height:390});
    }
    const share=page.getByRole('button',{name:locale==='ru'?'Поделиться карточкой':'Share card',exact:true});
    await expect(share).toBeEnabled();
    await share.scrollIntoViewIfNeeded();
    const before=await share.boundingBox();
    await share.focus();await page.keyboard.press('Enter');
    const mirror=page.locator('[data-toast-mirror]');
    await expect(mirror).toContainText(locale==='ru'?'Ссылка на карточку скопирована.':'Card link copied to clipboard.');
    await expect(share).toBeFocused();
    expect(await share.boundingBox()).toEqual(before);
    const box=await mirror.boundingBox();
    expect(box!.y+box!.height).toBeLessThanOrEqual(before!.y);
    expect(box!.x+box!.width).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));
    await expect(page.locator('.tof-toast-viewport [role="status"]')).toHaveCount(1);
    await page.mouse.move(0,0);
    await page.screenshot({path:`ignore/documentation-media/generated/saved-build-share-${locale}.png`,animations:'disabled'});
    await mirror.getByRole('button').click();
    await expect(mirror).toHaveCount(0);
    await expect(page.locator('.tof-toast-viewport .tof-toast')).toHaveCount(0);
    await page.evaluate(()=>{
      Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('Denied');}},configurable:true});
      document.execCommand=()=>false;
    });
    await share.click();
    await expect(mirror).toContainText(locale==='ru'?'Не удалось скопировать ссылку':'Could not copy the card link');
  });

  test(`saved equipped ranking header · ${locale}`,async({page})=>{
    test.setTimeout(90000);
    const uid='1301564092',digest='a'.repeat(64),selections:string[]=[];
    await page.route(`**/api/v1/build/profiles/${uid}/dps-frost`,route=>route.fulfill({json:{uid,role:'dps',element:'Frost',savedAt:'2026-10-12T00:00:00Z',capture,source:{digest,signature:'fixture'},art:null}}));
    await page.route(`**/api/v1/build/profiles/${uid}/dps-frost/ranking?**`,route=>{
      const query=new URL(route.request().url()).searchParams;selections.push(`${query.get('role')}:${query.get('element')}`);
      return route.fulfill({json:{available:true,digest,global:123,region:{code:'EU',rank:21},track:'Frost-Volt',calculatedAt:'2026-10-12T00:00:00Z'}});
    });
    await page.goto(`/tools/build/${uid}/dps-frost/`);
    if(locale==='ru'){
      await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
      await page.locator('[data-datamine-language="ru"]').click();
    }
    const ranking=page.getByLabel(locale==='ru'?'Рейтинг гира':'Gear ranking',{exact:true});
    await expect(ranking).toContainText('GLOBAL#123');
    await expect(ranking).toContainText('EU#21');
    await ranking.focus();
    await expect(page.getByRole('tooltip')).toContainText(locale==='ru'?'надетого комплекта':'equipped set');
    await page.keyboard.press('Escape');
    const bounds=await ranking.boundingBox(),focus=await page.locator('.build-focus').boundingBox();
    expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(focus!.x);
    await page.locator('article.card').screenshot({path:`ignore/documentation-media/generated/saved-ranking-${locale}.png`});
    await page.getByRole('button',{name:locale==='ru'?'Стихия GRV / PRV':'GRV / PRV element',exact:true}).click();
    await page.getByRole('option',{name:locale==='ru'?'Электро':'Volt',exact:true}).click();
    // A locale change can cancel/retry the initial request; choosing Volt keeps the Frost/Volt board.
    expect(new Set(selections)).toEqual(new Set(['dps:Frost']));
    await page.getByRole('button',{name:locale==='ru'?'Стихия GRV / PRV':'GRV / PRV element',exact:true}).click();
    await page.getByRole('option',{name:locale==='ru'?'Физ.':'Physical',exact:true}).click();
    await expect.poll(()=>selections.at(-1)).toBe('dps:Physical');
    await page.setViewportSize({width:844,height:390});
    await expect(ranking).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.goto('/tools/build/?demo=1');
    await expect(page.getByLabel(locale==='ru'?'Рейтинг гира':'Gear ranking',{exact:true})).toHaveCount(0);
  });
}
