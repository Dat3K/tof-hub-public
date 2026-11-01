import {test,expect,type Page} from '@playwright/test';
import {createCipheriv,publicEncrypt,constants,randomBytes} from 'node:crypto';
import fixture from '../../packages/contracts/src/__fixtures__/build-capture.json';
/** The advanced editor is offered only while the card is unlocked for editing. */
async function openAdvancedEditor(page:Page) {
  const lock=page.getByRole('checkbox',{name:'Lock editing',exact:true});
  if(await lock.isChecked())await lock.uncheck();
  await page.getByRole('checkbox',{name:'Advanced editor',exact:true}).check();
}


test('creates a new card from an encrypted file and tracks manual edits across reload and undo',async({page,request})=>{
  const keyResponse=await request.get('/api/v1/build/import/public-key');expect(keyResponse.ok()).toBe(true);
  const pub=await keyResponse.json();
  const key=randomBytes(32),nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
  cipher.setAAD(Buffer.from(`tof-hub-build-sealed:1:${pub.key_id}`));
  const capture=structuredClone(fixture);capture.capture.subject.uid='1300500001';
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(capture),'utf8'),cipher.final()]);
  const file={name:'example.tofbuild',mimeType:'application/octet-stream',buffer:Buffer.from(JSON.stringify({
    format:'tof-hub-build-sealed',version:1,key_id:pub.key_id,
    wrapped_key:publicEncrypt({key:pub.public_key_pem,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64url'),
    nonce:nonce.toString('base64url'),ciphertext:ciphertext.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),
  }))};
  await page.goto('/tools/build/');
  await page.getByRole('button',{name:'More actions',exact:true}).click();
  await page.getByRole('button',{name:'Test data',exact:true}).click();
  await expect(page.locator('article.card .hero-art')).toBeVisible();
  const importButton=page.getByRole('button',{name:'Import .tofbuild',exact:true});
  // Import is the primary action of the side rail, as Import pulls on the Wish Tracker.
  await expect(page.getByRole('navigation',{name:'Build card help'}).getByRole('button',{name:'Import .tofbuild',exact:true})).toBeVisible();
  await expect(importButton).toHaveCount(1);
  await page.getByRole('button',{name:'Import .tofbuild',exact:true}).focus();
  await expect(page.getByRole('button',{name:'Import .tofbuild',exact:true})).toBeFocused();
  await page.getByLabel('Build capture file').setInputFiles(file);
  await expect(page.locator('[data-build-notice]')).toContainText('Card filled from the file');
  const card=page.locator('article.card');
  await expect(card.locator('.player')).toHaveText('Example player');
  // The live card shows only the date; the provenance badge exists only in the exported PNG.
  await expect(card.locator('.data-origin:visible')).toHaveCount(0);
  await expect(card.locator('time[data-build-provenance]')).not.toHaveText('—');
  await expect(card.locator('.profile-meta .sub')).toContainText('EU / Astora');
  await expect(card.locator('.hero-art')).toBeVisible();
  await expect(card.locator('.profile-character-title')).toContainText('Shield Breaker');
  await expect(card.locator('.computing-level')).toHaveText(['Lv.13','Lv.10','Lv.15','Lv.15']);
  await expect(card.locator('.support-chip small')).toHaveText(Array(18).fill('—'));
  await page.screenshot({path:'ignore/documentation-media/generated/build/capture-import-desktop.png',animations:'disabled'});
  const exportStatus=async(status:string)=>{
    await page.getByRole('button',{name:'Export PNG',exact:true}).click();
    await expect(page.locator('[data-build-notice]')).toContainText(`PNG exported`);
    await expect(page.locator('[data-build-notice]')).toContainText(status);
  };
  await page.reload();await exportStatus('Verified');
  await openAdvancedEditor(page);
  const nameInput=page.getByLabel('Name', {exact:true});await nameInput.fill('Edited player');
  await exportStatus('Edited');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(card.locator('.player')).toHaveText('Example player');await exportStatus('Verified');
  await page.getByLabel('Build capture file').setInputFiles({name:'broken.tofbuild',mimeType:'application/json',buffer:Buffer.from('{}')});
  await expect(page.locator('[data-build-notice]')).toContainText('Could not import');await expect(card.locator('.player')).toHaveText('Example player');
  await page.getByRole('checkbox',{name:'Advanced editor',exact:true}).uncheck();
  await page.getByRole('checkbox',{name:'Lock editing',exact:true}).check();
  await page.setViewportSize({width:844,height:390});
  await expect(page.getByRole('button',{name:'Import .tofbuild',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();await page.locator('[data-datamine-language=ru]').click();
  await expect(page.getByRole('button',{name:'Импорт .tofbuild',exact:true})).toBeVisible();
  await expect(card.locator('.data-origin:visible')).toHaveCount(0);
  await page.getByLabel('Файл скана билда').setInputFiles({name:'broken.tofbuild',mimeType:'application/json',buffer:Buffer.from('{}')});
  await expect(page.locator('[data-build-notice]')).toContainText('Не удалось импортировать');
  await page.getByRole('button',{name:'Импорт .tofbuild',exact:true}).scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'ignore/documentation-media/generated/build/capture-import-mobile.png',animations:'disabled'});
});
