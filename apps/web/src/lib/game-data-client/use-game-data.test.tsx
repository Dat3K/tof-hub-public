import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Locale } from '@tof-hub/i18n';
import { GameDataCache } from './cache';
import { useGameData } from './use-game-data';

describe('useGameData locale changes', () => {
  it('fetches the new culture instead of seeding it with untagged SSR data', async () => {
    const cache = new GameDataCache();
    const initialData = { '1': { name: 'English item' } };
    const translated = { '1': { name: '日本語のアイテム' } };
    const fetchFn = vi.fn<typeof fetch>(async () => ({ ok: true, status: 200, json: async () => translated }) as Response);
    const { result, rerender } = renderHook(({ locale }: { locale: Locale }) =>
      useGameData('items', { locale, initialData, fetchFn }, cache), { initialProps: { locale: 'en' as Locale } });
    expect(result.current.data).toEqual(initialData);
    expect(fetchFn).not.toHaveBeenCalled();
    rerender({ locale: 'ja' });
    await waitFor(() => expect(result.current.data).toEqual(translated));
    expect(fetchFn.mock.calls[0][0]).toBe('/game-data/ja/runtime/items.json');
    expect(cache.getResolved('en', 'items')).toEqual(initialData);
    expect(cache.getResolved('ja', 'items')).toEqual(translated);
  });
});
