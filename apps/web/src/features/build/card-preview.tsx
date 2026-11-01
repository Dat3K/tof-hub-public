import type {CSSProperties,ReactNode} from 'react';
import {BUILD_CARD_HEIGHT,BUILD_CARD_WIDTH} from './layout';
import styles from './build.module.css';

/** The scaled card stage of the Build pages (Global and MMO); `overlay` covers exactly the scaled card. */
export function CardPreview({children,scale,height=BUILD_CARD_HEIGHT,overlay}:{children:ReactNode;scale:number;height?:number;overlay?:ReactNode}) {
  return <div className={styles.preview} style={{height:height*scale,width:BUILD_CARD_WIDTH*scale,marginInline:'auto'} as CSSProperties}><div style={{transform:`scale(${scale})`,transformOrigin:'top left',width:BUILD_CARD_WIDTH}}>{children}</div>{overlay}</div>;
}
