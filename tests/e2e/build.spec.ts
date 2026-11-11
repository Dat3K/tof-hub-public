import {test,expect,type Locator,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
test('weapon Up. editing follows generated breakthrough boundaries in EN/RU',async({page,context,baseURL})=>{
  test.setTimeout(90000);
  const catalog=await page.request.get('/game-data/build-page.json').then(response=>response.json());
  await page.addInitScript(draft=>localStorage.setItem('tof-build-draft-v1',JSON.stringify({...draft,demo:false})),catalog.demoDraft);
  for(const locale of ['en','ru']){
    await context.addCookies([{name:'tof_locale',value:locale,url:baseURL!}]);
    await page.goto('/tools/build/');
    const weapon=page.locator('article.card .weapon').first();
    await expect(weapon.locator('[data-build-edit="weapon-level:0"]')).toContainText('200');
    const lock=page.getByRole('checkbox',{name:locale==='ru'?'Заблокировать редактирование':'Lock editing',exact:true});
    await lock.focus();if(await lock.isChecked())await lock.press('Space');await expect(lock).not.toBeChecked();
    for(const [level,min,max] of [[190,19,20],[195,20,20],[200,20,21]]){
      await weapon.locator('[data-build-edit="weapon-level:0"]').focus();await page.keyboard.press('Enter');
      await page.getByRole('dialog').getByRole('spinbutton').fill(String(level));
      await page.keyboard.press('Escape');
      await weapon.locator('[data-build-edit="weapon-upgrade:0"]').focus();await page.keyboard.press('Enter');
      const input=page.getByRole('dialog').getByRole('spinbutton');
      await expect(input).toHaveAttribute('min',String(min));await expect(input).toHaveAttribute('max',String(max));
      await input.fill('99');await expect(input).toHaveValue(String(max));
      await page.keyboard.press('Escape');
      await expect(weapon.locator('[data-build-edit="weapon-upgrade:0"]')).toContainText(`Up. ${max}`);
    }
  }
});
/** The advanced editor is offered only while the card is unlocked for editing. */
async function openAdvancedEditor(page:Page) {
  const lock=page.getByRole('checkbox',{name:'Lock editing',exact:true});
  if(await lock.isChecked()){
    await lock.click();
    const replaceDemo=page.getByRole('dialog',{name:'Replace test data to edit?'});
    await expect.poll(async()=>await replaceDemo.isVisible()||!(await lock.isChecked())).toBe(true);
    if(await replaceDemo.isVisible())await replaceDemo.getByRole('button',{name:'Clear and edit'}).click();
    await expect(lock).not.toBeChecked();
  }
  await page.getByRole('checkbox',{name:'Advanced editor',exact:true}).check();
}

test('restores a local background and its framing after reload without uploading it to the server',async({page})=>{
  const catalog=await (await page.request.get('/game-data/build-page.json')).json();
  const personalDraft={...catalog.demoDraft,demo:false};
  await page.addInitScript(draft=>{if(!localStorage.getItem('tof-build-draft-v1'))localStorage.setItem('tof-build-draft-v1',JSON.stringify(draft));},personalDraft);
  await page.goto('/tools/build/');
  await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled();
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
  const input=page.getByLabel('Background image file',{exact:true});
  const siteArtwork=await page.locator('article.card .hero-art').getAttribute('src');
  const siteFraming=await page.locator('article.card .hero-art').getAttribute('style');
  await input.setInputFiles({name:'local.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9lVl8AAAAASUVORK5CYII=','base64')});
  const hero=page.locator('article.card .hero-art');
  await expect(hero).toHaveAttribute('src',/^blob:/);
  await page.getByRole('button',{name:'Background',exact:true}).click();
  await page.getByRole('slider',{name:'Art scale',exact:true}).focus();await page.keyboard.press('End');
  await page.getByRole('button',{name:'Move background',exact:true}).click();
  await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Escape');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-hub-local-artwork:build:settings')??'{}').art?.offsetX)).toBe(5);
  const style=await hero.getAttribute('style'),source=await hero.getAttribute('src');
  await page.reload();
  await expect(hero).toHaveAttribute('src',/^blob:/);
  await expect(hero).not.toHaveAttribute('src',source!);
  await expect(hero).toHaveAttribute('style',style!);
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
  await page.getByRole('button',{name:'Background',exact:true}).click();
  await page.getByRole('button',{name:'Reset artwork',exact:true}).click();
  await expect(hero).toHaveAttribute('src',siteArtwork!);
  await expect(hero).toHaveAttribute('style',siteFraming!);
  await page.reload();
  await expect(hero).not.toHaveAttribute('src',/^blob:/);
});


async function fillTestData(page:Page) {
  await page.getByRole('button',{name:/^(More actions|Дополнительные действия)$/}).click();
  await page.getByRole('button',{name:/^(Test data|Тестовые данные)$/}).click();
}

async function chooseCatalog(picker:Locator,value:string) {
  await picker.click();
  await picker.locator('..').locator(`[role="option"][data-value="${value}"]`).click();
}

