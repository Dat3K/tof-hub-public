import {test,expect} from '@playwright/test';

for(const locale of ['en','ru'] as const) {
  test(`Build rejects disguised SVG upload before image decoding (${locale})`,async({page,context,baseURL})=>{
    await context.addCookies([{name:'tof_locale',value:locale,url:baseURL!}]);
    await page.goto('/tools/build/',{waitUntil:'domcontentloaded'});
    const input=page.getByLabel(locale==='ru'?'Файл изображения фона':'Background image file',{exact:true});
    await expect(input).toBeAttached();
    const posts:string[]=[];
    page.on('request',request=>{if(request.method()==='POST')posts.push(request.url());});
    await input.setInputFiles({name:'picture.png',mimeType:'image/png',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="window.__maliciousUpload=true"/>')});
    await expect(page.getByRole('status').filter({hasText:locale==='ru'?'корректный PNG':'valid PNG'})).toBeVisible();
    expect(await page.evaluate(()=>Reflect.get(window,'__maliciousUpload'))).toBeUndefined();
    expect(posts).toEqual([]);
  });
}
