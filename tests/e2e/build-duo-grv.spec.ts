import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('Build GRV uses the same duo flat ATK family in Frost and Volt',async({page})=>{
  const catalog=JSON.parse(readFileSync('apps/web/public/game-data/build-page.json','utf8'));
  const draft=structuredClone(catalog.demoDraft);
  // A scoring fixture is a manual draft: a signed file draft is refreshed from its original capture.
  delete draft.captureSource;draft.demo=false;
  const weapon=catalog.weapons.find((item:{elements:string[]})=>item.elements.length===2&&item.elements.includes('Frost')&&item.elements.includes('Volt'));
  expect(weapon).toBeTruthy();draft.weapons[0].id=weapon.id;
  delete draft.weapons[0].element;delete draft.weapons[0].mode;delete draft.weapons[0].skills;
  draft.rv={mode:'grv',element:'Frost',includeCrit:true};
  const gear=draft.gear.find((item:{id:string})=>item.id==='reactor');
  // Current values transcribed from the supplied Microreactor capture; game bounds remain generated.
  gear.rows=[{type:'Frost Attack %',value:.051123,beforeTitan:.0414},
    {type:'Volt Attack',value:912.198547,beforeTitan:551.469116},
    {type:'Attack',value:494.903015,beforeTitan:237.420929},
    {type:'HP',value:23398.265625,beforeTitan:4125}];
  gear.augments=gear.augments.map(()=>({type:'',value:0}));
  await page.addInitScript(draft=>{
    if(!localStorage.getItem('tof-build-draft-v1'))localStorage.setItem('tof-build-draft-v1',JSON.stringify(draft));
  },draft);
  await page.goto('/tools/build/');
  const rv=page.getByRole('button',{name:'Microreactor · Global Roll Value',exact:true});
  await expect(rv).toBeVisible();const frost=await rv.innerText();
  await rv.focus();await rv.press('Enter');
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('Frost / Volt · Current stats');
  await dialog.press('Escape');await expect(rv).toBeFocused();
  const element=page.getByRole('button',{name:'GRV / PRV element',exact:true});
  await element.click();await element.locator('..').locator('[role=option][data-value=Volt]').click();
  await expect(page.locator('[data-rv-element]')).toHaveAttribute('data-rv-element','Volt');
  await expect(rv).toHaveText(frost);
  await page.reload();await expect(rv).toHaveText(frost);
  await expect(page.locator('[data-rv-element]')).toHaveAttribute('data-rv-element','Volt');
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();
  await page.locator('[data-datamine-language="ru"]').click();
  await page.setViewportSize({width:844,height:390});
  const ru=page.getByRole('button',{name:'Микрореактор · Глобальный Roll Value',exact:true});
  await ru.click();await expect(dialog).toContainText(/Электро \/ Л[её]д · Текущие статы/);
  expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
});
