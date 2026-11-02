import React from 'react';

export interface ProfileAvatarImage {
  icon: string;
  canvas?: {width: number; height: number; centerX: number; centerY: number};
}
export interface ProfileAvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  avatar?: ProfileAvatarImage;
  frame?: ProfileAvatarImage;
  size?: number;
  frameSize?: number;
  avatarLabel?: string;
  /** A static format caption; never loads/plays animated media on a card. */
  formatLabel?: string;
}

/** Uses the generated game canvas so oversized avatar and frame art stays aligned. */
export function ProfileAvatar({avatar,frame,size=53,frameSize=size*69/53,avatarLabel='',formatLabel,children,style,...props}:ProfileAvatarProps) {
  const length=(value:number)=>`calc(${value} * var(--ui-unit, .0625rem))`;
  const imageStyle=(image:ProfileAvatarImage,diameter:number,portrait=false):React.CSSProperties=>{
    const canvas=image.canvas??{width:1,height:1,centerX:.5,centerY:.5};
    return {position:'absolute',left:'50%',top:portrait?`calc(50% - ${length(size*2/53)})`:'50%',maxWidth:'none',objectFit:'contain',
      width:length(diameter*canvas.width),height:length(diameter*canvas.height),
      transform:`translate(-${canvas.centerX*100}%, -${canvas.centerY*100}%)`};
  };
  return <span {...props} data-framed={Boolean(frame)} style={{position:'relative',display:'block',width:length(size),height:length(size),flexShrink:0,...style}}>
    <span className="avatar-crop" style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'center',width:length(size),height:length(size),overflow:'hidden',borderRadius:'50%',outline:frame?'none':'1px solid #c0dfed80'}}>
      {avatar?<img className="avatar" style={imageStyle(avatar,size,true)} src={avatar.icon} alt={avatarLabel}/>:children}
    </span>
    {frame&&<img className="avatar-frame" style={{...imageStyle(frame,frameSize),pointerEvents:'none'}} src={frame.icon} alt=""/>}
    {formatLabel&&<small data-media-format style={{position:'absolute',bottom:length(-8),left:'50%',transform:'translateX(-50%)',
      background:'#101218',color:'#d8bd78',padding:`1px ${length(4)}`,borderRadius:length(3),fontSize:length(9),lineHeight:length(12),whiteSpace:'nowrap'}}>{formatLabel}</small>}
  </span>;
}
