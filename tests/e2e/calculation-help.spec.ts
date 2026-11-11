import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

const reference=JSON.parse(readFileSync('apps/web/public/game-data/build-page.json','utf8'));

function toolRail(page:Page) {
  return page.locator('[data-tool-rail]');
}

async function expandToolRail(page:Page,locale:'en'|'ru') {
  if((page.viewportSize()?.width??1280)>=1024)return;
  const rail=toolRail(page);
  const toggle=rail.locator('button[aria-controls][aria-expanded]');
  await expect(toggle).toBeVisible();
  if(await toggle.getAttribute('aria-expanded')==='false') {
    await expect(toggle).toHaveAccessibleName(locale==='ru'?'Дополнительные действия':'More actions');
    await toggle.click();
  }
}

for(const locale of ['en','ru'] as const){
  test(`Optimizer starts with explained formulas and separates calculation topics · ${locale}`,async({page})=>{
    await page.goto('/tools/optimizer/');
    if(locale==='ru'){
      await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
      await page.locator('[data-datamine-language="ru"]').click();
      await page.setViewportSize({width:390,height:844});
    }
    const formulas=locale==='ru'?'Формулы сравнения':'Comparison formulas';
    await expandToolRail(page,locale);
    await toolRail(page).getByRole('button',{name:formulas,exact:true}).click();
    const dialog=page.getByRole('dialog').last();
    const summary=dialog.getByRole('region',{name:locale==='ru'?'Точный прирост от замены':'Exact replacement gain',exact:true});
    await expect(summary).toBeVisible();
    expect((await summary.boundingBox())!.y).toBeLessThan((await dialog.getByRole('heading',{name:locale==='ru'?'Сравнение и точка отсчёта':'Comparison and baseline',exact:true}).boundingBox())!.y);
    const candidate=summary.locator('[data-formula-term]').filter({hasText:'O(candidate)'});
    await candidate.focus();
    await expect(page.getByRole('tooltip')).toContainText(locale==='ru'?'Полный билд с заменой в этом слоте':'Complete build with the candidate in this slot');
    const tooltipLayer=await page.getByRole('tooltip').evaluate(node=>Number(getComputedStyle(node).zIndex));
    const dialogLayer=await dialog.evaluate(node=>Number(getComputedStyle(node).zIndex));
    expect(tooltipLayer).toBeGreaterThan(dialogLayer);
    await summary.locator('[data-formula-term]').filter({hasText:'O(equipped)'}).hover();
    await expect(page.getByRole('tooltip').last()).toContainText(locale==='ru'?'точка отсчёта прироста':'reference for the gain');
    await candidate.blur();await page.mouse.move(0,0);
    await page.screenshot({path:`ignore/documentation-media/generated/optimizer/formulas-${locale}.png`,animations:'disabled'});
    expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await page.getByRole('radio',{name:locale==='ru'?/^Все вещи/:/^All pieces/}).click();
    await page.getByRole('list',{name:locale==='ru'?'Сравнение инвентаря':'Inventory comparison',exact:true}).getByRole('button',{name:locale==='ru'?/^Сравнить /:/^Compare /}).first().click();
    await page.getByRole('dialog').last().getByRole('button',{name:formulas,exact:true}).click();
    const selectedHelp=page.getByRole('dialog').last();
    await expect(selectedHelp.locator('[data-comparison-numeric]')).toBeVisible();
    expect(await selectedHelp.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
  });
}

for(const locale of ['en','ru'] as const){
  test(`Ranking question and rail open the same complete help · ${locale}`,async({page})=>{
    await page.goto('/tools/ranking/');
    if(locale==='ru'){
      await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
      await page.locator('[data-datamine-language="ru"]').click();
      await page.setViewportSize({width:844,height:390});
    }
    const label=locale==='ru'?'Как считается рейтинг':'How ranking is calculated';
    const question=page.locator('[class*="boardHead"]').getByRole('button',{name:label,exact:true});
    const rail=toolRail(page).getByRole('button',{name:label,exact:true});
    for(const opener of [question,rail]){
      if(opener===rail)await expandToolRail(page,locale);
      await expect(opener).toBeEnabled();
      await opener.focus();await opener.press('Enter');
      const dialog=page.getByRole('dialog').last();
      await expect(dialog.getByRole('heading',{name:locale==='ru'?'Рейтинг: GRV, CS и сравнение':'Ranking: GRV, CS and comparison',exact:true})).toBeVisible();
      await expect(dialog.getByText(locale==='ru'?'Веса максимальных проков (GRV)':'Maximum roll weights (GRV)',{exact:true})).toBeVisible();
      const account=dialog.getByRole('article').filter({has:page.getByRole('heading',{name:locale==='ru'?'Публичный аккаунт Global':'Public Global account',exact:true})});
      await account.scrollIntoViewIfNeeded();await expect(account).toBeVisible();
      await expect(account.getByRole('button',{name:locale==='ru'?/^Скопировать:/i:/^Copy:/i})).toHaveCount(2);
      expect(await account.evaluate(node=>node.parentElement?.lastElementChild===node)).toBe(true);
      expect(await account.evaluate(node=>!!node.closest('details'))).toBe(false);
      await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
    }
  });
}

for(const locale of ['en','ru'] as const){
  test(`shared calculation help across Build, Ranking and Optimizer · ${locale}`,async({page})=>{
    test.setTimeout(90000);
    await page.goto('/tools/build/?demo=1');
    if(locale==='ru'){
      await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
      await page.locator('[data-datamine-language="ru"]').click();
    }
    for(const route of ['build','ranking','optimizer']){
      await page.goto(`/tools/${route}/?demo=1`);
      const label=route==='optimizer'
        ?locale==='ru'?'Формулы сравнения':'Comparison formulas'
        :route==='ranking'?locale==='ru'?'Как считается рейтинг':'How ranking is calculated'
        :locale==='ru'?'Как считаются GRV и PRV':'How GRV and PRV work';
      const opener=toolRail(page).getByRole('button',{name:label,exact:true});
      await expandToolRail(page,locale);
      await expect(opener).toBeEnabled();
      await opener.focus();
      await opener.press('Enter');
      const dialog=page.getByRole('dialog').last();
      const formula=dialog.getByRole('region',{name:locale==='ru'?'АТК стихии и Space Support':'Element ATK and Space Support',exact:true});
      const damageScope=dialog.getByRole('region',{name:locale==='ru'?'Урон оружия и матриц при сравнении гира':'Weapon and matrix damage in gear comparisons',exact:true}).first();
      await expect(damageScope).toContainText('(M × D₂) / (M × D₁) = D₂ / D₁');
      await expect(damageScope).toContainText(locale==='ru'?'Эффекты, которые меняются вместе с гиром, по этому правилу исключать нельзя.':'effects that change with the gear cannot be discarded on this basis.');
      const titanNote=dialog.getByText(locale==='ru'?'Добавленные Titan-статы: почему одинаковые проки дают разное ОЗ':'Titan-added stats: why equal rolls can give different HP',{exact:true}).first();
      await titanNote.click();
      await expect(dialog.getByText(locale==='ru'?/Прогноз Titan сохраняет собственный потолок/:/Titan forecasts keep each original stat/).first()).toBeVisible();
      await titanNote.click();
      if(route==='ranking'){
        await expect(formula).toHaveCount(0);
        await expect(dialog.getByRole('heading',{name:locale==='ru'?'Рейтинг: GRV, CS и сравнение':'Ranking: GRV, CS and comparison',exact:true})).toBeVisible();
        await expect(dialog.getByText(/Apex CS/)).toBeVisible();
        await expect(dialog.getByRole('heading',{name:'PRV · Personal Roll Value',exact:true})).toHaveCount(0);
      }else{
        await expect(formula).toBeVisible();
        await expect(formula.getByText('B = max(B₁ − S₁, B₂ − S₂) + S₁',{exact:true})).toBeVisible();
        await expect(formula.getByText('ATK = B × (1 + a)',{exact:true})).toBeVisible();
      }
      if(route==='optimizer'){
        await expect(dialog.getByRole('region',{name:locale==='ru'?'КС экипировки':'Equipment CS',exact:true})).toHaveCount(0);
        await expect(dialog.getByText(`${locale==='ru'?'прирост':'gain'} = O(candidate) / O(equipped) − 1`,{exact:true})).toBeVisible();
        await expect(dialog.getByRole('heading',{name:locale==='ru'?'Прогноз Titan и его ограничения':'Titan forecast and its limits',exact:true})).toBeVisible();
      }
      if(route!=='optimizer')await expect(dialog.getByText(locale==='ru'?'Обновление рейтинга':'Ranking updates',{exact:true})).toBeVisible();
      if(route==='build'){
        await dialog.locator('summary').filter({hasText:locale==='ru'?'Другие расчёты и неочевидные правила игры':'Other calculations and game rules that are not obvious'}).click();
        await expect(dialog.getByRole('region',{name:locale==='ru'?'КС экипировки':'Equipment CS',exact:true})).toContainText('CS% = p × B × w');
        await expect(dialog.getByText('D(L) = round(a_crit(L) × L² + b_crit(L) × L + c_crit(L))',{exact:true})).toBeVisible();
        await expect(dialog.getByRole('heading',{name:locale==='ru'?'CS Enhancement Shot':'Enhancement Shot CS',exact:true})).toBeVisible();
        await expect(dialog.getByRole('heading',{name:locale==='ru'?'Коэффициенты CS свойств Titan':'Titan-property CS coefficients',exact:true})).toBeVisible();
        const number=(value:number)=>value.toLocaleString(locale==='ru'?'ru-RU':'en-US',{maximumFractionDigits:6});
        const coefficients=dialog.getByRole('heading',{name:locale==='ru'?'Коэффициенты CS в этом каталоге':'CS coefficients in this catalog',exact:true}).locator('..').locator('..');
        await expect(coefficients.getByText(`CS = value × ${number(reference.csRules.weights.HP)}`,{exact:true})).toBeVisible();
        const share=dialog.getByText(locale==='ru'?'Наблюдаемая доля добавленного стата':'Observed added-stat share',{exact:true}).locator('..').locator('..');
        await expect(share).toContainText(`${number(reference.reference.titanGrowth.addedStatShare*100)}%`);
      }
      await dialog.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      // Build requires landscape on phones; Ranking and Optimizer support portrait.
      await page.setViewportSize(route==='build'?{width:844,height:390}:{width:390,height:844});
      await expandToolRail(page,locale);
      await opener.click();
      await expect(damageScope).toContainText('(M × D₂) / (M × D₁) = D₂ / D₁');
      if(route!=='ranking')await expect(formula).toBeVisible();
      if(route==='build')await dialog.locator('summary').filter({hasText:locale==='ru'?'Другие расчёты и неочевидные правила игры':'Other calculations and game rules that are not obvious'}).click();
      expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
      await dialog.press('Escape');
      await expect(dialog).toHaveCount(0);
      await page.setViewportSize({width:1280,height:720});
    }
    await page.getByRole('radio',{name:locale==='ru'?/^Все вещи/:/^All pieces/}).click();
    const inventory=page.getByRole('list',{name:locale==='ru'?'Сравнение инвентаря':'Inventory comparison',exact:true});
    await inventory.getByRole('button',{name:locale==='ru'?/^Сравнить /:/^Compare /}).first().click();
    const comparison=page.getByRole('dialog').last();
    await comparison.getByRole('button',{name:locale==='ru'?'Формулы сравнения':'Comparison formulas',exact:true}).click();
    const nested=page.getByRole('dialog').last();
    await expect(nested.getByRole('region',{name:locale==='ru'?'АТК стихии и Space Support':'Element ATK and Space Support',exact:true})).toBeVisible();
    await nested.press('Escape');
  });
}
