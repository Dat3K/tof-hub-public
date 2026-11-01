'use client';

import { localeText } from '@/lib/i18n/text';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { setStoredServerMode } from '@tof-hub/ui';
import { PillSwitcher } from '@/components/pill-switcher/pill-switcher';
import { useI18n } from '@/lib/i18n';
import styles from './encounter.module.css';

/** The same mode control as OOW. Each mode owns its own game data and URL state. */
export function EncounterModeSwitcher({ mode, path }: { mode: 'gacha' | 'mmo'; path: string }) {
  const router = useRouter();
  const { locale } = useI18n();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return <PillSwitcher mode={mode === 'mmo' ? 'mmo' : 'standard'} originalLabel="Gacha" mmoLabel="MMO"
    disabled={!ready}
    ariaLabel={localeText(locale)('Game mode')} onChange={next => {
      const value = next === 'mmo' ? 'mmo' : 'gacha';
      setStoredServerMode(value);
      const url = new URL(window.location.href);
      if (value === mode) return;
      const query = new URLSearchParams();
      if (url.searchParams.has('lang')) query.set('lang', url.searchParams.get('lang')!);
      if (value === 'mmo') query.set('mode', 'mmo');
      router.push(`${path}${query.size ? `?${query}` : ''}`, { scroll: false });
    }} />;
}

export function EncounterHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <header className={styles.header}><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{children}</header>;
}

export function EncounterFacts({ items, presentation = 'summary' }: { items: { label: string; value: ReactNode; note?: string }[]; presentation?: 'summary' | 'details' }) {
  return <dl className={presentation === 'details' ? styles.stats : styles.facts}>{items.map(item => <div key={item.label}>
    <dt>{item.label}</dt><dd>{item.value ?? '—'}</dd>{item.note && <small className={presentation === 'details' ? styles.statNote : undefined}>{item.note}</small>}
  </div>)}</dl>;
}

/** Selection stays shareable and follows back/forward without reloading the whole dataset. */
export function useEncounterSelection(key: string, fallback: string, initialValue?: string, urlDefault?: string) {
  const [value, setValue] = useState(() => typeof window === 'undefined' ? initialValue || fallback : new URL(window.location.href).searchParams.get(key) || fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setValue(new URL(window.location.href).searchParams.get(key) || fallback);
    sync();
    setReady(true);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [key, fallback]);
  const select = (next: string) => {
    setValue(next);
    const url = new URL(window.location.href);
    if (next === urlDefault) url.searchParams.delete(key);
    else url.searchParams.set(key, next);
    window.history.replaceState(window.history.state, '', url);
  };
  return [value, select, ready] as const;
}
