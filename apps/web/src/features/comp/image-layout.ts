/** Portrait zoom shared by the live trait slot and canvas export. */
export const COMP_TRAIT_IMAGE_SCALE=1.28;

/** Centered object-fit: cover geometry, optionally zoomed inside the same clipping frame. */
export function coverImageRect(imageWidth:number,imageHeight:number,width:number,height:number,zoom=1) {
  const scale=Math.max(width/imageWidth,height/imageHeight)*zoom;
  const drawWidth=imageWidth*scale,drawHeight=imageHeight*scale;
  return {x:(width-drawWidth)/2,y:(height-drawHeight)/2,width:drawWidth,height:drawHeight};
}
