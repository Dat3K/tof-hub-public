import {test,expect} from '@playwright/test';
import {serializeSquadState} from '../../apps/web/src/features/comp/codecs';
import type {SquadState} from '../../apps/web/src/features/comp/types';

for(const locale of ['en','ru'] as const)test(`weapon elements, techniques and resonances persist (${locale})`,async({page})=>{
  test.setTimeout(90000);
  await page.goto('/tools/build/');
  await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled();
  const seeded=await page.evaluate(async()=>{
    const catalog=await fetch('/game-data/build-page.json').then(response=>response.json());
    const draft=structuredClone(catalog.demoDraft);
    for(const weapon of draft.weapons){delete weapon.element;delete weapon.skills;}
    draft.weapons[0].id='lana';draft.weapons[0].element='Volt';
    draft.weapons[1].id='fiona';draft.weapons[1].skills=catalog.weapons.find((weapon:{id:string})=>weapon.id==='fiona').selectableSkills.slice(0,2).map((skill:{id:string})=>skill.id);
    draft.weapons[2].id='gefion';
    return draft;
  });
  await page.addInitScript(draft=>{if(!sessionStorage.getItem('weapon-options-test-seed')){localStorage.setItem('tof-build-draft-v1',JSON.stringify(draft));sessionStorage.setItem('weapon-options-test-seed','1');}},seeded);
  await page.goto('/tools/build/');
  await expect(page.locator('article.card .weapon-element img')).toHaveCount(3);
  if(locale==='ru'){await page.getByRole('button',{name:'Language selector: English',exact:true}).click();await page.locator('[data-datamine-language=ru]').click();}
  const card=page.locator('article.card');
  await expect(card.locator('.weapon-element img')).toHaveCount(3);
  await expect(card.locator('.weapon-element img').first()).toHaveAttribute('alt',locale==='ru'?'Электро / Лед':'Volt / Frost');
  await expect(card.locator('.weapon-resonance')).toHaveCount(2);
  await expect(card.getByLabel(locale==='ru'?'Гидрофокус':'Hydro Focus',{exact:true})).toBeVisible();
  await page.getByRole('checkbox',{name:locale==='ru'?'Заблокировать редактирование':'Lock editing',exact:true}).uncheck();
  await card.locator('.weapon-element').first().click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel(locale==='ru'?'Элемент оружия':'Weapon element',{exact:true}).selectOption('Physical');
  await page.keyboard.press('Escape');
  await expect(card.locator('.weapon-resonance')).toHaveCount(0);
  await card.locator('[data-build-edit="weapon-config:1"]').click();
  await dialog.getByLabel(`${locale==='ru'?'Техника рассеивания':'Scatter Technique'} 1`,{exact:true}).selectOption('GA_FPlayerQueenSkill_Skill6');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(card.getByLabel(locale==='ru'?'Неистощимый источник':'Wellspring',{exact:true})).toBeVisible();
  await expect(card.locator('.weapon-element img').first()).toHaveAttribute('alt',locale==='ru'?'Физический / Огонь':'Physical / Flame');
  await page.screenshot({path:`ignore/documentation-media/generated/build/weapon-options-${locale}.png`});
});

test('Comp keeps two techniques in a shared URL and omits them on MMO',async({page})=>{
  const state:SquadState={mode:4,server:'standard',title:'Techniques',players:Array.from({length:4},(_,index)=>({id:`p${index}`,name:`Player ${index}`,role:'dps',customRole:null,trait:null,weapons:Array.from({length:3},(_,slot)=>({id:index===0&&slot===0?'fiona':null,stars:6,matrix:null})),relics:[{id:null,rank:0},{id:null,rank:0}]}))};
  await page.goto(`/tools/comp/?c=${serializeSquadState(state)}`);
  const first=page.getByLabel('Scatter Technique 1',{exact:true});
  await expect(first).toHaveCount(1);
  await first.focus();
  await first.selectOption('GA_FPlayerQueenSkill_Skill3');
  await page.getByLabel('Scatter Technique 2',{exact:true}).selectOption('GA_FPlayerQueenSkill_Skill5');
  await expect.poll(()=>page.url()).toContain('?c=');
  await page.reload();
  await expect(first).toHaveValue('GA_FPlayerQueenSkill_Skill3');
  await expect(page.getByLabel('Scatter Technique 2',{exact:true})).toHaveValue('GA_FPlayerQueenSkill_Skill5');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export PNG',exact:true}).click();
  const download=await downloadPromise;
  await download.saveAs('ignore/documentation-media/generated/build/comp-fiona-export.png');
  expect(await download.failure()).toBeNull();
  await page.screenshot({path:'ignore/documentation-media/generated/build/comp-fiona-techniques.png'});
  state.server='mmo';
  await page.goto(`/tools/comp/?c=${serializeSquadState(state)}`);
  await expect(page.getByLabel('Scatter Technique 1',{exact:true})).toHaveCount(0);
});
