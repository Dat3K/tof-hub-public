/** Linear scan before JSON.parse/Zod recursion. Brackets inside strings are ignored. */
export function assertJsonDepth(text:string,maxDepth=64) {
  let depth=0,string=false,escape=false;
  for(let i=0;i<text.length;i++) {
    const char=text[i];
    if(string) {if(escape)escape=false;else if(char==='\\')escape=true;else if(char==='"')string=false;continue;}
    if(char==='"')string=true;
    else if(char==='{'||char==='[') {if(++depth>maxDepth)throw new Error('JSON nesting exceeds limit');}
    else if(char==='}'||char===']')depth--;
  }
}

/** Also checks escaped key names after decoding; JSON must never carry prototype mutation keys. */
export function safeJsonReviver(key:string,value:unknown):unknown {
  if(key==='__proto__'||key==='constructor'||key==='prototype')throw new Error('Unsafe JSON key');
  return value;
}
