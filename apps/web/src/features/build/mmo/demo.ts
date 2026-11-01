import type {BuildCapture} from '@tof-hub/contracts';
import capture from './demo-capture.json';
import {mmoDraftFromCapture} from './capture-import';
import type {MmoBuildCatalog,MmoBuildDraft} from './types';

/**
 * "Test data": the owner's own MMO test character (kritik, Hykros, Korea DEV client), exported as a `.tofbuild` on
 * 2026-10-23 and stripped of scan, PC and network fields (docs/imports.md). It goes through
 * the regular capture mapping, so the card is what an import of that file shows; ids the catalog does not know stay empty.
 */
export function demoMmoDraft(catalog:MmoBuildCatalog):MmoBuildDraft {
  const file=capture as unknown as BuildCapture;
  const {draft}=mmoDraftFromCapture(file,catalog);
  // Presentation picks of the owner (Build page draft, 2026-10-25), not capture data: avatar Zoey and the Gashapon background.
  // The capture rides along unsigned (the signature belongs to the sealed export), so the ids and account details show on hover;
  // a Korea DEV capture cannot be saved either way.
  return {...draft,demo:true,source:{capture:file,digest:'',signature:''},profile:{...draft.profile,avatarId:'Zuoyi'},art:{id:'gashapon_btz_bg_btz',x:50,y:50,zoom:1}};
}
