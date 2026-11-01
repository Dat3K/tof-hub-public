import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {DRAFT_KEY,buildCombatDraft} from '../../apps/web/src/features/build/model';
import {formatValue} from '../../apps/web/src/features/build/presentation';
import {OPTIMIZER_STORAGE_KEY,exampleSession} from '../../apps/web/src/features/build/browser-storage';
import type {BuildCatalog} from '../../apps/web/src/features/build/types';

const catalog=JSON.parse(readFileSync('apps/web/public/game-data/build-page.json','utf8')) as BuildCatalog;
const activeDraft=structuredClone(catalog.demoDraft);
activeDraft.consumableExpiresAt={};
const shotSlot=catalog.consumables.findIndex(group=>group.id==='enhancement');
activeDraft.consumables![shotSlot]=catalog.consumables[shotSlot].items[0].id;
for(const locale of ['en','ru'] as const){
  test(`Enhancement Shot highlights only from the profile CS · ${locale}`,async({page})=>{
    await page.addInitScript(({key,draft,optimizerKey,session})=>{
      if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(draft));
      if(!localStorage.getItem(optimizerKey))localStorage.setItem(optimizerKey,JSON.stringify(session));
    },{key:DRAFT_KEY,draft:activeDraft,optimizerKey:OPTIMIZER_STORAGE_KEY,session:{...exampleSession(catalog),draft:activeDraft}});
    await page.goto('/tools/build/?demo=1');
    if(locale==='ru'){
      await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
      await page.locator('[data-datamine-language="ru"]').click();
    }
    const shot=page.locator('[data-consumable-slot="enhancement"]');
    const combat=buildCombatDraft(activeDraft,catalog);
    const hp=formatValue(combat.combat.hp,false,locale,0),crit=formatValue(combat.combat.crit,false,locale,0);
    await expect(page.locator('.hp-stat b')).toHaveText(hp);
    await expect(page.locator('.crit-rating strong')).toHaveText(crit);
    await expect(page.locator('.current-cs b')).toHaveText(formatValue(combat.profile.cs!,false,locale,0));
    const system=page.locator('.consumable-system');
    await expect(shot.locator('[data-enhancement-shot-cs]')).toHaveCount(0);
    await expect(system).not.toContainText(/CS\s*≈\s*\+/);
    await page.locator('.current-cs').hover();
    await expect(shot).toHaveAttribute('data-stat-match','true');
    await page.locator('.titan-totals [data-stat-keys*="@cs-sources"]').first().hover();
    await expect(shot).not.toHaveAttribute('data-stat-match','true');
    await page.mouse.move(0,0);
    await shot.getByRole('button').focus();
    await shot.getByRole('button').press('Enter');
    const details=page.getByRole('dialog').last();
    await expect(details).toBeVisible();
    await expect(details).not.toContainText(locale==='ru'?'КС базовых статов':'Base-stat CS');
    await details.press('Escape');
    await page.setViewportSize({width:844,height:390});
    await system.screenshot({path:`ignore/documentation-media/generated/enhancement-shot-cs-${locale}.png`});
    await expect(shot.locator('[data-enhancement-shot-cs]')).toHaveCount(0);
    await page.goto('/tools/optimizer/?demo=1');
    const stats=page.getByRole('region',{name:locale==='ru'?'Статы билда и персональные веса':'Build stats and personal weights'});
    await expect(stats.getByText(hp,{exact:true})).toBeVisible();
    await expect(stats.getByText(crit,{exact:true})).toBeVisible();
  });
}
