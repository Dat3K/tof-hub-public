'use client';

import React from 'react';
import type { DialogProps } from '../primitives/types';
import { Modal } from './modal';
import { Button } from '../primitives/button';

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'info',
  variant,
  isLoading = false,
  appearance,
  viewportTopInset,
}) => {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const descriptionId = React.useId();
  const resolvedType = variant || type;

  const getButtonVariant = () => {
    switch (resolvedType) {
      case 'danger':
        return 'danger';
      case 'warning':
        return 'gold';
      case 'success':
      case 'info':
      default:
        return 'primary';
    }
  };

  const getIcon = () => {
    switch (resolvedType) {
      case 'danger':
        return (
          <div className="w-10 h-10 rounded-full bg-[#ef4444]/20 border border-[#ef4444]/50 flex items-center justify-center text-[#fca5a5] shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className="w-10 h-10 rounded-full bg-[#f59e0b]/20 border border-[#f59e0b]/50 flex items-center justify-center text-[#fde68a] shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case 'success':
        return (
          <div className="w-10 h-10 rounded-full bg-[#10b981]/20 border border-[#10b981]/50 flex items-center justify-center text-[#a7f3d0] shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'info':
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-[#2ba6df]/20 border border-[#2ba6df]/50 flex items-center justify-center text-[#7dd3fc] shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" appearance={appearance} viewportTopInset={viewportTopInset}
      initialFocusRef={cancelRef} closeOnEsc={!isLoading} closeOnBackdropClick={!isLoading}
      aria-describedby={description ? descriptionId : undefined}>
      <Modal.Body className="p-6">
        <div className="flex items-start gap-4">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <Modal.Title className="text-base font-semibold mb-1 whitespace-normal break-words">
              {title}
            </Modal.Title>
            {description && (
              <p id={descriptionId} className="text-sm text-[#9ca3af] leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        {onConfirm && (
          <Button
            variant={getButtonVariant()}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

Dialog.displayName = 'Dialog';