test.describe('Build card editor',()=>{
  test('stores the captured title code and localizes it when changing card language',async({page,request})=>{
    const catalog=await request.get('/game-data/build-page.json').then(response=>response.json());
    const code=catalog.demoDraft.captureSource.capture.profile.titleId;
    const title=catalog.titles[code];
    await fillTestData(page);
    const displayed=page.locator('article.card .profile-character-title b');
    await expect(displayed).toHaveText(title.en);
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).profile.characterTitle)).toBe(code);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await expect(displayed).toHaveText(title.ru);
    await expect(displayed).toHaveAttribute('data-hint-overflow','true');
    await page.reload();
    await expect(displayed).toHaveText(title.ru);
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).profile.characterTitle)).toBe(code);
  });

  test('keeps resistance icons bright and colors the fully named resistance total',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
    const card=page.locator('article.card'),resistances=card.locator('.resistance-total');
    const iconOpacity=()=>resistances.locator('img').evaluateAll(nodes=>nodes.map(node=>{
      let opacity=1;for(let element:Element|null=node;element&&element.closest('article.card');element=element.parentElement)opacity*=Number(getComputedStyle(element).opacity);
      return opacity;
    }));
    await page.mouse.move(0,0);
    const baseline=await iconOpacity();
    await resistances.last().hover();
    await expect.poll(iconOpacity).toEqual(baseline);
    await expect(resistances.first().locator('b')).toHaveCSS('opacity','0.3');
    const tooltip=page.getByRole('tooltip');
    await expect(tooltip).toContainText('Total Resistance');
    const total=tooltip.locator('[data-stat-total="Resistance"]');
    await expect(total).toHaveAttribute('data-element','Altered');
    expect(await total.evaluate(node=>getComputedStyle(node).color)).toBe('rgb(63, 199, 154)');
    await resistances.last().click();
    const dialog=page.getByRole('dialog',{name:'Altered Resistance',exact:true});
    await expect(dialog).toContainText('Total Resistance');
    await expect(dialog.locator('[data-stat-total="Resistance"]')).toHaveAttribute('data-element','Altered');
  });

  test('colors each ATK total by its own inheritance source',async({page})=>{
    await fillTestData(page);
    for(const scenario of [{flat:50000,frostPercent:.1,attackColor:'Volt'},{flat:70000,frostPercent:.1,attackColor:'Volt'},{flat:70000,frostPercent:.3,attackColor:'Frost'}]){
      const storedDraft=await page.evaluate(({flat,frostPercent})=>{
        const draft=JSON.parse(localStorage.getItem('tof-build-draft-v1')!);
        draft.demo=false;delete draft.captureSource;delete draft.combat.consumableStatsApplied;
        draft.rv={...draft.rv,element:'Frost',weaponId:'gefion'};draft.weapons[0].id='gefion';
        draft.consumables=draft.consumables.map(()=>'');
        draft.support=draft.support.map((module:{id:string;level:number})=>({...module,level:0}));
        for(const element of draft.combat.elements){
          if(element.id==='Frost')Object.assign(element,{attack:flat,attackPercent:frostPercent,damage:.05});
          if(element.id==='Volt')Object.assign(element,{attack:60000,attackPercent:.2,damage:.01});
        }
        for(const gear of draft.gear)gear.equipped=false;
        Object.assign(draft.gear[9],{equipped:true,titan:false,augmented:false,rows:[
          {type:'Frost Attack %',value:frostPercent,beforeTitan:null},{type:'Volt Attack %',value:.2,beforeTitan:null},
          {type:'Frost Damage %',value:.05,beforeTitan:null},{type:'Volt Damage %',value:.01,beforeTitan:null},
        ]});
        return JSON.stringify(draft);
      },scenario);
      const previewPage=await page.context().newPage();
      await previewPage.addInitScript(raw=>localStorage.setItem('tof-build-draft-v1',raw),storedDraft);
      await previewPage.goto('/tools/build/');
      const check=async(label:string,kind:string,element:string)=>{
        await previewPage.locator('article.card').getByRole('button',{name:label,exact:true}).click();
        const total=previewPage.getByRole('dialog',{name:label,exact:true}).locator(`[data-stat-total="${kind}"]`);
        await expect(total).toHaveAttribute('data-element',element);
        expect(await total.evaluate(node=>getComputedStyle(node).color)).toBe(element==='Frost'?'rgb(75, 127, 214)':'rgb(178, 124, 255)');
        await previewPage.keyboard.press('Escape');
      };
      await check('Frost ATK','Attack',scenario.attackColor);
      await check('Frost ATK%','Attack %',scenario.frostPercent<.2?'Volt':'Frost');
      await check('Frost DMG%','Damage %','Frost');
      await check('Volt DMG%','Damage %','Frost');
      await previewPage.close();
    }
  });

  test('groups flat ATK sources into universal base and keeps the shot out of gear progression',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
    const card=page.locator('article.card');
    const number=(text:string|null)=>Number((text??'').replace(/[^0-9.-]/g,''));
    await card.getByRole('button',{name:'Universal ATK',exact:true}).click();
    const universal=page.getByRole('dialog',{name:'Universal ATK',exact:true});
    const row=universal.locator('[data-universal-attack-breakdown]');
    const other=number(await row.locator('strong').filter({hasText:'Other sources'}).locator('..').locator('b').textContent());
    const base=number(await row.locator('[data-gear-contribution="progression"] b').textContent());
    const rolls=number(await row.locator('[data-gear-contribution="rolls"] b').textContent());
    const total=number(await card.locator('.universal-attack-stat b').textContent());
    expect(Math.abs(other+base+rolls-total)).toBeLessThanOrEqual(2);
    // These are the captured example's fixed base/enhancement contribution, with no shot added.
    expect(base).toBe(16761);
    expect(other).toBe(20263);
    await page.keyboard.press('Escape');
    for(const element of ['Frost','Volt','Flame','Physical']){
      await card.getByRole('button',{name:`${element} ATK`,exact:true}).click();
      const dialog=page.getByRole('dialog',{name:`${element} ATK`,exact:true});
      await expect(dialog).toContainText('Universal base');
      await expect(dialog).not.toContainText('Other sources');
      await expect(dialog.locator('[data-gear-contribution="progression"]')).toHaveCount(0);
      await expect(dialog).not.toContainText('Enhancement shot');
      const universalBase=number(await dialog.locator('strong').filter({hasText:'Universal base'}).locator('..').locator('b').textContent());
      const random=number(await dialog.locator('[data-gear-contribution="rolls"] b').first().textContent());
      const own=number(await dialog.locator('strong').filter({hasText:`Base ATK · ${element}`}).locator('..').locator('b').textContent());
      expect(Math.abs(universalBase+random-own)).toBeLessThanOrEqual(1);
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await card.getByRole('button',{name:'Лед АТК',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Лед АТК',exact:true})).toContainText('Универсальная база');
  });

  test('opens Crit DMG details only over its label or value, leaving the row gap inactive',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
    const row=page.locator('article.card .crit-damage');
    const triggers=row.locator('button.inspect-trigger');
    await expect(triggers).toHaveCount(2);
    for(let index=0;index<2;index++){
      await triggers.nth(index).hover();
      await expect(page.getByRole('tooltip')).toContainText('Total Crit DMG');
      await triggers.nth(index).click();
      await expect(page.getByRole('dialog',{name:'Crit DMG',exact:true})).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await triggers.last().blur();
    const left=await triggers.first().boundingBox(),right=await triggers.last().boundingBox();
    const x=(left!.x+left!.width+right!.x)/2,y=left!.y+left!.height/2;
    await page.mouse.move(x,y);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(page.locator('article.card')).not.toHaveAttribute('data-stat-highlight');
    await page.mouse.click(x,y);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('inspects total crit chance with the same source highlights as crit rating',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
    const card=page.locator('article.card');
    await card.locator('.crit-damage b').hover();
    await expect(page.getByRole('tooltip')).toContainText('Total Crit DMG');
    await expect(page.getByRole('tooltip')).not.toContainText('Critical hit multiplier');
    const matches=()=>card.locator('[data-stat-match="true"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-stat-keys')).sort());
    await card.locator('.crit-rating').hover();
    const sources=await matches();
    expect(sources.length).toBeGreaterThan(3);
    await card.locator('.crit-breakdown.total').hover();
    expect(await matches()).toEqual(sources);
    const tooltip=page.getByRole('tooltip');
    await expect(tooltip).toContainText('Total Crit chance');
    await expect(tooltip).not.toContainText('Enemy-level coefficient');
    await page.mouse.move(0,0);
    const trigger=card.locator('.crit-breakdown.total').locator('xpath=ancestor::button[1]');
    await trigger.focus();
    expect(await matches()).toEqual(sources);
    await trigger.press('Enter');
    const dialog=page.getByRole('dialog',{name:'Crit chance',exact:true});
    await expect(dialog).not.toContainText('Enemy-level coefficient');
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await trigger.click();
    await expect(page.getByRole('dialog',{name:'Шанс крита',exact:true})).not.toContainText('Коэффициент уровня врага');
  });

  test('preserves the demo import style inside the Build preview and opens its app guide',async({page})=>{
    await fillTestData(page);
    await page.mouse.move(0,0);
    const button=page.locator('.demo-cta').getByRole('button',{name:'Import your build',exact:true});
    await expect(button).toBeVisible();
    const appearance=await button.evaluate(node=>{
      const style=getComputedStyle(node);
      return {color:style.color,background:style.backgroundColor,border:style.borderColor,padding:style.padding};
    });
    expect(appearance).toEqual({color:'rgb(245, 217, 122)',background:'rgba(14, 19, 29, 0.85)',border:'rgba(245, 217, 122, 0.4)',padding:'7px 14px'});
    await button.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
  });

  for(const locale of ['en','ru'] as const)test(`opens combat stat breakdown dialogs by click and keyboard · ${locale}`,async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
    if(locale==='ru'){
      await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
      await page.locator('[data-datamine-language="ru"]').click();
      await page.setViewportSize({width:844,height:390});
    }
    const card=page.locator('article.card');
    const controls=[
      {node:card.locator('.hp-stat'),details:'[data-hp-breakdown]'},
      {node:card.locator('.universal-attack-stat'),details:'[data-universal-attack-breakdown]'},
      {node:card.locator('.crit-rating'),details:'[data-crit-breakdown]'},
      {node:card.locator('.crit-breakdown.total'),details:'[data-crit-breakdown]'},
      {node:card.locator('.crit-damage b'),details:'[data-crit-damage-breakdown]'},
      ...Array.from({length:5},(_,i)=>({node:card.locator('.resistance-total').nth(i),details:'[data-resistance-breakdown]'})),
    ];
    for(const [index,{node,details}] of controls.entries()){
      const button=node.locator('xpath=ancestor::button[1]');
      const numeric=node.locator('b,strong');
      const value=await (await numeric.count()?numeric.last():node).textContent();
      if(index%2===0)await button.click();else{await button.focus();await button.press('Enter');}
      const dialog=page.getByRole('dialog').last();
      await expect(dialog).toHaveAccessibleName(await button.getAttribute('aria-label')??'');
      await expect(dialog.locator(details)).toBeVisible();
      await expect(dialog.locator(details)).toContainText(value!.trim());
      expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(button).toBeFocused();
    }
  });
  test.beforeEach(async({page})=>{
    await page.goto('/tools/build/');
    await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled();
    await openAdvancedEditor(page);
  });
  test('uses sourced demo damage, pet Crit chance, yellow weapon stars and left-to-right matrix pairs',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    await expect(card.locator('.crit-damage b')).toHaveText('50.00%');
    const data=await page.evaluate(async()=>fetch('/game-data/build-page.json').then(r=>r.json()));
    for(const [i,element] of data.demoDraft.combat.elements.entries())await expect(card.locator('.stat-table tbody tr').nth(i).locator('td').last()).toContainText((element.damage*100).toFixed(1)+'%');
    const weapon=card.locator('.weapon-art').first();
    await weapon.evaluate(node=>node.scrollIntoView({block:'center'}));
    await weapon.locator('.weapon-icon').hover({position:{x:8,y:30}});
    await expect(page.getByRole('tooltip')).toContainText('★6');
    await expect(page.getByRole('tooltip')).not.toContainText('A6');
    const stars=page.getByRole('tooltip').locator('[data-inspection-heading] span').filter({hasText:'★6'}).last();
    expect(await stars.evaluate(node=>getComputedStyle(node).color)).not.toBe('rgb(164, 220, 247)');
    await card.getByRole('button',{name:'Leia',exact:true}).first().hover();
    const enemyLevel=data.demoDraft.enemyLevel;
    await expect(page.getByRole('tooltip')).toContainText(`5,950 = ${(5950/data.reference.critFormula.denominators[enemyLevel]*100).toFixed(2)}% (Enemy Lv. ${enemyLevel})`);
    const strip=card.locator('.matrix-strip').first();
    const pair=await strip.locator('.matrix').evaluateAll(nodes=>nodes.slice(0,2).map(node=>node.getAttribute('data-matrix-slot')));
    await strip.locator('.matrix').first().hover();
    await expect(strip.locator('[data-matrix-highlight="true"]')).toHaveCount(2);
    expect(await strip.locator('[data-matrix-highlight="true"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-matrix-slot')))).toEqual(pair);
    await card.locator('.crit-rating').hover();
    await expect(card.locator('.matrix[data-matrix-slot="1"]').first()).toHaveAttribute('data-stat-match','false');
    await expect(card.locator('.computing-node').first()).toHaveAttribute('data-stat-match','false');
    const crit=card.locator('.roll[data-stat-keys="Crit"]').first();
    await expect(crit).toHaveAttribute('data-stat-match','true');
    expect(await crit.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    await page.screenshot({path:'ignore/documentation-media/generated/build/stat-source-dimming.png',animations:'disabled'});
    await page.mouse.move(0,0);
    await expect(card.locator('[data-stat-match]')).toHaveCount(0);
  });
  test('shows loading instead of an empty card before draft hydration',async({browser})=>{
    const context=await browser.newContext({javaScriptEnabled:false});
    try {
      const initial=await context.newPage();
      await initial.goto('/tools/build/');
      await expect(initial.locator('article.card')).toHaveCount(0);
      await expect(initial.getByRole('status')).toContainText('Loading build card editor');
    } finally {await context.close();}
  });
  test('keeps weapon level and star edit outlines around their text without clipping',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    const card=page.locator('article.card');
    const weapon=card.locator('.weapon').first();
    const level=weapon.locator('[data-build-edit="weapon-level:0"]');
    const stars=weapon.locator('.weapon-stars');
    for(const control of [level,stars]){
      await control.hover();
      await expect(control).toHaveCSS('outline-style','solid');
      expect(await control.evaluate(node=>{
        const bounds=node.getBoundingClientRect();
        const range=document.createRange();range.selectNodeContents(node);
        return Math.abs(bounds.width-range.getBoundingClientRect().width);
      })).toBeLessThan(4);
    }
    await expect(weapon.locator('.weapon-meta')).toHaveCSS('overflow','visible');
    await level.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await stars.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await level.hover();
    await expect(level).toHaveCSS('outline-style','solid');
    await page.screenshot({path:'ignore/documentation-media/generated/build/weapon-edit-outline-ru.png'});
  });
  test('drags artwork and controls scale beside the lock',async({page})=>{
    const {demoDraft}=await (await page.request.get('/game-data/build-page.json')).json();
    delete demoDraft.captureSource;
    await page.addInitScript(draft=>{
      if(sessionStorage.getItem('artwork-test-loaded'))return;
      localStorage.setItem('tof-build-draft-v1',JSON.stringify(draft));
      sessionStorage.setItem('artwork-test-loaded','1');
    },{...demoDraft,demo:false});
    await page.reload();
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    const card=page.locator('article.card');
    const art=card.locator('.hero-art');
    const background=page.getByRole('button',{name:'Background',exact:true});
    const move=page.getByRole('button',{name:'Move background',exact:true});
    const positioning=page.getByRole('button',{name:/^Move background:/});
    if(!await move.isVisible())await background.click();
    const zoom=page.getByRole('slider',{name:'Art scale',exact:true}).first();
    const lockBounds=(await page.getByRole('checkbox',{name:'Lock editing',exact:true}).locator('..').boundingBox())!;
    const scaleBounds=(await zoom.locator('..').boundingBox())!;
    // Background controls follow the editing lock in the toolbar and never cover it.
    expect(scaleBounds.x>=lockBounds.x+lockBounds.width||scaleBounds.y>=lockBounds.y+lockBounds.height).toBe(true);
    await zoom.focus();await page.keyboard.press('Home');
    await expect(art).toHaveCSS('transform',/^matrix\(0\.25, 0, 0, 0\.25,/);
    await zoom.focus();await page.keyboard.press('End');
    await expect(art).toHaveCSS('transform',/^matrix\(3, 0, 0, 3,/);
    await move.click();
    await expect(positioning).toBeVisible();
    const bounds=(await card.boundingBox())!;
    const readOffset=()=>art.evaluate(node=>parseFloat((node as HTMLElement).style.transform.match(/translate\(([-\d.]+)/)![1]));
    const initialOffset=await readOffset();
    // Dragging anywhere on the card moves the art; card controls do not react while positioning.
    await page.mouse.move(bounds.x+bounds.width*.25,bounds.y+bounds.height*.3);
    await page.mouse.down();
    await page.mouse.move(bounds.x+bounds.width*.6,bounds.y+bounds.height*.7);
    await expect.poll(readOffset).toBeCloseTo(initialOffset+35,0);
    const initialPosition=await art.evaluate(node=>(node as HTMLElement).style.transform);
    await page.mouse.move(bounds.x-20,bounds.y+bounds.height*.7);
    await expect.poll(()=>art.evaluate(node=>(node as HTMLElement).style.transform)).not.toBe(initialPosition);
    await page.mouse.up();
    const released=await art.evaluate(node=>(node as HTMLElement).style.transform);
    await page.mouse.move(bounds.x+bounds.width*.3,bounds.y+bounds.height*.3);
    await expect.poll(()=>art.evaluate(node=>(node as HTMLElement).style.transform)).toBe(released);
    await page.keyboard.press('Shift+ArrowLeft');
    for(let i=0;i<30;i++)await page.keyboard.press('Shift+ArrowLeft');
    await expect.poll(readOffset).toBeLessThan(-100);
    const fixed=await art.evaluate(node=>(node as HTMLElement).style.transform);
    await page.keyboard.press('Escape');
    await page.screenshot({path:'ignore/documentation-media/generated/build/art-pointer-editing.png'});
    await page.mouse.move(bounds.x+bounds.width*.8,bounds.y+bounds.height*.8);
    await expect.poll(()=>art.evaluate(node=>(node as HTMLElement).style.transform)).toBe(fixed);
    if(!await move.isVisible())await background.click();
    await move.click();
    await page.keyboard.press('Escape');
    await expect(positioning).toHaveCount(0);
    await card.locator('.art-edit-control').click();
    await page.getByRole('dialog').getByRole('button',{name:'Move background',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(positioning).toBeVisible();
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
    await expect(positioning).toHaveCount(0);
    await expect.poll(async()=>JSON.parse((await page.evaluate(()=>localStorage.getItem('tof-build-draft-v1')))! ).art.zoom).toBe(3);
    await page.reload();
    await expect.poll(()=>art.evaluate(node=>(node as HTMLElement).style.transform)).toBe(fixed);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await page.getByRole('checkbox',{name:'Заблокировать редактирование',exact:true}).uncheck();
    const scale=page.getByRole('slider',{name:'Масштаб арта',exact:true}).first();
    await expect(scale).toBeVisible();
    const sliderBounds=(await scale.boundingBox())!;
    expect(sliderBounds.x).toBeGreaterThanOrEqual(0);
    expect(sliderBounds.x+sliderBounds.width).toBeLessThanOrEqual(390);
  });
  test('dims technical labels during every stat inspection without dimming matching sources',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const labels=card.locator('.section-label,.section-title > small,.system > h3,.stats h3,.stat-table thead,.foot-brand,.card-metadata');
    const inspectors=[card.locator('.universal-attack-stat'),card.locator('.hp-stat'),card.locator('.crit-rating'),card.locator('.stat-table tbody tr td:nth-child(2)').first(),card.locator('.stat-table tbody tr td:nth-child(3)').first(),card.locator('.resistance-total').first(),card.locator('.titan-total').first()];
    for(const inspector of inspectors){
      await inspector.hover();
      await expect(card).toHaveAttribute('data-stat-highlight',/.+/);
      await expect.poll(()=>labels.evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).opacity==='0.3'))).toBe(true);
      await expect(inspector).toHaveAttribute('data-stat-match','true');
    }
    const attack=inspectors[3];
    await attack.hover();
    const resonance=card.locator('.equipment-heading .equipment-level');
    await expect(resonance).toHaveAttribute('data-stat-match','true');
    await expect.poll(()=>resonance.evaluate(node=>{
      let opacity=1;
      for(let current:Element|null=node;current&&!current.matches('article.card');current=current.parentElement)opacity*=Number(getComputedStyle(current).opacity);
      return opacity;
    })).toBe(1);
    await page.mouse.move(0,0);
    await expect(card).not.toHaveAttribute('data-stat-highlight');
    await expect.poll(()=>labels.evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).opacity==='1'))).toBe(true);
    await inspectors[0].locator('xpath=ancestor::button[1]').focus();
    await expect.poll(()=>labels.evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).opacity==='0.3'))).toBe(true);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await inspectors[0].hover();
    await expect.poll(()=>labels.evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).opacity==='0.3'))).toBe(true);
    await expect(inspectors[0]).toHaveAttribute('data-stat-match','true');
  });
  test('shows current gear base, enhancement and unlocked stats in game order',async({page})=>{
    await fillTestData(page);
    const data=await (await page.request.get('/game-data/build-page.json')).json();
    const card=page.locator('article.card');
    const fmt=(n:number,locale='en-US')=>new Intl.NumberFormat(locale,{maximumFractionDigits:0}).format(n);
    for(const [index,gear] of data.demoDraft.gear.entries()){
      const stage=gear.titan?'titan':gear.augmented?'augmented':'normal';
      const stats=data.gear.find((g:{id:string})=>g.id===gear.id).baseStats[stage].find((entry:{level:number})=>entry.level===gear.enhancement).stats;
      await card.locator('.gear-head .inspect-trigger:has(img)').nth(index).hover();
      const tooltip=page.getByRole('tooltip');
      await expect(tooltip).toContainText('Base Stats');
      for(const stat of stats.filter((stat:{base:number;enhancement:number})=>stat.base||stat.enhancement))
        await expect(tooltip).toContainText(`+${fmt(stat.base)} +${fmt(stat.enhancement)}`);
      const unlocked=stats.filter((stat:{unlocked:number})=>stat.unlocked>0);
      if(unlocked.length){
        await expect(tooltip).toContainText('Enhancement Unlocked');
        for(const stat of unlocked)await expect(tooltip).toContainText(`+${fmt(stat.unlocked)}`);
      } else await expect(tooltip).not.toContainText('Enhancement Unlocked');
      await expect(tooltip).not.toContainText('Random stats');
    }
    const eye=card.locator('.gear-head .inspect-trigger:has(img)').nth(8);
    await page.mouse.move(0,0);
    await page.keyboard.press('Tab');
    await eye.focus();
    await expect(page.getByRole('tooltip')).toContainText('Enhancement Unlocked');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await eye.hover();
    await expect(page.getByRole('tooltip')).toContainText('Базовые статы');
    await expect(page.getByRole('tooltip')).toContainText('Открытые бонусы усиления');
    expect((await page.getByRole('tooltip').boundingBox())!.width).toBeLessThanOrEqual(360);
  });
  test('audits progression source labels and flat versus percentage contributions across all stats',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const data=await (await page.request.get('/game-data/build-page.json')).json();
    const draft=data.demoDraft;
    const suppressor=data.suppressors.find((item:{id:string})=>item.id===draft.profile.suppressorId);
    const contract=data.enhancementResonance;
    const resonance=contract.tiers.filter((tier:{enhancement:number;count:number})=>draft.gear.filter((g:{id:string;equipped:boolean;enhancement:number})=>contract.slotIds.includes(g.id)&&g.equipped&&g.enhancement>=tier.enhancement).length>=tier.count).at(-1);
    const progression=[{node:card.locator('.suppressor-source'),stats:suppressor.stats},{node:card.locator('.equipment-heading .equipment-level'),stats:resonance.stats}];
    const fmt=(n:number,locale='en-US')=>new Intl.NumberFormat(locale,{maximumFractionDigits:0}).format(n);
    for(const attack of await card.locator('.stat-table tbody tr td:nth-child(2)').all()){
      await attack.hover();
      for(const {node,stats} of progression){
        await expect(node).toHaveAttribute('data-stat-match','true');
        await expect(node).toHaveAttribute('data-damage-bonus',`ATK: +${fmt(stats.atk)}`);
      }
      const expected=draft.computing.map((node:{id:string;level:number})=>data.computing.find((entry:{id:string})=>entry.id===node.id)?.effects
        .filter((effect:{attackStat:boolean})=>effect.attackStat).reduce((sum:number,effect:{levels:{level:number;value:number}[]})=>
          sum+(effect.levels.find(point=>point.level===node.level)?.value??0),0)??0);
      for(const [index,amount] of expected.entries())if(amount>0)await expect(card.locator('.computing-node').nth(index))
        .toHaveAttribute('data-damage-bonus',`ATK%: +${(amount*100).toFixed(1)}%`);
    }
    const checks=[{node:card.locator('.hp-stat'),key:'hp',label:'HP'},{node:card.locator('.crit-rating'),key:'crit',label:'Crit'},{node:card.locator('.resistance-total').nth(2),key:'res',label:'Resistance'}];
    for(const check of checks){
      await check.node.hover();
      for(const {node,stats} of progression){
        await expect(node).toHaveAttribute('data-stat-match','true');
        await expect(node).toHaveAttribute('data-damage-bonus',`${check.label}: +${fmt(stats[check.key])}`);
        expect(await node.evaluate(el=>getComputedStyle(el,'::after').textTransform)).toBe('none');
        expect(await node.evaluate(el=>getComputedStyle(el,'::after').letterSpacing)).toBe('normal');
      }
    }
    for(const column of [3,4]){
      await card.locator(`.stat-table tbody tr td:nth-child(${column})`).first().hover();
      for(const {node} of progression)await expect(node).toHaveAttribute('data-stat-match','false');
    }
    await page.mouse.move(0,0);
    await card.locator('.stat-table tbody tr td:nth-child(2)').first().focus();
    await expect(progression[1].node).toHaveAttribute('data-damage-bonus',`ATK: +${fmt(resonance.stats.atk)}`);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await card.locator('.stat-table tbody tr td:nth-child(2)').first().hover();
    for(const {node,stats} of progression)await expect(node).toHaveAttribute('data-damage-bonus',`АТК: +${fmt(stats.atk,'ru-RU')}`);
    await card.locator('.resistance-total').first().hover();
    for(const {node,stats} of progression){
      await expect(node).toHaveAttribute('data-damage-bonus',`Сопротивление: +${fmt(stats.res,'ru-RU')}`);
      expect(await node.evaluate(el=>getComputedStyle(el,'::after').textTransform)).toBe('none');
    }
  });
  test('shows Titan effect percentages from combined levels with mouse, keyboard and Russian tooltips',async({page})=>{
    await fillTestData(page);
    const data=await (await page.request.get('/game-data/build-page.json')).json();
    const card=page.locator('article.card');
    const id='CommonAtkAggravatingInjury';
    const pieces=data.demoDraft.gear.filter((gear:{id:string;equipped:boolean;rareId:string})=>gear.equipped&&gear.rareId===id);
    const level=pieces.reduce((sum:number,gear:{rareLevel:number})=>sum+gear.rareLevel,0);
    const effect=data.reference.titanRare.items.find((item:{id:string})=>item.id===id).effectCurve.find((point:{level:number})=>point.level===level);
    expect(pieces.length).toBeGreaterThan(1);
    expect(effect?.value).toBeGreaterThan(0);
    const total=card.locator(`.titan-total[data-titan-stat="${id}"]`);
    const rare=card.locator(`.rare[data-stat-keys="${id}"]`);
    const tooltip=page.getByRole('tooltip');
    const expectEffect=async(locale:'en'|'ru')=>{
      const effectText=new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:3}).format(effect.value);
      await expect(tooltip).toContainText(locale==='en'?'Direct normal attack damage':'Прямой урон обычных атак');
      await expect(tooltip).toContainText(`+${effectText}`);
      await expect(tooltip.locator('[data-titan-level]')).toHaveText(`+${level}`);
    };
    await total.hover();
    await expectEffect('en');
    await expect(card.locator('.rare[data-stat-match="true"]')).toHaveCount(pieces.length);
    await rare.first().hover();
    await expect(total).toHaveAttribute('data-stat-match','true');
    await page.mouse.move(0,0);
    await total.focus();
    await expectEffect('en');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await total.hover();
    await expectEffect('ru');
    expect((await tooltip.boundingBox())!.width).toBeLessThanOrEqual(360);
  });
  test('shows HP sources from weapons, matrices, progression and the shot including HP percentage gear',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const hp=card.locator('.hp-stat');
    const shot=card.locator('[data-consumable-slot="enhancement"]');
    await hp.hover();
    await expect(card.locator('.weapon-art[data-stat-match="true"]')).toHaveCount(3);
    await expect(card.locator('.weapon-art').first()).toHaveAttribute('data-damage-bonus','HP: +79,999');
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(9);
    await expect(card.locator('.matrix[data-matrix-slot="3"]').first()).toHaveAttribute('data-stat-match','false');
    await expect(card.locator('.matrix[data-matrix-slot="1"]').nth(1)).toHaveAttribute('data-damage-bonus',/^HP: \+[1-9][\d,]*$/);
    await expect(card.locator('.suppressor-source')).toHaveAttribute('data-damage-bonus',/^HP: \+[1-9][\d,]*$/);
    await expect(card.locator('.equipment-heading .equipment-level[data-stat-match="true"]')).toHaveCount(1);
    const shotHp=await shot.getAttribute('data-damage-bonus');
    expect(shotHp).toMatch(/^HP: \+[\d,]+$/);
    for(const gearHP of await card.locator('.base [data-stat-keys="HP"],.roll[data-stat-keys="HP"],.roll[data-stat-keys="HP %"],.augment-value[data-stat-keys="HP %"]').all())await expect(gearHP).toHaveAttribute('data-stat-match','true');
    await expect(card.locator('.computing-node[data-stat-match="true"]')).toHaveCount(0);
    await expect(card.locator('[data-consumable-slot="food"]')).toHaveAttribute('data-stat-match','false');
    await page.mouse.move(0,0);
    await hp.focus();
    await expect(shot).toHaveAttribute('data-damage-bonus',shotHp!);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await hp.hover();
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(9);
    await expect(shot).toHaveAttribute('data-damage-bonus',/^HP: \+[\d\s]+$/);
    const data=await (await page.request.get('/game-data/build-page.json')).json();
    const max=structuredClone(data.demoDraft);
    max.demo=false;
    delete max.captureSource;
    max.weapons.forEach((w:{level:number;matrices:{level:number;stars:number}[]})=>{w.level=200;w.matrices.forEach(m=>{m.level=100;m.stars=3;});});
    await page.addInitScript(draft=>localStorage.setItem('tof-build-draft-v1',JSON.stringify(draft)),max);
    await page.reload();
    await hp.hover();
    await expect(shot).toHaveAttribute('data-damage-bonus','HP: +0');
  });
  test('shows universal resistance sources and shot gains for every element',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const totals=card.locator('.resistance-total');
    const shot=card.locator('[data-consumable-slot="enhancement"]');
    const data=await (await page.request.get('/game-data/build-page.json')).json();
    const suppressor=data.suppressors.find((item:{id:string})=>item.id===data.demoDraft.profile.suppressorId);
    const suppressorResistance=new Intl.NumberFormat('en',{maximumFractionDigits:0}).format(suppressor.stats.res);
    await totals.first().hover();
    await expect(shot).toHaveAttribute('data-damage-bonus',/^Resistance: \+[1-9][\d,]*$/);
    const shotBonus=await shot.getAttribute('data-damage-bonus');
    for(let i=0;i<5;i++){
      await totals.nth(i).hover();
      await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(3);
      await expect(card.locator('.matrix[data-matrix-slot="3"]').first()).toHaveAttribute('data-damage-bonus','Resistance: +833');
      await expect(card.locator('.suppressor-source')).toHaveAttribute('data-stat-match','true');
      await expect(card.locator('.suppressor-source')).toHaveAttribute('data-damage-bonus',`Resistance: +${suppressorResistance}`);
      await expect(card.locator('.equipment-heading .equipment-level[data-stat-match="true"]')).toHaveCount(1);
      await expect(card.locator('.computing-node[data-stat-match="true"]')).toHaveCount(2);
      await expect(card.locator('.computing-node').first()).toHaveAttribute('data-damage-bonus','RES%: +6.0%');
      await expect(card.locator('.computing-node').nth(1)).toHaveAttribute('data-damage-bonus','RES%: +7.0%');
      await expect(shot).toHaveAttribute('data-stat-match','true');
      await expect(shot).toHaveAttribute('data-damage-bonus',shotBonus!);
      await expect(card.locator('.weapon-art[data-stat-match="true"]')).toHaveCount(0);
      await expect(card.locator('[data-consumable-slot="food"]')).toHaveAttribute('data-stat-match','false');
    }
    await page.mouse.move(0,0);
    await totals.first().locator('xpath=ancestor::button[1]').focus();
    await expect(shot).toHaveAttribute('data-damage-bonus',shotBonus!);
    await page.screenshot({path:'ignore/documentation-media/generated/build/resistance-sources.png',animations:'disabled'});
    const variant=structuredClone(data.demoDraft);
    variant.demo=false;
    delete variant.captureSource;
    variant.weapons[0].id=data.weapons.find((w:{stats?:{max_stats:{resistance?:number;def?:number}}})=>(w.stats?.max_stats.resistance??w.stats?.max_stats.def??0)>0).id;
    await page.addInitScript(draft=>localStorage.setItem('tof-build-draft-v1',JSON.stringify(draft)),variant);
    await page.reload();
    await totals.first().hover();
    await expect(card.locator('.weapon-art').first()).toHaveAttribute('data-stat-match','true');
    await expect(card.locator('.weapon-art').first()).toHaveAttribute('data-damage-bonus',/^Resistance: \+[1-9]/);
    await expect(shot).toHaveAttribute('data-damage-bonus',/^Resistance: \+[1-9]/);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await totals.last().hover();
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(3);
    await expect(card.locator('.suppressor-source')).toHaveAttribute('data-damage-bonus',`Сопротивление: +${suppressorResistance}`);
    await expect(card.locator('.computing-node').first()).toHaveAttribute('data-damage-bonus',/^Сопротивление%: \+6,0\s*%$/);
  });
  test('highlights ATK% from shots, food, computing and applicable matrix pairs',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const shot=card.locator('[data-consumable-slot="attack"]');
    const food=card.locator('[data-consumable-slot="food"]');
    await card.locator('.stat-table tbody tr').first().locator('td').nth(1).hover();
    await expect(shot).toHaveAttribute('data-stat-match','true');
    await expect(shot).toHaveAttribute('data-damage-bonus','ATK%: +3.5%');
    await expect(food).toHaveAttribute('data-stat-match','false');
    await expect(card.locator('.computing-node[data-stat-match="true"]')).toHaveCount(2);
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(6);
    await expect(card.locator('.matrix[data-stat-match="true"][data-damage-bonus]')).toHaveCount(0);
    await expect(card.locator('.weapon').first().locator('.matrix-set-row')).toHaveAttribute('data-stat-match','true');
    await expect(card.locator('.weapon').first().locator('.matrix-set-row')).toHaveAttribute('data-damage-bonus','ATK%: +34.0%');
    await expect(card.locator('.weapon').first().locator('.matrix-set-row b')).toHaveCSS('opacity','0.3');
    await page.screenshot({path:'ignore/documentation-media/generated/build/attack-percent-sources.png'});
    await card.locator('.stat-table tbody tr').nth(3).locator('td').nth(1).hover();
    await expect(food).toHaveAttribute('data-stat-match','true');
    await expect(food).toHaveAttribute('data-damage-bonus','ATK%: +12.0%');
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(4);
    await expect(card.locator('.weapon').first().locator('.matrix-set-row')).not.toHaveAttribute('data-stat-match','true');
    await page.mouse.move(0,0);
    await expect(card.locator('.weapon').first().locator('.matrix-set-row b')).toHaveCSS('opacity','1');
    await card.locator('.stat-table tbody tr').nth(1).locator('td').nth(1).focus();
    await expect(shot).toHaveAttribute('data-stat-match','true');
    await expect(food).toHaveAttribute('data-stat-match','false');
    // Volt ATK%: the Evolution Cube's all-element set is a lit source (its name dims behind the bonus bubble).
    await expect(card.locator('.weapon').nth(1).locator('.matrix-set-row b')).toHaveCSS('opacity','0.3');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await card.locator('.stat-table tbody tr').nth(3).locator('td').nth(1).hover();
    await expect(food).toHaveAttribute('data-stat-match','true');
    await expect(shot).toHaveAttribute('data-damage-bonus',/^АТК%: \+3,5\s*%$/);
    const data=await (await page.request.get('/game-data/build-page.json')).json();
    const paired=data.matrices.find((m:{name:{en:string}})=>m.name.en==='Future');
    const variant=structuredClone(data.demoDraft);
    variant.consumables[data.consumables.findIndex((g:{id:string})=>g.id==='attack')]=data.consumables.find((g:{id:string})=>g.id==='attack').items.find((item:{name:{en:string}})=>item.name.en==='Blade Shot').id;
    variant.weapons.forEach((w:{matrices:{id:string;stars:number}[]},weaponIndex:number)=>w.matrices.forEach((m,index)=>{m.id=weaponIndex===0&&index<2?paired.id:'';m.stars=3;}));
    await page.addInitScript(draft=>localStorage.setItem('tof-build-draft-v1',JSON.stringify(draft)),variant);
    await page.reload();
    await card.locator('.stat-table tbody tr').nth(2).locator('td').nth(1).hover();
    await expect(shot).toHaveAttribute('data-damage-bonus',/^АТК%: \+2,5\s*%$/);
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(2);
    await card.locator('.stat-table tbody tr').first().locator('td').nth(1).hover();
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(0);
    await card.locator('.stat-table tbody tr').nth(3).locator('td').nth(1).hover();
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(2);
  });
  test('inspects all elemental sources from the element label without Enhancement Shot gain bubbles',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const frost=card.locator('.stat-table tbody tr').first().locator('.element-stat-label');
    const check=async()=>{
      await expect(card.locator('.weapon-art[data-stat-match="true"]')).toHaveCount(3);
      await expect(card.locator('.weapon-art').first()).toHaveAttribute('data-damage-bonus','ATK: +1,612');
      const memory=card.locator('.weapon').nth(1).locator('.matrix[data-matrix-slot="1"]');
      await expect(memory).toHaveAttribute('data-stat-match','true');
      await expect(memory).toHaveAttribute('data-damage-bonus','ATK: +260');
      await expect(card.locator('[data-consumable-slot="enhancement"]')).toHaveAttribute('data-damage-bonus','ATK: +2,199');
      await expect(card.locator('[data-consumable-slot="attack"]')).toHaveAttribute('data-stat-match','true');
      await expect(card.locator('[data-consumable-slot="attack"]')).toHaveAttribute('data-damage-bonus','ATK%: +3.5%');
      await expect(card.locator('[data-consumable-slot="food"]')).toHaveAttribute('data-stat-match','false');
      await expect(card.locator('.computing-node[data-stat-match="true"]')).toHaveCount(4);
      await expect(card.locator('.weapon').first().locator('.matrix-set-row')).toHaveAttribute('data-damage-bonus','ATK%: +34.0%');
      await expect(card).not.toHaveAttribute('data-stat-highlight',/@enhancement-shot/);
    };
    await frost.hover();
    await check();
    await page.mouse.move(0,0);
    await frost.focus();
    await check();
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await frost.hover();
    await expect(card.locator('.weapon-art[data-stat-match="true"]')).toHaveCount(3);
    await expect(card.locator('[data-consumable-slot="attack"]')).toHaveAttribute('data-damage-bonus',/^АТК%: \+3,5\s*%$/);
    await expect(card.locator('[data-consumable-slot="food"]')).toHaveAttribute('data-stat-match','false');
  });
  test('shows food flat attack separately from food ATK% and fills sourced demo percentages',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const rows=card.locator('.stat-table tbody tr');
    const expected=['125.9%','91.7%','73.0%','80.5%','68.5%'];
    for(let i=0;i<expected.length;i++)await expect(rows.nth(i).locator('td').nth(1)).toHaveText(expected[i]);
    const food=card.locator('[data-consumable-slot="food"]');
    const consumableBonusesDoNotOverlap=()=>card.locator('.consumable-slots').evaluate(node=>{
      const slots=[...node.querySelectorAll<HTMLElement>('.consumable-slot')].slice(0,2);
      const bounds=slots.map(slot=>{
        const box=slot.getBoundingClientRect();
        const style=getComputedStyle(slot,'::after');
        const width=parseFloat(style.width)+(style.boxSizing==='border-box'?0:parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth));
        const scale=box.width/slot.offsetWidth;
        const left=style.left==='auto'?box.right-(parseFloat(style.right)+width)*scale:box.left+parseFloat(style.left)*scale;
        return {left,right:left+width*scale};
      });
      return bounds[0].right<bounds[1].left;
    });
    await rows.nth(3).locator('td').first().hover();
    await expect(food).toHaveAttribute('data-stat-match','true');
    await expect(food).toHaveAttribute('data-damage-bonus','ATK: +500');
    const heart=card.locator('.weapon').nth(1).locator('.matrix-set-row').first();
    const night=card.locator('.weapon').nth(2).locator('.matrix-set-row').nth(1);
    await expect(heart).toHaveAttribute('data-stat-match','true');
    await expect(heart).toHaveAttribute('data-damage-bonus','ATK%: +30.0%');
    await expect(heart.locator('b')).toHaveCSS('opacity','0.3');
    await expect(night).toHaveAttribute('data-damage-bonus','ATK%: +2.6% ×5 (conditional)');
    await expect(night.locator('b')).toHaveCSS('opacity','0.3');
    const setOnly=card.locator('.weapon').nth(1).locator('.matrix[data-matrix-slot="0"]');
    await expect(setOnly).toHaveAttribute('data-stat-match','true');
    await expect(setOnly).not.toHaveAttribute('data-damage-bonus');
    await page.screenshot({path:'ignore/documentation-media/generated/build/attack-matrix-set-sources.png',animations:'disabled'});
    await rows.nth(3).locator('td').nth(1).hover();
    await expect(food).toHaveAttribute('data-damage-bonus','ATK%: +12.0%');
    await expect.poll(consumableBonusesDoNotOverlap).toBe(true);
    await rows.first().locator('td').first().hover();
    await expect(food).toHaveAttribute('data-stat-match','false');
    await food.locator('button').hover();
    await expect(card).not.toHaveAttribute('data-stat-highlight',/@enhancement-shot/);
    await expect(page.getByRole('tooltip')).toContainText('Power Nutripaste');
    await page.mouse.move(0,0);
    await rows.nth(3).locator('td').first().focus();
    await expect(food).toHaveAttribute('data-damage-bonus','ATK: +500');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await rows.nth(3).locator('td').nth(1).hover();
    await expect(food).toHaveAttribute('data-damage-bonus',/^АТК%: \+12,0\s*%$/);
    await expect.poll(consumableBonusesDoNotOverlap).toBe(true);
    await rows.nth(3).locator('td').first().hover();
    await expect(food).toHaveAttribute('data-damage-bonus','ATK: +500');
    await expect(heart).toHaveAttribute('data-damage-bonus',/^АТК%: \+30,0\s*%$/);
    await expect(heart.locator('b')).toHaveCSS('opacity','0.3');
  });
  test('shows pet stats and Global attack inheritance in its tooltip',async({page})=>{
    await fillTestData(page);
    const pet=page.locator('article.card .system-media button').first();
    await pet.hover();
    const tooltip=page.getByRole('tooltip');
    await expect(tooltip).toContainText('ATK:6,855 +3,597');
    await expect(tooltip).toContainText('Player ATK (10% inherited):35,969');
    const inherited=tooltip.locator('[data-pet-inherited-attack]');
    await expect(inherited).toHaveText('+3,597');
    const numericStyles=await tooltip.evaluate(node=>{
      const base=node.querySelector('[data-pet-inherited-attack]')!.parentElement!;
      const player=node.querySelector('.game-rich-text .sim-num-hl')!;
      const style=(el:Element)=>{const s=getComputedStyle(el);return [s.fontFamily,s.fontSize,s.fontWeight];};
      return {base:style(base),player:style(player),inherited:style(node.querySelector('[data-pet-inherited-attack]')!),baseColor:getComputedStyle(base).color,playerColor:getComputedStyle(player).color};
    });
    expect(numericStyles.base).toEqual(numericStyles.player);
    expect(numericStyles.inherited).toEqual(numericStyles.player);
    expect(numericStyles.baseColor).toEqual(numericStyles.playerColor);
    const color=await inherited.evaluate(node=>getComputedStyle(node).color.match(/\d+/g)!.map(Number));
    expect(color[1]).toBeGreaterThan(color[0]);
    expect(color[1]).toBeGreaterThan(color[2]);
    await expect(tooltip).not.toContainText('Total ATK');
    await expect(tooltip).toContainText('Crit:5,950');
    await expect(tooltip).toContainText('Crit DMG:50%');
    await page.screenshot({path:'ignore/documentation-media/generated/build/pet-stats-inheritance.png'});
    await page.mouse.move(0,0);
    await pet.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(tooltip).toContainText('Player ATK (10% inherited)');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await pet.hover();
    await expect(tooltip).toContainText(/АТК игрока \(10\s*% наследуется\)/);
    expect((await tooltip.boundingBox())!.width).toBeLessThanOrEqual(360);
  });
  test('shows Enhancement Shot gains only beside equipment it actually increases',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const shot=card.locator('[data-consumable-slot="enhancement"] button');
    await shot.hover();
    await expect(page.getByRole('tooltip')).toContainText('ATK:');
    expect((await page.getByRole('tooltip').boundingBox())!.width).toBeLessThanOrEqual(360);
    // Demo: Lv.200/180/160 weapons; nine matrices are below ★3 or Lv.100.
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(9);
    await expect(card.locator('.weapon-art[data-stat-match="true"]')).toHaveCount(2);
    // The weapon name row carries the progression link; every demo set has a piece below its maximum.
    await expect(card.locator('.weapon-name-row[data-stat-match="true"]')).toHaveCount(2);
    await expect(card.locator('.weapon-name-row[data-stat-match="false"]')).toHaveCount(1);
    const unchangedSet=card.locator('.weapon').nth(0).locator('.matrix-set-row').first();
    await expect(card.locator('.matrix-set-row[data-stat-match="true"]')).toHaveCount(4);
    const weaponBonus=card.locator('.weapon-art[data-stat-match="true"]').first();
    const insideWeapon=()=>weaponBonus.evaluate(node=>{
      const anchor=node.getBoundingClientRect();
      const weapon=node.closest('.weapon')!.getBoundingClientRect();
      const bubble=getComputedStyle(node,'::after');
      const scale=anchor.width/(node as HTMLElement).offsetWidth;
      const transform=new DOMMatrix(bubble.transform==='none'?undefined:bubble.transform);
      const left=anchor.left+(parseFloat(bubble.left)+transform.m41)*scale;
      const right=left+parseFloat(bubble.width)*scale;
      return left>=weapon.left&&right<=weapon.right;
    });
    expect(await insideWeapon()).toBe(true);
    await expect(card.locator('.matrix[data-stat-match="true"]').first()).toHaveAttribute('data-damage-bonus',/ATK: \+/);
    const adjacent=card.locator('.weapon').first().locator('.matrix[data-stat-match="true"]');
    await expect(adjacent).toHaveCount(2);
    for(const matrix of await adjacent.all()){
      await expect(matrix).toHaveAttribute('data-damage-bonus',/ATK:.*\nHP:/);
      expect(await matrix.evaluate(n=>getComputedStyle(n,'::after').whiteSpace)).toBe('pre-line');
    }
    await page.screenshot({path:'ignore/documentation-media/generated/build/enhancement-shot-bonuses.png'});
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await shot.hover();
    expect(await insideWeapon()).toBe(true);
    await page.getByRole('button',{name:'Выбор языка: Русский',exact:true}).click();
    await page.locator('[data-datamine-language="en"]').click();
    await page.setViewportSize({width:1280,height:720});
    const catalog=await (await page.request.get('/game-data/build-page.json')).json();
    const maximum=structuredClone(catalog.demoDraft);
    maximum.weapons.forEach((weapon:{level:number})=>{weapon.level=catalog.defaultLevels.weapon;});
    for(const weapon of maximum.weapons)for(const [index,matrix] of weapon.matrices.entries()){
      const entry=catalog.matrices.find((m:{id:string})=>m.id===matrix.id);
      const profile=catalog.matrixStats.profiles[entry.statProfiles[index]];
      matrix.level=Math.max(...profile.levels.map((l:{level:number})=>l.level));
      matrix.stars=Math.max(...profile.starMultipliers.map((s:{stars:number})=>s.stars));
    }
    await page.addInitScript(draft=>localStorage.setItem('tof-build-draft-v1',JSON.stringify(draft)),maximum);
    await page.reload();
    await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled();
    await shot.hover();
    await expect(page.getByRole('tooltip')).toContainText('ATK:+0');
    await expect(card.locator('.matrix[data-stat-match="true"],.weapon-art[data-stat-match="true"]')).toHaveCount(0);
    await expect(card.locator('.weapon-name-row[data-stat-match="false"]')).toHaveCount(3);
    await expect(card.locator('.matrix-set-row[data-stat-match="false"]')).toHaveCount(4);
    await page.mouse.move(0,0);
    await expect(card.locator('.weapon-name-row[data-stat-match],.matrix-set-row[data-stat-match]')).toHaveCount(0);
    await expect(unchangedSet).toHaveCSS('opacity','1');
  });
  test('edits individual gear fields and restricts Titan additions',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    const card=page.locator('article.card');
    await card.locator('[data-build-edit="gear-level:0"]').click();
    await expect(page.getByRole('dialog').getByRole('spinbutton')).toHaveCount(1);
    await page.getByRole('dialog').getByRole('spinbutton').fill('45');
    await page.keyboard.press('Escape');
    await expect(card.locator('[data-build-edit="gear-level:0"]')).toHaveText('+45');
    await card.locator('[data-build-edit="gear-stars:0"]').click();
    await expect(page.getByRole('dialog').getByRole('button',{name:'★5',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    for(const target of ['gear-stat:0:random:0','gear-stat:0:augment:0','gear-stat:0:rare:0']){
      await card.locator(`[data-build-edit="${target}"]`).click();
      const dialog=page.getByRole('dialog');
      await expect(dialog.getByLabel('Equipped',{exact:true})).toHaveCount(0);
      await expect(dialog.getByLabel('Enhancement',{exact:true})).toHaveCount(0);
      if(target.includes(':augment:')){
        await dialog.getByLabel('Added Titan stat 1',{exact:true}).click();
        const options=await dialog.getByRole('listbox').getByRole('option').allTextContents();
        expect(options).not.toContain('Crit');
        expect(options).not.toContain('Frost ATK');
        await page.keyboard.press('Escape');
      }
      await page.keyboard.press('Escape');
    }
    await card.locator('[data-build-edit="gear:0"] .gear-head img').click();
    await expect(page.getByRole('dialog').getByLabel('Equipped',{exact:true})).toBeVisible();
  });
  test('uses Comp panels and shows no modules at full Load',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    const card=page.locator('article.card');
    const headings=await card.evaluate(node=>{
      const element=getComputedStyle(node.querySelector('.stat-table thead th')!);
      const resistance=getComputedStyle(node.querySelector('.resistance-summary h3')!);
      return ['fontSize','fontWeight','color','letterSpacing','textTransform'].every(key=>element.getPropertyValue(key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()))===resistance.getPropertyValue(key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())));
    });
    expect(headings).toBe(true);
    await card.locator('.weapon-title').first().click();
    const dialog=page.getByRole('dialog');
    const panel=dialog.locator('.tool-panel');
    expect((await panel.boundingBox())!.width).toBe(1080);
    const controls=dialog.locator('.tool-panel-controls');
    const before=await controls.boundingBox();
    await expect(dialog.locator('.tool-picker-card').first()).toBeVisible();
    await expect(dialog.locator('.tool-picker-card-badges').first()).toContainText('SSR');
    await expect(dialog.locator('.tool-picker-card-subtitle').first()).toBeVisible();
    const body=controls.locator('..').locator(':scope > div.overflow-y-auto');
    await body.evaluate(node=>{node.scrollTop=300;});
    expect(await controls.boundingBox()).toEqual(before);
    await body.evaluate(node=>{node.scrollTop=0;});
    await expect(dialog.locator('.tool-picker-card-badges img').first()).toBeVisible();
    await page.screenshot({path:'ignore/documentation-media/generated/build/comp-style-weapon-picker.png'});
    await page.keyboard.press('Escape');
    for(const slot of [2,3]){
      await card.locator(`[data-build-edit="module:${slot}"]`).click();
      await expect(dialog).toContainText('Load: 15 / 15');
      await expect(dialog.locator('[data-id]')).toHaveCount(0);
      await expect(dialog).toContainText('remove a module');
      await page.keyboard.press('Escape');
    }
    await card.locator('[data-build-edit="module:2"]').click();
    await dialog.getByRole('button',{name:'Remove',exact:true}).click();
    await card.locator('[data-build-edit="module:2"]').click();
    await expect(dialog.locator('[data-id]').first()).toBeVisible();
    await expect(dialog).toContainText('Load: 11 / 15');
    await page.keyboard.press('Escape');
  });
  test('edits gear through the compact slot and stage panel',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    await page.locator('article.card [data-build-edit="gear:0"] .gear-head img').click();
    const dialog=page.getByRole('dialog');
    await expect(dialog.getByRole('tab')).toHaveCount(12);
    await expect(dialog.getByRole('tab',{name:'Helmet',exact:true})).toHaveAttribute('aria-selected','true');
    await expect(dialog.getByLabel('Before Titan',{exact:true})).toHaveCount(4);
    await expect(dialog.getByRole('button',{name:'Titan',exact:true})).toHaveAttribute('aria-pressed','true');
    await dialog.getByLabel('Enhancement',{exact:true}).fill('48');
    await expect(dialog.locator('strong').first()).toContainText('+48');
    await dialog.getByRole('button',{name:'SSR',exact:true}).click();
    await expect(dialog.getByLabel('Before Titan',{exact:true})).toHaveCount(0);
    await expect(dialog.getByLabel('Current value',{exact:true})).toHaveCount(4);
    await dialog.getByRole('button',{name:'Augmented',exact:true}).click();
    await expect(dialog.getByLabel('Added Titan stat 1',{exact:true})).toBeVisible();
    await expect(dialog.getByLabel('Rare Titan stat',{exact:true})).toHaveCount(0);
    await dialog.getByRole('button',{name:'Titan',exact:true}).click();
    await expect(dialog.getByLabel('Rare Titan stat',{exact:true})).toBeVisible();
    await page.screenshot({path:'ignore/documentation-media/generated/build/gear-editor-titan.png',animations:'disabled'});
    await dialog.getByRole('tab',{name:'Gloves',exact:true}).click();
    await expect(dialog.getByRole('tab',{name:'Gloves',exact:true})).toHaveAttribute('aria-selected','true');
    await expect(dialog.getByLabel('Enhancement',{exact:true})).toHaveValue('57');
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('tab',{name:'Eyepiece',exact:true})).toHaveAttribute('aria-selected','true');
    await page.keyboard.press('Escape');
    await expect(page.locator('article.card [data-build-edit="gear-level:0"]')).toHaveText('+48');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await page.locator('article.card [data-build-edit="gear:0"] .gear-head img').click();
    await expect(dialog.getByLabel('Усиление',{exact:true})).toHaveValue('48');
    expect(await dialog.evaluate(node=>node.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'ignore/documentation-media/generated/build/gear-editor-ru-mobile.png'});
  });
  test('shows zero quality for a minimum Crit roll and normalizes the footer',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const minimum=card.locator('.roll[data-stat-keys="Crit"]').filter({hasText:'×1'});
    await expect(minimum.locator('.roll-quality')).toHaveText(' · 0%');
    await minimum.hover();
    await expect(page.getByRole('tooltip')).toContainText('Before Titan: 726. Roll quality: 0%.');
    await expect(card.locator('.gear-stat-total[data-stat-keys="Crit"] .gear-stat-rolls')).toHaveText('×6 · 83%');
  });
  test('selects optional food and three shot slots with compact relics',async({page})=>{
    await fillTestData(page);
    const lock=page.getByRole('checkbox',{name:'Lock editing',exact:true});
    const card=page.locator('article.card');
    await expect(card.locator('.consumable-slot')).toHaveCount(4);
    await expect(card.locator('.consumable-system h3')).toHaveText('Consumables');
    await card.locator('[data-consumable-slot="food"] button').hover();
    await expect(page.getByRole('tooltip')).toContainText('Power Nutripaste');
    await expect(card).not.toHaveAttribute('data-stat-highlight',/@enhancement-shot/);
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(0);
    await expect(card.locator('.compact-relic .relic-rank').first()).toHaveText('★★★★★');
    await lock.uncheck();
    for(let index=0;index<4;index++){
      await card.locator(`[data-build-edit="consumable:${index}"]`).click();
      await page.getByRole('dialog').getByRole('button',{name:'Remove',exact:true}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await lock.check();
    await expect(card.locator('.consumable-slot')).toHaveCount(0);
    await lock.uncheck();
    await expect(card.locator('.consumable-slot')).toHaveCount(4);
    const choose=async(index:number,last=false)=>{
      await card.locator(`[data-build-edit="consumable:${index}"]`).click();
      const choices=page.getByRole('dialog').locator('.tool-picker-card');
      if(index===1)await expect(choices).toHaveCount(2);
      await (last?choices.last():choices.first()).click();
    };
    await choose(0);await choose(1);await choose(1,true);
    await lock.check();
    const slots=card.locator('.consumable-slot');
    await expect(slots).toHaveCount(2);
    const first=(await slots.nth(0).boundingBox())!,second=(await slots.nth(1).boundingBox())!;
    expect(first.y).toBe(second.y);
    const group=(await card.locator('.consumable-slots').boundingBox())!;
    expect(Math.abs((first.x+second.x+second.width)/2-(group.x+group.width/2))).toBeLessThan(1);
    await lock.uncheck();await choose(2);await lock.check();
    await expect(slots).toHaveCount(3);
    expect((await slots.nth(2).boundingBox())!.y).toBeGreaterThan((await slots.nth(0).boundingBox())!.y);
    await lock.uncheck();await choose(3);await lock.check();
    await expect(slots).toHaveCount(4);
    await page.screenshot({path:'ignore/documentation-media/generated/build/food-shots-layout.png'});
    await card.locator('[data-consumable-slot="enhancement"] button').hover();
    await expect(page.getByRole('tooltip')).toContainText('ATK:');
    await expect(page.getByRole('tooltip')).not.toContainText('max stars');
    await page.reload();
    await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled();
    await expect(card.locator('.consumable-slot button')).toHaveCount(4);
    await lock.uncheck();
    await card.locator('[data-build-edit="consumable:0"]').click();
    await page.getByRole('dialog').getByRole('button',{name:'Remove',exact:true}).click();
    await lock.check();
    await expect(slots).toHaveCount(3);
  });
  test('activates Enhancement Shot inspection only from the pink shot',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const pink=card.locator('[data-consumable-slot="enhancement"] button');
    await pink.hover();
    await expect(card).toHaveAttribute('data-stat-highlight','@enhancement-shot');
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(9);
    for(const slot of ['food','attack','piercing']) {
      const consumable=card.locator(`[data-consumable-slot="${slot}"] button`);
      await consumable.hover();
      await expect(card).not.toHaveAttribute('data-stat-highlight',/@enhancement-shot/);
      await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(0);
    }
    await pink.hover();
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(9);
    const food=card.locator('[data-consumable-slot="food"] button');
    await food.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await food.hover();
    await expect(card).not.toHaveAttribute('data-stat-highlight',/@enhancement-shot/);
    await expect(page.getByRole('tooltip')).toContainText('Power Nutripaste');
  });
  test('defaults Build entity pickers to newest first and supports older-first sorting',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    const data=await (await page.request.get('/game-data/build-page.json')).json();
    for(const [target,id] of [['weapon:0',data.weapons[0].id],['trait',data.weapons.find((item:{traitIcon:string})=>item.traitIcon).id],['matrix:0:0',data.matrices[0].id],['relic:0',data.relics[0].id]]){
      await page.locator(`article.card [data-build-edit="${target}"] button`).first().press('Enter');
      const dialog=page.getByRole('dialog');
      await expect(dialog).toContainText('Newest first');
      await expect(dialog.locator('.tool-picker-card').first()).toHaveAttribute('data-id',id);
      await page.keyboard.press('Escape');
    }
    await page.locator('article.card [data-build-edit="weapon:0"] button').first().press('Enter');
    const dialog=page.getByRole('dialog');
    await dialog.locator('button[aria-haspopup="listbox"]').click();
    await page.getByRole('option',{name:'Oldest first',exact:true}).click();
    await expect(dialog.locator('.tool-picker-card').first()).not.toHaveAttribute('data-id',data.weapons[0].id);
    await dialog.locator('button[aria-haspopup="listbox"]').click();
    await page.getByRole('option',{name:'Newest first',exact:true}).click();
    await page.screenshot({path:'ignore/documentation-media/generated/build/picker-newest-first.png'});
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await page.locator('article.card [data-build-edit="weapon:0"] button').first().press('Enter');
    await expect(dialog).toContainText('Сначала новые');
    await expect(dialog.locator('.tool-picker-card').first()).toHaveAttribute('data-id',data.weapons[0].id);
  });
  test('sets all Space Support modules from the core icon and preserves the selection',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    const core=page.locator('article.card .inspect-trigger:has(.support-core)');
    const levels=page.locator('article.card .support-chip > small');
    const count=await levels.count();
    for(const level of [0,10,5]){
      await core.scrollIntoViewIfNeeded();
      await core.click();
      const dialog=page.getByRole('dialog',{name:'All Space Support modules'});
      await expect(dialog.getByRole('button',{name:/^Lv\. /})).toHaveCount(3);
      await dialog.getByRole('button',{name:`Lv. ${level}`,exact:true}).click();
      await expect(dialog).toHaveCount(0);
      await expect(levels).toHaveText(Array(count).fill(String(level)));
    }
    await page.reload();
    await expect(levels).toHaveText(Array(count).fill('5'));
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await page.getByRole('checkbox',{name:'Заблокировать редактирование',exact:true}).uncheck();
    await core.press('Enter');
    const dialog=page.getByRole('dialog',{name:'Все модули Space Support'});
    await dialog.getByRole('button',{name:'Lv. 0',exact:true}).click();
    await expect(levels).toHaveText(Array(count).fill('0'));
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
  });
  test('uses compact readable suppressor choices with stats and newest levels first',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    const opener=page.locator('article.card [data-build-edit="profile:suppressorId"]');
    await opener.press('Enter');
    const dialog=page.getByRole('dialog');
    const first=dialog.locator('.tool-picker-card').first();
    await expect(first).toHaveClass(/tool-picker-card--compact/);
    await expect(first).toContainText('V12.5');
    await expect(first).toContainText('HP');
    expect((await first.boundingBox())!.height).toBeLessThan(130);
    expect((await first.locator('img').boundingBox())!.width).toBeLessThanOrEqual(76);
    await expect(dialog.locator('[data-id="11_4"]')).toContainText('Selected');
    await page.screenshot({path:'ignore/documentation-media/generated/build/suppressor-picker-compact.png'});
    await first.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toHaveAttribute('aria-label',/V12\.5/);
    await opener.press('Enter');
    await dialog.getByRole('textbox').fill('does not exist');
    await expect(dialog).toContainText('No results');
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await opener.press('Enter');
    await expect(first).toContainText('Выбран');
    const box=(await first.boundingBox())!;
    expect(box.x+box.width).toBeLessThanOrEqual(390);
    await page.screenshot({path:'ignore/documentation-media/generated/build/suppressor-picker-compact-ru.png'});
  });
  test('sorts avatar and frame choices by catalog order and localized name',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    const data=await (await page.request.get('/game-data/build-page.json')).json();
    await page.locator('article.card [data-build-edit="profile:avatarId"]').press('Enter');
    const dialog=page.getByRole('dialog');
    await expect(dialog).toContainText('Newest first');
    for(const items of [data.avatars,data.avatarFrames]){
      await dialog.locator('button[aria-haspopup="listbox"]').click();
      await page.getByRole('option',{name:'Name: A–Z',exact:true}).click();
      const expected=[...items].sort((a:{name:{en:string}},b:{name:{en:string}})=>a.name.en.localeCompare(b.name.en,'en'));
      await expect(dialog.locator('.tool-picker-card').first()).toHaveAttribute('data-id',expected[0].id);
      await dialog.locator('button[aria-haspopup="listbox"]').click();
      await page.getByRole('option',{name:'Newest first',exact:true}).click();
      const tail=(id:string)=>Number(id.match(/(\d+)(?!.*\d)/)?.[1]??-1);
      const newest=[...items].sort((a:{id:string},b:{id:string})=>tail(b.id)-tail(a.id)||b.id.localeCompare(a.id));
      await expect(dialog.locator('.tool-picker-card').first()).toHaveAttribute('data-id',newest[0].id);
      if(items===data.avatars)await dialog.getByRole('button',{name:'Choose avatar frame',exact:true}).click();
    }
    await page.screenshot({path:'ignore/documentation-media/generated/build/avatar-frame-sort.png'});
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await page.locator('article.card [data-build-edit="profile:avatarId"]').press('Enter');
    await dialog.locator('button[aria-haspopup="listbox"]').click();
    await page.getByRole('option',{name:'Название: А–Я',exact:true}).click();
    const ru=[...data.avatars].sort((a:{name:{ru:string}},b:{name:{ru:string}})=>a.name.ru.localeCompare(b.name.ru,'ru'));
    await expect(dialog.locator('.tool-picker-card').first()).toHaveAttribute('data-id',ru[0].id);
    await expect(dialog.locator('.tool-picker-card').first()).toBeVisible();
  });
  test('filters food by element and defaults to descending buff magnitude',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    await page.locator('[data-consumable-slot="food"] button').click();
    const dialog=page.getByRole('dialog');
    await expect(dialog).toContainText('Buff: strongest first');
    await dialog.locator('button[data-val="Physical"]').click();
    const data=await (await page.request.get('/game-data/build-page.json')).json();
    const foods=data.consumables.find((group:{id:string})=>group.id==='food').items.filter((item:{elements?:string[]})=>item.elements?.includes('Physical'));
    foods.sort((a:{foodBuff:{percentage:number;flat:number};id:string},b:{foodBuff:{percentage:number;flat:number};id:string})=>b.foodBuff.percentage-a.foodBuff.percentage||b.foodBuff.flat-a.foodBuff.flat||a.id.localeCompare(b.id,undefined,{numeric:true}));
    await expect(dialog.locator('.tool-picker-card')).toHaveCount(foods.length);
    await expect(dialog.locator('.tool-picker-card').first()).toHaveAttribute('data-id',foods[0].id);
    await expect(dialog.locator('button[data-val="dps"]')).toHaveCount(0);
    await page.screenshot({path:'ignore/documentation-media/generated/build/food-picker-buff-sort.png'});
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await page.locator('[data-consumable-slot="food"] button').click();
    await expect(dialog).toContainText('Баф: сначала сильные');
    await dialog.locator('button[data-val="Frost"]').click();
    await expect(dialog.locator('.tool-picker-card').first()).toBeVisible();
  });
  test('shows generated element badges on Build matrix choices',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    await page.locator('article.card [data-build-edit="matrix:0:0"] button').first().click();
    const data=await (await page.request.get('/game-data/build-page.json')).json();
    const dialog=page.getByRole('dialog');
    const combos:Record<string,string>={'Physical-Flame':'wuhuo','Flame-Physical':'huowu','Frost-Volt':'binglei','Volt-Frost':'leibing'};
    for(const matrix of data.matrices){
      const option=dialog.locator(`[data-id="${matrix.id}"]`);
      await expect(option.locator('.tool-picker-card-badges [data-presentation="icon"]')).toHaveCount(matrix.elementLoadouts.length);
      for(const [index,elements] of matrix.elementLoadouts.entries()){
        const badge=option.locator('.tool-picker-card-badges [data-presentation="icon"]').nth(index);
        await expect(badge).toContainText(elements.join(' / '));
        if(elements.length===2){
          await expect(badge).toHaveAttribute('data-secondary-element',elements[1].toLowerCase()==='physical'?'phys':elements[1].toLowerCase());
          await expect(badge.locator('img')).toHaveAttribute('src',new RegExp(`icon_element_${combos[elements.join('-')]}`));
        }else await expect(badge).not.toHaveAttribute('data-secondary-element',/.+/);
      }
    }
    const matrix=data.matrices.find((item:{elementLoadouts:string[][]})=>item.elementLoadouts.some(elements=>elements.length===2));
    const option=dialog.locator(`[data-id="${matrix.id}"]`);
    await option.scrollIntoViewIfNeeded();
    await page.screenshot({path:'ignore/documentation-media/generated/build/matrix-picker-elements.png'});
    await dialog.locator('button[data-val="Physical"]').click();
    await expect(dialog.locator('.tool-picker-card')).toHaveCount(data.matrices.filter((item:{elements:string[]})=>item.elements.includes('Physical')).length);
    await dialog.locator('button[data-val="Physical"]').click();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await page.locator('article.card [data-build-edit="matrix:0:0"] button').first().press('Enter');
    await expect(dialog.locator(`[data-id="${matrix.id}"] .tool-picker-card-badges`)).toContainText(' / ');
  });
  test('uses consistent Comp cards for traits, matrices and relics in desktop and Russian mobile pickers',async({page})=>{
    await page.goto('/tools/comp/');
    for(const column of ['colTrait','colMatrices','colRelics']){
      await page.locator(`[class*="${column}"] [role="button"]`).first().press('Enter');
      const dialog=page.getByRole('dialog');
      const option=dialog.locator('.tool-picker-card').first();
      await expect(option.locator('h3')).toBeVisible();
      await expect(option.locator('.tool-picker-card-art img')).toBeVisible();
      await expect(option.locator('.tool-picker-card-badges')).toContainText(/SSR|SR|R/);
      await expect(option.locator('.tool-picker-card-subtitle')).not.toContainText('✦');
      if(column==='colMatrices'){
        await expect(option.locator('[data-presentation="icon"]').first()).toBeVisible();
        await expect(option.locator('.tool-picker-card-badges img').first()).toHaveAttribute('src',/icon_element_wuhuo/);
        await expect(option.locator('[data-secondary-element="flame"]')).toHaveCount(1);
      }
      await option.focus();
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
    }
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await page.locator('[class*="colMatrices"] [role="button"]').first().press('Enter');
    await expect(page.getByRole('dialog').locator('.tool-picker-card h3').first()).toBeVisible();
    await page.getByRole('dialog').locator('.tool-picker-card').first().scrollIntoViewIfNeeded();
    await page.screenshot({path:'ignore/documentation-media/generated/build/comp-reference-matrix-picker-ru.png'});
  });
  test('reuses the weapon picker cards in Comp',async({page})=>{
    await page.goto('/tools/comp/');
    await page.waitForLoadState('networkidle');
    await page.locator('[class*="slotEquippedWeapon"][role="button"]').first().click({position:{x:5,y:5}});
    const dialog=page.getByRole('dialog');
    const weapon=dialog.locator('.tool-picker-card').first();
    await expect(weapon.locator('img').first()).toBeVisible();
    await expect(weapon.locator('.tool-picker-card-subtitle')).toBeVisible();
    const title=await weapon.locator('h3').innerText();
    await page.screenshot({path:'ignore/documentation-media/generated/build/comp-reference-weapon-picker.png'});
    await weapon.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button',{name:title,exact:true}).first()).toBeVisible();
  });
  test('filters pet modules by Load and explains MMO pets without modules',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    const card=page.locator('article.card');
    await card.locator('[data-build-edit="pet-stars"]').click();
    await page.getByRole('dialog').getByRole('button',{name:'★0',exact:true}).click();
    await card.locator('[data-build-edit="module:1"]').click();
    await expect(page.getByRole('dialog').getByText(/Load.*\/ 5/)).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/slot is locked/)).toBeVisible();
    await expect(page.getByRole('dialog').locator('[data-id]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await card.locator('.system-media[data-build-edit="pet"] img').first().click();
    const catalog=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    const mmo=catalog.pets.find((p:{modules:unknown[]})=>!p.modules.length);
    await page.getByRole('dialog').locator(`[data-id="${mmo.id}"]`).click();
    await expect(card.getByText('No modules',{exact:true})).toBeVisible();
    await expect(card.locator('.pet-modules')).toHaveCount(0);
  });
  test('keeps card text selectable without I-beam cursors and shows matrix level stats',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    expect(await card.evaluate(n=>[n,...n.querySelectorAll('*')].some(e=>getComputedStyle(e).cursor==='text'))).toBe(false);
    expect(await card.locator('.matrix small').first().evaluate(n=>getComputedStyle(n).userSelect)).toBe('text');
    const first=card.locator('.matrix').first();
    await first.locator('small').evaluate(node=>{
      const range=document.createRange();range.selectNodeContents(node);
      const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);
      node.closest('button')!.click();
    });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(()=>getSelection()?.toString())).toBe('★1');
    await page.evaluate(()=>getSelection()?.removeAllRanges());
    await first.locator('small').hover();
    await expect(page.getByRole('tooltip').last()).toContainText('2-Piece Set');
    for(const [index,position] of ['Memory','Belief','Mind','Emotion'].entries()){
      await card.locator('.matrix').nth(index).locator('.inspect-trigger').first().hover({position:{x:20,y:20}});
      const icon=page.getByRole('tooltip').last().locator('[data-inspection-heading] strong img');
      await expect(icon).toHaveAttribute('alt',position);
      await expect(icon).toBeVisible();
      const placement=await icon.evaluate(node=>{const image=node.getBoundingClientRect();const title=node.parentElement!;const range=document.createRange();range.selectNodeContents(title.lastChild!);const text=range.getBoundingClientRect();return {left:image.right<=text.left,aligned:Math.abs((image.top+image.bottom-text.top-text.bottom)/2)<3};});
      expect(placement).toEqual({left:true,aligned:true});
      expect(await icon.evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0)).toBe(true);
    }
    for(const [index,label] of ['HP','HP','Crit','Resistance'].entries()){
      await card.locator('.matrix').nth(index).locator('.matrix-level').hover();
      const tip=page.getByRole('tooltip').last();
      await expect(tip).toContainText(label+':');
      await expect(tip).toContainText(index===2?'HP:':'ATK:');
      await expect(tip).toContainText('Lv. 100');
      await expect(tip).not.toContainText(['Memory','Belief','Mind','Emotion'][index]);
      expect(await tip.locator('[data-inspection-heading] strong img').evaluate(node=>{const image=node.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(node.parentElement!.lastChild!);const text=range.getBoundingClientRect();return image.right<=text.left&&Math.abs((image.top+image.bottom-text.top-text.bottom)/2)<3;})).toBe(true);
      await expect(tip.locator('[data-inspection-heading] strong img')).toHaveAttribute('alt',['Memory','Belief','Mind','Emotion'][index]);
    }
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    await first.locator('small').click();
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Matrix stars');
    await page.keyboard.press('Escape');
    await first.locator('.matrix-level').click();
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Matrix level');
    await expect(page.getByRole('dialog').getByRole('spinbutton')).toHaveValue('100');
    await page.keyboard.press('Escape');
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await first.locator('.matrix-level').hover();
    await expect(page.getByRole('tooltip').last()).not.toContainText('Память');
    await expect(page.getByRole('tooltip').last().locator('[data-inspection-heading] strong img')).toHaveAttribute('alt','Память');
    await expect(page.getByRole('tooltip').last()).toContainText('ATK:');
    await first.locator('.matrix-level').click();
    await expect(page.getByRole('dialog')).toContainText('ATK:');
  });
  test('shows weapon level stats independently of advancement',async({page})=>{
    await fillTestData(page);
    const weapon=page.locator('article.card .weapon').first();
    await weapon.locator('.weapon-icon').hover({position:{x:8,y:30}});
    await expect(page.getByRole('tooltip')).toContainText('ATK:+1,612');
    await expect(page.getByRole('tooltip')).toContainText('HP:+79,999');
    await expect(page.getByRole('tooltip')).toContainText('Crit:+1,000');
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    await weapon.locator('[data-build-edit="weapon-stars:0"]').first().click();
    await page.getByRole('dialog').getByRole('button',{name:'★0',exact:true}).click();
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
    await weapon.locator('.weapon-icon').hover({position:{x:8,y:30}});
    await expect(page.getByRole('tooltip')).toContainText('ATK:+1,612');
    await expect(page.getByRole('tooltip')).toContainText('HP:+79,999');
    await weapon.locator('.weapon-icon').click({position:{x:8,y:30}});
    await expect(page.getByRole('dialog')).toContainText('Crit:+1,000');
    await page.keyboard.press('Escape');
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    await weapon.locator('[data-build-edit="weapon-level:0"]').click();
    await page.getByRole('dialog').getByRole('spinbutton').fill('100');
    await page.keyboard.press('Escape');
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
    await weapon.locator('.weapon-icon').hover({position:{x:8,y:30}});
    await expect(page.getByRole('tooltip')).toContainText('ATK:+829');

  });
  test('keeps build picker and inspection dialogs below the responsive header',async({page})=>{
    test.setTimeout(120000);
    await fillTestData(page);
    const card=page.locator('article.card');
    const checkBounds=async()=>{
      const bounds=await page.getByRole('dialog').evaluate(node=>{
        const panel=node.firstElementChild!.getBoundingClientRect();
        return {top:panel.top,bottom:panel.bottom,header:document.querySelector('[data-site-header]')!.getBoundingClientRect().bottom,height:innerHeight};
      });
      expect(bounds.top).toBeGreaterThanOrEqual(bounds.header+8);
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.height-8);
    };
    for(const viewport of [{width:1365,height:650},{width:844,height:390}]){
      await page.setViewportSize(viewport);
      await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
      for(const target of ['profile:suppressorId','weapon:0','matrix:0:0','trait','relic:0','pet','module:0','rv','gear:0','art','synthesis:0','combat:hp','mark']){
        const trigger=card.locator(`[data-build-edit="${target}"]`).first();
        if(target.startsWith('matrix:'))await trigger.locator('button').first().click({position:{x:20,y:20}});
        else if(target.startsWith('weapon:'))await trigger.locator('.weapon-title').click();
        else await trigger.click();
        await expect(page.getByRole('dialog'),`Dialog for ${target}`).toBeVisible();
        await checkBounds();
        await page.keyboard.press('Escape');
      }
      await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
      for(const selector of ['.gear-rv button','[data-build-edit="relic:0"] button','.matrix button','.computing-node button']){
        await card.locator(selector).first().click();
        await checkBounds();
        await page.keyboard.press('Escape');
      }
    }
  });
  test('shares Comp loadout filters for weapons, traits, matrices and relics',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    const card=page.locator('article.card');
    const catalog=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    for(const target of ['weapon:0','trait','matrix:0:0','matrix-set:1:0']){
      const trigger=card.locator(`[data-build-edit="${target}"]`).first();
        if(target.startsWith('matrix:'))await trigger.locator('button').first().click({position:{x:20,y:20}});
        else if(target.startsWith('weapon:'))await trigger.locator('.weapon-title').click();
        else await trigger.click();
      const dialog=page.getByRole('dialog');
      await dialog.locator('button[data-val="Frost"]').click();
      await dialog.locator('button[data-val="dps"]').click();
      if(target.startsWith('matrix'))await dialog.locator('button[data-val="SSR"]').click();
      const ids=await dialog.locator('[data-id]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-id')));
      expect(ids.length).toBeGreaterThan(0);
      const roster=target.startsWith('matrix')?catalog.matrices:catalog.weapons;
      for(const id of ids){
        const item=roster.find((item:{id:string})=>item.id===id);
        expect(target.startsWith('matrix')?item.elements:[item.elements[0]]).toContain('Frost');
        expect(target.startsWith('matrix')?item.roles:[item.role]).toContain('dps');
      }
      await page.keyboard.press('Escape');
    }
    await card.locator('[data-build-edit="relic:0"]').first().click({position:{x:8,y:8}});
    const dialog=page.getByRole('dialog');
    await dialog.locator('button[data-val="SR"]').click();
    await dialog.locator('button[data-val="Attack"]').click();
    const ids=await dialog.locator('[data-id]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-id')));
    expect(ids.length).toBeGreaterThan(0);
    for(const id of ids)expect(catalog.relics.find((item:{id:string})=>item.id===id)).toMatchObject({quality:'SR',property:'Attack'});
    await page.keyboard.press('Escape');
    await card.locator('[data-build-edit="mark"]').first().click();
    await expect(page.getByRole('dialog').getByRole('textbox')).toHaveCount(0);
  });
  test('keeps the loadout stationary when unlocking and removes Nan Yin mark without moving the loadout',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const positions=()=>card.locator('article.weapon').evaluateAll(nodes=>nodes.map(node=>({top:node.offsetTop,height:node.offsetHeight})));
    const before=await positions();
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    expect(await positions()).toEqual(before);
    await card.locator('.mark-edit-control').click();
    const dialog=page.getByRole('dialog');
    await expect(dialog.locator('[data-id=""]')).toHaveCount(0);
    await dialog.getByRole('button',{name:'Remove',exact:true}).click();
    await expect(card.locator('.weapon-mark-trigger')).toHaveCount(0);
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).markWeaponId)).toBe('');
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
    expect(await positions()).toEqual(before);
  });
  test('unlocks the card and edits empty weapons, individual matrices and synthesis',async({page})=>{
    const lock=page.getByRole('checkbox',{name:'Lock editing',exact:true});
    await expect(lock).toBeChecked();
    const card=page.locator('article.card');
    await expect(card).not.toHaveAttribute('data-editing');
    await lock.uncheck();
    await expect(card).toHaveAttribute('data-editing','true');
    await card.locator('[data-build-edit="weapon:0"]').first().click({position:{x:12,y:12}});
    let dialog=page.getByRole('dialog');
    await expect(dialog).toHaveAccessibleName('Weapon 1');
    await dialog.getByRole('textbox').fill('Fairy');
    await dialog.locator('[data-id="gefion"]').click();
    await expect(card.locator('.weapon-title').first()).toHaveText('Fairy Wreath');
    await card.locator('[data-build-edit="weapon-stars:0"]').first().click();
    await page.getByRole('dialog').getByRole('button',{name:'★4',exact:true}).click();
    await expect(card.locator('.weapon-stars').first()).toHaveText('★★★★');
    await card.locator('[data-build-edit="matrix:0:2"]').first().click({position:{x:10,y:20}});
    dialog=page.getByRole('dialog');
    await expect(dialog).toHaveAccessibleName('Matrix 3');
    const matrix=dialog.locator('[data-id]').first();
    const matrixId=await matrix.getAttribute('data-id');
    await matrix.click();
    await expect(card.locator('.matrix img')).toHaveCount(1);
    await card.locator('[data-build-edit="matrix-stars:0:2"]').click();
    await page.getByRole('dialog').getByRole('button',{name:'★2',exact:true}).click();
    await card.locator('[data-build-edit="matrix-level:0:2"]').click();
    await page.getByRole('dialog').getByRole('spinbutton').fill('80');
    await page.getByRole('dialog').getByRole('button',{name:'Done',exact:true}).click();
    await card.locator('[data-build-edit="synthesis:0"]').click();
    await page.getByRole('dialog').getByRole('button',{name:'S5',exact:true}).click();
    await expect(card.locator('.synthesis-stage').first()).toHaveText('S5');
    await page.reload();
    await expect(lock).toBeChecked();
    await expect(card.locator('.weapon-stars').first()).toHaveText('★★★★');
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!));
    expect(saved.weapons[0].matrices[2]).toMatchObject({id:matrixId,stars:2,level:80});
    expect(saved.weapons[0].matrices[0].id).toBe('');
    expect(saved.synthesis[0].stage).toBe(5);
  });
  test('edits gear, combat and profile through the card while preserving inspection and Info',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    await card.locator('[data-build-edit="profile:name"]').click();
    await page.getByRole('dialog').getByRole('textbox').fill('New name');
    await page.getByRole('dialog').getByRole('button',{name:'Done',exact:true}).click();
    await expect(card.locator('.player')).toHaveText('New name');
    await card.locator('[data-build-edit="element:0:damage"]').click();
    await page.getByRole('dialog').getByRole('spinbutton').fill('55.5');
    await page.keyboard.press('Escape');
    await expect(card.locator('.stat-table tbody tr').first().locator('td').last()).toHaveText('55.5%');
    await card.locator('.gear .roll').first().click();
    const dialog=page.getByRole('dialog');
    await expect(dialog).toHaveAccessibleName('Helmet · Stat');
    await expect(dialog.getByRole('spinbutton',{name:'Current value',exact:true})).toHaveCount(1);
    await dialog.getByRole('spinbutton',{name:'Current value',exact:true}).first().fill('1000');
    await page.keyboard.press('Escape');
    await expect(card.locator('.gear .roll').first()).toContainText('1,000');
    await card.locator('.weapon-title').first().click({button:'right'});
    await expect(page.getByRole('menuitem').first()).toHaveAttribute('href',/\/info\/simulacra\?char=/);
    await page.keyboard.press('Escape');
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
    await card.locator('.compact-relic button').first().click();
    await expect(page.getByRole('dialog')).toContainText('Base effect');
  });
  test('edits supporting systems and restores keyboard focus after selection',async({page})=>{
    await fillTestData(page);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    const card=page.locator('article.card');
    const synthesis=card.locator('[data-build-edit="synthesis:1"] button');
    await synthesis.focus();
    await page.keyboard.press('Enter');
    let dialog=page.getByRole('dialog');
    await expect(dialog).toContainText('S6');
    await dialog.getByRole('button',{name:'Done',exact:true}).focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button',{name:'Close modal',exact:true})).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button',{name:'Done',exact:true})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(synthesis).toBeFocused();
    for(const [target,label] of [['computing:0','Lv. 9'],['support:0','Lv. 2'],['relic-stars:0','★3'],['pet-stars','★2'],['module-level:0','Lv. 2']] as const){
      await card.locator(`[data-build-edit="${target}"]`).click();
      await page.getByRole('dialog').getByRole('button',{name:label,exact:true}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    for(const target of ['relic:1','trait','module:1','profile:suppressorId'] as const){
      // A relic's area also contains its stars; the name is the relic picker.
      await card.locator(`[data-build-edit="${target}"]`).last().click();
      dialog=page.getByRole('dialog');
      await dialog.getByRole('button',{name:'Remove',exact:true}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await card.locator('[data-build-edit="profile:avatarId"]').click();
    dialog=page.getByRole('dialog');
    await dialog.getByRole('button',{name:'Choose avatar frame',exact:true}).click();
    const frame=dialog.locator('[data-id]').first();
    const frameId=await frame.getAttribute('data-id');
    await frame.click();
    await card.locator('[data-build-edit="pet"]').click();
    const nextPet=page.getByRole('dialog').locator('[data-id]').last();
    const petId=await nextPet.getAttribute('data-id');
    await nextPet.click();
    await page.waitForTimeout(350);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!));
    expect(saved.computing[0].level).toBe(9);
    expect(saved.support[0].level).toBe(2);
    expect(saved.relics[0].stars).toBe(3);
    expect(saved.relics[1].id).toBe('');
    expect(saved.traitId).toBe('');
    expect(saved.profile.avatarFrameId).toBe(frameId);
    expect(saved.profile.suppressorId).toBe('');
    const catalog=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    expect(saved.pet).toMatchObject({id:petId,stars:catalog.pets.find((item:{id:string})=>item.id===petId).maxStars,level:catalog.defaultLevels.pet,modules:['','','','']});
    await card.locator('[data-build-edit="weapon:0"]').first().click({position:{x:12,y:12}});
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-editable-picker.png'});
    await page.keyboard.press('Escape');
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-editable-card.png'});
  });
  test('keeps editing menus usable in Russian on mobile',async({page})=>{
    await fillTestData(page);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    const lock=page.getByRole('checkbox',{name:'Заблокировать редактирование',exact:true});
    await expect(lock).toBeChecked();
    await lock.uncheck();
    await page.locator('article.card [data-build-edit="weapon:0"]').first().click({position:{x:2,y:2}});
    const dialog=page.getByRole('dialog');
    await expect(dialog).toHaveAccessibleName('Оружие 1');
    await dialog.getByRole('textbox').fill('nothing-matches');
    await expect(dialog).toContainText('Ничего не найдено');
    await dialog.getByRole('textbox').fill('');
    await expect(dialog.locator('[data-id]').first()).toBeVisible();
    await expect.poll(()=>dialog.evaluate(node=>node.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-edit-picker-ru-mobile.png'});
    await dialog.getByRole('button',{name:'Готово',exact:true}).click();
    await page.locator('article.card [data-build-edit="consumable:1"]').click();
    await expect(dialog).toHaveAccessibleName('Шприц атаки');
    await expect(dialog.locator('.tool-picker-card')).toHaveCount(2);
    await expect.poll(()=>dialog.evaluate(node=>node.scrollWidth<=innerWidth)).toBe(true);
    await dialog.locator('.tool-picker-card').last().click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const position=await lock.boundingBox();
    const exportPosition=await page.getByRole('button',{name:'Экспорт PNG',exact:true}).boundingBox();
    expect(position!.x).toBeLessThan(exportPosition!.x);
    expect(position!.x).toBeGreaterThanOrEqual(0);
  });
  test('changes a matrix set group without replacing the other half of a mixed set',async({page})=>{
    await fillTestData(page);
    await page.locator('summary').filter({hasText:/^Weapons & matrices$/}).click();
    const first=page.getByRole('group',{name:'Weapon 1',exact:true});
    const second=page.getByRole('group',{name:'Weapon 2',exact:true});
    const secondId=await second.getByLabel('Set',{exact:true}).first().getAttribute('data-value');
    const originalId=await first.getByLabel('Set',{exact:true}).first().getAttribute('data-value');
    await chooseCatalog(first.getByLabel('Set',{exact:true}).nth(2),secondId!);
    await chooseCatalog(first.getByLabel('Set',{exact:true}).nth(3),secondId!);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    const card=page.locator('article.card');
    await card.locator('[data-build-edit="matrix-set:0:2"]').click();
    const chosen=page.getByRole('dialog').locator(`[data-id]:not([data-id="${originalId}"]):not([data-id="${secondId}"])`).last();
    const id=await chosen.getAttribute('data-id');
    await chosen.click();
    await expect(first.getByLabel('Set',{exact:true}).first()).toHaveAttribute('data-value',originalId);
    await expect(first.getByLabel('Set',{exact:true}).nth(1)).toHaveAttribute('data-value',originalId);
    await expect(first.getByLabel('Set',{exact:true}).nth(2)).toHaveAttribute('data-value',id!);
    await expect(first.getByLabel('Set',{exact:true}).nth(3)).toHaveAttribute('data-value',id!);
    await card.locator('[data-build-edit="matrix-level-all:0"]').first().click();
    await page.getByRole('dialog').getByRole('spinbutton').fill('99');
    await page.keyboard.press('Escape');
    for(const input of (await first.getByRole('spinbutton',{name:'Level',exact:true}).all()).slice(1))await expect(input).toHaveValue('99');
  });
  test('persists a loading background and accepts any Arts catalog link',async({page})=>{
    const data=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    const hero=page.locator('article.card .hero-art');
    await expect(hero).toBeAttached();
    const initial=await hero.getAttribute('src');
    expect(data.artworks.some((art:{url:string;loading:boolean})=>art.loading&&art.url===initial)).toBe(true);
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled();
    await expect(hero).toHaveAttribute('src',initial!);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    await page.locator('article.card .art-edit-control').click();
    const dialog=page.getByRole('dialog');
    await expect(dialog.locator('[data-id]')).toHaveCount(data.artworks.length);
    const art=data.artworks.find((a:{id:string})=>a.id==='season_4_huodongzh2_tuozhanbao_bg');
    await dialog.getByLabel('Link from Arts',{exact:true}).fill('/info/arts/#'+art.id);
    await expect(dialog.getByText(art.name.en,{exact:true}).last()).toBeVisible();
    await dialog.getByRole('button',{name:'Use',exact:true}).click();
    await expect(hero).toHaveAttribute('src',art.url);
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled();
    await expect(hero).toHaveAttribute('src',art.url);
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    await page.locator('article.card .art-edit-control').click();
    await dialog.getByLabel('Link from Arts',{exact:true}).fill('/info/arts/#missing');
    await expect(dialog.getByRole('button',{name:'Use',exact:true})).toBeDisabled();
    await expect(hero).toHaveAttribute('src',art.url);
    await dialog.getByRole('button',{name:'No background',exact:true}).click();
    await expect(hero).toHaveCount(0);
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled();
    await expect(hero).toHaveCount(0);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await page.getByRole('checkbox',{name:'Заблокировать редактирование',exact:true}).uncheck();
    await page.locator('article.card .art-edit-control').click();
    await dialog.getByLabel('Или вставьте ссылку из раздела Арты',{exact:true}).fill('https://example.com/info/arts/#'+art.id);
    await dialog.getByRole('button',{name:'Применить',exact:true}).click();
    await expect(hero).toHaveAttribute('src',art.url);
  });
  test('switches uploaded artwork to selected game art through the card',async({page})=>{
    await fillTestData(page);
    const title=page.locator('article.card .build-title');
    const titleBefore=await title.boundingBox();
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    const titleAfter=await title.boundingBox();
    expect(titleAfter).toEqual(titleBefore);
    await page.locator('input[type="file"][accept*="image"]').setInputFiles({name:'custom.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3S8AAAAASUVORK5CYII=','base64')});
    await expect(page.locator('article.card .hero-art')).toHaveAttribute('src',/^blob:/);
    const signature=await page.locator('article.card .profile-signature').boundingBox();
    const background=await page.locator('article.card .art-edit-control').boundingBox();
    // The background control sits in the gap between the signature and the role/element title.
    expect(Math.abs(background!.x+background!.width/2-(signature!.x+signature!.width+titleAfter!.x)/2)).toBeLessThan(4);
    await page.getByRole('slider',{name:'Art scale',exact:true}).first().fill('1.5');
    await page.locator('article.card .art-edit-control').click();
    const dialog=page.getByRole('dialog');
    const choice=dialog.locator('[data-id]').first();
    const id=await choice.getAttribute('data-id');
    await choice.click();
    const data=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    await expect(page.locator('article.card .hero-art')).toHaveAttribute('src',data.artworks.find((art:{id:string})=>art.id===id).url);
    await expect(page.getByRole('button',{name:'Reset artwork',exact:true})).toHaveCount(0);
    await expect(page.locator('article.card .hero-art')).toHaveCSS('transform',/1\.5/);
  });
  test('opens entity Info links from images and labels with the context menu',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const cases=[
      ['.weapon-title','/info/simulacra?char='],
      ['.matrix img','/info/matrices#'],
      ['.matrix-caption b','/info/matrices#'],
      ['.trait-display b','/info/simulacra?char='],
      ['.synthesis-item small','/info/simulacra?char='],
      ['.compact-relic .inspect-trigger','/info/relics?server=gacha&relic='],
      ['.pet-modules img','/info/pets?category=modules#'],
      ['.weapon-mark','/info/simulacra?char='],
    ];
    for(const [selector,prefix] of cases){
      await card.locator(selector).first().click({button:'right'});
      const menu=page.getByRole('menu',{name:'Open in Info'});
      await expect(menu,selector).toBeVisible();
      const link=menu.getByRole('menuitem').first();
      await expect(link).toHaveAttribute('href',new RegExp('^'+prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
      await expect(link).toHaveAttribute('target','_blank');
      await expect(link).toBeFocused();
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
    }
    await card.locator('.avatar-portrait').click({button:'right'});
    await expect(page.getByRole('menuitem')).toHaveCount(2);
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem').last()).toBeFocused();
    await expect(page.getByRole('menuitem').first()).toHaveAttribute('href',/\/info\/cosmetics\?id=/);
    await page.keyboard.press('Escape');
    const pet=card.locator('.system-media').filter({has:page.locator('button[aria-label="Leia"]')});
    await pet.locator('b').click({button:'right'});
    await expect(page.getByRole('menuitem')).toHaveAttribute('href',/\/info\/pets\?pet=/);
    await page.keyboard.press('Escape');
    await card.locator('.weapon-title').first().click({button:'right'});
    const href=await page.getByRole('menuitem').getAttribute('href');
    const popupPromise=page.waitForEvent('popup');
    await page.getByRole('menuitem').click();
    const popup=await popupPromise;
    await popup.waitForURL(url=>url.pathname.replace(/\/$/,'')==='/info/simulacra'&&url.searchParams.get('char')===new URL(href!,'http://localhost').searchParams.get('char'));
    await expect(popup.getByRole('heading',{name:'Gefion',level:1,exact:true})).toBeVisible();
    await popup.close();
    await card.locator('.weapon-head button').first().focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card.locator('.weapon-head button').first()).toBeFocused();
    await card.locator('.gear-title').first().click({button:'right'});
    await expect(page.getByRole('menu')).toHaveCount(0);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await expect(page.getByRole('button',{name:'Экспорт PNG',exact:true})).toBeEnabled();
    await page.setViewportSize({width:844,height:390});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await card.locator('.avatar-portrait').click({button:'right'});
    const russianMenu=page.getByRole('menu',{name:'Открыть в Info'});
    await expect(russianMenu.getByRole('menuitem',{name:'Открыть в Info · Рамка',exact:true})).toBeVisible();
    const bounds=await russianMenu.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(844);
    await page.keyboard.press('Escape');

  });
  test('edits the live card, calculates crit and restores the draft',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    await expect(card.locator('.crit-breakdown.total b')).toHaveText('89.16%');
    await expect(card.locator('.matrix')).toHaveCount(12);
    await expect(card.locator('.card-metadata time')).toHaveText(/\d{2}\.\d{2}\.\d{4}/);
    await expect(card.locator('.gear')).toHaveCount(12);
    await page.locator('summary').filter({hasText:/^Combat stats$/}).click();
    await page.getByLabel('Enemy level',{exact:true}).fill('100');
    await expect(card.locator('.crit-breakdown.total b')).toHaveText('75.95%');
    await page.getByLabel('Name',{exact:true}).fill('Test Wanderer');
    await page.getByLabel('Profile signature',{exact:true}).fill('Hello <img src=x>');
    await expect(card.locator('.profile-signature')).toHaveText('Hello <img src=x>');
    await expect(card.locator('.profile-signature img')).toHaveCount(0);
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')||'{}').profile?.name)).toBe('Test Wanderer');
    const updatedAt=await card.locator('.card-metadata time').getAttribute('datetime');
    await page.reload();
    await expect(card.locator('.card-metadata time')).toHaveAttribute('datetime',updatedAt!);
    await expect(card.locator('.player')).toHaveText('Test Wanderer');
    await expect(card.locator('.crit-breakdown.total b')).toHaveText('75.95%');
    expect(await card.locator('img').evaluateAll(images=>images.filter(img=>!(img as HTMLImageElement).complete||!(img as HTMLImageElement).naturalWidth).map(img=>(img as HTMLImageElement).src))).toEqual([]);
  });
  test('keeps the full empty card layout with dashes and numeric zeroes',async({page})=>{
    const card=page.locator('article.card');
    await expect(card.locator('.player')).toHaveText('—');
    await expect(card.locator('.profile-cs b')).toHaveText(['0','0']);
    await expect(card.locator('.profile-crew b')).toHaveText('—');
    await expect(card.locator('.profile-character-title b')).toHaveText('—');
    await expect(card.locator('.profile-signature')).toHaveText('—');
    await expect(card.locator('.weapon-title')).toHaveText(['—','—','—']);
    await expect(card.locator('.matrix-placeholder')).toHaveCount(12);
    await expect(card.locator('.roll')).toHaveCount(48);
    for(const value of await card.locator('.roll b').all())await expect(value).toHaveText('0');
    await expect(card.locator('.augment-value')).toHaveCount(24);
    await expect(card.locator('.rare')).toHaveCount(12);
    // View mode hides empty pet module slots; the editor shows all four.
    await expect(card.locator('.module-placeholder')).toHaveCount(0);
    await expect(card.locator('.empty-rv')).toHaveCount(12);
    await expect(card.locator('.profile-meta')).toContainText('UID 0 · Lv. 0');
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-empty-card.png'});
    await page.reload();
    await expect(card.locator('.profile-meta')).toContainText('UID 0 · Lv. 0');
    await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await expect(card.locator('.module-placeholder')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
  test('selects game avatars and transparent frames and restores both choices',async({page})=>{
    await fillTestData(page);
    const data=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    const portrait=page.locator('article.card .avatar-portrait');
    const avatar=page.getByLabel('Avatar',{exact:true}),frame=page.getByLabel('Avatar frame',{exact:true});
    await avatar.click();await expect(avatar.locator('..').getByRole('option')).toHaveCount(data.avatars.length+1);await page.keyboard.press('Escape');
    await frame.click();await expect(frame.locator('..').getByRole('option')).toHaveCount(data.avatarFrames.length+1);await page.keyboard.press('Escape');
    await expect(portrait.locator('.avatar')).toHaveAttribute('src',data.avatars.find((a:{id:string})=>a.id===data.demoDraft.profile.avatarId).icon);
    await chooseCatalog(frame,'');
    await expect(portrait.locator('.avatar-frame')).toHaveCount(0);
    await chooseCatalog(avatar,data.avatars[1].id);
    await chooseCatalog(frame,data.avatarFrames[1].id);
    await expect(portrait.locator('.avatar-frame')).toHaveAttribute('src',data.avatarFrames[1].icon);
    await page.reload();
    await openAdvancedEditor(page);
    await expect(avatar).toHaveAttribute('data-value',data.avatars[1].id);
    await expect(frame).toHaveAttribute('data-value',data.avatarFrames[1].id);
    expect(await portrait.locator('img').evaluateAll(images=>images.every(img=>(img as HTMLImageElement).naturalWidth>0))).toBe(true);
    await chooseCatalog(avatar,'');
    await expect(portrait).toHaveCount(1);
    await expect(portrait.locator('.avatar')).toHaveCount(0);
    await expect(portrait.locator('.profile-placeholder')).toHaveText('—');
  });
  test('supports mixed matrices and derives Nan Yin marks from the loadout',async({page})=>{
    await fillTestData(page);
    await page.locator('summary').filter({hasText:/^Weapons & matrices$/}).click();
    const first=page.getByRole('group',{name:'Weapon 1',exact:true});
    const second=page.getByRole('group',{name:'Weapon 2',exact:true});
    const secondSet=await second.getByLabel('Set',{exact:true}).first().getAttribute('data-value');
    await chooseCatalog(first.getByLabel('Set',{exact:true}).nth(2),secondSet!);
    await chooseCatalog(first.getByLabel('Set',{exact:true}).nth(3),secondSet!);
    await expect(page.locator('article.weapon').first().locator('.matrix-set-row')).toHaveCount(2);
    const third=page.getByRole('group',{name:'Weapon 3',exact:true});
    const mark=page.locator('article.card .weapon-mark-trigger button').first();
    await mark.hover();
    await expect(page.getByRole('tooltip')).toContainText('1% + 6 × 1% = 7%');
    await expect(page.getByRole('tooltip')).toContainText('Nan Yin A1: marks the selected weapon.');
    await expect(page.locator('article.card .weapon-mark')).toHaveCount(1);
    await expect(page.getByRole('tooltip').locator('.sim-num-hl').filter({hasText:/^1$/})).toHaveCount(0);
    await chooseCatalog(third.getByLabel('Weapon',{exact:true}),'nan-yin');
    await third.getByLabel('Advancement',{exact:true}).fill('6');
    await expect(page.locator('article.card .weapon-mark')).toHaveCount(3);
    await mark.hover();
    await expect(page.getByRole('tooltip')).toContainText('9% + 6 × 1% = 15%');
    await third.getByLabel('Advancement',{exact:true}).fill('1');
    await expect(page.locator('article.card .weapon-mark')).toHaveCount(3);
    await mark.hover();
    await expect(page.getByRole('tooltip')).toContainText('9% + 1 × 1% = 10%');
    await expect(page.getByRole('tooltip')).toContainText('Nan Yin A1: in build — marks all weapons.');
    await third.getByLabel('Advancement',{exact:true}).fill('2');
    await expect(page.locator('article.card .weapon-mark')).toHaveCount(3);
    await mark.hover();
    await expect(page.getByRole('tooltip')).toContainText('9% + 2 × 1% = 11%');
    await chooseCatalog(third.getByLabel('Weapon',{exact:true}),'nemesis-voidpiercer');
    await expect(page.locator('article.card .weapon-mark')).toHaveCount(1);
    await third.getByLabel('Advancement',{exact:true}).hover();
    await page.locator('article.card .roll em').first().focus();
    await expect(page.getByRole('tooltip')).toContainText('Maximum after Titan');
  });
  test('shows the same roll tooltip on stat labels, values and roll counts',async({page})=>{
    await fillTestData(page);
    await page.locator('article.card .roll em').first().focus();
    await expect(page.getByRole('tooltip')).toContainText('Maximum after Titan');
    const original=await page.getByRole('tooltip').innerText();
    await page.locator('article.card .roll em').first().blur();
    const row=page.locator('article.card .roll').first();
    await row.locator('span').first().hover();
    await expect(page.getByRole('tooltip')).toHaveText(original);
    await row.locator('b').hover();
    await expect(page.getByRole('tooltip')).toHaveText(original);
    const boots=page.locator('article.card .gear').nth(6);
    await boots.locator('.roll b').first().hover();
    await expect(page.getByRole('tooltip')).toHaveText('Before Titan: 69. Maximum after Titan: 400.9 (99.78%).');
    await boots.locator('.augment-value').first().hover();
    await expect(page.getByRole('tooltip')).toContainText('Maximum after Titan: 1,253.5');

  });
  test('shows damage bonuses beside sources only from table and gear stats',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const damage=card.locator('.stat-table tbody tr').first().locator('td').nth(2);
    const lin=card.locator('[data-damage-source="synthesis:lin"]');
    const content=card.locator('[data-damage-source="support:NewRow_23"]');
    await damage.hover();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(lin).toHaveAttribute('data-stat-match','true');
    await expect(lin).toHaveAttribute('data-damage-bonus',/DMG: \+3\.0%/);
    await expect(content).toHaveAttribute('data-stat-match','true');
    for(const id of ['NewRow_25','NewRow_22','NewRow_17','NewRow_20'])await expect(card.locator('[data-damage-source="support:'+id+'"]')).toHaveAttribute('data-stat-match','false');
    await expect(card.locator('.computing-node[data-stat-match="true"]')).toHaveCount(4);
    await expect.poll(()=>lin.evaluate(node=>getComputedStyle(node,'::after').content)).toContain('DMG:');
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-damage-sources.png'});
    await lin.locator('img').hover();
    await expect(card).not.toHaveAttribute('data-stat-highlight',/@damage-sources/);
    await expect(card.locator('[data-damage-source][data-stat-match="true"]')).toHaveCount(0);
    const gear=card.locator('.roll[data-stat-keys="Frost Damage %"]').first();
    await gear.hover();
    await expect(lin).toHaveAttribute('data-stat-match','true');
    const footer=card.locator('.gear-stat-total[data-stat-keys="Frost Damage %"]');
    await footer.locator('.gear-stat-rolls').hover();
    await expect(card.locator('[data-damage-source][data-stat-match="true"]')).toHaveCount(0);
    await expect(card.locator('[data-damage-source][data-stat-match]:not([data-source-channel="@attack-sources"])')).toHaveCount(0);
    for(const source of await card.locator('[data-damage-source]:not(.inactive)').all())await expect(source).toHaveCSS('opacity','1');
    for(const source of await card.locator('[data-damage-source].inactive').all())await expect(source).toHaveCSS('opacity','0.45');
    // The element label inspects ATK and ATK% sources: DMG% sources are not lit (they dim with the rest of the card).
    await card.locator('.stat-table tbody tr').first().locator('td').first().hover();
    await expect(card.locator('[data-damage-source][data-stat-match="true"]:not([data-source-channel="@attack-sources"]):not([data-source-channel="@attack-percent-sources"])')).toHaveCount(0);
    await expect(lin).toHaveAttribute('data-stat-match','false');
    expect(await lin.evaluate(node=>getComputedStyle(node,'::after').content)).toBe('none');
    await page.mouse.move(0,0);
    await damage.locator('.element-stat-value span[tabindex]').focus();
    await expect(lin).toHaveAttribute('data-stat-match','true');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await damage.hover();
    await expect(lin).toHaveAttribute('data-damage-bonus',/DMG: \+3,0\s*%/);
  });
  test('shows Crit sources from weapons, matrices, Enhancement Shot and progression',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    await card.locator('.crit-rating').hover();
    const enemyLevel=card.locator('.enemy-level');
    await expect(enemyLevel).toHaveAttribute('data-stat-match','true');
    await expect(enemyLevel).toHaveCSS('opacity','1');
    await expect(enemyLevel).toHaveCSS('cursor','default');
    await expect(enemyLevel.locator('.level-value')).toHaveCSS('background-color','rgba(92, 167, 218, 0.18)');
    await expect(card.locator('.weapon-art[data-stat-match="true"]')).toHaveCount(3);
    await expect(card.locator('.weapon-art[data-stat-match="true"]').first()).toHaveAttribute('data-damage-bonus','Crit: +1,000');
    await expect(card.locator('.weapon-art[data-stat-match="true"]').last()).toHaveAttribute('data-damage-bonus','Crit: +806');
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(3);
    for(const matrix of await card.locator('.matrix[data-stat-match="true"]').all()){
      await expect(matrix).toHaveAttribute('data-matrix-slot','0');
      await expect(matrix).toHaveAttribute('data-damage-bonus',/^Crit: \+/);
    }
    const shot=card.locator('[data-consumable-slot="enhancement"]');
    await expect(shot).toHaveAttribute('data-stat-match','true');
    await expect(shot).toHaveAttribute('data-damage-bonus','Crit: +430');
    await expect(card.locator('.suppressor-source')).toHaveAttribute('data-stat-match','true');
    await expect(card.locator('.equipment-heading small[data-stat-match="true"]')).toHaveCount(1);
    await expect(card.locator('.computing-node[data-stat-match="true"],.support-chip[data-stat-match="true"]')).toHaveCount(0);
    await page.screenshot({path:'ignore/documentation-media/generated/build/crit-all-sources.png'});
    await page.mouse.move(0,0);
    await card.locator('.crit-breakdown.total').focus();
    await expect(enemyLevel).toHaveAttribute('data-stat-match','true');
    await expect(shot).toHaveAttribute('data-stat-match','true');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await card.locator('.crit-rating').hover();
    await expect(shot).toHaveAttribute('data-damage-bonus','Крит: +430');
    await expect(enemyLevel).toHaveAttribute('data-stat-match','true');
    await card.locator('.stat-table tbody tr').first().locator('td').first().hover();
    await expect(enemyLevel).toHaveAttribute('data-stat-match','false');
    await expect(shot).toHaveAttribute('data-stat-match','true');
    await expect(shot).toHaveAttribute('data-damage-bonus',/^ATK: \+2\s?199$/);
    await expect(card.locator('.weapon-art[data-stat-match="true"]')).toHaveCount(3);
    const catalog=await (await page.request.get('/game-data/build-page.json')).json();
    const maximum=structuredClone(catalog.demoDraft);
    // Lv.180/160 weapons and the matrices below ★3/Lv.100 both gain Crit from the shot: max them all.
    maximum.weapons.forEach((weapon:{level:number;matrices:{level:number;stars:number}[]})=>{weapon.level=catalog.defaultLevels.weapon;weapon.matrices.forEach(matrix=>{matrix.level=catalog.defaultLevels.matrix;matrix.stars=3;});});
    await page.addInitScript(draft=>localStorage.setItem('tof-build-draft-v1',JSON.stringify(draft)),maximum);
    await page.reload();
    await card.locator('.crit-rating').hover();
    await expect(shot).toHaveAttribute('data-damage-bonus','Крит: +0');
  });
  test('shows Enhancement Shot flat ATK gain for every element and preserves zero gains',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const shot=card.locator('[data-consumable-slot="enhancement"]');
    for(const row of await card.locator('.stat-table tbody tr').all()) {
      await row.locator('td').first().hover();
      await expect(shot).toHaveAttribute('data-stat-match','true');
      await expect(shot).toHaveAttribute('data-damage-bonus','ATK: +2,199');
      await expect(card).not.toHaveAttribute('data-stat-highlight',/@enhancement-shot/);
    }
    await card.locator('.stat-table tbody tr').first().locator('td').nth(1).hover();
    await expect(shot).toHaveAttribute('data-stat-match','false');
    const data=await (await page.request.get('/game-data/build-page.json')).json();
    const maximum=structuredClone(data.demoDraft);
    maximum.weapons.forEach((weapon:{level:number;matrices:{level:number;stars:number}[]})=>{weapon.level=data.defaultLevels.weapon;weapon.matrices.forEach(matrix=>{matrix.level=data.defaultLevels.matrix;matrix.stars=3;});});
    await page.addInitScript(draft=>localStorage.setItem('tof-build-draft-v1',JSON.stringify(draft)),maximum);
    await page.reload();
    await card.locator('.stat-table tbody tr').first().locator('td').first().hover();
    await expect(shot).toHaveAttribute('data-stat-match','true');
    await expect(shot).toHaveAttribute('data-damage-bonus','ATK: +0');
  });
  test('keeps elemental gear attack inspection separate from universal attack sources',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    for(const row of [card.locator('.roll[data-stat-keys="Frost Attack"]').first(),card.locator('.augment-value[data-stat-keys="Frost Attack"]').first()]) {
      await row.hover();
      await expect(card).toHaveAttribute('data-stat-highlight','Frost Attack');
      await expect(card.locator('.weapon-art[data-stat-match="true"],.matrix[data-stat-match="true"],.roll[data-stat-keys="Attack"][data-stat-match="true"],.base [data-stat-keys="Attack"][data-stat-match="true"]')).toHaveCount(0);
      await expect(card.locator('.roll[data-stat-keys="Frost Attack"]').first()).toHaveAttribute('data-stat-match','true');
      await page.mouse.move(0,0);
      await row.focus();
      await expect(card).toHaveAttribute('data-stat-highlight','Frost Attack');
      await expect(card.locator('.weapon-art[data-stat-match="true"],.matrix[data-stat-match="true"]')).toHaveCount(0);
    }
  });
  test('shows Space Support ATK only from table and gear attack inspection',async({page})=>{
    await fillTestData(page);
    const data=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    const chosen=data.support.modules.find((m:{attackStat?:string})=>m.attackStat==='Frost Attack');
    const level=data.demoDraft.support.find((m:{id:string})=>m.id===chosen.id).level;
    const value=chosen.levels.find((l:{level:number})=>l.level===level).value;
    const card=page.locator('article.card');
    const support=card.locator(`[data-damage-source="support:${chosen.id}"]`);
    await card.locator('.stat-table tbody tr').first().locator('td').first().hover();
    await expect(support).toHaveAttribute('data-stat-match','true');
    await expect(support).toHaveAttribute('data-damage-bonus',`ATK: +${new Intl.NumberFormat('en-US').format(value)}`);
    expect(await support.evaluate(node=>getComputedStyle(node,'::after').content)).toContain('ATK: +');
    await expect(card.locator('.synthesis-item[data-stat-match="true"]')).toHaveCount(0);
    await expect(card.locator('.computing-node[data-stat-match="true"]')).toHaveCount(2);
    await expect(card.locator('.weapon-art[data-stat-match="true"]')).toHaveCount(3);
    await expect(card.locator('.matrix[data-stat-match="true"]')).toHaveCount(11);
    await expect(card.locator('.weapon-art[data-stat-match="true"]').first()).toHaveAttribute('data-damage-bonus',/^ATK: \+/);
    await expect(card.locator('.matrix[data-stat-match="true"]').first()).toHaveAttribute('data-damage-bonus',/^ATK: \+/);
    await expect(card.locator('.computing-node[data-stat-match="true"]').first()).toHaveAttribute('data-damage-bonus',/^ATK%: \+.*%$/);
    await expect(card.locator('.roll[data-stat-keys="Frost Attack %"]').first()).toHaveAttribute('data-stat-match','true');
    await expect(card.locator('.roll[data-stat-keys="Volt Attack %"]').first()).toHaveAttribute('data-stat-match','false');
    await page.screenshot({path:'ignore/documentation-media/generated/build/attack-all-sources.png'});
    await expect(card.locator('.support-chip[data-source-channel="@damage-sources"][data-stat-match="true"]')).toHaveCount(0);
    for(const flat of [card.locator('.roll[data-stat-keys="Attack"]').first(),card.locator('.base [data-stat-keys="Attack"]').first()]){
      await flat.hover();
      await expect(card).toHaveAttribute('data-stat-highlight','Attack|@attack-sources');
      for(const row of await card.locator('.roll[data-stat-keys="Attack"]').all())await expect(row).toHaveAttribute('data-stat-match','true');
      for(const row of await card.locator('.roll[data-stat-keys="Frost Attack"],.augment-value[data-stat-keys="Frost Attack"],.roll[data-stat-keys="Frost Attack %"],.stat-table td').all())await expect(row).toHaveAttribute('data-stat-match','false');
      await expect(support).toHaveAttribute('data-stat-match','false');
    }
    await card.locator('.roll[data-stat-keys="Frost Attack"]').first().hover();
    await expect(support).toHaveAttribute('data-stat-match','true');
    await card.locator('.gear-stat-total[data-stat-keys="Frost Attack"]').hover();
    await expect(card.locator('.support-chip[data-stat-match]')).toHaveCount(0);
    await support.locator('img').hover();
    await expect(card).not.toHaveAttribute('data-stat-highlight',/@attack-sources/);
    await expect(card.locator('.support-chip[data-stat-match]')).toHaveCount(0);
    await page.mouse.move(0,0);
    await card.locator('.stat-table tbody tr').first().locator('td').first().focus();
    await expect(support).toHaveAttribute('data-stat-match','true');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await card.locator('.stat-table tbody tr').first().locator('td').first().hover();
    await expect(support).toHaveAttribute('data-stat-match','true');
    await expect(support).toHaveAttribute('data-damage-bonus',new RegExp('^АТК: \+'));
  });
  test('fills every section, replaces previous edits and persists test data',async({page})=>{
    const data=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    await fillTestData(page);
    await expect(page.locator('article.card .pet-modules img')).toHaveCount(3);
    await expect(page.locator('article.card .computing-node')).toHaveCount(4);
    await expect(page.locator('article.card .support-chip')).toHaveCount(data.demoDraft.support.length);
    await expect(page.locator('article.card .synthesis-item')).toHaveCount(2);
    await expect.poll(()=>page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('tof-build-draft-v1')||'null');if(saved){delete saved.updatedAt;delete saved.consumableExpiresAt;}return saved;})).toEqual(data.demoDraft);
    await page.getByLabel('Name',{exact:true}).fill('Changed');
    await fillTestData(page);
    await page.reload();
    await openAdvancedEditor(page);
    await expect(page.getByLabel('Name',{exact:true})).toHaveValue(data.demoDraft.profile.name);
    await expect.poll(()=>page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('tof-build-draft-v1')||'null');if(saved){delete saved.updatedAt;delete saved.consumableExpiresAt;}return saved;})).toEqual(data.demoDraft);
  });
  test('explains useful roll value and preserves its element settings',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    await expect(card.locator('.gear-rv')).toHaveCount(12);
    const total=card.locator('[data-build-rv]');
    await expect(total).toContainText('Total GRV');
    await total.getByRole('button',{name:'Total Global Roll Value',exact:true}).hover();
    const totalTooltip=page.getByRole('tooltip');
    await expect(totalTooltip).toContainText('Build maximum');
    await expect(totalTooltip).toContainText('of maximum');
    const maximum=Number((await totalTooltip.locator('[class*=rollValueCeiling] b').innerText()).replaceAll(',','').replace(' GRV',''));
    const totalQuality=Number(await totalTooltip.getByRole('progressbar').getAttribute('aria-valuenow'));
    expect(maximum).toBeGreaterThan(Number(await total.getAttribute('data-build-rv')));
    expect(Math.abs(totalQuality-100*Number(await total.getAttribute('data-build-rv'))/maximum)).toBeLessThan(.1);

    const sum=await card.locator('.gear-rv button').evaluateAll(nodes=>nodes.reduce((total,node)=>total+parseFloat((node.textContent||'').replaceAll(',','')),0));
    expect(Math.abs(Number(await total.getAttribute('data-build-rv'))-sum)).toBeLessThan(.7);
    await expect(card.locator('.equipment-heading button')).toHaveText('Lv. 10');
    const helmet=card.locator('.gear').first();
    await expect(helmet.locator('.gear-title .level')).toHaveText('+50');
    const rv=helmet.getByRole('button',{name:'Helmet · Global Roll Value',exact:true});
    const firstValue=await rv.innerText();
    await expect(page.getByLabel('Roll quality',{exact:true})).toHaveCount(0);
    await expect(card.locator('.gear-rv')).toHaveCount(12);
    await expect(total).toBeVisible();
    await expect(card.locator('.gear-rv')).toHaveCount(12);
    const quality=Number(await helmet.locator('.gear-rv').getAttribute('data-rv-quality'));
    expect(quality).toBeGreaterThan(0);
    expect(quality).toBeLessThanOrEqual(1);
    const shown=Math.round(quality*1000)/1000,band=shown<.6?'neutral':shown<.7?'green':shown<.8?'blue':shown<.85?'purple':shown<.9?'gold':'titan';
    await expect(helmet.locator('.gear-rv')).toHaveAttribute('data-grade',band);
    const best=card.locator('.gear').nth(6).locator('.gear-rv');
    await expect(best).toHaveAttribute('data-grade','titan');
    const titanGradient=await best.locator('[class*="rollValueBadge"]').evaluate(node=>getComputedStyle(node).backgroundImage);
    expect(titanGradient).toContain('rgb(255, 167, 215)');
    expect(titanGradient).toContain('rgb(167, 237, 255)');
    await rv.hover();
    await expect(page.getByRole('tooltip')).toContainText('of slot ceiling');
    await expect(page.getByRole('tooltip')).not.toContainText('Formula:');
    await expect(page.getByRole('tooltip').getByRole('progressbar')).toBeVisible();
    await expect(page.getByRole('tooltip')).toContainText('291.8 GRV');
    await expect(page.getByRole('tooltip').locator('img')).toHaveCount(4);
    await expect.poll(()=>page.getByRole('tooltip').locator('img').evaluateAll(images=>images.every(image=>{
      const rect=image.getBoundingClientRect();
      return Math.abs(rect.width-14)<.05&&Math.abs(rect.height-14)<.05&&getComputedStyle(image).filter==='brightness(0) invert(1)'&&(image as HTMLImageElement).naturalWidth>0;
    }))).toBe(true);
    await expect(page.getByRole('tooltip')).not.toContainText('Color:');
    await expect(page.getByRole('tooltip')).not.toContainText('100 RV =');
    await expect(page.getByRole('tooltip').locator('[class*=rollValueRows] small')).toHaveCount(2);
    await expect(page.getByRole('tooltip').locator('[class*=rollValueRows] small').first()).toContainText(/Projected Titan: [\d,.]+/);
    const tooltip=page.getByRole('tooltip');
    await expect(tooltip.locator('[data-rv-stat="Frost Attack"]')).toHaveAttribute('data-grade','blue');
    await expect(tooltip.locator('[data-rv-stat="Attack"]')).toHaveAttribute('data-grade','neutral');
    await expect(tooltip.locator('[data-rv-stat="Frost Attack"]')).toHaveCSS('color','rgb(153, 218, 255)');
    await expect(card.locator('.roll [data-rv-stat],.augment-value [data-rv-stat]')).toHaveCount(0);
    await page.evaluate(()=>window.scrollTo(0,0));
    await best.getByRole('button').hover();
    await expect(page.getByRole('tooltip')).toContainText('Boots · Global Roll Value');
    const headerBottom=await page.locator('[data-site-header]').evaluate(node=>node.getBoundingClientRect().bottom);
    await expect.poll(()=>page.getByRole('tooltip').evaluate(node=>node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(headerBottom+4);

    await page.screenshot({path:'ignore/documentation-media/generated/build/react-rv-tooltip.png'});
    expect(await card.locator('.gear-head').evaluateAll(heads=>heads.every(head=>head.scrollWidth<=head.clientWidth+1))).toBe(true);
    await card.locator('.gear').nth(8).locator('.gear-rv button').click();
    await page.getByRole('dialog').locator('summary').filter({hasText:'How the calculation works'}).click();
    await expect(page.getByRole('dialog')).toContainText('4.1435%');
    await expect(page.getByRole('dialog')).toContainText('828.7');
    await expect(page.getByRole('dialog')).not.toContainText(/RV v[23]/);
    await expect(page.getByRole('dialog')).toContainText('50,000');
    await expect(page.getByRole('dialog')).toContainText('Your buffs, enemy level and current Crit do not change GRV weights.');
    await page.keyboard.press('Escape');
    await page.locator('summary').filter({hasText:/^Equipment$/}).click();
    await expect(page.getByLabel('Include crit in RV',{exact:true})).toHaveCount(0);
    await page.getByLabel('RV element',{exact:true}).selectOption('Flame');
    await expect(rv).not.toHaveText(firstValue);
    await page.reload();
    await openAdvancedEditor(page);
    await page.locator('summary').filter({hasText:/^Equipment$/}).click();
    await expect(page.getByLabel('RV element',{exact:true})).toHaveValue('Flame');
    await expect(page.getByLabel('Include crit in RV',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await page.setViewportSize({width:844,height:390});
    await card.locator('.gear-rv button').first().click();
    await expect(page.getByRole('dialog')).toContainText('Параметры этой оценки');
    await expect(page.getByRole('dialog')).toContainText('Огонь');
    expect(await page.getByRole('dialog').evaluate(node=>node.getBoundingClientRect().width<=innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:1440,height:900});
    const trigger=card.locator('.gear-rv button').first();
    await page.getByRole('heading',{name:'Ручное заполнение',level:2}).hover();
    await trigger.focus();
    await trigger.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('Потолок слота');
  });
  test('shows item hover details, keyboard dialogs and fixed preview stats',async({page})=>{
    await fillTestData(page);
    const matrix=page.locator('article.card .matrix button').first();
    await matrix.hover();
    await expect(page.getByRole('tooltip')).toContainText('Reverse Coordinates');
    await matrix.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('4 pieces · ★1 · Active');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-item-details.png'});
    await page.getByRole('button',{name:'Close modal'}).click();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.getByRole('heading',{name:'Advanced editor',exact:true}).hover();
    await matrix.hover();
    await expect(page.getByRole('tooltip')).toContainText('Reverse Coordinates');
    await page.locator('article.card .gear-head button').first().click();
    await expect(page.getByRole('dialog').getByRole('columnheader',{name:'Before',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('article.card .roll-quality').first()).toBeVisible();
    await expect(page.locator('article.card .gear-stat-totals')).toBeVisible();
    await page.setViewportSize({width:844,height:390});
    await matrix.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.getByRole('dialog').evaluate(node=>node.getBoundingClientRect().width<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Close modal'}).click();
  });
  test('recognizes four singles, alternating pairs and a three-plus-one matrix layout',async({page})=>{
    const slotOrder=[3,0,2,1];
    const catalog=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    const sets=catalog.matrices.filter((m:{effects:{level:number}[]})=>m.effects.some(e=>e.level===2)&&m.effects.some(e=>e.level===4)).slice(0,4);
    for(const pattern of [[0,1,2,3],[0,1,0,1],[0,0,0,1]]){
      const draft=structuredClone(catalog.demoDraft);
      draft.weapons[0].matrices=pattern.map((id,i)=>({id:sets[id].id,stars:[3,1,2,0][i],level:100}));
      await page.addInitScript(d=>localStorage.setItem('tof-build-draft-v1',JSON.stringify(d)),draft);
      await page.reload();
      const weapon=page.locator('article.card .weapon').first(),chips=weapon.locator('.matrix');
      for(let i=0;i<4;i++){
        await chips.nth(i).locator('button').first().hover();
        const matching=pattern.flatMap((id,j)=>id===pattern[slotOrder[i]]?[j]:[]);
        if(matching.length===1){
          await expect(page.getByRole('tooltip')).toContainText('No set bonus');
          await expect(page.getByRole('tooltip')).not.toContainText('1-Piece Set');
          await expect(weapon.locator('[data-matrix-highlight="true"]')).toHaveCount(0);
        }else{
          const pair=matching.sort((a,b)=>draft.weapons[0].matrices[b].stars-draft.weapons[0].matrices[a].stars).slice(0,2);
          await expect(page.getByRole('tooltip')).toContainText('2-Piece Set');
          await expect(page.getByRole('tooltip')).toContainText(`★${Math.min(...pair.map(i=>draft.weapons[0].matrices[i].stars))}`);
          // The pair highlight follows the display order; only the rank uses the strongest pieces (model.test.ts).
          const shown=slotOrder.filter(slot=>matching.includes(slot)).slice(0,2);
          const highlighted=await chips.evaluateAll(nodes=>nodes.flatMap(n=>n.getAttribute('data-matrix-highlight')==='true'?[Number(n.getAttribute('data-matrix-slot'))]:[]));
          expect(highlighted.sort((a,b)=>a-b)).toEqual(shown.sort((a,b)=>a-b));
        }
      }
      if(pattern.join()==='0,1,2,3')await expect(weapon.locator('.matrix-caption')).toHaveText('No set bonus');
      if(pattern.join()==='0,1,0,1')await expect(weapon.locator('.matrix-set-row')).toHaveCount(2);
      if(pattern.join()==='0,0,0,1'){
        await expect(weapon.locator('.matrix-set-row')).toHaveCount(1);
        await chips.first().locator('button').first().click();
        await expect(page.getByRole('dialog')).toContainText('2 pieces · ★2 · Active');
        await expect(page.getByRole('dialog')).not.toContainText(/4 pieces.*Active/);
        await page.keyboard.press('Escape');
      }
    }
  });
  test('shows the matrix effect and outlines its contributing set',async({page})=>{
    await fillTestData(page);
    const weapon=page.locator('article.card .weapon').first();
    const chips=weapon.locator('.matrix');
    await chips.nth(0).locator('button').first().hover();
    await expect(page.getByRole('tooltip')).toContainText('2-Piece Set');
    await expect(weapon.locator('[data-matrix-highlight="true"]')).toHaveCount(2);
    await chips.nth(2).locator('button').first().hover();
    await expect(page.getByRole('tooltip')).toContainText('4-Piece Set');
    await expect(weapon.locator('[data-matrix-highlight="true"]')).toHaveCount(4);
    await page.keyboard.press('Tab');
    await chips.nth(1).locator('button').first().focus();
    await page.getByRole('heading',{name:'Advanced editor',exact:true}).hover();
    await expect(weapon.locator('[data-matrix-highlight="true"]')).toHaveCount(2);
    await chips.nth(1).locator('button').first().blur();
    await expect(weapon.locator('[data-matrix-highlight="true"]')).toHaveCount(0);
    await page.locator('summary').filter({hasText:/^Weapons & matrices$/}).click();
    const otherSet=await page.getByRole('group',{name:'Weapon 2',exact:true}).getByLabel('Set',{exact:true}).first().getAttribute('data-value');
    const editor=page.getByRole('group',{name:'Weapon 1',exact:true});
    await chooseCatalog(editor.getByLabel('Set',{exact:true}).nth(2),otherSet!);
    await chooseCatalog(editor.getByLabel('Set',{exact:true}).nth(3),otherSet!);
    await chips.nth(1).locator('button').first().hover();
    await expect(page.getByRole('tooltip')).toContainText('2-Piece Set');
    await expect(weapon.locator('[data-matrix-highlight="true"]')).toHaveCount(2);
    await expect(chips.nth(0)).not.toHaveAttribute('data-matrix-highlight','true');
    await expect(chips.nth(3)).toHaveAttribute('data-matrix-highlight','true');
  });
  test('shows configurable synthesis milestones',async({page})=>{
    await fillTestData(page);
    await page.locator('article.card .synthesis-item button').first().hover();
    await expect(page.getByRole('tooltip').locator('[data-unlocked="true"]')).toContainText('S2+3%Active');
    await expect(page.getByRole('tooltip').locator('[data-unlocked="false"]')).toContainText('S5+4%Not unlocked');
    await page.locator('article.card .synthesis-item button').nth(1).hover();
    await expect(page.getByRole('tooltip').locator('[data-unlocked="true"]').last()).toContainText('S5+3%Active');
  });
  test('uses the strongest pair rank and the full-set minimum matrix rank',async({page})=>{
    await fillTestData(page);
    const weapon=page.locator('article.card .weapon').first();
    const chips=weapon.locator('.matrix');
    await chips.nth(3).locator('button').first().hover();
    await expect(page.getByRole('tooltip')).toContainText('★1');
    await expect(page.getByRole('tooltip')).toContainText('4-Piece Set');
    await expect(page.getByRole('tooltip').locator('.sim-num-hl').first()).toHaveText('22%');
    await page.locator('summary').filter({hasText:/^Weapons & matrices$/}).click();
    const editor=page.getByRole('group',{name:'Weapon 1',exact:true});
    await editor.getByRole('group',{name:'Matrix 1',exact:true}).getByLabel('Stars',{exact:true}).fill('0');
    await editor.getByRole('group',{name:'Matrix 3',exact:true}).getByLabel('Stars',{exact:true}).fill('3');
    await chips.nth(3).locator('button').first().hover();
    await expect(page.getByRole('tooltip')).toContainText('★0');
    await expect(page.getByRole('tooltip')).toContainText('4-Piece Set');
    await expect(page.getByRole('tooltip').locator('.sim-num-hl').first()).toHaveText('18%');
    await chips.nth(0).locator('button').first().hover();
    await expect(page.getByRole('tooltip')).toContainText('★3');
    await expect(page.getByRole('tooltip')).toContainText('2-Piece Set');
    await expect(page.getByRole('tooltip').locator('.sim-num-hl').first()).toHaveText('34%');
    await expect(chips.nth(0)).toHaveAttribute('data-matrix-highlight','true');
    await expect(chips.nth(1)).toHaveAttribute('data-matrix-highlight','true');
    await expect(chips.nth(2)).not.toHaveAttribute('data-matrix-highlight','true');
    await chips.nth(0).locator('button').first().click();
    await expect(page.getByRole('dialog')).toContainText('2 pieces · ★3 · Active');
    await expect(page.getByRole('dialog')).toContainText('4 pieces · ★0 · Active');
  });
  test('uses a clear title and progression header across build detail windows',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    for(const selector of ['.suppressor-icon','.weapon-icon','.matrix img','.pet-modules img','.computing-node img','.support-chip img']){
      const target=card.locator(selector).first();
      await target.evaluate(node=>node.scrollIntoView({block:'center'}));
      await target.hover(selector==='.weapon-icon'?{position:{x:8,y:30}}:{});
      const heading=page.getByRole('tooltip').locator('[data-inspection-heading]');
      await expect(heading.locator(':scope > strong')).toHaveCSS('font-size','14px');
      await expect(heading.locator(':scope > strong')).toHaveCSS('font-weight','700');
      await expect(heading.locator(':scope > div').first()).toHaveCSS('color','rgb(43, 166, 223)');
      await expect(heading.locator(':scope > div').first()).toHaveCSS('font-weight','600');
    }
    await card.locator('.computing-node button').first().click();
    const dialog=page.getByRole('dialog');
    await expect(dialog.locator('[data-inspection-heading]')).toContainText('Lv. 6 / 20');
    await expect(dialog.locator('[data-inspection-heading] > strong')).toHaveCSS('font-size','17px');
    await page.keyboard.press('Escape');
    await card.locator('.suppressor-icon').hover();
    await page.getByRole('tooltip').screenshot({path:'ignore/documentation-media/generated/build/react-suppressor-tooltip.png'});
  });
  test('shows the relic base effect and every unlocked advancement',async({page})=>{
    await fillTestData(page);
    const relic=page.locator('article.card .compact-relic button').first();
    await relic.hover();
    const tooltip=page.getByRole('tooltip');
    await expect(tooltip).toContainText('Base effect');
    expect(await tooltip.evaluate(node=>{const name=node.querySelector('[data-inspection-heading] > strong')!.getBoundingClientRect();const stars=node.querySelector('[data-inspection-heading] > div')!.getBoundingClientRect();return stars.left>name.right&&Math.abs(stars.bottom-name.bottom)<4;})).toBe(true);
    await expect(tooltip.locator('.game-rich-text').first()).toHaveCSS('font-size','12px');
    await expect(tooltip.locator('.game-rich-text').first()).toHaveCSS('line-height','16.8px');
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-relic-tooltip.png'});
    for(let level=1;level<=5;level++)await expect(tooltip).toContainText(`★${level}`);
    expect(await tooltip.evaluate(node=>node.getBoundingClientRect().bottom<=innerHeight)).toBe(true);
    await relic.click();
    await expect(page.getByRole('dialog')).toContainText('Base effect');
    await expect(page.getByRole('dialog')).toContainText('★5');
    await page.getByRole('button',{name:'Close modal'}).click();
    const editor=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Relics & Smart Servant$/})});
    await editor.locator(':scope > summary').click();
    await editor.getByRole('spinbutton',{name:'Stars',exact:true}).first().fill('2');
    await relic.hover();
    await expect(tooltip).toContainText('★2');
    await expect(tooltip).not.toContainText('★3');
  });
  test('uses max-level Leia modules in the demo and shows Load only in module selection',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    await expect(card.locator('[data-build-edit="pet"] b')).toHaveText('Leia');
    await expect(card.getByText(/Load:/)).toHaveCount(0);
    await expect(card.locator('.pet-modules img')).toHaveCount(3);
    await card.locator('.pet-modules button').first().hover();
    await expect(page.getByRole('tooltip').last()).toContainText('Lv. 4');
    await expect(page.getByRole('tooltip').last()).not.toContainText('Load');
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    await card.locator('[data-build-edit="module:3"]').click();
    await expect(page.getByRole('dialog')).toContainText('Load: 15 / 15');
  });
  test('shows module descriptions and selects level-specific module artwork',async({page})=>{
    const catalog=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    const pet=catalog.pets.find((item:{id:string})=>item.id===catalog.demoDraft.pet.id);
    const module=pet.modules.find((item:{id:string})=>item.id===catalog.demoDraft.pet.modules[0]);
    await fillTestData(page);
    const trigger=page.locator('article.card .pet-modules button').first();
    const initial=module.levels.at(-1);
    await expect(trigger.locator('img')).toHaveAttribute('src',initial.icon);
    const manual=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Relics & Smart Servant$/})});
    await manual.locator('summary').click();
    await manual.getByLabel('Module level 1',{exact:true}).selectOption(String(module.levels[0].level));
    await trigger.hover();
    await expect(page.getByRole('tooltip')).toContainText('35%/45%/55%/65%');
    await expect(page.getByRole('tooltip').locator('.sim-num-hl').first()).toHaveText('35%');
    await expect(page.getByRole('tooltip').locator('.game-range-dim').filter({hasText:'65%'})).toHaveCount(1);
    const editor=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Relics & Smart Servant$/})});
    const last=module.levels.at(-1);
    await editor.getByLabel('Module level 1',{exact:true}).selectOption(String(last.level));
    await expect(trigger.locator('img')).toHaveAttribute('src',last.icon);
    await trigger.hover();
    await expect(page.getByRole('tooltip').locator('.sim-num-hl').first()).toHaveText('65%');
    await expect(page.getByRole('tooltip').locator('.game-range-dim').filter({hasText:'35%'})).toHaveCount(1);
    await expect(page.getByRole('tooltip')).toContainText(`Lv. ${last.level}`);
    await trigger.click();
    await expect(page.getByRole('dialog').locator('.sim-num-hl').first()).toHaveText('65%');
    await page.reload();
    await expect(trigger.locator('img')).toHaveAttribute('src',last.icon);
  });
  test('uses Global gear icons for SSR, augmented SSR and Titan stages',async({page})=>{
    const catalog=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    const metadata=catalog.gear[0];
    const helmet=page.locator('article.card .gear').first();
    await expect(helmet.locator('.gear-head img').first()).toHaveAttribute('src',metadata.icons.normal);
    await fillTestData(page);
    await expect(helmet.locator('.gear-head img').first()).toHaveAttribute('src',metadata.icons.titan);
    await page.locator('summary').filter({hasText:/^Equipment$/}).click();
    const editor=page.locator('summary').filter({hasText:/^Helmet$/}).locator('..');
    await editor.locator(':scope > summary').click();
    const stage=editor.getByLabel('Augmentation stage',{exact:true});
    await stage.selectOption('augmented');
    await expect(helmet.locator('.gear-head img').first()).toHaveAttribute('src',metadata.icons.augmented);
    await expect(helmet.locator('.augment-value')).toHaveCount(2);
    await expect(helmet.locator('.rare')).toHaveCount(0);
    await stage.selectOption('normal');
    await expect(helmet.locator('.gear-head img').first()).toHaveAttribute('src',metadata.icons.normal);
    await expect(helmet.locator('.augment-value')).toHaveCount(0);
    await stage.selectOption('titan');
    await expect(helmet.locator('.rare')).toHaveCount(1);
    for(const id of ['visor','reactor']){
      const gear=catalog.gear.find((item:{id:string})=>item.id===id);
      expect(gear.icons.normal).toContain('/ResourcesOverSea/Icon/weapon/');
      expect(gear.icons.normal).not.toMatch(/_(ice|fire|thunder|physic|superpower)\./);
    }
    await page.reload();
    await expect(helmet.locator('.gear-head img').first()).toHaveAttribute('src',metadata.icons.titan);
  });
  test('keeps the approved stat display fixed without preview checkboxes',async({page})=>{
    await fillTestData(page);
    for(const label of ['Roll quality','Substat breakdown','Resistance %','Titan roll quality'])await expect(page.getByLabel(label,{exact:true})).toHaveCount(0);
    const card=page.locator('article.card');
    await expect(card.locator('.resistance-percent')).toHaveCount(5);
    await expect(card.locator('.augment-label')).toHaveCount(24);
    await expect(card.locator('.resistance-percent')).toHaveCount(5);
    await expect(card.locator('.resistance-percent').first()).toHaveText('50.9%');
    await expect(card.locator('.resistance-percent').last()).toHaveText('41.1%');
    expect(await card.locator('.resistance-total').evaluateAll(nodes=>nodes.every(node=>{
      const number=node.querySelector('b')!.getBoundingClientRect();
      const percent=node.querySelector('.resistance-percent')!;
      const bounds=percent.getBoundingClientRect();
      return bounds.top>=number.bottom&&Math.abs(bounds.left+bounds.width/2-number.left-number.width/2)<1&&getComputedStyle(percent).color==='rgb(143, 156, 169)';
    }))).toBe(true);
    await expect(card.locator('.titan-roll-size')).toHaveCount(0);
    await expect(card.locator('.gear-rv')).toHaveCount(12);
    await expect(card.locator('.gear-stat-totals')).toBeVisible();
    expect(await card.locator('.stat-table td:last-child').evaluateAll(cells=>cells.every(cell=>cell.scrollWidth<=cell.clientWidth+1))).toBe(true);
    await card.screenshot({path:'ignore/documentation-media/generated/build/react-stat-options.png'});
    await page.reload();
    await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled();
    await expect(card.locator('.augment-label')).toHaveCount(24);
    await expect(card.locator('.titan-roll-size')).toHaveCount(0);
    await expect(card.locator('.resistance-percent')).toHaveCount(5);
  });
  test('includes universal ATK in elemental combat attack inspection',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const volt=card.locator('.stat-table tbody tr').nth(1).locator('td').first();
    await volt.hover();
    await expect(card).toHaveAttribute('data-stat-highlight','Attack|Attack %|Volt Attack %|Volt Attack|@attack-sources|@attack-percent-sources');
    for(const row of await card.locator('.roll[data-stat-keys="Attack"]').all())await expect(row).toHaveAttribute('data-stat-match','true');
    await expect(card.locator('.roll[data-stat-keys="Attack"] b').first()).toHaveCSS('color','rgb(237, 242, 248)');
    await expect(card.locator('.augment-value[data-stat-keys="Volt Attack"]').first()).toHaveAttribute('data-stat-match','true');
    await expect(card.locator('.roll[data-stat-keys="Frost Attack"]').first()).toHaveAttribute('data-stat-match','false');
    await expect(card.locator('[data-damage-source][data-stat-match="true"]:not([data-source-channel="@attack-sources"]):not([data-source-channel="@attack-percent-sources"])')).toHaveCount(0);
    await expect(card.locator('.gear-head[data-source-channel="@cs-sources"][data-stat-match="true"]')).toHaveCount(0);
    await page.mouse.move(0,0);
    await volt.focus();
    await expect(card).toHaveAttribute('data-stat-highlight','Attack|Attack %|Volt Attack %|Volt Attack|@attack-sources|@attack-percent-sources');
    const titan=card.locator('.augment-value[data-stat-keys="Flame Resistance"]').first();
    await titan.hover();
    await expect(titan.locator('.augment-label')).toHaveCSS('color','rgb(255, 133, 139)');
  });
  test('links combat, equipment and footer stats on hover and keyboard focus',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const frost=card.locator('.stat-table tbody tr').first().locator('td').first();
    await frost.hover();
    // The element label also inspects ATK% (resonance and other percent sources).
    await expect(card).toHaveAttribute('data-stat-highlight','Attack|Attack %|Frost Attack %|Frost Attack|@attack-sources|@attack-percent-sources');
    for(const row of await card.locator('.roll[data-stat-keys="Attack"]').all())await expect(row).toHaveAttribute('data-stat-match','true');
    await expect(card.locator('.stat-table tbody tr').first().locator('.element-stat-label')).toHaveAttribute('data-stat-match','true');
    await expect(card.locator('.stat-table tbody tr').nth(1).locator('td').first()).toHaveAttribute('data-stat-match','false');
    expect(await frost.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    const resistance=card.locator('.resistance-total').first();
    await resistance.hover();
    await expect(card).toHaveAttribute('data-stat-highlight','Frost Resistance|Frost Resistance %|Resistance|Resistance %|@resistance-sources');
    await expect(card.locator('.resistance-total').nth(1)).toHaveAttribute('data-stat-match','false');
    await expect(resistance).toHaveAttribute('data-stat-match','true');
    const universalBases=card.locator('.base [data-stat-keys="Resistance"]');
    expect(await universalBases.count()).toBeGreaterThan(0);
    for(const stat of await universalBases.all())await expect(stat).toHaveAttribute('data-stat-match','true');
    for(const stat of await card.locator('.roll[data-stat-keys="Resistance"]').all())await expect(stat).toHaveAttribute('data-stat-match','true');
    const voltResistance=card.locator('.resistance-total').nth(1);
    await voltResistance.hover();
    await expect(card).toHaveAttribute('data-stat-highlight','Volt Resistance|Volt Resistance %|Resistance|Resistance %|@resistance-sources');
    for(const stat of await universalBases.all())await expect(stat).toHaveAttribute('data-stat-match','true');
    await page.mouse.move(0,0);
    await voltResistance.focus();
    for(const stat of await universalBases.all())await expect(stat).toHaveAttribute('data-stat-match','true');
    await voltResistance.blur();

    await frost.hover();
    await expect(card.locator('.roll[data-stat-keys="Frost Attack"]').first()).toHaveAttribute('data-stat-match','true');
    expect(await card.locator('.roll[data-stat-keys="Frost Attack"] .roll-quality').first().evaluate(node=>getComputedStyle(node).color)).toBe('rgb(216, 197, 155)');
    expect(await card.locator('.gear-stat-total[data-stat-keys="Frost Attack"] .gear-stat-rolls b').first().evaluate(node=>getComputedStyle(node).color)).toBe('rgb(216, 197, 155)');
    await expect(card.locator('.roll[data-stat-keys="HP"]').first()).toHaveAttribute('data-stat-match','false');
    for(const selector of ['.weapon','.systems'])expect(await card.locator(selector).first().evaluate(node=>getComputedStyle(node).opacity)).toBe('1');
    await expect.poll(()=>card.locator('.roll[data-stat-keys="HP"]').first().evaluate(node=>getComputedStyle(node).opacity)).toBe('0.3');
    await expect.poll(()=>card.locator('.gear-head').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).opacity==='0.3'))).toBe(true);
    await expect(card.locator('.gear-stat-total[data-stat-keys="Frost Attack"]')).toHaveCount(1);
    for(const item of await card.locator('.gear-stat-total[data-stat-keys="Frost Attack"]').all())await expect(item).toHaveAttribute('data-stat-match','true');
    const frostPercent=card.locator('.gear-stat-total[data-stat-keys="Frost Attack %"]');
    await expect(frostPercent).toHaveAttribute('data-stat-match','true');
    const percentCell=card.locator('.stat-table tbody tr').first().locator('td').nth(1);
    await percentCell.hover();
    await expect(card).toHaveAttribute('data-stat-highlight','Frost Attack %|Attack %|@attack-percent-sources');
    await expect(frostPercent).toHaveAttribute('data-stat-match','true');
    await frostPercent.hover();
    await expect(card).toHaveAttribute('data-stat-highlight','Frost Attack %');
    await expect(card.locator('.roll[data-stat-keys="Frost Attack %"]').first()).toHaveAttribute('data-stat-match','true');
    await expect(card.locator('.roll[data-stat-keys="Frost Attack"]').first()).toHaveAttribute('data-stat-match','false');
    await expect(card.locator('.gear-stat-total[data-stat-keys="Frost Attack"]')).toHaveAttribute('data-stat-match','false');
    await expect(frost).toHaveAttribute('data-stat-match','false');
    await page.getByRole('heading',{name:'Advanced editor',exact:true}).hover();
    await frostPercent.locator('.gear-stat-value').focus();
    await expect(card).toHaveAttribute('data-stat-highlight','Frost Attack %');
    await frostPercent.locator('.gear-stat-value').blur();
    await page.getByRole('heading',{name:'Advanced editor',exact:true}).hover();
    await expect(card).not.toHaveAttribute('data-stat-highlight');
    await expect.poll(()=>card.locator('.roll[data-stat-keys="HP"]').first().evaluate(node=>getComputedStyle(node).opacity)).toBe('1');
    await expect.poll(()=>card.locator('.gear-head').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).opacity==='1'))).toBe(true);
    const hp=card.locator('.hp-stat');
    await hp.focus();
    await expect(card).toHaveAttribute('data-stat-highlight','HP|HP %|@hp-sources');
    await expect(card.locator('.roll[data-stat-keys="HP"]').first()).toHaveAttribute('data-stat-match','true');
    await expect(card.locator('.gear-stat-total[data-stat-keys="HP"]')).toHaveAttribute('data-stat-match','true');
    await hp.blur();
    await expect(card).not.toHaveAttribute('data-stat-highlight');
    const footer=card.locator('.gear-stat-total[data-stat-keys="Crit"]').first();
    await footer.hover();
    for(const stat of await card.locator('.base [data-stat-keys]').all())await expect(stat).toHaveAttribute('data-stat-match','false');
    await expect(card.locator('.roll[data-stat-keys="Crit"]').first()).toHaveAttribute('data-stat-match','true');
    await page.mouse.move(0,0);
    await footer.locator('.gear-stat-value').focus();
    for(const stat of await card.locator('.base [data-stat-keys]').all())await expect(stat).toHaveAttribute('data-stat-match','false');
    await expect(card.locator('.crit-rating')).toHaveAttribute('data-stat-match','true');
    await expect(card.locator('.crit-breakdown.total')).toHaveAttribute('data-stat-match','true');
    await card.screenshot({path:'ignore/documentation-media/generated/build/react-stat-highlight.png'});
    await footer.locator('.gear-stat-value').blur();
    await page.getByRole('heading',{name:'Advanced editor',exact:true}).hover();
    await expect(card).not.toHaveAttribute('data-stat-highlight');
  });
  test('shows support effects and level-dependent supercomputing bonuses',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    await card.getByRole('button',{name:'Physical Attack',exact:true}).hover();
    await expect(page.getByRole('tooltip')).toContainText('Bonus: +150 Physical Attack');
    await expect(page.getByRole('tooltip')).not.toContainText('Next level');
    await card.getByRole('button',{name:'Flame Attack',exact:true}).hover();
    await expect(page.getByRole('tooltip')).toContainText('Bonus: +450 Flame Attack');
    const node=card.locator('.computing-node button').first();
    await node.hover();
    await expect(page.getByRole('tooltip')).toContainText('All resistances');
    await expect(page.getByRole('tooltip')).toContainText('Healing');
    await expect(page.getByRole('tooltip')).toContainText('Elemental DMG:+3.0%');
    const computingIcons=page.getByRole('tooltip').locator('img');
    await expect(computingIcons).toHaveCount(3);
    await expect.poll(()=>computingIcons.evaluateAll(nodes=>nodes.every(node=>(node as HTMLImageElement).naturalWidth>0))).toBe(true);
    await expect(page.getByRole('tooltip')).not.toContainText('Next level');
    await page.locator('summary').filter({hasText:/^Supercomputing & Space Support$/}).click();
    const input=page.getByRole('spinbutton',{name:'Combat Engine',exact:true});
    await input.click();
    await input.fill('10');
    await node.hover();
    await expect(page.getByRole('tooltip')).toContainText('Elemental DMG:+5.0%');
    await expect(page.getByRole('tooltip')).not.toContainText('Next level');
    await input.click();
    await input.fill('11');
    await node.hover();
    await expect(page.getByRole('tooltip')).toContainText('Elemental DMG:+6.0%');
    await input.click();
    await input.fill('20');
    await node.hover();
    await expect(page.getByRole('tooltip')).toContainText('Elemental DMG:+12.5%');
    await expect(page.getByRole('tooltip')).not.toContainText('Next level');
    await node.click();
    await expect(page.getByRole('dialog')).toContainText('Elemental DMG:+12.5%');
    await page.getByRole('button',{name:'Close modal'}).click();
    await card.locator('.computing-node button').nth(2).hover();
    await expect(page.getByRole('tooltip')).toContainText('All ATK');
    await expect(page.getByRole('tooltip')).toContainText('Shatter');
  });
  test('exports the approved full-resolution card',async({page})=>{
    test.setTimeout(90000);
    await fillTestData(page);
    const exportHeight=await page.locator('article.card').evaluate(node=>parseFloat((node as HTMLElement).style.height));
    await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
    await page.evaluate(()=>{new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(node instanceof HTMLElement&&node.style.left==='-20000px'){(window as unknown as {exportHadEditChrome:boolean}).exportHadEditChrome=!!node.querySelector('[data-editing],[data-build-edit],.module-edit-level,.matrix-edit-level,.mark-edit-control,.art-edit-control');}}}).observe(document.body,{childList:true});});
    const downloadPromise=page.waitForEvent('download',{timeout:60000});
    await page.getByRole('button',{name:'Export PNG',exact:true}).click();
    const download=await downloadPromise;
    expect(await page.evaluate(()=>(window as unknown as {exportHadEditChrome:boolean}).exportHadEditChrome)).toBe(false);
    expect(download.suggestedFilename()).toBe('tof-build-kritik.png');
    await download.saveAs(resolve('docs/tools/build/react-export.png'));
    const bytes=readFileSync(resolve('docs/tools/build/react-export.png'));
    expect(bytes.readUInt32BE(16)).toBe(3520);
    expect(bytes.readUInt32BE(20)).toBe(exportHeight*2);
    await expect(page.getByRole('status').filter({hasText:'PNG exported'})).toBeVisible();
  });
  test('fits the compact card below the header and keeps every section inside',async({page})=>{
    await page.setViewportSize({width:1920,height:930});
    await fillTestData(page);
    await page.evaluate(()=>window.scrollTo(0,0));
    const card=page.locator('article.card');
    await expect(card.locator('.gear-stat-rolls').filter({hasText:'×0'})).toHaveCount(0);
    const resistanceRoll=card.locator('.gear-stat-total[data-stat-keys="Flame Resistance %"]');
    await expect(resistanceRoll.locator('.gear-stat-value')).toContainText('9.00%');
    await expect(resistanceRoll.locator('.gear-stat-rolls')).toHaveText('×1');
    await expect(resistanceRoll).not.toContainText('16.87');
    for(const stat of await card.locator('.gear-stat-total[data-stat-keys$=" %"]').all())await expect(stat.locator('.gear-stat-rolls')).not.toContainText('%');
    await expect(card.locator('.gear-stat-total[data-stat-keys="Crit"] .gear-stat-rolls')).toContainText('%');
    expect(await card.locator('.gear-stat-totals').evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
    await expect.poll(()=>card.evaluate(node=>node.getBoundingClientRect().bottom<=innerHeight)).toBe(true);
    expect(await card.evaluate(node=>{
      const frame=node.getBoundingClientRect();
      const header=document.querySelector('header')!.getBoundingClientRect();
      return frame.top-header.bottom>=0&&frame.top-header.bottom<=5;
    })).toBe(true);
    const contained=()=>card.evaluate(node=>[...node.querySelectorAll('.gear,.weapon,.system,.footer')].flatMap(section=>{
      const frame=section.getBoundingClientRect();
      return [...section.querySelectorAll('.rare,.matrix-caption,.system-media,.computing-level,.support-chip,.gear-stat-value,.gear-stat-rolls,.card-metadata')].filter(child=>child.getBoundingClientRect().bottom>frame.bottom+1).map(child=>({section:section.className,text:child.textContent,overflow:child.getBoundingClientRect().bottom-frame.bottom}));
    }));
    expect(await contained()).toEqual([]);
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-compact-desktop.png'});
    await page.setViewportSize({width:1920,height:768});
    await expect.poll(()=>card.evaluate(node=>node.getBoundingClientRect().bottom<=innerHeight-30)).toBe(true);
    expect(await contained()).toEqual([]);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    expect(await contained()).toEqual([]);
    await page.setViewportSize({width:844,height:390});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
  test('shows the compact demo footer in one row with colored element icons',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    const stats=card.locator('.gear-stat-total');
    const rows=await stats.evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));
    expect(new Set(rows.map(n=>Math.round(n))).size).toBe(1);
    await expect(stats.first().locator('.gear-stat-value')).toHaveAttribute('aria-label','HP');
    await expect(card.locator('.gear-stat-value .stat-kind')).toHaveCount(0);
    await expect(card.locator('.summary-stat-icon[data-crit] small')).toHaveText('%');
    const badges=await card.locator('.summary-stat-icon small').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).color));
    expect(new Set(badges)).toEqual(new Set(['rgb(255, 132, 138)']));
    const centered=await card.locator('.gear-stat-totals').evaluate(n=>{
      const r=n.getBoundingClientRect(),items=[...n.children].map(x=>x.getBoundingClientRect());
      return Math.abs((items[0].left+items.at(-1)!.right)/2-(r.left+r.right)/2);
    });
    expect(centered).toBeLessThan(1);

    const frost=card.locator('.gear-stat-value[aria-label="Frost ATK"] img');
    const catalog=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    await expect(frost).toHaveAttribute('src',catalog.elementIcons.Frost.icon);
    await expect(card.locator('.gear-stat-value[aria-label="Frost ATK %"] small')).toHaveText('A%');
    await expect(card.locator('.gear-stat-value[aria-label="Frost DMG %"] small')).toHaveText('D%');
    await card.screenshot({path:'ignore/documentation-media/generated/build/compact-footer.png'});
  });
  test('keeps a large rolled-stat footer fully visible in EN and RU',async({page})=>{
    const catalog=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    const draft=structuredClone(catalog.demoDraft);
    const seen=new Set<string>();
    draft.gear.forEach((gear:{rows:{type:string;value:number;beforeTitan:number}[];titan:boolean;augmented:boolean},index:number)=>{
      const allowed=[...catalog.gear[index].allowedStats].sort((a:string,b:string)=>Number(seen.has(a))-Number(seen.has(b)));
      gear.titan=false;gear.augmented=false;
      gear.rows=allowed.slice(0,4).map((type:string,i:number)=>{
        seen.add(type);const bounds=catalog.reference.statTypes[type];
        const value=bounds.randomStatDefaultValue+bounds.randomStatMaxRollValue*(i===0?2:1);
        return {type,value,beforeTitan:value};
      });
    });
    await page.addInitScript(draft=>localStorage.setItem('tof-build-draft-v1',JSON.stringify(draft)),draft);
    await page.reload();
    const card=page.locator('article.card');
    await expect(card.locator('.gear-stat-total')).toHaveCount(seen.size);
    expect(seen.size).toBeGreaterThan(14);
    const fits=()=>card.evaluate(node=>{
      const footer=node.querySelector('.footer')!.getBoundingClientRect();
      const frame=node.getBoundingClientRect();
      return footer.bottom<=frame.bottom&&[...node.querySelectorAll('.gear-stat-total')].every(item=>{
        const rect=item.getBoundingClientRect();
        return [...item.children].every(child=>{const r=child.getBoundingClientRect();return r.left>=rect.left-1&&r.right<=rect.right+1&&r.bottom<=footer.bottom;});
      });
    });
    expect(await fits()).toBe(true);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    expect(await fits()).toBe(true);
    await page.setViewportSize({width:844,height:390});
    expect(await fits()).toBe(true);
  });
  test('contains long catalog names and supports empty slots',async({page})=>{
    const data=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    const longestWeapon=[...data.weapons].sort((a,b)=>b.weapon.en.length-a.weapon.en.length)[0];
    const longestMatrix=[...data.matrices].sort((a,b)=>b.name.en.length-a.name.en.length)[0];
    await fillTestData(page);
    // The demo's mixed 2+2 matrix layout is on the third weapon (Star of Oblivion).
    const secondWeapon=page.locator('article.weapon').nth(2);
    await expect(page.getByRole('checkbox',{name:'Lock editing',exact:true})).toBeChecked();
    await expect(page.locator('article.card .matrix-level')).toHaveCount(12);
    await expect(secondWeapon.locator('.matrix-set-row')).toHaveCount(2);
    await expect(secondWeapon.locator('.matrix-set-row small')).toHaveText(['2 pcs','2 pcs']);
    await expect(secondWeapon.locator('.matrix-set-row b')).toHaveText(['Spiritual Reconstruction','Night City Never Sleeps']);
    expect(await secondWeapon.locator('.matrix-set-row').evaluateAll(rows=>rows.every(row=>{
      const name=row.querySelector('b')!.getBoundingClientRect(),count=row.querySelector('small')!.getBoundingClientRect();
      return name.right<=count.left&&count.right<=row.getBoundingClientRect().right+1;
    }))).toBe(true);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-mixed-matrices.png'});
    await page.locator('summary').filter({hasText:/^Weapons & matrices$/}).click();
    const first=page.getByRole('group',{name:'Weapon 1',exact:true});
    await chooseCatalog(first.getByLabel('Weapon',{exact:true}),longestWeapon.id);
    for(const select of await first.getByLabel('Set',{exact:true}).all())await chooseCatalog(select,longestMatrix.id);
    expect(await page.locator('article.weapon').first().evaluate(node=>{
      const card=node.getBoundingClientRect();
      return [...node.querySelectorAll('.weapon-head,.matrix-strip,.matrix-caption')].every(child=>child.getBoundingClientRect().bottom<=card.bottom);
    })).toBe(true);
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-long-names.png'});
    await chooseCatalog(first.getByLabel('Weapon',{exact:true}),'');
    await expect(page.locator('article.weapon').first().locator('.weapon-title')).toHaveText('—');
    await expect(page.locator('article.weapon').first().locator('.matrix')).toHaveCount(4);
    await expect(page.locator('article.card .data-origin:visible')).toHaveCount(0);
  });
  test('keeps user text when changing locale and fits a mobile viewport',async({page})=>{
    await fillTestData(page);
    await page.getByLabel('Name',{exact:true}).fill('My name');
    await expect(page.getByText('Your loadout, stats and supporting systems in one card.',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('combobox',{name:'Language',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await expect(page.getByRole('heading',{name:'Ручное заполнение',level:2})).toBeVisible();
    await expect(page.locator('article.card .player')).toHaveText('My name');
    await page.setViewportSize({width:844,height:390});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const exportButton=page.getByRole('button',{name:'Экспорт PNG',exact:true});
    const before=await exportButton.boundingBox();
    await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
    await expect(exportButton).toBeVisible();
    const after=await exportButton.boundingBox();
    expect(after!.y).toBeCloseTo(before!.y,0);
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-mobile.png'});
  });
  test('calculates equipment base totals from enhancement and unlocked milestones',async({page})=>{
    await fillTestData(page);
    await page.locator('summary').filter({hasText:/^Equipment$/}).click();
    const summary=page.locator('summary').filter({hasText:/^Eyepiece$/});
    await summary.click();
    const editor=summary.locator('..');
    await editor.getByLabel('Enhancement',{exact:true}).fill('56');
    const base=page.locator('article.gear').nth(8).locator('.base');
    await expect(base).toHaveText('RES 1,311HP 49,033Crit 1,558');
    await base.locator('span').filter({hasText:'HP 49,033'}).hover();
    await expect(page.getByRole('tooltip')).toContainText('5,184 + 34,459 + 9,390 = 49,033');
    await editor.getByLabel('Enhancement',{exact:true}).fill('55');
    await expect(base).not.toHaveText('RES 1,311HP 49,033Crit 1,558');
    await editor.getByLabel('Augmentation stage',{exact:true}).selectOption('normal');
    await expect(base).not.toContainText('49,033');
    await page.reload();
    await expect(page.locator('article.gear').nth(8).locator('.base')).not.toContainText('49,033');
  });
  test('shows basic equipment enhancement resonance and current bonuses',async({page})=>{
    await fillTestData(page);
    const trigger=page.getByRole('button',{name:'Enhance Resonance',exact:true});
    await expect(trigger).toHaveText('Lv. 10');
    await page.locator('summary').filter({hasText:/^Equipment$/}).click();
    const data=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    for(const id of data.enhancementResonance.slotIds) {
      const gear=data.gear.find((item:{id:string})=>item.id===id);
      const summary=page.locator('summary').filter({hasText:new RegExp(`^${gear.name.en}$`)});
      await summary.click();
      await summary.locator('..').getByLabel('Enhancement',{exact:true}).fill('55');
    }
    await expect(trigger).toHaveText('Lv. 11');
    await trigger.hover();
    const tooltip=page.getByRole('tooltip');
    await expect(tooltip).toContainText('8 pieces · +55');
    for(const value of ['+880','+440','+70,400'])await expect(tooltip).toContainText(value);
    await expect(tooltip).not.toContainText('Next');
    await expect(tooltip.locator('img')).toHaveCount(4);
    expect(await tooltip.locator('img').evaluateAll(images=>images.every(image=>{
      const icon=image.getBoundingClientRect(),label=image.parentElement!.getBoundingClientRect(),row=image.parentElement!.parentElement!.getBoundingClientRect();
      return icon.width<=14&&icon.height<=14&&row.height<26&&label.left<=icon.left&&(image as HTMLImageElement).naturalWidth>0;
    }))).toBe(true);
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-resonance-tooltip.png'});
    await trigger.click();
    await expect(page.getByRole('dialog').locator('img')).toHaveCount(4);
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByRole('button',{name:'Enhance Resonance',exact:true})).toHaveText('Lv. 11');
  });
  test('shows the selected suppressor beside the name with its current stats',async({page})=>{
    await fillTestData(page);
    const defaultTrigger=page.getByRole('button',{name:'Suppressor · V11.4',exact:true});
    await defaultTrigger.hover();
    const defaultTooltip=page.getByRole('tooltip');
    await expect(defaultTooltip.locator('img')).toHaveCount(4);
    expect(await defaultTooltip.locator('img').evaluateAll(images=>images.every(image=>{
      const rect=image.getBoundingClientRect(),row=image.parentElement!.parentElement!.getBoundingClientRect();
      return rect.width===14&&rect.height===14&&row.height<26&&(image as HTMLImageElement).naturalWidth>0;
    }))).toBe(true);
    await defaultTooltip.screenshot({path:'ignore/documentation-media/generated/build/react-suppressor-tooltip.png'});
    await page.getByRole('heading',{name:'Advanced editor',exact:true}).hover();
    await page.getByLabel('Suppressor',{exact:true}).selectOption('12_3');
    const data=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    const tier=data.suppressors.find((item:{id:string})=>item.id==='12_3');
    const trigger=page.getByRole('button',{name:'Suppressor · V12.3',exact:true});
    await expect(trigger.locator('img')).toHaveAttribute('src',tier.icon);
    await expect.poll(()=>trigger.locator('img').evaluate(node=>(node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.locator('article.card .header').screenshot({path:'ignore/documentation-media/generated/build/react-suppressor-header.png'});
    await trigger.hover();
    const tooltip=page.getByRole('tooltip');
    for(const value of Object.values(tier.stats) as number[])await expect(tooltip).toContainText(new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value));
    await trigger.click();
    await expect(page.getByRole('dialog').locator('[data-inspection-heading]')).toContainText('Suppressor· V12.3');
    await page.keyboard.press('Escape');
    await expect(tooltip).not.toBeVisible();
    await page.reload();
    await expect(page.getByRole('button',{name:'Suppressor · V12.3',exact:true})).toBeVisible();
    await openAdvancedEditor(page);
    await page.getByLabel('Suppressor',{exact:true}).selectOption('');
    await expect(page.locator('.suppressor-icon')).toHaveCount(0);
  });
  test('keeps the selected element label and percentages while inheriting duo ATK',async({page})=>{
    await fillTestData(page);
    await page.getByRole('button',{name:'GRV / PRV element',exact:true}).click();
    await page.locator('[role=option][data-value="Frost"]').click();
    await expect(page.locator('article.card .build-element')).toHaveText('Frost');
    await page.locator('summary').filter({hasText:/^Combat stats$/}).click();
    // Scope to the editor: the role resonance icon on the card is also labelled "Attack".
    const combat=page.locator('details').filter({has:page.locator('summary',{hasText:/^Combat stats$/})});
    await combat.getByLabel('Attack',{exact:true}).nth(1).fill('60000');
    await combat.getByLabel('Damage %',{exact:true}).nth(1).fill('50');
    const rows=page.locator('article.card .stat-table tbody tr');
    await expect(rows.nth(1).locator('td').nth(0)).toHaveClass('active');
    await expect(rows.nth(0).locator('td').nth(0)).not.toHaveClass('active');
    await expect(rows.nth(0).locator('td').nth(1)).toHaveClass('active');
    await expect(rows.nth(0).locator('td').nth(2)).toHaveClass('active');
    await expect(rows.nth(1).locator('td').nth(2)).not.toHaveClass('active');
    await expect(rows.nth(0).locator('th')).toHaveClass('active');
    const selectedColor=await rows.nth(0).locator('th').evaluate(node=>getComputedStyle(node).color);
    await expect.poll(()=>rows.nth(1).locator('td').nth(0).evaluate(node=>getComputedStyle(node).color)).toBe(selectedColor);
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-duo-stat-winners.png'});
    await page.reload();
    await expect(rows.nth(1).locator('td').nth(0)).toHaveClass('active');
  });
  test('puts HP first, simplifies crit and uses resistance icons',async({page})=>{
    await fillTestData(page);
    const card=page.locator('article.card');
    await expect(card.locator('.profile-cs')).toHaveText('CS 311,318Apex CS 319,228');
    await page.getByLabel('Crew',{exact:true}).fill('Whalesong');
    await page.getByLabel('Character title',{exact:true}).fill('Mentor');
    await page.getByLabel('Current CS',{exact:true}).fill('312000');
    await page.getByLabel('Maximum CS',{exact:true}).fill('320000');
    await page.reload();
    await openAdvancedEditor(page);
    await expect(card.locator('.profile-cs')).toHaveText('CS 312,000Apex CS 320,000');
    await expect(card.locator('.profile-affiliations')).toHaveText('Crew:WhalesongTitle:Mentor');
    expect(await card.locator('.player-row').evaluate(node=>{
      const suppressor=node.querySelector('.suppressor-icon')!.getBoundingClientRect();
      const affiliations=node.querySelector('.profile-affiliations')!.getBoundingClientRect();
      return affiliations.left>suppressor.right;
    })).toBe(true);
    expect(await card.locator('.header').evaluate(node=>{
      const level=node.querySelector('.sub')!.getBoundingClientRect();
      const title=node.querySelector('.player-row')!.getBoundingClientRect();
      const cs=node.querySelector('.profile-cs')!.getBoundingClientRect();
      const signature=node.querySelector('.profile-signature')!.getBoundingClientRect();
      const identity=node.querySelector('.identity')!.getBoundingClientRect();
      return cs.left>level.right&&Math.abs(cs.top-level.top)<1&&signature.left>Math.max(title.right,cs.right)&&Math.abs(signature.top+signature.height/2-identity.top-identity.height/2)<1;
    })).toBe(true);
    await expect(card.locator('.top-stat')).toContainText('Crit');
    await expect(card.locator('.crit-rating strong')).toHaveText('19,840');
    await expect(card.locator('.crit-calculation')).toHaveText(/^→ \d+\.\d{3}%\+ \d+\.\d{3}%$/);
    await expect(card.locator('.crit-breakdown.total b')).toHaveText(/^\d+\.\d{3}%$/);
    await expect(card.locator('.health-row')).toContainText('HP1,248,600Universal ATK32,850');
    await expect(card.locator('.crit-breakdown.total')).toHaveText(/^\d+\.\d{3}%$/);
    expect(await card.locator('.stats').evaluate(node=>node.querySelector('.health-row')!.getBoundingClientRect().bottom<node.querySelector('.crit-summary')!.getBoundingClientRect().top)).toBe(true);
    const data=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
    const resistanceImages=card.locator('.resistance-total img');
    await expect(resistanceImages).toHaveCount(5);
    for(const [i,element] of data.demoDraft.combat.elements.entries())await expect(resistanceImages.nth(i)).toHaveAttribute('src',data.resistanceIcons[element.id].icon);
    expect(await card.locator('.crit-hero').evaluate(node=>{
      const rating=node.querySelector('.crit-rating')!.getBoundingClientRect();
      const result=node.querySelector('.crit-result')!.getBoundingClientRect();
      return rating.right<=result.left&&Math.abs(rating.bottom-result.bottom)<2;
    })).toBe(true);
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-health-first.png'});
    await page.locator('summary').filter({hasText:/^Combat stats$/}).click();
    await expect(card.locator('.stat-table thead')).toHaveText('ElementATKATK%DMG%');
    expect(await card.locator('.resistance-summary').evaluate(node=>node.getBoundingClientRect().top>node.parentElement!.querySelector('.stat-table')!.getBoundingClientRect().bottom&&node.getBoundingClientRect().bottom<node.parentElement!.querySelector('.titan-summary')!.getBoundingClientRect().top)).toBe(true);
    await page.getByLabel('Attack %',{exact:true}).first().fill('123.4');
    await expect(card.locator('.stat-table tbody tr').first().locator('td').nth(1)).toHaveText('123.4%');
    await page.getByLabel('Endurance',{exact:true}).fill('1500');
    await page.reload();
    await openAdvancedEditor(page);
    await expect(page.getByLabel('Endurance',{exact:true})).toHaveValue('1500');
    await expect(card.locator('.stat-table tbody tr').first().locator('td').nth(1)).toHaveText('123.4%');
    await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
    await page.locator('[data-datamine-language="ru"]').click();
    await expect(page.getByLabel('Резисты в %',{exact:true})).toHaveCount(0);
    await expect(card.locator('.resistance-percent')).toHaveCount(5);
    expect(await card.locator('.health-row,.resistance-total').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1))).toBe(true);
    await page.setViewportSize({width:844,height:390});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'ignore/documentation-media/generated/build/react-health-first-ru-mobile.png'});
  });
});

