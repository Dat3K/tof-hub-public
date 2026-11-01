import fs from 'node:fs';
import path from 'node:path';
import {test,expect} from '@playwright/test';
import {PUBLIC_ROUTES,routeCopy} from '../../apps/web/src/lib/seo/routes';

const root = path.resolve('apps/web/public/game-data');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'link-previews.json'),'utf8'));
const decode = (text:string) => text.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
function meta(html:string,property:string) {
  const tag = html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`));
  return tag ? decode(tag[1]) : null;
}

for(const route of PUBLIC_ROUTES) {
  test(`English social metadata for a Russian visitor: ${route}`,async({request})=>{
    const response = await request.get(route,{headers:{'User-Agent':'TelegramBot','Cookie':'tof_locale=ru'}});
    expect(response.status(),route).toBe(200);
    const html = (await response.text()).split('</head>')[0];
    const copy = routeCopy(route)!;
    expect(meta(html,'og:title'),route).toBe(copy[0]);
    expect(meta(html,'og:description'),route).toBe(copy[1]);
    expect(meta(html,'og:locale'),route).toBe('en_US');
    expect(meta(html,'twitter:card'),route).toBe('summary_large_image');
    expect(meta(html,'og:image'),route).toContain('/og/?path=');
  });
}

for(const bot of ['Twitterbot','Discordbot']) {
  test(`default crawler retains blocking metadata: ${bot}`,async({request})=>{
    const response=await request.get('/projects/',{headers:{'User-Agent':bot,Cookie:'tof_locale=ru'}});
    expect(response.status()).toBe(200);
    const head=(await response.text()).split('</head>')[0];
    expect(meta(head,'og:title')).toBe(routeCopy('/projects/')![0]);
    expect(meta(head,'og:locale')).toBe('en_US');
  });
}

test('direct object links keep identity in metadata and render real PNG previews',async({request})=>{
  test.setTimeout(180000);
  for(const [route,dataset] of Object.entries(manifest.datasets) as [string,string][]) {
    const entries = JSON.parse(fs.readFileSync(path.join(root,`${dataset}.json`),'utf8')).entities;
    const entity = entries.find((entry:{image?:string})=>entry.image) || entries[0];
    const response = await request.get(`${entity.path}&q=unrelated-filter`,{headers:{'User-Agent':'Discordbot','Cookie':'tof_locale=ru'}});
    expect(response.status(),entity.path).toBe(200);
    const html = await response.text();
    expect(meta(html,'og:title'),route).toBe(entity.title);
    expect(meta(html,'og:description'),route).toBe(entity.description);
    expect(meta(html,'og:url'),route).toContain(entity.path.replace(/&/g,'&'));
    expect(meta(html,'og:url'),route).not.toContain('unrelated-filter');
    const imageUrl = new URL(meta(html,'og:image')!);
    const image = await request.get(imageUrl.pathname + imageUrl.search);
    expect(image.status(),route).toBe(200);
    expect(image.headers()['content-type'],route).toContain('image/png');
    const png = await image.body();
    expect(png.readUInt32BE(16),route).toBe(1200);expect(png.readUInt32BE(20),route).toBe(630);
  }
});

test('search policy indexes tools and entities while keeping saved builds unindexed',async({request})=>{
  test.setTimeout(60000);
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /tools/build/mockup/');expect(robots).toContain('Disallow: /api/');
  expect(robots.split(/\r?\n/)).not.toContain('Disallow: /tools/build/');expect(robots).not.toContain('Disallow: /tools/wish/');
  const xml = await (await request.get('/sitemap.xml')).text();
  expect(xml).toContain('/tools/build/</loc>');expect(xml).toContain('/tools/optimizer/</loc>');
  expect(xml).toContain('/info/simulacra/?server=');
  expect(xml).not.toContain('/tools/build/profiles/');expect(xml).not.toContain('/tools/queue/');
  const response = await request.get('/tools/build/12345678/dps-frost/',{headers:{'User-Agent':'Twitterbot'}});
  expect(response.status()).toBe(200);
  expect(meta(await response.text(),'robots')).toContain('noindex');
  expect((await request.get('/og/?path='+encodeURIComponent('//example.com/'))).status()).toBe(400);
});

test('catalog entity queries open and close with the keyboard on desktop and mobile',async({page,context,baseURL})=>{
  test.setTimeout(180000);
  await context.addCookies([{name:'tof_locale',value:'ru',url:baseURL!}]);
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    for(const route of ['/info/matrices/','/info/cosmetics/','/info/arts/','/info/pets/']) {
      const entries = JSON.parse(fs.readFileSync(path.join(root,`${manifest.datasets[route]}.json`),'utf8')).entities;
      const entity = route === '/info/pets/' ? entries.find((entry:{path:string})=>entry.path.includes('module=')) : entries[0];
      await page.goto(entity.path,{waitUntil:'domcontentloaded'});
      await expect(page.getByRole('dialog').first(),entity.path).toBeVisible();
      // The SSR dialog can be visible before client keyboard handlers hydrate.
      await expect(async()=>{
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0,{timeout:1000});
      }).toPass({timeout:20000});
      const query = new URL(page.url()).searchParams;
      for(const key of ['suit','outfit','art','module']) expect(query.has(key),entity.path).toBe(false);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    }
  }
});
