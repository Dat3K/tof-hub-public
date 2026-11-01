'use client';

import React from 'react';
import styles from './pill-switcher.module.css';

export interface PillSwitcherProps {
  mode: 'standard' | 'mmo';
  onChange: (mode: 'standard' | 'mmo') => void;
  label?: string;
  originalLabel: string;
  mmoLabel: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function PillSwitcher({
  mode,
  onChange,
  label,
  originalLabel,
  mmoLabel,
  ariaLabel = 'Game Mode',
  className = '',
  disabled = false,
}: PillSwitcherProps) {
  return (
    <div className={`${styles.modeSwitcher} ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {label && <span className={styles.modeLabel}>{label}</span>}
      <div className={styles.modePills}>
        <button
          type="button"
          disabled={disabled}
          className={`${styles.modePill} ${mode === 'standard' ? styles.modePillActive : ''}`}
          aria-pressed={mode === 'standard'}
          onClick={() => onChange('standard')}
        >
          {originalLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          className={`${styles.modePill} ${mode === 'mmo' ? styles.modePillActive : ''}`}
          aria-pressed={mode === 'mmo'}
          onClick={() => onChange('mmo')}
        >
          {mmoLabel}
        </button>
      </div>
    </div>
  );
}
