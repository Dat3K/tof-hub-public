import type {ReactNode} from 'react';

export interface DemoCallToActionProps {
  label: string;
  importLabel: string;
  onImport?: () => void;
  importHref?: string;
  disabled?: boolean;
  children?: ReactNode;
}

/** Shared example label and import action for tool pages. */
export function DemoCallToAction({label,importLabel,onImport,importHref,disabled,children}:DemoCallToActionProps) {
  const action = <><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v13m0-13-5 5m5-5 5 5"/><path d="M4 20h16"/></svg>{importLabel}</>;
  return <div className="tof-demo-cta">
    <span className="tof-demo-label">{label}</span>
    {importHref && !disabled
      ? <a className="tof-demo-import" href={importHref}>{action}</a>
      : (onImport || importHref) && <button type="button" className="tof-demo-import" disabled={disabled} onClick={onImport}>{action}</button>}
    {children}
  </div>;
}
