import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MultypeRenamesDataset } from '@tof-hub/contracts';
import { gameDataCache } from '@/lib/game-data-client';
import { MultypeView } from './multype-view';

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ locale: 'en' }),
  useLocale: () => ({ locale: 'en' }),
}));
vi.mock('@/lib/version-status', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/version-status')>(),
  useVersionStatus: () => ({ status: { globalVersion: null } }),
}));

const dataset: MultypeRenamesDataset = {
  version: 1,
  mapping: { NoModule: { FinalDamageExtraUpMult: ['test.json'] } },
};
const scan = { gameVersion: '1.2.3', generatedAt: '2026-01-01T00:00:00Z' };

afterEach(() => {
  gameDataCache.clear();
  vi.unstubAllGlobals();
});

describe('Multype scan version', () => {
  it('recovers saved scan metadata when the server payload has none', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ ...dataset, scan }),
    });
    vi.stubGlobal('fetch', fetch);
    render(<MultypeView initialData={dataset} initialLocale="en" />);

    await screen.findByRole('button', { name: 'Dataset version: 1.2.3' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('/game-data/en/runtime/multype.json');
    expect(screen.getByText('v1.2.3')).toBeTruthy();
  });

  it('keeps the supplied scan version without depending on Global or another request', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<MultypeView initialData={{ ...dataset, scan }} initialLocale="en" />);

    expect(screen.getByRole('button', { name: 'Dataset version: 1.2.3' })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the unavailable explanation in the popup when loading fails', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    render(<MultypeView initialData={dataset} initialLocale="en" />);

    const badge = screen.getByRole('button', { name: 'Dataset version: Version information is unavailable' });
    expect(badge.textContent).toBe('Dataset version—');
    fireEvent.click(badge);
    expect(screen.getByText('Version information is unavailable')).toBeTruthy();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
