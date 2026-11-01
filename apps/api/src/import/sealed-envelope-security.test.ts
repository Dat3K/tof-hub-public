// @vitest-environment node
import {constants,createCipheriv,generateKeyPairSync,publicEncrypt,randomBytes} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {decryptEnvelope} from './sealed-envelope';
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
function seal(text:string) {
  const key=randomBytes(32),nonce=randomBytes(12),format='tof-hub-build-sealed',key_id='test';
  const cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(Buffer.from(`${format}:1:${key_id}`));
  const ciphertext=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);
  return {format,key_id,nonce:nonce.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),ciphertext:ciphertext.toString('base64url'),
    wrapped_key:publicEncrypt({key:pair.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64url')};
}
describe('sealed envelope resource and authentication gates',()=>{
  it('accepts authenticated JSON and refuses changes to data, key, nonce, tag or AAD',()=>{
    const envelope=seal('{"value":1}');
    expect(decryptEnvelope(envelope,pair.privateKey,1000)).toEqual({value:1});
    const changed=Buffer.from(envelope.ciphertext,'base64url');changed[0]=changed[0]!^1;
    for(const mutation of [{ciphertext:changed.toString('base64url')},{wrapped_key:'AA'},{nonce:'AA'},{tag:'AA'},{key_id:'other'},{format:'other'}]) {
      expect(()=>decryptEnvelope({...envelope,...mutation},pair.privateKey,1000)).toThrow();
    }
  });
  it('rejects noncanonical encoding, excessive nesting and plaintext over the limit',()=>{
    const envelope=seal('{"value":1}');
    expect(()=>decryptEnvelope({...envelope,nonce:envelope.nonce+'='},pair.privateKey,1000)).toThrow('Noncanonical');
    expect(()=>decryptEnvelope(envelope,pair.privateKey,4)).toThrow('exceeds limit');
    expect(()=>decryptEnvelope(seal('['.repeat(65)+'0'+']'.repeat(65)),pair.privateKey,1000)).toThrow('nesting');
  });
});
