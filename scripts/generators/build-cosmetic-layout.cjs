// Measure visible texture bounds without changing the original game asset.
const sitePaths=require('../lib/site-paths.cjs');
const path=require('node:path');
const sharp=sitePaths.sharp();
module.exports=async function(items,pub) {
  for(const item of items) {
    const {data,info}=await sharp(path.join(pub,item.icon)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let left=info.width,top=info.height,right=-1,bottom=-1;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++) {
      if(data[(y*info.width+x)*info.channels+info.channels-1]<=20)continue;
      left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
    }
    if(right<left)continue;
    const size=Math.max(right-left+1,bottom-top+1);
    item.canvas={width:info.width/size,height:info.height/size,centerX:(left+right+1)/(2*info.width),centerY:(top+bottom+1)/(2*info.height)};
  }
  return items;
};
