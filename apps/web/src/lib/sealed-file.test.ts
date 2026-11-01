import {describe,expect,it} from 'vitest';
import {checkSealedFile} from './sealed-file';

const file=(name:string,text:string|Uint8Array<ArrayBuffer>)=>new File([text],name);
const sealed='{"format":"tof-hub-players-sealed","version":1,"key_id":"local-1"}';

describe('browser first gate for sealed uploads',()=>{
  it('accepts a complete file of the right tool',async()=>{
    expect(await checkSealedFile(file('players.tofplayers',sealed),'players')).toBeNull();
    expect(await checkSealedFile(file('card.tofbuild','﻿{"format":"tof-hub-build-sealed"}'),'build')).toBeNull();
  });
  it('names the problem of a wrong, foreign, empty or cut-off file',async()=>{
    expect(await checkSealedFile(file('players.zip',sealed),'players')).toBe('extension');
    expect(await checkSealedFile(file('players.tofplayers',''),'players')).toBe('size');
    expect(await checkSealedFile(file('players.tofplayers','{"format":"tof-hub-wish-sealed"}'),'players')).toBe('format');
    expect(await checkSealedFile(file('players.tofplayers',new Uint8Array(new ArrayBuffer(5)).fill(0xff)),'players')).toBe('format');
    expect(await checkSealedFile(file('players.tofplayers',sealed.slice(0,-1)),'players')).toBe('incomplete');
  });
});
