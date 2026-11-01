import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { constants, createHash, generateKeyPairSync, sign } from 'node:crypto';
import { BuildCaptureSchema } from '@tof-hub/contracts';
import capture from '../../../../../packages/contracts/src/__fixtures__/build-capture.json';
import { draftFromCapture, type CaptureImportCatalog } from './capture-import';
import { verifyBuildCard } from './card-verification';
import { createBuildExportCard } from './build-export-card';
import type { BuildCatalog } from './types';

const catalog = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../public/game-data/build-page.json'), 'utf8')) as BuildCatalog;
const mapping = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../public/game-data/capture-card-map.json'), 'utf8')) as CaptureImportCatalog;
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const data = BuildCaptureSchema.parse(capture);
const digest = createHash('sha256').update(JSON.stringify(data)).digest('hex');
const signature = sign('sha256', Buffer.from(`tof-hub-build-capture:1:${digest}`), {
  key: keys.privateKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32,
}).toString('base64url');
afterEach(() => { vi.unstubAllGlobals(); });

describe('Build PNG model and DOM boundary', () => {
  it('ignores HTML edits on repeated offline exports and disposes every temporary React tree', async () => {
    const draft = draftFromCapture(data, catalog, mapping, 'en', digest, undefined, signature);
    const scene = () => {
      let card!: HTMLElement;
      act(() => { card = createBuildExportCard({ draft, catalog, locale: 'en' }); });
      return card;
    };
    const preview = scene(); document.body.appendChild(preview);
    try {
      const name = preview.querySelector<HTMLElement>('[data-build-edit="profile:name"]')!;
      expect(name).not.toBeNull();
      name.textContent = 'FORGED DOM NAME';
      preview.querySelector('[data-export-provenance="verified"]')!.setAttribute('data-export-active', '');
      expect(preview.cloneNode(true).textContent).toContain('FORGED DOM NAME'); // The old exporter copied this DOM.
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
      const before = document.querySelectorAll('*').length;
      for (let attempt = 0; attempt < 3; attempt++) {
        expect(await verifyBuildCard(draft, catalog, { publicKeyPem, mapping })).toBe('verified');
        const exported = scene();
        expect(exported.textContent).not.toContain('FORGED DOM NAME');
        expect(exported.querySelector('[data-build-edit="profile:name"]')!.textContent).toBe(draft.profile.name);
        expect(exported.querySelector('[data-export-active]')).toBeNull();
        expect(document.querySelectorAll('*')).toHaveLength(before);
      }
      draft.profile.name = 'Changed through the editor';
      expect(await verifyBuildCard(draft, catalog, { publicKeyPem, mapping })).toBe('edited');
      expect(scene().textContent).toContain('Changed through the editor');
      expect(fetch).not.toHaveBeenCalled();
    } finally { preview.remove(); }
  }, 20_000);
});
