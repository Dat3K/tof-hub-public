'use client';

import React from 'react';
import type { ServerMode, ServerModeSwitcherProps } from './types';
import { ModeSwitcher } from './mode-switcher';

const STORAGE_KEY = 'tof_server_mode';
const FALLBACK_KEYS = ['tof_sim_server', 'tof_relics_server', 'tof-simulacra-server-mode'];

/**
 * Safely retrieves stored server mode with legacy compatibility fallbacks.
 */
export function getStoredServerMode(defaultMode: ServerMode = 'gacha'): ServerMode {
  if (typeof window === 'undefined') return defaultMode;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const param = (urlParams.get('server') || urlParams.get('mode') || '').toLowerCase();
    if (param === 'mmo' || param === 'gacha') return param;

    const primary = window.localStorage.getItem(STORAGE_KEY);
    if (primary === 'mmo' || primary === 'gacha') return primary;

    for (const key of FALLBACK_KEYS) {
      const fallback = window.localStorage.getItem(key);
      if (fallback === 'mmo' || fallback === 'gacha') return fallback;
    }
  } catch (_) {
    // Storage access protected in private / sandboxed contexts
  }

  return defaultMode;
}

/**
 * Safely persists server mode across primary and legacy keys, and optionally updates URL query param.
 */
export function setStoredServerMode(mode: ServerMode, syncUrl = false): void {
  if (typeof window === 'undefined') return;

  const norm = mode.toLowerCase() as ServerMode;
  if (norm !== 'mmo' && norm !== 'gacha') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, norm);
    for (const key of FALLBACK_KEYS) {
      window.localStorage.setItem(key, norm);
    }
  } catch (_) {}

  if (syncUrl && typeof window.history?.replaceState === 'function') {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('server', norm);
      window.history.replaceState(null, '', url.toString());
    } catch (_) {}
  }
}

/**
 * ServerModeSwitcher — Gacha / MMO server mode toggle (.sim-mode-toggle).
 * Rendered strictly on gameplay-divergent pages (simulacra, relics, pets).
 * Embedded inside search bar on desktop, wraps cleanly on mobile.
 */
/**
 * Pure keyboard handler for ServerModeSwitcher Arrow navigation.
 */
export function handleServerModeKeyDown(
  event: { key: string; preventDefault?: () => void },
  currentMode: ServerMode,
  onSelect: (mode: ServerMode) => void,
  focusGacha?: () => void,
  focusMmo?: () => void
): void {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault?.();
    if (currentMode === 'gacha') {
      onSelect('mmo');
      focusMmo?.();
    } else {
      onSelect('gacha');
      focusGacha?.();
    }
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault?.();
    if (currentMode === 'mmo') {
      onSelect('gacha');
      focusGacha?.();
    } else {
      onSelect('mmo');
      focusMmo?.();
    }
  }
}

export function ServerModeSwitcher({
  value,
  onChange,
  gachaLabel = 'Gacha',
  mmoLabel = 'MMO',
  storageKey = STORAGE_KEY,
  syncUrl = false,
  className = '',
  ariaLabel = 'Server Mode',
}: ServerModeSwitcherProps) {
  const handleSelect = (mode: ServerMode) => {
    if (mode === value) return;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, mode);
        for (const key of FALLBACK_KEYS) {
          window.localStorage.setItem(key, mode);
        }
        if (syncUrl && typeof window.history?.replaceState === 'function') {
          const url = new URL(window.location.href);
          url.searchParams.set('server', mode);
          window.history.replaceState(null, '', url.toString());
        }
      }
    } catch (_) {}

    onChange(mode);
  };

  return (
    <ModeSwitcher
      value={value}
      onChange={handleSelect}
      options={[
        { value: 'gacha', label: gachaLabel, tone: 'orange' },
        { value: 'mmo', label: mmoLabel, tone: 'rose' },
      ]}
      dataAttribute="data-server-filter"
      className={className}
      ariaLabel={ariaLabel}
    />
  );
}
