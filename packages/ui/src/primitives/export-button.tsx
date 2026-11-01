import React from 'react';

export interface ExportButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  busy?:boolean;
  /** `gold` (default) for downloads; `sky` for a neighbouring action of the same weight (e.g. Save build). */
  tone?:'gold'|'sky';
  /** Replaces the download arrow (16px line icon). */
  icon?:React.ReactNode;
}

/** Shared download action using the approved Datamine FCE presentation; `tone`/`icon` reuse it for sibling actions. */
export function ExportButton({busy=false,tone='gold',icon,disabled,children,className='',type='button',...props}:ExportButtonProps) {
  return <button {...props} type={type} className={`tof-export-button ${className}`.trim()} data-tone={tone==='gold'?undefined:tone} disabled={disabled||busy} aria-busy={busy||undefined}>
    <span className="tof-export-button-icon" aria-hidden="true">{busy?<span>…</span>:icon??<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13m0 0l-5-5m5 5l5-5"/><path d="M4 20h16"/></svg>}</span>
    <span className="tof-export-button-label">{children}</span>
  </button>;
}
