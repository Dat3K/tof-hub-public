import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const example=JSON.parse(readFileSync('scripts/data/build-example.json','utf8'));
test('captured example is verified and ranks without a saved database profile',async({page})=>{
  test.setTimeout(90000);
  let body:Record<string,unknown>|null=null;
  await page.route('**/api/v1/build/import/public-key',route=>route.fulfill({json:{ready:true,public_key_pem:example.publicKeyPem}}));
  await page.route('**/api/v1/build/import/ranking',route=>{
    body=route.request().postDataJSON();
    return route.fulfill({json:{available:true,digest:example.source.digest,global:123,region:{code:'EU',rank:21},track:'Frost-Volt'}});
  });
  await page.goto('/tools/build/');
  await page.getByRole('button',{name:'More actions',exact:true}).click();
  await page.getByRole('button',{name:'Test data',exact:true}).click();
  await expect(page.locator('.player-row')).toContainText('ariveder4i');
  const ranking=page.getByLabel('Gear ranking',{exact:true});
  await expect(ranking).toContainText('Global №123');
  expect(body).toMatchObject({digest:example.source.digest,signature:example.source.signature,role:'dps'});
  await page.locator('article.card').screenshot({path:'ignore/documentation-media/generated/ariveder4i-ranking.png'});
  await page.getByLabel('Lock editing',{exact:true}).uncheck();
  // A direct data edit invalidates the verified card rather than retaining the original file's badge.
  await page.getByRole('button',{name:'More actions',exact:true}).click();
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:/Clear|Confirm/}).last().click();
  await expect(ranking).toHaveCount(0);
});
