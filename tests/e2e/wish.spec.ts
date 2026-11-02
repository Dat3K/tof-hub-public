import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.describe('Special Orders Wish Tracker (/tools/wish)', () => {
  test('restores locally uploaded artwork, scale, brightness and position after reload and clears it on removal',async({page})=>{
    await page.goto('/tools/wish/');
    const controls=page.locator('[data-wish-artwork-controls]');
    await controls.locator('input[type="file"]').setInputFiles({name:'local.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9lVl8AAAAASUVORK5CYII=','base64')});
    await expect(page.locator('.tof-toast-viewport')).toContainText('Image added.');
    const art=page.locator('#wish-banner-showcase img[aria-label]');
    await art.focus();await art.press('Shift+ArrowLeft');
    await controls.getByLabel('Custom image size',{exact:true}).focus();await page.keyboard.press('End');
    await controls.getByLabel('Custom image brightness',{exact:true}).focus();await page.keyboard.press('Home');
    await expect(art).toHaveCSS('filter',/brightness\(0\.3\)/);
    const style=await art.getAttribute('style');
    const source=await art.getAttribute('src');
    await page.reload();
    await expect(art).toHaveAttribute('style',style!);
    await expect(art).toHaveAttribute('src',/^blob:/);
    await expect(art).not.toHaveAttribute('src',source!);
    await expect.poll(()=>art.evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBe(1);
    await expect(art).toHaveCSS('filter',/brightness\(0\.3\)/);
    await controls.getByRole('button',{name:'Remove',exact:true}).click();
    await page.reload();
    await expect(art).toHaveCount(0);
    await expect(page.locator('[data-wish-public-art]')).toBeVisible();
  });

  test('reports artwork preparation, completion and decode errors without moving the banner',async({page})=>{
    await page.addInitScript(()=>{
      const decode=HTMLImageElement.prototype.decode;
      let pending=true;
      HTMLImageElement.prototype.decode=function(){
        if(!pending || !this.src.startsWith('blob:'))return decode.call(this);
        return new Promise<void>((resolve,reject)=>{
          Object.assign(window,{releaseWishImage:()=>{pending=false;decode.call(this).then(resolve,reject);}});
        });
      };
    });
    await page.goto('/tools/wish/');
    // Let the initial banner artwork and fonts finish loading before measuring
    // its position; otherwise their own layout shifts can look like a toast shift.
    await page.evaluate(async()=>{
      await document.fonts.ready;
      await Promise.all(Array.from(document.images,image=>image.decode().catch(()=>undefined)));
    });
    const input=page.locator('[data-wish-artwork-controls] input[type="file"]');
    const banner=page.locator('#wish-banner-showcase');
    const before=await banner.boundingBox();
    await input.setInputFiles({name:'art.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9lVl8AAAAASUVORK5CYII=','base64')});
    const notices=page.locator('.tof-toast-viewport');
    await expect(notices).toContainText('Preparing image…');
    expect(await banner.boundingBox()).toEqual(before);
    await page.evaluate(()=>(window as unknown as {releaseWishImage:()=>void}).releaseWishImage());
    await expect(notices).toContainText('Image added.');
    const art=banner.locator('img[aria-label]');
    const source=await art.getAttribute('src');
    await input.setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('broken image')});
    await expect(notices).toContainText('Could not open the image.');
    await expect(art).toHaveAttribute('src',source!);
  });

  test('uses the shared demo label and import action in EN and RU mobile', async ({page}) => {
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/tools/wish/');
    const notice=page.locator('aside').filter({hasText:'Example · demo history'});
    await expect(notice).toBeVisible();
    const publicArtwork=page.locator('[data-wish-public-art="loading_loading21"]');
    await expect(publicArtwork).toBeVisible();
    await expect(publicArtwork).toHaveAttribute('src',/\/game-assets\/webp\/.*loading21\.webp$/);
    await expect.poll(()=>publicArtwork.evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBe(1920);
    const action=notice.getByRole('button',{name:'Import .tofwish',exact:true});
    await action.focus();await expect(action).toBeFocused();
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),action.press('Enter')]);
    expect(await chooser.element().getAttribute('accept')).toMatch(/application\/json/);
    await chooser.setFiles([]);
    await expect(action).toBeFocused();
    await page.screenshot({path:'ignore/documentation-media/generated/wish-demo-shared-en.png',animations:'disabled'});
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language=ru]').click();
    await page.setViewportSize({width:390,height:844});
    const ru=page.locator('aside').filter({hasText:'Пример · демо-история'});
    const ruAction=ru.getByRole('button',{name:'Импорт .tofwish',exact:true});
    await expect(ruAction).toBeVisible();
    expect(await ru.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
    await page.screenshot({path:'ignore/documentation-media/generated/wish-demo-shared-ru-mobile.png',animations:'disabled'});
    const [ruChooser]=await Promise.all([page.waitForEvent('filechooser'),ruAction.click()]);
    expect(await ruChooser.element().getAttribute('accept')).toMatch(/application\/json/);
    await ruChooser.setFiles([]);
  });

  test('aligns the selected banner and selector below the header from the rail in EN and RU mobile', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/tools/wish/?tab=history&track=standard_matrix&banner=matrix-standard&kind=matrix');
    const section = page.locator('[data-wish-banner-section]');
    const go = page.getByRole('button', { name: 'Go to banner', exact: true });
    await expect(go).toBeVisible();
    await go.focus();
    await page.keyboard.press('Enter');
    const aligned = () => page.evaluate(() => {
      const top = document.querySelector('[data-wish-banner-section]')!.getBoundingClientRect().top;
      const headerBottom = Math.max(0, document.querySelector('[data-site-header]')!.getBoundingClientRect().bottom);
      return Math.abs(top - headerBottom);
    });
    await expect.poll(aligned).toBeLessThan(2);
    await expect(go).toBeFocused();
    await expect(section).toContainText('Choice Matrices');
    await page.screenshot({ path: 'ignore/documentation-media/generated/wish-banner-focus-en.png', animations: 'disabled' });
    await page.getByRole('button', { name: 'Language selector: English', exact: true }).click();
    await page.locator('[data-datamine-language=ru]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: 'К баннеру', exact: true }).click();
    await expect.poll(aligned).toBeLessThan(2);
    await page.screenshot({ path: 'ignore/documentation-media/generated/wish-banner-focus-ru-mobile.png', animations: 'disabled' });
    await page.goto('/tools/wish/?tab=simulation');
    await expect(page.getByRole('button', { name: 'К баннеру', exact: true })).toHaveCount(0);
  });

  test('confirms local account removal and keeps uploaded profiles intact in EN and RU mobile', async ({ page }) => {
    const ids=['import-'+'a'.repeat(32),'import-'+'b'.repeat(32)];
    const writes:string[]=[],errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(request.url().includes('/api/v1/')&&!['GET','HEAD','OPTIONS'].includes(request.method()))writes.push(request.method()+' '+new URL(request.url()).pathname);});
    await page.addInitScript(profileIds=>{
      if(!localStorage.getItem('tof-wish-imported-profile-ids')) {
        localStorage.setItem('tof-wish-imported-profile-ids',JSON.stringify(profileIds));
        localStorage.setItem('tof-wish-current-profile',profileIds[0]!);
      }
    },ids);
    const profiles=ids.map((id,index)=>({profile:{id,uid:String(990000+index),name:index?'Second account':'First account',region:'EU',server:'13002',updatedAt:'2026-10-10T12:00:00.000Z'},records:[],banners:[]}));
    await page.route('**/api/v1/wish/profiles/*/imported',async route=>{
      const profile=profiles.find(entry=>route.request().url().includes(entry.profile.id));
      await route.fulfill({json:profile});
    });
    await page.goto('/tools/wish/');
    const remove=page.getByRole('button',{name:'Remove from list: First account',exact:true});
    await expect(remove).toBeVisible();
    const stored=await page.evaluate(()=>localStorage.getItem('tof-wish-imported-profile-ids'));
    await remove.focus();await page.keyboard.press('Enter');
    const confirmation=page.getByRole('dialog',{name:'Remove account from this list?',exact:true});
    const scroll=await page.evaluate(()=>window.scrollY);
    await expect(confirmation.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
    await expect(confirmation).toContainText('First account');
    await expect(confirmation).toContainText('Its data and pull history will remain.');
    await page.keyboard.press('Escape');await expect(remove).toBeFocused();
    expect(await page.evaluate(()=>window.scrollY)).toBe(scroll);
    expect(await page.evaluate(()=>localStorage.getItem('tof-wish-imported-profile-ids'))).toBe(stored);
    expect(await page.evaluate(()=>localStorage.getItem('tof-wish-hidden-profiles'))).toBeNull();
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();await page.locator('[data-datamine-language=ru]').click();
    await page.setViewportSize({width:390,height:844});
    const ruRemove=page.getByRole('button',{name:'Удалить из списка: First account',exact:true});
    await ruRemove.click();
    const ruConfirmation=page.getByRole('dialog',{name:'Убрать аккаунт из списка?',exact:true});
    await expect(ruConfirmation.getByRole('button',{name:'Отмена',exact:true})).toBeFocused();
    await ruConfirmation.getByRole('button',{name:'Отмена',exact:true}).click();await expect(ruRemove).toBeFocused();
    await ruRemove.click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'ignore/documentation-media/generated/wish-remove-confirmation-mobile-ru.png',animations:'disabled'});
    await ruConfirmation.getByRole('button',{name:'Удалить из списка',exact:true}).click();
    await expect(ruRemove).toHaveCount(0);
    await expect(page.locator('summary').filter({hasText:'Сменить аккаунт'})).toBeFocused();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('tof-wish-hidden-profiles')!))).toEqual([ids[0]]);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('tof-wish-imported-profile-ids')!))).toEqual([ids[1]]);
    expect(await page.evaluate(()=>localStorage.getItem('tof-wish-current-profile'))).toBe(ids[1]);
    await page.reload();await expect(ruRemove).toHaveCount(0);
    await expect(page.locator('main')).toContainText('Second account');
    // Local hiding cannot change the server response, even for the removed account.
    expect(await page.evaluate(async id=>(await fetch(`/api/v1/wish/profiles/${id}/imported`).then(response=>response.json())).profile.name,ids[0])).toBe('First account');
    expect(writes).toEqual([]);expect(errors).toEqual([]);
  });

  test('keeps tally and players out of the shared right-side navigation', async ({ page }) => {
    for (const path of ['/tools/wish/tally/']) {
      await page.goto(path);
      const rail = page.locator('header.fixed nav');
      await expect(rail).toBeVisible();
      await expect(rail.locator('a[href="/tools/wish/tally/"], a[href="/tools/wish/players/"]')).toHaveCount(0);
      await expect(page.locator('.info-ui > header:not(.fixed)')).toHaveCount(0);
    }

    await page.locator('header.fixed nav').getByRole('link', { name: /Wish Counter|Счётчик круток/ }).click();
    await expect(page).toHaveURL(/\/tools\/wish\/$/);
    const trackerRail = page.locator('header.fixed nav');
    await expect(trackerRail.getByRole('button', { name: /Wish Counter|Счётчик круток/ })).toHaveAttribute('aria-current', 'page');
    await expect(trackerRail.locator('a[href="/tools/wish/tally/"], a[href="/tools/wish/players/"]')).toHaveCount(0);
  });

  test('shows matrix options only when matrices are part of the simulation', async ({ page }) => {
    await page.goto('/tools/wish/?profileId=full-history-demo&tab=simulation');
    const matrixBox = page.getByRole('checkbox', { name: /50-Cost Matrix Box Purchased|Ящик матриц/ });
    const autoBlock = page.getByRole('checkbox', { name: /Auto-Block Saturated Slot|Авто.*блок/ });

    await page.getByRole('button', { name: /Weapon Only|Только оружие/ }).click();
    await expect(matrixBox).toHaveCount(0);
    await expect(autoBlock).toHaveCount(0);

    await page.getByRole('button', { name: /Matrices Only|Только матрицы/ }).click();
    await expect(matrixBox).toHaveCount(1);
    await expect(autoBlock).toHaveCount(1);
  });

  test('downloads the selected banner as a full-resolution PNG', async ({ page }) => {
    const heights:number[]=[];
    for(const viewport of [{width:1280,height:900},{width:3840,height:2160}]){
    await page.setViewportSize(viewport);
    await page.goto('/tools/wish/?profileId=full-history-demo&bannerId=weapon-zoey');
    const button = page.getByRole('button', { name: /Download banner PNG|Скачать баннер PNG/ });
    await expect(button).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^tof-wish-Demo-Wanderer-weapon-zoey\.png$/);
    const png = await readFile(await download.path());
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(2432);
    expect(png.readUInt32BE(20)).toBeGreaterThan(1000);
    heights.push(png.readUInt32BE(20));
    }
    expect(heights[1]).toBe(heights[0]);
  });

  test('collapses the live banner while keeping full-card export available', async ({ page }) => {
    await page.goto('/tools/wish/?profileId=full-history-demo&bannerId=weapon-zoey');
    const showcase = page.locator('#wish-banner-showcase');
    const exportButton = page.getByRole('button', { name: /Download banner PNG|Скачать баннер PNG/ });
    const collapseButton = page.getByRole('button', { name: /Collapse banner|Свернуть баннер/ });
    await expect(showcase).toBeVisible();
    expect(await exportButton.evaluate((button) => button.closest('#wish-banner-showcase'))).toBeNull();

    await collapseButton.click();
    await expect(showcase).toBeHidden();
    await expect(page.getByRole('button', { name: /Expand banner|Развернуть баннер/ })).toBeVisible();
    await expect(exportButton).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
    const png = await readFile(await download.path());
    expect(png.readUInt32BE(16)).toBe(2432);
    expect(png.readUInt32BE(20)).toBeGreaterThan(1000);

    await page.getByRole('button', { name: /Expand banner|Развернуть баннер/ }).click();
    await expect(showcase).toBeVisible();
  });

  test('exports custom aggregate art without its editing controls or dark edge effects', async ({ page }) => {
    await page.goto('/tools/wish/?profileId=full-history-demo&bannerId=all');
    const controls = page.locator('[data-wish-artwork-controls]');
    await expect(controls).toBeVisible();
    await controls.locator('input[type="file"]').setInputFiles({
      name: 'art.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9lVl8AAAAASUVORK5CYII=', 'base64'),
    });
    await page.evaluate(() => {
      const observer = new MutationObserver(() => {
        const scene = document.querySelector('[data-wish-export-root]');
        const card = scene?.firstElementChild;
        const art = card?.querySelector('img[aria-label]');
        if (!card || !art) return;
        (window as Window & { wishExportProbe?: unknown }).wishExportProbe = {
          hasControls: Boolean(card.querySelector('[data-wish-artwork-controls]')),
          borderWidth: getComputedStyle(card).borderTopWidth,
          shadow: getComputedStyle(card).boxShadow,
          artworkFilter: getComputedStyle(art).filter,
        };
        observer.disconnect();
      });
      observer.observe(document.body, { childList: true });
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download banner PNG|Скачать баннер PNG/ }).click(),
    ]);
    const png = await readFile(await download.path());
    expect(png.readUInt32BE(16)).toBe(2432);
    expect(await page.evaluate(() => (window as Window & { wishExportProbe?: unknown }).wishExportProbe)).toEqual({
      hasControls: false,
      borderWidth: '0px',
      shadow: 'none',
      // No drop shadow in the PNG; only the user's brightness (1 = unchanged) remains.
      artworkFilter: 'brightness(1)',
    });
    await expect(controls).toBeVisible();
  });

  test('keeps the full-history demo tracks separate from the event aggregate', async ({ page }) => {
    await page.goto('/tools/wish/?profileId=full-history-demo');
    const selector = page.getByRole('region', { name: /Banner selection|Выбор баннера/ });
    await expect(selector.getByRole('button', { name: /Choice Weapons/ })).toBeVisible();
    await expect(selector.getByRole('button', { name: /Choice Matrices/ })).toBeVisible();
    await expect(selector.getByRole('button', { name: /Weapons Galore/ })).toBeVisible();

    const showcase = page.locator('#wish-banner-showcase');
    await expect(showcase).toContainText(/All banners|Все баннеры/);
    await expect(showcase).toContainText('1,355');

    for (const [bannerName, count] of [
      ['Choice Weapons', '110'],
      ['Choice Matrices', '48'],
      ['Weapons Galore', '320'],
    ] as const) {
      await selector.getByRole('button', { name: new RegExp(bannerName) }).click();
      await expect(showcase).toContainText(bannerName);
      await expect(showcase).toContainText(count);
    }

    await selector.getByRole('button', { name: /All banners|Все баннеры/ }).click();
    await expect(showcase).toContainText('1,355');
    await expect(page).toHaveURL(/track=weapon_limited/);
    await page.getByRole('tab', { name: /History|История/ }).click();
    await expect(page.getByText(/100 shown of 1355|Показано 100 из 1355/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Collapse pulls for 28 December 2025/ })).toBeVisible();

    await page.goto('/tools/wish/?profileId=full-history-demo&track=standard_weapon');
    await expect(page.locator('#wish-banner-showcase')).toContainText('Choice Weapons');

    await page.goto('/tools/wish/?profileId=full-history-demo&tab=history&bannerId=matrix-standard');
    await expect(page.locator('#wish-banner-showcase img[src*="matrixfragment.webp"]')).toBeVisible();
    await expect(page.locator('img[src*="/Icon/yizhi/"]').first()).toBeVisible();
  });

  test('renders the event showcase and switches between weapon and matrix orders', async ({ page }) => {
    await page.goto('/tools/wish/?profileId=full-history-demo');
    await page.waitForLoadState('domcontentloaded');

    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/История круток|Special Orders Tracker/i);
    const selector = page.getByRole('region', { name: /Banner selection|Выбор баннера/ });
    await expect(page.locator('#wish-banner-showcase')).toContainText('1,355');
    await expect(selector.getByRole('button', { name: /Agleia Special Order/ })).toBeVisible();
    await expect(selector.getByRole('button', { name: /Berry Special Order/ })).toBeVisible();
    await expect(selector.getByRole('button', { name: /Gefion Special Order/ })).toBeVisible();
    await selector.getByRole('button', { name: /Berry Special Order/ }).click();
    await expect(page.locator('#wish-banner-showcase')).toContainText('470');
    await expect(page.locator('#wish-banner-showcase')).toContainText('530');
    await expect(page.locator('#wish-banner-showcase').getByRole('heading',{name:'Berry Special Order',exact:true})).toBeVisible();
    await selector.getByRole('button', { name: /Berry Matrix Special Order/ }).click();
    await expect(page.locator('#wish-banner-showcase')).toContainText('240');
    await expect(page.locator('#wish-banner-showcase').getByRole('heading',{name:'Berry Matrix Special Order',exact:true})).toBeVisible();
    await selector.getByRole('button', { name: /Zoey Special Order/ }).click();
    await expect(page.locator('#wish-banner-showcase')).toContainText('98');
    await selector.getByRole('button', { name: /Zoey Matrix Special Order/ }).click();
    await expect(page.locator('#wish-banner-showcase')).toContainText('137');
    const showcase = page.locator('#wish-banner-showcase');
    const matrixArtwork = await showcase.locator(':scope > div:first-child > img').first().getAttribute('src');
    await selector.getByRole('button', { name: /Berry Special Order/ }).click();
    await expect(selector.getByRole('button', { name: /Berry Special Order/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(showcase.locator('h2')).toHaveText('Berry Special Order');
    await expect(showcase).toContainText('470');
    await expect(showcase).toContainText('530');
    await expect(page).toHaveURL(/track=weapon_limited/);
    await expect(showcase.locator(':scope > div:first-child > img').first()).not.toHaveAttribute('src', matrixArtwork!);

    await page.goto('/tools/wish/?profileId=full-history-demo&banner=matrix-berry');
    await expect(showcase.locator('h2')).toHaveText('Berry Matrix Special Order');
    await expect(showcase).toContainText('240');
  });

  test('navigates through tabs: Overview, History, Analytics, and Simulation', async ({ page }) => {
    await page.goto('/tools/wish/?profileId=full-history-demo');
    await page.waitForLoadState('domcontentloaded');

    // History Tab
    const historyTabTrigger = page.getByRole('tab', { name: /История|History/i });
    await historyTabTrigger.click();

    // Switch to table view
    const tableViewBtn = page.getByRole('button', { name: /Журнал|Log/i });
    await tableViewBtn.click();
    const tableHeader = page.locator('table thead');
    await expect(tableHeader).toBeVisible();

    // Analytics Tab
    const analyticsTabTrigger = page.getByRole('tab', { name: /Личная аналитика|Analytics/i });
    await analyticsTabTrigger.click();

    // The banner card shows a similar label; check the metric inside the active Analytics panel.
    const winRateMetric = page.getByRole('tabpanel').getByText(/Чистый винрейт 50\/50|Pure 50\/50 Win Rate/i);
    await expect(winRateMetric).toBeVisible();

    // Simulation lives in the side navigation.
    await page.getByRole('button', { name: /Simulator|Симулятор/i }).click();
    await expect(page.getByText(/Simulation|Симуляция/i).first()).toBeVisible();
  });

  test('opens and closes Gacha Rules modal', async ({ page }) => {
    await page.goto('/tools/wish/?profileId=full-history-demo');
    await page.waitForLoadState('domcontentloaded');

    const rulesBtn = page.getByRole('button', { name: /Правила гаранта|Gacha Rules/i });
    await expect(rulesBtn).toBeVisible();
    await rulesBtn.click();

    const modalTitle = page.locator('text=/Механика специальных заказов|Special Orders Mechanics/i');
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

    const closeBtn = page.getByRole('button', { name: /Закрыть|Close/i }).last();
    await closeBtn.click();

    await expect(modalTitle).not.toBeVisible();
  });
});
