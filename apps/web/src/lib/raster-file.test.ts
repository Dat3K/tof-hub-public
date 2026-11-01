// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {checkRasterFile} from './raster-file';

const png=(width=800,height=600)=>{
  const bytes=new Uint8Array(32);bytes.set([137,80,78,71,13,10,26,10]);bytes.set(new TextEncoder().encode('IHDR'),12);
  const view=new DataView(bytes.buffer);view.setUint32(16,width);view.setUint32(20,height);return bytes;
};
const file=(bytes:Uint8Array,type='image/png')=>new File([bytes as BlobPart],'file.png',{type});
describe('raster file gate shared by Build, Comp and OCR',()=>{
  it('checks bytes instead of trusting extensions or MIME labels',async()=>{
    expect(await checkRasterFile(file(png()))).toBe(true);
    expect(await checkRasterFile(file(new TextEncoder().encode('<svg onload="alert(1)"/>')))).toBe(false);
    expect(await checkRasterFile(file(png(),'image/jpeg'))).toBe(false);
    expect(await checkRasterFile(file(png(),'image/svg+xml'))).toBe(false);
  });
  it('bounds bytes, dimensions and pixel allocation before decoding',async()=>{
    expect(await checkRasterFile(file(png(100_000,100_000)))).toBe(false);
    expect(await checkRasterFile(file(png(6000,6000)))).toBe(false);
    expect(await checkRasterFile(file(png(0,600)))).toBe(false);
    expect(await checkRasterFile(file(png()),10)).toBe(false);
    expect(await checkRasterFile(file(new Uint8Array()))).toBe(false);
  });
  it('reads JPEG SOF dimensions and WebP VP8X dimensions',async()=>{
    const jpeg=Uint8Array.from([255,216,255,192,0,8,8,2,88,3,32,1]);
    expect(await checkRasterFile(file(jpeg,'image/jpeg'))).toBe(true);
    const webp=new Uint8Array(30);webp.set(new TextEncoder().encode('RIFF'),0);webp.set(new TextEncoder().encode('WEBPVP8X'),8);
    webp[24]=255;webp[27]=255;
    expect(await checkRasterFile(file(webp,'image/webp'))).toBe(true);
    webp[26]=255;expect(await checkRasterFile(file(webp,'image/webp'))).toBe(false);
  });
});