test('switches GRV and PRV with persisted personal weights, accessible dialogs and mobile RU',async({page})=>{
  await page.goto('/tools/build/');
  const toggle=page.getByRole('radio',{name:'Personal RV',exact:true});
  await expect(toggle).toBeEnabled();
  await fillTestData(page);
  await toggle.click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')||'{}').rv?.mode)).toBe('prv');
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
  await page.getByRole('spinbutton',{name:'Enemy level',exact:true}).fill('0');
  await page.getByRole('spinbutton',{name:'Enemy level',exact:true}).press('Tab');
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
  await page.locator('.gear-rv button').first().click();
  await expect(page.getByRole('dialog')).toContainText('Personal reference unavailable');
  await page.keyboard.press('Escape');
  await fillTestData(page);
  const helmet=page.locator('.gear-rv button').first();
  await expect(helmet).toContainText('GRV');
  const global=await helmet.innerText();
  await toggle.focus();await toggle.press('Enter');
  await expect(helmet).toContainText('PRV');
  expect(await helmet.innerText()).not.toBe(global.replace('GRV','PRV'));
  await helmet.click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('Personal Roll Value');
  await expect(dialog).toContainText('not the hidden universal account base');
  await expect(dialog).toContainText('Build without this item');
  await expect(dialog.locator('[data-rv-removal]')).toBeVisible();
  await expect(dialog).toContainText('not the exact damage increase');
  await expect(dialog.locator('[data-rv-mode]')).toHaveAttribute('data-rv-mode','prv');
  await expect(dialog.locator('h3').filter({hasText:'Maximum roll weights'})).toBeVisible();
  await expect(dialog.locator('[data-rv-roll-weights] [data-rv-roll-type="Attack"]')).toContainText('PRV');
  await expect(dialog.locator('[data-rv-roll-weights] [data-rv-roll-type="Frost Attack"]')).toContainText('Titan');
  await expect(dialog.locator('span').filter({hasText:/^PRV · Personal Roll Value$/})).toHaveCount(0);
  await page.screenshot({path:'ignore/documentation-media/generated/build/roll-value-prv.png'});
  await page.keyboard.press('Escape');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')||'{}').rv?.mode)).toBe('prv');
  await page.reload();
  await expect(page.getByRole('radio',{name:'Personal RV',exact:true})).toHaveAttribute('aria-checked','true');
  await expect(helmet).toContainText('PRV');
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
  await page.locator('[data-datamine-language="ru"]').click();
  await page.setViewportSize({width:844,height:390});
  await page.getByRole('radio',{name:'Глобальный RV',exact:true}).click();
  await expect(helmet).toContainText('GRV');
  await helmet.click();
  await expect(dialog).toContainText('Глобальный Roll Value');
  await expect(dialog).toContainText('Веса максимальных проков');
  await expect(dialog.locator('[data-rv-roll-weights] [data-rv-roll-type="Crit"]')).toContainText('100 GRV');
  await expect(dialog).toContainText('не прибавка к урону');
  expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  await page.screenshot({path:'ignore/documentation-media/generated/build/roll-value-grv-ru.png'});
  await page.keyboard.press('Escape');
  await expect(helmet).toBeFocused();
});

