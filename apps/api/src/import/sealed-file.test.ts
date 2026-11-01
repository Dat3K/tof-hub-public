import {describe,expect,it} from 'vitest';
import {readSealedText,SealedFileError} from './sealed-file';

const options={format:'tof-hub-players-sealed',maxBytes:1024};
const sealed='{"format":"tof-hub-players-sealed","version":1}';

describe('sealed file first gate',()=>{
  it('reads a sealed text file of the expected format, with or without a BOM',()=>{
    expect(readSealedText(Buffer.from(sealed),options)).toEqual({format:'tof-hub-players-sealed',version:1});
    expect(readSealedText(Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(sealed)]),options)).toMatchObject({version:1});
  });
  it('refuses empty, oversized, binary, foreign, cut-off and damaged files before parsing them',()=>{
    for(const body of [Buffer.alloc(0),Buffer.from(sealed.padEnd(2048,' ')),Buffer.from([0x50,0x4b,0x03,0x04,0xff,0xfe]),
      Buffer.from('{"format":"tof-hub-build-sealed","version":1}'),Buffer.from(sealed.slice(0,-1)),Buffer.from('{"format":"tof-hub-players-sealed","version":1,}')])
      expect(()=>readSealedText(body,options)).toThrow(SealedFileError);
  });
});
