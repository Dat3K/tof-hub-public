import {ImageResponse} from 'next/og';

export const size = {width:180,height:180};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<div style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:'100%',background:'#0d1017',color:'#d8bd78',fontSize:64,fontWeight:700}}>ToF</div>,size);
}