test('unifies the equipment entry and shows icon stat choices with keyboard and mobile support',async({page})=>{
  await page.goto('/tools/build/');
  await fillTestData(page);
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
  await page.locator('article.card .equipment-heading').getByRole('button').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('tab')).toHaveCount(12);
  await expect(dialog.getByLabel('RV element')).toHaveCount(0);
  await expect(dialog.locator('summary').filter({hasText:'Roll breakdown'})).toHaveCount(0);
  const stat=dialog.getByRole('button',{name:'Stat',exact:true}).first();
  await expect(stat.locator('img')).toHaveCount(1);
  await stat.focus();await stat.press('Enter');
  await expect(dialog.getByRole('listbox')).toBeVisible();
  expect(await dialog.getByRole('listbox').getByRole('option').evaluateAll(nodes=>nodes.slice(1).every(n=>n.querySelector('img')!==null))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();await expect(stat).toBeFocused();
  const rare=dialog.getByRole('button',{name:'Rare Titan stat',exact:true});
  await rare.click();
  expect(await dialog.getByRole('listbox').getByRole('option').evaluateAll(nodes=>nodes.slice(1).every(n=>n.querySelector('img')!==null))).toBe(true);
  await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(rare.locator('img')).toHaveCount(1);
  await expect(dialog.getByRole('listbox')).toHaveCount(0);
  await page.screenshot({path:'ignore/documentation-media/generated/build/gear-editor-icons.png'});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
  await page.locator('[data-datamine-language="ru"]').click();
  await page.setViewportSize({width:844,height:390});
  await page.locator('article.card .equipment-heading').getByRole('button').click();
  await expect(dialog.getByRole('tab')).toHaveCount(12);
  expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  await dialog.getByLabel('Доп. стат Titan 1',{exact:true}).click();
  await expect(dialog.getByRole('listbox')).toBeVisible();
  await page.screenshot({path:'ignore/documentation-media/generated/build/gear-editor-icons-ru.png'});
  await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
});
test('uses a compact mark picker without an empty card and keeps removal available',async({page})=>{
  await page.goto('/tools/build/');
  await fillTestData(page);
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
  await page.locator('article.card [data-build-edit="mark"]').first().click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('[data-id]')).toHaveCount(3);
  await expect(dialog.locator('[data-id=""]')).toHaveCount(0);
  expect(await dialog.locator('.tool-panel').evaluate(node=>node.getBoundingClientRect().height<innerHeight*.8)).toBe(true);
  await page.screenshot({path:'ignore/documentation-media/generated/build/mark-picker-compact.png'});
  await dialog.getByRole('button',{name:'Remove',exact:true}).click();
  await expect(page.locator('article.card .weapon-mark')).toHaveCount(0);
});
test('uses consistent inspection typography for suppressor, pet, gear and progression',async({page})=>{
  await page.goto('/tools/build/');
  await fillTestData(page);
  const card=page.locator('article.card');
  for(const source of [card.locator('.suppressor-source'),card.locator('.system-media').filter({hasText:'Leia'}).locator('.inspect-trigger').first(),card.locator('.gear-head img').first(),card.locator('.equipment-heading button')]){
    await source.click();
    const dialog=page.getByRole('dialog');
    const families=await dialog.evaluate(node=>{const h=node.querySelector('[data-inspection-heading]');return h?[getComputedStyle(h.querySelector('strong')!).fontFamily,...Array.from(h.querySelectorAll('[class*=inspectionMeta]')).map(n=>getComputedStyle(n).fontFamily)]:[];});
    expect(new Set(families).size).toBeLessThanOrEqual(1);
    expect(await dialog.locator('img').evaluateAll(images=>images.every(img=>(img as HTMLImageElement).naturalWidth>0))).toBe(true);
    await page.keyboard.press('Escape');
  }
});

