'use client';

import { type Locale } from '@tof-hub/i18n';
import React from 'react';
import type { CompServer, SquadMode, SquadState } from '../types';
import styles from '../comp.module.css';
import { getCompStrings } from '../copy';
import { CompPresetSelect } from './CompPresetSelect';
import { PillSwitcher } from '@/components/pill-switcher/pill-switcher';

interface CompToolbarProps {
  state: SquadState;
  locale: Locale;
  activePreset: string;
  onModeChange: (mode: SquadMode) => void;
  onServerChange: (server: CompServer) => void;
  onPresetSelect: (presetId: string) => void;
  onShare: () => void;
  onExportPng: () => void;
  onClear: () => void;
  isExporting?: boolean;
}

export const CompToolbar: React.FC<CompToolbarProps> = ({
  state,
  locale,
  activePreset,
  onModeChange,
  onServerChange,
  onPresetSelect,
  onShare,
  onExportPng,
  onClear,
  isExporting = false,
}) => {
  const strings = getCompStrings(locale);

  return (
    <aside className={styles.toolbar} aria-label={strings.toolbarAria}>
            {/* Game server switch (standard roster by default, MMO-only roster) */}
      <div className={styles.serverSwitchWrap}>
        <PillSwitcher
          mode={state.server === 'mmo' ? 'mmo' : 'standard'}
          onChange={(next) => onServerChange(next === 'mmo' ? 'mmo' : 'standard')}
          label={strings.serverLabel}
          originalLabel={strings.serverStandard}
          mmoLabel={strings.serverMmo}
          ariaLabel={strings.serverAria}
        />
      </div>

      {/* Mode switch + presets (legacy .comp-sidebar__section) */}
      <div className={styles.toolbarGroup}>
        {/* 4p / 8p Mode Toggle */}
        <div className={styles.modeSwitch} role="group" aria-label={strings.modeAria}>
          <button
            type="button"
            className={`${styles.modeBtn} ${state.mode === 4 ? styles.modeBtnActive : ''}`}
            onClick={() => onModeChange(4)}
            aria-pressed={state.mode === 4}
          >
            {strings.mode4}
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${state.mode === 8 ? styles.modeBtnActive : ''}`}
            onClick={() => onModeChange(8)}
            aria-pressed={state.mode === 8}
          >
            {strings.mode8}
          </button>
        </div>

        {/* Preset Selector (legacy .comp-preset-control) */}
        <CompPresetSelect
          id="comp-preset-select"
          mode={state.mode}
          server={state.server ?? 'standard'}
          locale={locale}
          activePreset={activePreset}
          onPresetSelect={onPresetSelect}
        />
      </div>

      {/* Actions: Share, Export PNG, Clear (legacy .comp-sidebar__actions) */}
      <div className={styles.toolbarGroup}>
        {/* Share Button */}
        <button
          type="button"
          className={`${styles.sideBtn} ${styles.sideBtnAccent}`}
          onClick={onShare}
          aria-label={strings.shareAria}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>{strings.shareLabel}</span>
        </button>

        {/* Export PNG Button */}
        <button
          type="button"
          className={`${styles.sideBtn} ${styles.sideBtnPrimary}`}
          onClick={onExportPng}
          disabled={isExporting}
          aria-label={strings.exportAria}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span>{isExporting ? strings.exporting : strings.exportLabel}</span>
        </button>

        {/* Clear Squad Button */}
        <button
          type="button"
          className={`${styles.sideBtn} ${styles.sideBtnDanger}`}
          onClick={onClear}
          aria-label={strings.clearAria}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>{strings.clearLabel}</span>
        </button>
      </div>
    </aside>
  );
};
