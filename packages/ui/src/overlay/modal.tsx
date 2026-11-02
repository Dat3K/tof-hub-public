'use client';

import React, { useEffect, useRef, useId, createContext, useContext } from 'react';
import type {
  ModalProps,
  ModalHeaderProps,
  ModalTitleProps,
  ModalBodyProps,
  ModalFooterProps,
  ModalSize,
} from '../primitives/types';

interface ModalContextValue {
  onClose: () => void;
  titleId: string;
  appearance: 'default' | 'tool' | 'table';
}

const ModalContext = createContext<ModalContextValue | null>(null);

function useModalContext() {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error('Modal subcomponents must be rendered within a <Modal />.');
  }
  return ctx;
}

function getSizeClasses(size: ModalSize = 'md'): string {
  switch (size) {
    case 'picker':
      return 'tool-panel-picker';
    case 'sm':
      return 'max-w-md';
    case 'lg':
      return 'max-w-2xl';
    case 'xl':
      return 'max-w-4xl';
    case 'full':
      return 'max-w-6xl w-[95vw]';
    case 'md':
    default:
      return 'max-w-lg';
  }
}

export const Modal: React.FC<ModalProps> & {
  Controls: typeof ModalControls;
  Header: typeof ModalHeader;
  Title: typeof ModalTitle;
  Close: typeof ModalClose;
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
} = ({
  isOpen,
  onClose,
  children,
  size = 'md',
  appearance = 'default',
  viewportTopInset = 0,
  initialFocusRef,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  className = '',
  overlayClassName = '',
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  ariaLabel,
  'aria-label': ariaLabelProp,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    // Save previous focus
    previousActiveElement.current = document.activeElement as HTMLElement | null;

    // Prevent background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Opening a dialog must not move the underlying page.
    (initialFocusRef?.current ?? dialogRef.current)?.focus({ preventScroll: true });
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )).filter(node => node.tabIndex >= 0 && node.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (!first) { e.preventDefault(); dialog.focus({ preventScroll: true }); return; }
        if (e.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
          e.preventDefault(); last?.focus({ preventScroll: true });
        } else if (!e.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) {
          e.preventDefault(); first.focus({ preventScroll: true });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousActiveElement.current?.focus?.({ preventScroll: true });
    };
  }, [isOpen, closeOnEsc, onClose, initialFocusRef]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const sizeClasses = getSizeClasses(size);

  return (
    <ModalContext.Provider value={{ onClose, titleId, appearance }}>
      <div
        className={`fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in ${appearance==='tool'?'tool-panel-overlay':''} ${overlayClassName}`.trim()}
        style={viewportTopInset>0?{paddingTop:viewportTopInset+16}:undefined}
        onClick={handleBackdropClick}
        aria-modal="true"
        role="dialog"
        aria-label={ariaLabel ?? ariaLabelProp}
        aria-labelledby={(ariaLabel ?? ariaLabelProp) ? undefined : (ariaLabelledBy || titleId)}
        aria-describedby={ariaDescribedBy}
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          style={viewportTopInset>0?{maxHeight:`min(90dvh, calc(100dvh - ${viewportTopInset+32}px))`}:undefined}
          className={`w-full max-h-[90vh] flex flex-col ${appearance==='table'?'tool-table-panel':appearance==='tool'?'tool-panel':'bg-[var(--tool-panel-surface)]'} border border-white/10 rounded-xl shadow-[0_1rem_2.5rem_rgba(0,0,0,0.65)] overflow-hidden focus-visible:outline-none ${sizeClasses} ${className}`.trim()}
        >
          {children}
        </div>
      </div>
    </ModalContext.Provider>
  );
};

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  children,
  onClose,
  showCloseButton = true,
  actions,
  className = '',
  ...rest
}) => {
  const modalContext = useModalContext();
  const handleClose = onClose || modalContext.onClose;

  return (
    <div
      className={`flex items-center justify-between px-5 py-4 border-b border-white/10 ${modalContext.appearance==='table'?'tool-table-panel-header':modalContext.appearance==='tool'?'tool-panel-header':'bg-[var(--surface-panel-header)]'} ${className}`.trim()}
      {...rest}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2.5">{actions}{showCloseButton && <ModalClose onClick={handleClose} />}</div> : showCloseButton && <ModalClose onClick={handleClose} />}
    </div>
  );
};

export const ModalTitle: React.FC<ModalTitleProps> = ({
  children,
  className = '',
  ...rest
}) => {
  const { titleId,appearance } = useModalContext();

  return (
    <h2
      id={titleId}
      className={`text-lg font-bold text-white tracking-wide ${appearance==='tool'?'tool-panel-title break-words':'truncate'} ${className}`.trim()}
      {...rest}
    >
      {children}
    </h2>
  );
};

export const ModalClose: React.FC<{
  onClick?: () => void;
  className?: string;
  'aria-label'?: string;
}> = ({
  onClick,
  className = '',
  'aria-label': ariaLabel = 'Close modal',
}) => {
  const modalContext = useModalContext();
  const handleClick = onClick || modalContext.onClose;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className={`p-1.5 -mr-1.5 min-w-[2.25rem] min-h-[2.25rem] inline-flex items-center justify-center text-[#9ca3af] hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ba6df] ${className}`.trim()}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
};

export const ModalBody: React.FC<ModalBodyProps> = ({
  children,
  className = '',
  ...rest
}) => {
  return (
    <div
      className={`flex-1 overflow-y-auto p-5 text-sm text-[#d7d0dd] ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
};

export const ModalFooter: React.FC<ModalFooterProps> = ({
  children,
  className = '',
  ...rest
}) => {
  return (
    <div
      className={`flex items-center justify-end gap-3 px-5 py-3.5 border-t border-white/10 ${useModalContext().appearance==='table'?'tool-table-panel-footer':useModalContext().appearance==='tool'?'tool-panel-footer':'bg-[var(--surface-panel-header)]'} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
};

export function ModalControls({children,className='',...rest}:ModalBodyProps) {
  return <div className={`tool-panel-controls ${className}`} {...rest}>{children}</div>;
}
Modal.Controls = ModalControls;
Modal.Header = ModalHeader;
Modal.Title = ModalTitle;
Modal.Close = ModalClose;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
Modal.displayName = 'Modal';