test('applies bulk enhancement to all twelve slots and undoes it in one action',async({page})=>{
  await page.goto('/tools/build/');
  await fillTestData(page);
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).gear);
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
  await page.locator('article.card .equipment-heading button').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('region',{name:'All equipment slots'})).toContainText('12 slots');
  await dialog.getByLabel('Enhancement for all slots',{exact:true}).fill('65');
  await dialog.getByLabel('Stars for all slots',{exact:true}).selectOption('5');
  await dialog.getByRole('button',{name:'Apply to all 12',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).gear.every((g:{enhancement:number;stars:number})=>g.enhancement===65&&g.stars===5))).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).gear)).toEqual(original);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await expect(page.locator('article.card .gear-title .level')).toHaveText(Array(12).fill('+65'));
  await page.locator('article.card .equipment-heading button').click();
  await dialog.getByLabel('Stage for all slots',{exact:true}).selectOption('normal');
  await dialog.getByLabel('Stars for all slots',{exact:true}).selectOption('0');
  await dialog.getByRole('button',{name:'Apply to all 12',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).gear.every((g:{titan:boolean;augmented:boolean;stars:number})=>!g.titan&&!g.augmented&&g.stars===0))).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Undo',exact:true}).focus();
  await page.keyboard.press('Control+z');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).gear.every((g:{titan:boolean;stars:number})=>g.titan&&g.stars===5))).toBe(true);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).gear.every((g:{titan:boolean})=>!g.titan))).toBe(true);
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
  await page.locator('[data-datamine-language="ru"]').click();
  await page.setViewportSize({width:844,height:390});
  await page.locator('article.card .equipment-heading button').click();
  await expect(dialog.getByRole('button',{name:'Применить ко всем 12',exact:true})).toBeVisible();
  expect(await dialog.locator('.tool-panel').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
  await page.screenshot({path:'ignore/documentation-media/generated/build/bulk-enhancement-ru.png'});
});
test('undoes typing, art gestures and uploaded artwork without losing redo assets',async({page})=>{
  await page.goto('/tools/build/');
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  await openAdvancedEditor(page);
  await fillTestData(page);
  const name=page.getByLabel('Name',{exact:true});
  await name.fill('Temporary name');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(name).toHaveValue('kritik');
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await expect(name).toHaveValue('Temporary name');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await name.fill('New branch');
  await expect(page.getByRole('button',{name:'Redo',exact:true})).toBeDisabled();
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).art);
  await page.getByRole('button',{name:'Move background',exact:true}).click();
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Escape');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).art.offsetX)).toBe(10);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).art)).toEqual(before);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).art.offsetX)).toBe(10);
  const upload=page.locator('input[type=file][accept*="image"]');
  await upload.setInputFiles(resolve('ignore/documentation-media/docs/tools/build/mark-picker-compact.png'));
  const hero=page.locator('article.card .hero-art');
  await expect(hero).toHaveAttribute('src',/^blob:/);
  // A new image starts centred (the earlier drag offset is cleared).
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).art.offsetX)).toBe(0);
  const url=await hero.getAttribute('src');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(hero).not.toHaveAttribute('src',/^blob:/);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await expect(hero).toHaveAttribute('src',url!);
  await expect.poll(()=>hero.evaluate(n=>(n as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Reset artwork',exact:true}).click();
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(hero).toHaveAttribute('src',url!);
  await page.reload();
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  await openAdvancedEditor(page);
  await expect(name).toHaveValue('New branch');
});

test('keeps the manual editor aligned and uses searchable icon choices on desktop and mobile',async({page})=>{
  await page.goto('/tools/build/');
  await openAdvancedEditor(page);
  await fillTestData(page);
  await page.setViewportSize({width:1600,height:1000});
  const editor=page.getByRole('region',{name:'Build editor',exact:true});
  await editor.getByRole('heading',{name:'Character profile',exact:true}).scrollIntoViewIfNeeded();
  await expect(editor.getByRole('heading',{name:'Appearance',exact:true})).toBeVisible();
  await page.screenshot({path:'ignore/documentation-media/generated/build/manual-editor-profile.png'});
  await editor.locator('summary').filter({hasText:/^Weapons & matrices$/}).click();
  const matrix=editor.getByRole('group',{name:'Weapon 1',exact:true}).getByLabel('Set',{exact:true}).first();
  await matrix.click();
  const search=page.getByRole('searchbox',{name:'Search: Set',exact:true});
  await search.fill('Reverse Coordinates');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('listbox').getByRole('option').locator('img')).toHaveCount(1);
  await search.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(matrix).toContainText('Reverse Coordinates');
  await matrix.click();await search.fill('nothing-matches-this');
  await expect(page.getByRole('status').filter({hasText:'No matches'})).toBeVisible();
  await search.press('Escape');await expect(matrix).toBeFocused();
  const weapon=editor.getByRole('group',{name:'Weapon 1',exact:true});
  await weapon.scrollIntoViewIfNeeded();await page.screenshot({path:'ignore/documentation-media/generated/build/manual-editor-weapons.png'});
  while(await editor.locator('details:not([open])>summary').count())await editor.locator('details:not([open])>summary').first().click();
  const assertFields=async()=>{
    const issues=await editor.locator('input:not([type=checkbox]),select,textarea,button[aria-haspopup=listbox]').evaluateAll(nodes=>nodes.filter(node=>{
      const box=node.getBoundingClientRect(),parent=node.closest('label,[class*="field"]')?.getBoundingClientRect();
      return box.width>0&&parent&&(box.right>parent.right+1||box.left<parent.left-1);
    }).map(node=>node.getAttribute('aria-label')||node.getAttribute('aria-labelledby')||node.tagName));
    expect(issues).toEqual([]);
  };
  await assertFields();
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
  await page.locator('[data-datamine-language=ru]').click();
  await expect(page.getByRole('button',{name:'Экспорт PNG',exact:true})).toBeEnabled();
  await page.setViewportSize({width:844,height:390});
  const ru=page.getByRole('region',{name:'Редактор билда',exact:true});
  await ru.getByRole('heading',{name:'Профиль персонажа',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'ignore/documentation-media/generated/build/manual-editor-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await ru.getByLabel('Аватар',{exact:true}).click();
  await page.getByRole('searchbox',{name:'Поиск: Аватар',exact:true}).fill('no-result');
  await expect(page.getByRole('status').filter({hasText:'Ничего не найдено'})).toBeVisible();
  await page.keyboard.press('Escape');
});

test('loads manual editor code only on demand and fits the desktop card above the left-to-right toolbar',async({page})=>{
  const scripts:Promise<string>[]=[];
  page.on('response',response=>{if(response.request().resourceType()==='script')scripts.push(response.text().catch(()=>''));});
  await page.setViewportSize({width:1920,height:920});
  await page.goto('/tools/build/');
  await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled();
  const toggle=page.getByRole('checkbox',{name:'Advanced editor',exact:true});
  await expect(toggle).not.toBeChecked();
  await expect(page.getByRole('region',{name:'Build editor',exact:true})).toHaveCount(0);
  expect((await Promise.all(scripts)).some(source=>source.includes('Character profile')&&source.includes('Artwork position'))).toBe(false);
  await fillTestData(page);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
  const card=page.locator('article.card'),toolbar=page.getByRole('button',{name:'Export PNG',exact:true}).locator('..').locator('..');
  const cardBox=await card.boundingBox(),toolbarBox=await toolbar.boundingBox();
  expect(cardBox!.y+cardBox!.height).toBeLessThanOrEqual(toolbarBox!.y);
  await expect(page.getByRole('button',{name:'100% view',exact:true})).toHaveCount(0);
  expect(Math.abs(toolbarBox!.width-cardBox!.width)).toBeLessThan(2);
  expect(Math.abs(toolbarBox!.x-cardBox!.x)).toBeLessThan(2);
  const first=await page.getByText('Advanced editor',{exact:true}).boundingBox();
  const undo=await page.getByRole('button',{name:'Undo',exact:true}).boundingBox();
  expect(undo!.x).toBeLessThan(first!.x);
  await page.screenshot({path:'ignore/documentation-media/generated/build/static-card-toolbar.png'});
  await toggle.check();
  await expect(page.getByRole('region',{name:'Build editor',exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
  expect((await Promise.all(scripts)).some(source=>source.includes('Character profile')&&source.includes('Artwork position'))).toBe(true);
  const name=page.getByRole('region',{name:'Build editor',exact:true}).getByLabel('Name',{exact:true});
  await name.fill('Lazy editor draft');
  await toggle.uncheck();
  await expect(page.getByRole('region',{name:'Build editor',exact:true})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
  await toggle.check();await expect(name).toHaveValue('Lazy editor draft');
  await toggle.uncheck();
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
  await card.locator('.equipment-heading button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button',{name:'Apply to all 12',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:1366,height:768});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
  await page.setViewportSize({width:844,height:390});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('shows a saved shot expiry and updates its remaining lifetime in EN and RU',async({page})=>{
  await page.clock.install({time:new Date('2026-10-03T10:00:00Z')});
  await page.goto('/tools/build/');await fillTestData(page);
  const shot=page.locator('article.card [data-consumable-slot="attack"] button');
  await shot.hover();await expect(page.getByRole('tooltip')).toContainText(/Remaining\s*2d 6h 0m/);
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
  await shot.click();
  await page.getByRole('dialog').getByLabel('Effect expires (UTC)',{exact:true}).fill('2026-10-04T11:05');
  await page.keyboard.press('Escape');
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
  await shot.hover();
  await expect(page.getByRole('tooltip')).toContainText('04.10.2026 11:05 UTC');
  await expect(page.getByRole('tooltip')).toContainText('1d 1h 5m');
  await page.reload();await shot.hover();
  await expect(page.getByRole('tooltip').locator('time')).toHaveAttribute('datetime','2026-10-04T11:05:00.000Z');
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();await page.locator('[data-datamine-language=ru]').click();
  await shot.hover();await expect(page.getByRole('tooltip')).toContainText(/Осталось\s*1 д 1 ч 5 мин/);
  await page.clock.setFixedTime(new Date('2026-10-05T10:00:00Z'));
  await page.clock.runFor(30000);
  await expect(page.getByRole('tooltip')).toContainText('Действие закончилось');
  await fillTestData(page);await shot.hover();
  await expect(page.getByRole('tooltip')).toContainText(/Осталось\s*2 д 6 ч 0 мин/);
  await expect(page.getByRole('tooltip').locator('time')).toHaveAttribute('datetime','2026-10-07T16:00:00.000Z');
  await page.setViewportSize({width:844,height:390});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('shows the maximum CS achievement timestamp independently of the draft date',async({page})=>{
  await page.goto('/tools/build/');await fillTestData(page);
  const gs=page.getByRole('button',{name:'Maximum Combat Score',exact:true});
  await gs.hover();await expect(page.getByRole('tooltip')).toContainText('01.10.2026 18:42 UTC');
  await expect(page.getByRole('tooltip').locator('time')).toHaveAttribute('datetime','2026-10-01T18:42:00.000Z');
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
  await gs.click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Maximum CS reached (UTC)',{exact:true}).fill('2026-10-02T12:34:56');
  await page.keyboard.press('Escape');await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
  await gs.hover();await expect(page.getByRole('tooltip')).toContainText('02.10.2026 12:34 UTC');
  await expect(page.getByRole('tooltip').locator('time')).toHaveAttribute('datetime','2026-10-02T12:34:56.000Z');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).profile.apexGsAchievedAt)).toBe('2026-10-02T12:34:56.000Z');
  await page.reload();await gs.hover();await expect(page.getByRole('tooltip')).toContainText('02.10.2026 12:34 UTC');
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();await page.locator('[data-datamine-language=ru]').click();
  await page.getByRole('button',{name:'Максимальный CS',exact:true}).hover();await expect(page.getByRole('tooltip')).toContainText('02.10.2026 12:34 UTC');
});

test('shows full equipment CS with Titan contributions and restores percentage bases',async({page})=>{
  await page.goto('/tools/build/');await fillTestData(page);
  const card=page.locator('article.card');
  await expect(card.locator('.profile-cs')).toHaveText('CS 311,318Apex CS 319,228');
  for(const trigger of await card.locator('.inspect-trigger').all()) {
    await expect(trigger).toHaveCSS('padding','0px');
    await expect(trigger).toHaveCSS('border-top-width','0px');
  }
  const current=card.locator('.current-cs');
  const titan=card.locator('.titan-total[data-titan-stat="EvadeAtkAggravatingInjury"]');
  const titanFont=await titan.evaluate(node=>getComputedStyle(node).fontSize);
  const titanListBounds=await card.locator('.titan-totals').boundingBox();
  await current.hover();
  await expect(titan).toHaveCSS('font-size',titanFont);
  await expect(titan.locator('b')).toHaveText('+5');
  expect(await card.locator('.titan-totals').boundingBox()).toEqual(titanListBounds);
  await expect(card.locator('.titan-cs-overlay')).toBeVisible();
  await expect(card.locator('.profile-meta')).toHaveCSS('opacity','1');
  await expect(current).toHaveCSS('opacity','1');
  const overlayBounds=(await card.locator('.titan-cs-overlay').boundingBox())!;
  const summaryBounds=(await card.locator('.titan-summary').boundingBox())!;
  expect(overlayBounds.y+overlayBounds.height).toBeLessThan(summaryBounds.y);
  expect(overlayBounds.x).toBeCloseTo(summaryBounds.x,0);
  expect(overlayBounds.width).toBeCloseTo(summaryBounds.width,0);
  await expect(card.locator('.titan-cs-overlay')).toContainText('3,292');
  expect(await titan.evaluate(node=>getComputedStyle(node,'::after').content)).toBe('none');
  await expect(card.locator('.gear-head[data-source-channel="@cs-sources"][data-stat-match="true"]')).toHaveCount(12);
  for(const source of await card.locator('.gear-head').all())await expect(source).toHaveAttribute('data-damage-bonus',/^CS: [\d,]+$/);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(card.locator('.titan-total[data-stat-match="true"]')).toHaveCount(9);
  await expect(card.locator('.titan-total[data-titan-stat="SlowMult"]')).toHaveAttribute('data-damage-bonus','CS: 2,000');
  await expect(card.locator('.titan-total[data-titan-stat="EvadeAtkAggravatingInjury"]')).toHaveAttribute('data-damage-bonus','CS: 3,292');
  await expect(card.locator('.enemy-level')).toHaveCSS('cursor','default');
  await page.mouse.move(0,0);await current.focus();
  await expect(card.locator('.gear-head[data-stat-match="true"]')).toHaveCount(12);
  await current.click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const belt=card.locator('.gear').nth(4).getByRole('button',{name:'Belt',exact:true});
  await belt.hover();
  await expect(page.getByRole('tooltip').locator('[data-gear-cs]')).toContainText('CS');
  await expect(page.getByRole('tooltip').locator('[data-gear-cs] b')).toHaveText(/≈ [\d,]+/);
  const baseStatGap=await page.getByRole('tooltip').locator('[class*="compactEffects"]>div').first().evaluate(row=>row.children[1].getBoundingClientRect().left-row.children[0].getBoundingClientRect().right);
  expect(baseStatGap).toBeGreaterThanOrEqual(5);
  expect(baseStatGap).toBeLessThanOrEqual(7);
  await belt.click();const dialog=page.getByRole('dialog');
  await expect(dialog.locator('[data-gear-cs]')).toBeVisible();
  await page.keyboard.press('Escape');
  await openAdvancedEditor(page);
  await page.locator('summary').filter({hasText:/^CS percentage bases$/}).click();
  const data=JSON.parse(readFileSync(resolve('apps/web/public/game-data/build-page.json'),'utf8'));
  await expect(page.getByLabel('Total HP%',{exact:true})).toHaveValue(String(Number((data.demoDraft.combat.hpPercent*100).toFixed(4))));
  await page.getByLabel('Total HP%',{exact:true}).fill('');
  await page.getByRole('checkbox',{name:'Advanced editor',exact:true}).uncheck();
  await card.locator('.gear').nth(10).getByRole('button',{name:'Exoskeleton',exact:true}).hover();
  await expect(page.getByRole('tooltip').locator('[data-gear-cs] b')).toHaveText('—');
  await current.hover();
  await expect(card.locator('.gear').nth(10).locator('.gear-head')).toHaveAttribute('data-stat-match','false');
  await expect(card.locator('.gear').nth(10).locator('.gear-head')).not.toHaveAttribute('data-damage-bonus',/.+/);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.reload();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).combat.hpPercent)).toBeNull();
  await expect(card.locator('.player')).toHaveText(data.demoDraft.profile.name);
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();await page.locator('[data-datamine-language=ru]').click();
  await page.setViewportSize({width:844,height:390});
  await card.locator('.gear').nth(4).getByRole('button',{name:'Пояс',exact:true}).hover();
  await expect(page.getByRole('tooltip').locator('[data-gear-cs]')).toContainText('CS');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


test('keeps generated test example presentation and save eligibility after reload',async({page,request})=>{
  const catalog=await request.get('/game-data/build-page.json').then(response=>response.json());
  await page.goto('/tools/build/');
  await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled();
  await fillTestData(page);
  const card=page.locator('article.card');
  const checkExample=async(ru=false)=>{
    await expect(card.locator('.pet-name')).toHaveText(catalog.demoDraft.pet.customName);
    await expect(card.locator('.weapon-mark')).toHaveCount(1);
    const save=page.getByRole('button',{name:ru?'Сохранить билд':'Save build',exact:true});
    await save.locator('..').hover();
    await expect(page.getByRole('tooltip')).toContainText(ru?'Сохраняется только неизменённая карточка':'Only an unedited card can be saved');
    await expect(save).toBeDisabled();
    await page.mouse.move(0,0);
    await expect.poll(()=>page.evaluate(()=>{
      const draft=JSON.parse(localStorage.getItem('tof-build-draft-v1')!);
      return {demo:draft.demo,markWeaponId:draft.markWeaponId,pet:draft.pet};
    })).toEqual({demo:true,markWeaponId:catalog.demoDraft.markWeaponId,pet:catalog.demoDraft.pet});
  };
  await checkExample();
  await page.reload();
  await checkExample();
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
  await page.locator('[data-datamine-language=ru]').click();
  await page.setViewportSize({width:844,height:390});
  await page.reload();
  await checkExample(true);
});

test('opens both bottom toolbar menus above the locked card toolbar',async({page})=>{
  await page.goto('/tools/build/');
  await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled();
  await expect(page.getByRole('checkbox',{name:'Lock editing',exact:true})).toBeChecked();
  for(const scenario of [
    {viewport:{width:1920,height:1080},ru:false,more:'More actions',clear:'Clear',confirmation:'Clear this build?',cancel:'Cancel',background:'Background',choose:'Choose background'},
    {viewport:{width:844,height:390},ru:true,more:'Дополнительные действия',clear:'Очистить',confirmation:'Очистить билд?',cancel:'Отмена',background:'Фон',choose:'Выбрать фон'},
  ]){
    if(scenario.ru){await page.getByRole('button',{name:'Language selector: English',exact:true}).click();await page.locator('[data-datamine-language=ru]').click();}
    await page.setViewportSize(scenario.viewport);
    const more=page.getByRole('button',{name:scenario.more,exact:true});
    await more.focus();await page.keyboard.press('Enter');
    // A visible DOM element can still be clipped by the toolbar's scroll container.
    // Clicking the action checks that the open menu can actually receive pointer input.
    await page.getByRole('button',{name:scenario.clear,exact:true}).click();
    const confirmation=page.getByRole('dialog',{name:scenario.confirmation,exact:true});
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button',{name:scenario.cancel,exact:true}).click();
    await page.getByRole('button',{name:scenario.background,exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:scenario.choose,exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('groups toolbar actions by priority and keeps secondary actions accessible on mobile and keyboard',async({page})=>{
  await page.goto('/tools/build/');
  const more=page.getByRole('button',{name:'More actions',exact:true});
  await expect(page.getByRole('button',{name:'Test data',exact:true})).not.toBeVisible();
  await more.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Test data',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(more).toBeFocused();
  await expect(page.getByRole('button',{name:'Test data',exact:true})).not.toBeVisible();
  await fillTestData(page);
  await expect(page.locator('article.card .player')).toHaveText('kritik');
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).uncheck();
  await expect(page.getByText('Finish editing',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Move background',exact:true})).toBeVisible();
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
  await more.click();await page.locator('h1').evaluate(el=>el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));
  await expect(page.getByRole('button',{name:'Clear',exact:true})).not.toBeVisible();
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();await page.locator('[data-datamine-language=ru]').click();
  await page.setViewportSize({width:844,height:390});
  await expect(page.getByText('Редактировать карточку',{exact:true})).toBeVisible();
  await page.getByRole('radio',{name:'Персональный RV',exact:true}).click();
  await expect(page.getByRole('radio',{name:'Персональный RV',exact:true})).toHaveAttribute('aria-checked','true');
  await page.getByRole('button',{name:'Дополнительные действия',exact:true}).click();
  await expect(page.getByRole('button',{name:'Очистить',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('confirms browser-only build clearing with cancellation, keyboard focus and RU mobile',async({page})=>{
  const writes:string[]=[];page.on('request',request=>{if(request.url().includes('/api/v1/')&&!['GET','HEAD','OPTIONS'].includes(request.method()))writes.push(request.method()+' '+new URL(request.url()).pathname);});
  const nativeDialogs:string[]=[];page.on('dialog',async dialog=>{nativeDialogs.push(dialog.type());await dialog.dismiss();});
  await page.goto('/tools/build/');
  await fillTestData(page);
  const card=page.locator('article.card'),more=page.getByRole('button',{name:'More actions',exact:true});
  await expect(card.locator('.player')).toHaveText('kritik');
  const stored=await page.evaluate(()=>localStorage.getItem('tof-build-draft-v1'));
  await more.click();await page.getByRole('button',{name:'Clear',exact:true}).focus();await page.keyboard.press('Enter');
  const confirmation=page.getByRole('dialog',{name:'Clear this build?',exact:true});
  const scroll=await page.evaluate(()=>window.scrollY);
  await expect(confirmation.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
  await expect(confirmation).toContainText('Saved profiles and uploaded data will remain.');
  await page.keyboard.press('Escape');await expect(more).toBeFocused();
  expect(await page.evaluate(()=>window.scrollY)).toBe(scroll);
  expect(await page.evaluate(()=>localStorage.getItem('tof-build-draft-v1'))).toBe(stored);
  await expect(card.locator('.player')).toHaveText('kritik');
  await more.click();await page.getByRole('button',{name:'Clear',exact:true}).click();
  await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();await expect(more).toBeFocused();
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();await page.locator('[data-datamine-language=ru]').click();
  await page.setViewportSize({width:844,height:390});
  const ruMore=page.getByRole('button',{name:'Дополнительные действия',exact:true});
  await ruMore.click();await page.getByRole('button',{name:'Очистить',exact:true}).click();
  const ruConfirmation=page.getByRole('dialog',{name:'Очистить билд?',exact:true});
  await expect(ruConfirmation.getByRole('button',{name:'Отмена',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'ignore/documentation-media/generated/build/clear-confirmation-mobile-ru.png',animations:'disabled'});
  await ruConfirmation.getByRole('button',{name:'Очистить',exact:true}).click();await expect(ruMore).toBeFocused();
  await expect(card.locator('.player')).not.toHaveText('kritik');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('tof-build-draft-v1')!).demo)).toBeFalsy();
  await page.reload();await expect(card.locator('.player')).not.toHaveText('kritik');
  expect(nativeDialogs).toEqual([]);expect(writes).toEqual([]);
});

test('asks to turn a phone held in portrait and shows the card in landscape',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/tools/build/');
  await expect(page.getByText('Turn your device',{exact:true})).toBeVisible();
  await expect(page.locator('article.card')).toBeHidden();
  await page.setViewportSize({width:844,height:390});
  await expect(page.getByText('Turn your device',{exact:true})).toBeHidden();
  await expect(page.locator('article.card')).toBeVisible();
});


test('avatar shows the same account counters as the player name on hover and keyboard focus',async({page,request})=>{
  const catalog=await request.get('/game-data/build-page.json').then(response=>response.json());
  const draft=structuredClone(catalog.demoDraft);
  draft.demo=false;draft.profile.name='Avatar account test';
  draft.account={totalLoginDays:1230,continueLoginDays:1,buyGemCount:276,buyFashionCount:2};
  await page.addInitScript(value=>localStorage.setItem('tof-build-draft-v1',JSON.stringify(value)),draft);
  await page.goto('/tools/build/');
  const portrait=page.locator('.card .avatar-portrait');
  await expect(portrait).toBeVisible();
  const original=await portrait.boundingBox();
  await portrait.hover();
  const tooltip=page.getByRole('tooltip');
  await expect(tooltip).toContainText('Login days');
  await expect(tooltip).toContainText('1,230');
  const avatarContent=await tooltip.innerText();
  await page.mouse.move(0,0);await expect(tooltip).not.toBeVisible();
  await page.locator('.card .player-row .inspect-trigger').first().hover();
  await expect(tooltip).toContainText('Login days');
  expect(await tooltip.innerText()).toBe(avatarContent);
  expect(await portrait.boundingBox()).toEqual(original);
  await page.mouse.move(0,0);await expect(tooltip).not.toBeVisible();
  await portrait.focus();await expect(tooltip).toContainText('Login days');
  await portrait.blur();
  await page.getByRole('button',{name:'Language selector'}).click();
  await page.locator('[data-datamine-language="ru"]').click();
  await portrait.hover();await expect(tooltip).toContainText('Дней подряд');
});


test('Altered tooltip identifies the strongest final attack and splits the copied base, own attack and percent',async({page,request})=>{
  const catalog=await request.get('/game-data/build-page.json').then(response=>response.json());
  const draft=structuredClone(catalog.demoDraft);draft.demo=false;
  draft.support.forEach((module:{level:number})=>{module.level=0;});
  draft.combat.elements.forEach((element:{attack:number;attackPercent:number})=>{element.attack=0;element.attackPercent=0;});
  Object.assign(draft.combat.elements.find((element:{id:string})=>element.id==='Frost'),{attack:1000,attackPercent:1});
  Object.assign(draft.combat.elements.find((element:{id:string})=>element.id==='Volt'),{attack:1500,attackPercent:.1});
  Object.assign(draft.combat.elements.find((element:{id:string})=>element.id==='Altered'),{attack:2300,attackPercent:.1});
  draft.rv={element:'Altered',includeCrit:true,mode:'prv'};
  await page.addInitScript(value=>localStorage.setItem('tof-build-draft-v1',JSON.stringify(value)),draft);
  await page.goto('/tools/build/');
  const row=page.locator('.card .stat-table tbody tr').filter({hasText:'Altered'});
  await row.locator('td').nth(0).locator('.element-stat-value').hover();
  const tooltip=page.getByRole('tooltip');
  await expect(tooltip.locator('[data-altered-source="Frost"]')).toHaveText('2,000');
  await expect(tooltip).toContainText('Own ATK');
  await expect(tooltip).toContainText('+300');
  await expect(tooltip).toContainText('+230');
  await expect(tooltip).toContainText('2,530');
});
