import {test,expect,type APIRequestContext,type Page} from '@playwright/test';
import {constants,createCipheriv,publicEncrypt,randomBytes} from 'node:crypto';
import fixture from '../../packages/contracts/src/__fixtures__/build-capture.json';
import {scanFixture} from '../../packages/contracts/src/__fixtures__/scan-session';
async function testFile(request:APIRequestContext,environment:'test'|'unknown') {
  const response=await request.get('/api/v1/build/import/public-key');expect(response.ok()).toBe(true);
  const pub=await response.json(),key=randomBytes(32),nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
  cipher.setAAD(Buffer.from(`tof-hub-build-sealed:1:${pub.key_id}`));
  const payload={...fixture,schemaVersion:3,capture:{...fixture.capture,scan:scanFixture(environment)}};
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
  return {name:'test-server.tofbuild',mimeType:'application/octet-stream',buffer:Buffer.from(JSON.stringify({format:'tof-hub-build-sealed',version:1,key_id:pub.key_id,
    wrapped_key:publicEncrypt({key:pub.public_key_pem,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64url'),
    nonce:nonce.toString('base64url'),ciphertext:ciphertext.toString('base64url'),tag:cipher.getAuthTag().toString('base64url')}))};
}
async function checkPageFlag(page:Page,environment:'test'|'unknown',locale:'en'|'ru') {
  const origin=environment==='test'?'test-server':'unknown-server';
  await expect(page.locator(`[data-capture-origin="${origin}"]`)).toBeVisible();
  if(environment==='test')await expect(page.locator(`[data-capture-flag="${origin}"]`)).toContainText(locale==='en'?'Test server · DEV':'Тестовый сервер · DEV');
  else {
    await expect(page.locator(`[data-capture-flag="${origin}"]`)).toHaveCount(0);
    await expect(page.getByText(locale==='en'?'Unresolved capture':'Среда скана не подтверждена',{exact:true})).not.toBeVisible();
  }
}
for(const environment of ['test','unknown'] as const) {
test(`${environment} capture opens Build, stays isolated from profiles and keeps its export badge`,async({page,request})=>{
  test.setTimeout(90000);
  await page.goto('/tools/build/');
  await page.getByLabel('Build capture file').setInputFiles(await testFile(request,environment));
  await checkPageFlag(page,environment,'en');
  await expect(page.getByRole('button',{name:'Save build',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'My builds',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('No character UID on this card');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await expect(page.getByRole('link',{name:'All profiles',exact:true})).toHaveAttribute('href','/tools/build/profiles/');
  await page.reload();
  await checkPageFlag(page,environment,'en');
  await page.evaluate(()=>{
    const target=window as Window&{captureExportBadges:string[]};target.captureExportBadges=[];
    new MutationObserver(()=>{for(const node of document.querySelectorAll('[data-export-active]'))target.captureExportBadges.push(node.textContent??'');}).observe(document.body,{childList:true,subtree:true});
  });
  await page.getByRole('button',{name:'Export PNG',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as Window&{captureExportBadges:string[]}).captureExportBadges),{timeout:45000}).toContain(environment==='test'?'Test server · DEV':'Unresolved capture');
  expect(await page.evaluate(()=>(window as Window&{captureExportBadges:string[]}).captureExportBadges)).not.toContain('Verified');
  await expect(page.getByRole('button',{name:'Export PNG',exact:true})).toBeEnabled({timeout:45000});
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();await page.locator('[data-datamine-language=ru]').click();
  await page.setViewportSize({width:844,height:390});
  await checkPageFlag(page,environment,'ru');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test(`${environment} capture opens Optimizer in EN and RU with the appropriate page flag`,async({page,request})=>{
  await page.goto('/tools/optimizer/');
  await page.getByLabel('Build capture file').setInputFiles(await testFile(request,environment));
  await checkPageFlag(page,environment,'en');
  await expect(page.getByRole('note',{name:'Imported profile'}).locator('time')).toHaveText('09.10.2026 10:05 UTC');
  await expect(page.getByRole('table',{name:'Combat stats'})).toBeVisible();
  await page.reload();
  await checkPageFlag(page,environment,'en');
  await expect(page.getByRole('note',{name:'Imported profile'}).locator('time')).toHaveText('09.10.2026 10:05 UTC');
  await page.getByRole('button',{name:'Language selector: English',exact:true}).click();await page.locator('[data-datamine-language=ru]').click();
  await page.setViewportSize({width:520,height:844});
  await checkPageFlag(page,environment,'ru');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
}
