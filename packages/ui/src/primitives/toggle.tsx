'use client';

import React, { useState, useId } from 'react';
import type { ToggleProps } from './types';

export const Toggle: React.FC<ToggleProps> = ({
  id: explicitId,
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  disabled = false,
  size = 'md',
  color = 'cyan',
  label,
  description,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const isControlled = controlledChecked !== undefined;
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isChecked = isControlled ? controlledChecked : internalChecked;

  const handleToggle = () => {
    if (disabled) return;
    const next = !isChecked;
    if (!isControlled) {
      setInternalChecked(next);
    }
    onChange?.(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  };

  // Geometry
  const sizeConfig = {
    sm: {
      track: 'w-7 h-4',
      thumb: 'w-3 h-3',
      translate: 'translate-x-3',
    },
    md: {
      track: 'w-9 h-5',
      thumb: 'w-4 h-4',
      translate: 'translate-x-4',
    },
    lg: {
      track: 'w-12 h-6',
      thumb: 'w-5 h-5',
      translate: 'translate-x-6',
    },
  }[size];

  // Colors when active
  const activeColorMap = {
    cyan: 'bg-[#2ba6df] shadow-[0_0_10px_rgba(43,166,223,0.4)]',
    amber: 'bg-[#f59e0b] shadow-[0_0_10px_rgba(245,158,11,0.4)]',
    emerald: 'bg-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.4)]',
    purple: 'bg-[#a855f7] shadow-[0_0_10px_rgba(168,85,247,0.4)]',
  }[color];

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`.trim()}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={isChecked}
        aria-label={typeof label === 'string' ? label : ariaLabel}
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ba6df] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d13] disabled:opacity-40 disabled:cursor-not-allowed ${sizeConfig.track} ${
          isChecked ? activeColorMap : 'bg-white/10 hover:bg-white/15'
        }`}
      >
        <span
          className={`pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
            sizeConfig.thumb
          } ${isChecked ? sizeConfig.translate : 'translate-x-0'}`}
        />
      </button>

      {(label || description) && (
        <label htmlFor={id} className="cursor-pointer text-left" onClick={handleToggle}>
          {label && <div className="text-sm font-medium text-[#f3f4f6]">{label}</div>}
          {description && <div className="text-xs text-[#9ca3af]">{description}</div>}
        </label>
      )}
    </div>
  );
};

Toggle.displayName = 'Toggle';
