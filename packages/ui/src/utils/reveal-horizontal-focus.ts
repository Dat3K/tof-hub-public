import type {FocusEvent} from 'react';

/** Keep a keyboard-focused control clear of the edges and a sticky row label. */
export function revealHorizontalFocus(event:FocusEvent<HTMLElement>) {
  const panel=event.currentTarget,target=event.target;
  if(panel.scrollWidth<=panel.clientWidth||!(target instanceof HTMLElement)||!panel.contains(target))return;
  const bounds=panel.getBoundingClientRect(),box=target.getBoundingClientRect();
  const label=panel.firstElementChild;
  const left=label instanceof HTMLElement&&getComputedStyle(label).position==='sticky'?label.getBoundingClientRect().right:bounds.left;
  if(box.left<left+2)panel.scrollLeft-=left+2-box.left;
  else if(box.right>bounds.right-2)panel.scrollLeft+=box.right-bounds.right+2;
}
