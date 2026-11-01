'use client';

import { type Locale } from '@tof-hub/i18n';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDismiss } from '@tof-hub/ui';
import type { CompServer, SquadMode } from '../types';
import { PRESET_LIST } from '../presets';
import { getCompStrings, type CompStrings } from '../copy';
import styles from '../comp.module.css';

interface PresetItem {
  id: string;
  label: string;
  isDivider?: boolean;
}

export interface CompPresetSelectProps {
  id?: string;
  mode: SquadMode;
  server?: CompServer;
  locale: Locale;
  activePreset: string;
  onPresetSelect: (presetId: string) => void;
}

function getPresetLabel(presetId: string, strings: CompStrings, locale: Locale): string {
  if (!presetId) return strings.presetPlaceholder;
  const preset = PRESET_LIST.find((item) => item.id === presetId);
  return preset ? (locale === 'ru' ? preset.name_ru : preset.name_en) : strings.presetPlaceholder;
}

export const CompPresetSelect: React.FC<CompPresetSelectProps> = ({
  id = 'comp-preset-select',
  mode,
  server = 'standard',
  locale,
  activePreset,
  onPresetSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const strings = getCompStrings(locale);

  // Options follow the preset registry, filtered by server roster and squad
  // size. The label lookup falls back to the registry names (covers MMO).
  const serverPresets = PRESET_LIST.filter(
    (p) => (p.server ?? 'standard') === server && p.mode === mode
  );
  const options: PresetItem[] = [
    { id: '', label: strings.presetPlaceholder },
    ...serverPresets.map((p, idx) => ({
      id: p.id,
      label: getPresetLabel(p.id, strings, locale),
      isDivider: idx === 0,
    })),
  ];

  // Close on outside click (keys are handled by the listbox itself)
  useDismiss({ refs: [containerRef], onDismiss: () => setIsOpen(false), enabled: isOpen, escape: false });

  // Focus active/focused option
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && optionRefs.current[focusedIndex]) {
      optionRefs.current[focusedIndex]?.focus();
    }
  }, [isOpen, focusedIndex]);

  const handleSelect = useCallback(
    (presetId: string) => {
      onPresetSelect(presetId);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [onPresetSelect],
  );

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
      const curIdx = options.findIndex((o) => o.id === activePreset);
      setFocusedIndex(curIdx >= 0 ? curIdx : 0);
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + options.length) % options.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusedIndex(options.length - 1);
    }
  };

  const currentLabel = getPresetLabel(activePreset, strings, locale);

  return (
    <div ref={containerRef} className={styles.presetWrap}>
      <div
        className={`${styles.presetControl} ${isOpen ? styles.presetControlOpen : ''}`}
        data-mode={String(mode)}
      >
        <button
          ref={triggerRef}
          type="button"
          className={styles.presetTrigger}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls="comp-preset-menu"
          aria-label={strings.presetAria}
          onClick={() => {
            const next = !isOpen;
            setIsOpen(next);
            if (next) {
              const curIdx = options.findIndex((o) => o.id === activePreset);
              setFocusedIndex(curIdx >= 0 ? curIdx : 0);
            }
          }}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className={styles.presetValue}>{currentLabel}</span>
          <svg
            className={`${styles.presetChevron} ${isOpen ? styles.presetChevronOpen : ''}`}
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              d="m5 7.5 5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {isOpen && (
          <div
            id="comp-preset-menu"
            className={styles.presetMenu}
            role="listbox"
            aria-label={strings.presetAria}
            onKeyDown={handleMenuKeyDown}
          >
            {options.map((opt, idx) => {
              const isSelected = activePreset === opt.id;
              return (
                <button
                  key={opt.id || 'default'}
                  ref={(el) => {
                    optionRefs.current[idx] = el;
                  }}
                  type="button"
                  role="option"
                  tabIndex={focusedIndex === idx ? 0 : -1}
                  aria-selected={isSelected}
                  className={`${styles.presetOption} ${opt.isDivider ? styles.presetOptionDivider : ''} ${
                    isSelected ? styles.presetOptionSelected : ''
                  }`}
                  onClick={() => handleSelect(opt.id)}
                >
                  <span>{opt.label}</span>
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      d="m4.5 10 3.25 3.25L15.5 5.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              );
            })}
          </div>
        )}

        {/* Synchronized native select for test & automation compatibility */}
        <select
          id={id}
          className={styles.presetNative}
          value={activePreset}
          onChange={(e) => handleSelect(e.target.value)}
          aria-hidden="true"
          tabIndex={-1}
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
