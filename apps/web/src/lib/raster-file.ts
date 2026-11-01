/** Header checks precede image decoding. SVG/HTML and oversized pixel buffers are never accepted. */
export async function checkRasterFile(file:File,maxBytes=20*1024*1024):Promise<boolean> {
  try {
  if(file.size<=0||file.size>maxBytes)return false;
  const bytes=new Uint8Array(await file.slice(0,256*1024).arrayBuffer());
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let type='',width=0,height=0;
  const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
  if(bytes.length>=24&&bytes.slice(0,8).every((value,index)=>value===[137,80,78,71,13,10,26,10][index])&&ascii(12,16)==='IHDR') {
    type='image/png';width=view.getUint32(16);height=view.getUint32(20);
  } else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255) {
    type='image/jpeg';
    for(let offset=2;offset+8<bytes.length;) {
      if(bytes[offset++]!==255)return false;
      while(bytes[offset]===255)offset++;
      const marker=bytes[offset++]!;
      if(marker===0xda||marker===0xd9)break;
      if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
      if(offset+2>bytes.length)return false;
      const length=view.getUint16(offset);
      if(length<2||offset+length>bytes.length)return false;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=8) {
        height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;
      }
      offset+=length;
    }
  } else if(bytes.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP') {
    type='image/webp';
    const chunk=ascii(12,16);
    if(chunk==='VP8X') {
      width=1+bytes[24]!+(bytes[25]!<<8)+(bytes[26]!<<16);
      height=1+bytes[27]!+(bytes[28]!<<8)+(bytes[29]!<<16);
    } else if(chunk==='VP8 '&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a) {
      width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;
    } else if(chunk==='VP8L'&&bytes[20]===0x2f) {
      const bits=view.getUint32(21,true);width=1+(bits&0x3fff);height=1+((bits>>>14)&0x3fff);
    }
  }
  return type===file.type&&width>0&&height>0&&width<=8192&&height<=8192&&width*height<=25_000_000;
  } catch {return false;}
}
