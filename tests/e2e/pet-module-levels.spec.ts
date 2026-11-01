import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('Info Pets selects level-specific module artwork in cards and details',async({page})=>{
  const data=JSON.parse(readFileSync('apps/web/public/game-data/en/pets.json','utf8'));
  const module=data.module_families.find((item:{id:string})=>item.id==='ssr_1');
  await page.goto('/info/pets/');
  await page.getByRole('tab',{name:'Skill Modules',exact:true}).click();
  const card=page.locator('[data-id="ssr_1"]');
  await expect(card).toBeVisible();
  const icon=card.getByRole('img',{name:module.name_en,exact:true});
  await expect(icon).toHaveAttribute('src',new RegExp(module.levels.at(-1).icon.split('/').at(-1).replaceAll('.','\\.')));
  await card.getByRole('button',{name:'Level 1',exact:true}).click();
  await expect(icon).toHaveAttribute('src',new RegExp(module.levels[0].icon.split('/').at(-1).replaceAll('.','\\.')));
  await expect(card.getByRole('button',{name:'Level 1',exact:true})).toHaveAttribute('aria-pressed','true');
  await card.getByRole('heading',{name:module.name_en,exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Star 1',exact:true}).click();
  await expect(dialog.getByRole('img',{name:module.name_en,exact:true})).toHaveAttribute('src',new RegExp(module.levels[0].icon.split('/').at(-1).replaceAll('.','\\.')));
});
