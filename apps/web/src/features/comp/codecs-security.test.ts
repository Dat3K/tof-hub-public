// @vitest-environment node
import {deflateRawSync} from 'node:zlib';
import {describe,expect,it} from 'vitest';
import {deserializeSquadState,TinyZlib} from './codecs';
describe('shared Comp link safety',()=>{
  it('rejects decompression bombs at the output boundary',()=>{
    const bomb=deflateRawSync(Buffer.from('a'.repeat(300*1024)));
    expect(()=>TinyZlib.rawInflate(new Uint8Array(bomb))).toThrow('exceeds limit');
    expect(deserializeSquadState(bomb.toString('base64url'))).toBeNull();
  });
  it('rejects oversized and truncated links and still decodes ordinary compressed data',()=>{
    expect(deserializeSquadState('a'.repeat(65*1024))).toBeNull();
    expect(()=>TinyZlib.rawInflate(Uint8Array.from([255]))).toThrow();
    const ordinary=new Uint8Array(deflateRawSync(Buffer.from('hello')));
    expect(new TextDecoder().decode(TinyZlib.rawInflate(ordinary))).toBe('hello');
  });
});
