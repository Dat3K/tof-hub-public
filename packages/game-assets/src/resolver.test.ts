import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  gameAsset,
  resolveGameAsset,
  gameAssetSources,
  gameAssetPng,
  gameAssetWebp,
  isGameAsset,
  stripAssetFormat,
  normalizeAssetPath,
  configureGameAssets,
  resetGameAssetConfig,
  registerAssetManifest,
  unregisterAssetManifest,
  hasRegisteredAssetManifest,
  isAssetInManifest,
  getRecentDiagnostics,
  clearRecentDiagnostics,
  addDiagnosticListener,
  AssetResolutionError,
  DEFAULT_ASSET_BASE_URL,
  DEFAULT_FALLBACK_PLACEHOLDER,
} from './index';

describe('@tof-hub/game-assets — Asset Resolver', () => {
  beforeEach(() => {
    resetGameAssetConfig();
    unregisterAssetManifest();
    clearRecentDiagnostics();
  });

  describe('canonical in-game path resolution', () => {
    it('resolves WebP asset preserving in-game relative path', () => {
      const url = gameAsset({
        path: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo',
        format: 'webp',
      });
      expect(url).toBe('/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
    });

    it('resolves PNG asset preserving in-game relative path', () => {
      const url = gameAsset({
        path: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo',
        format: 'png',
      });
      expect(url).toBe('/game-assets/png/Hotta/Content/Resources/UI/wuqi/icon_element_huo.png');
    });

    it('defaults delivery format to WebP', () => {
      const url = gameAsset({
        path: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo',
      });
      expect(url).toBe('/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
    });

    it('supports direct string input signature with default WebP delivery', () => {
      const url = gameAsset('Hotta/Content/Resources/UI/wuqi/icon_element_huo');
      expect(url).toBe('/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
    });

    it('supports direct string input signature with format override', () => {
      const url = gameAsset('Hotta/Content/Resources/UI/wuqi/icon_element_huo', 'png');
      expect(url).toBe('/game-assets/png/Hotta/Content/Resources/UI/wuqi/icon_element_huo.png');
    });
  });

  describe('Extension swapping & normalization', () => {
    it('swaps .png extension to .webp when WebP is requested', () => {
      const url = gameAsset({
        path: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo.png',
        format: 'webp',
      });
      expect(url).toBe('/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
    });

    it('swaps .webp extension to .png when PNG is requested', () => {
      const url = gameAsset({
        path: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp',
        format: 'png',
      });
      expect(url).toBe('/game-assets/png/Hotta/Content/Resources/UI/wuqi/icon_element_huo.png');
    });

    it('handles uppercase file extensions', () => {
      const url = gameAsset('Hotta/Content/Resources/UI/wuqi/icon_element_huo.PNG', 'webp');
      expect(url).toBe('/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
    });

    it('strips leading and trailing slashes and collapses multiple slashes', () => {
      const url = gameAsset('///Hotta//Content///Resources/UI/wuqi/icon_element_huo///');
      expect(url).toBe('/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
    });

    it('normalizes Windows backslashes into forward slashes', () => {
      const url = gameAsset('Hotta\\Content\\Resources\\UI\\wuqi\\icon_element_huo.png');
      expect(url).toBe('/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
    });
  });

  describe('Legacy identity migration', () => {
    it('migrates legacy datamine media URLs from catalog.json', () => {
      const legacyPath = '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_fangyu.webp';
      const resolved = resolveGameAsset(legacyPath);

      expect(resolved.url).toBe('/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_fangyu.webp');
      expect(resolved.normalizedPath).toBe('Hotta/Content/Resources/UI/wuqi/icon_fangyu');
      expect(resolved.isFallback).toBe(false);

      const legacyDiag = resolved.diagnostics.find((d) => d.code === 'LEGACY_PATH_MIGRATED');
      expect(legacyDiag).toBeDefined();
      expect(legacyDiag?.message).toContain('Migrated legacy asset path');
    });

    it('migrates datamine paths without leading slash', () => {
      const legacyPath = 'datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_fangyu.webp';
      const url = gameAsset(legacyPath, 'png');
      expect(url).toBe('/game-assets/png/Hotta/Content/Resources/UI/wuqi/icon_fangyu.png');
    });

    it('migrates Unreal Engine /Game/ reference paths from shared-media-manifest.json', () => {
      const ueRef = '/Game/Resources/UI/Artifact/itemicon/artifact_ssr_001.artifact_ssr_001';
      const resolved = resolveGameAsset(ueRef);

      expect(resolved.url).toBe('/game-assets/webp/Hotta/Content/Resources/UI/Artifact/itemicon/artifact_ssr_001.webp');
      expect(resolved.normalizedPath).toBe('Hotta/Content/Resources/UI/Artifact/itemicon/artifact_ssr_001');

      const legacyDiag = resolved.diagnostics.find((d) => d.code === 'LEGACY_PATH_MIGRATED');
      expect(legacyDiag).toBeDefined();
    });

    it('migrates already pre-resolved /game-assets/ URLs with format change', () => {
      const preResolved = '/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp';
      const pngUrl = gameAsset(preResolved, 'png');
      expect(pngUrl).toBe('/game-assets/png/Hotta/Content/Resources/UI/wuqi/icon_element_huo.png');
    });

    it('migrates public filesystem paths', () => {
      const fsPath = 'apps/web/public/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp';
      const url = gameAsset(fsPath);
      expect(url).toBe('/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
    });
  });

  describe('Security: Directory traversal prevention', () => {
    it('detects and blocks directory traversal attempts', () => {
      const resolved = resolveGameAsset('../../etc/passwd.png');
      expect(resolved.isFallback).toBe(true);
      expect(resolved.url).toBe(DEFAULT_FALLBACK_PLACEHOLDER);

      const invalidDiag = resolved.diagnostics.find((d) => d.code === 'INVALID_PATH');
      expect(invalidDiag).toBeDefined();
      expect(invalidDiag?.message).toContain('Path traversal detected');
    });
  });

  describe('Controlled fallbacks and dev diagnostics (not silent replacement)', () => {
    it('applies fallback and logs diagnostics for empty string without silent replacement', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const resolved = resolveGameAsset('');
      expect(resolved.isFallback).toBe(true);
      expect(resolved.url).toBe(DEFAULT_FALLBACK_PLACEHOLDER);

      expect(resolved.diagnostics.some((d) => d.code === 'MISSING_PATH')).toBe(true);
      expect(resolved.diagnostics.some((d) => d.code === 'FALLBACK_USED')).toBe(true);

      // Confirms dev warning was fired (not silent replacement)
      expect(warnSpy).toHaveBeenCalled();
      const warnedMessage = warnSpy.mock.calls[0]?.[0] || '';
      expect(warnedMessage).toContain('[game-assets]');

      warnSpy.mockRestore();
    });

    it('records diagnostics in queryable history buffer', () => {
      resolveGameAsset('', undefined);
      const diagnostics = getRecentDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.code).toBe('MISSING_PATH');
    });

    it('notifies registered diagnostic listeners', () => {
      const listener = vi.fn();
      const unsubscribe = addDiagnosticListener(listener);

      resolveGameAsset('   ');
      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].code).toBe('MISSING_PATH');

      unsubscribe();
      listener.mockClear();
      resolveGameAsset('   ');
      expect(listener).not.toHaveBeenCalled();
    });

    it('allows custom fallback path', () => {
      const url = gameAsset({
        path: '',
        fallback: '/images/custom-fallback.png',
      });
      expect(url).toBe('/images/custom-fallback.png');
    });

    it('supports explicit null fallback to suppress placeholder URL', () => {
      const url = gameAsset({
        path: '',
        fallback: null,
      });
      expect(url).toBe('');
    });

    it('throws AssetResolutionError when throwOnError is enabled', () => {
      expect(() => {
        resolveGameAsset({
          path: '',
          throwOnError: true,
        });
      }).toThrow(AssetResolutionError);
    });

    it('suppresses console warning when silent: true is specified', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const resolved = resolveGameAsset({
        path: '',
        silent: true,
      });
      expect(resolved.isFallback).toBe(true);
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('Dual format sources (gameAssetSources)', () => {
    it('returns both WebP and PNG sources for HTML <picture>', () => {
      const sources = gameAssetSources('Hotta/Content/Resources/UI/wuqi/icon_element_huo');

      expect(sources.webp).toBe('/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
      expect(sources.png).toBe('/game-assets/png/Hotta/Content/Resources/UI/wuqi/icon_element_huo.png');
      expect(sources.defaultUrl).toBe(sources.webp);
      expect(sources.isFallback).toBe(false);
    });

    it('reflects fallback state when path is invalid', () => {
      const sources = gameAssetSources('');
      expect(sources.isFallback).toBe(true);
      expect(sources.webp).toBe(DEFAULT_FALLBACK_PLACEHOLDER);
    });
  });

  describe('Convenience helper functions', () => {
    it('gameAssetPng forces PNG format', () => {
      const url = gameAssetPng('Hotta/Content/Resources/UI/wuqi/icon_element_huo');
      expect(url).toBe('/game-assets/png/Hotta/Content/Resources/UI/wuqi/icon_element_huo.png');
    });

    it('gameAssetWebp forces WebP format', () => {
      const url = gameAssetWebp('Hotta/Content/Resources/UI/wuqi/icon_element_huo.png');
      expect(url).toBe('/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
    });

    it('isGameAsset checks path validity', () => {
      expect(isGameAsset('Hotta/Content/Resources/UI/wuqi/icon_element_huo')).toBe(true);
      expect(isGameAsset('/datamine/shared/media/Hotta/Content/foo.webp')).toBe(true);
      expect(isGameAsset('')).toBe(false);
      expect(isGameAsset('../../traversal')).toBe(false);
    });

    it('stripAssetFormat extracts normalized in-game relative path', () => {
      const clean = stripAssetFormat('/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
      expect(clean).toBe('Hotta/Content/Resources/UI/wuqi/icon_element_huo');
    });
  });

  describe('Configuration & Base URL customization', () => {
    it('allows customizing base URL globally', () => {
      configureGameAssets({ baseUrl: 'https://cdn.tof-hub.com/assets' });
      const url = gameAsset('Hotta/Content/Resources/UI/wuqi/icon_element_huo');
      expect(url).toBe('https://cdn.tof-hub.com/assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
    });

    it('handles trailing slashes on custom base URL cleanly', () => {
      configureGameAssets({ baseUrl: 'https://cdn.tof-hub.com/assets///' });
      const url = gameAsset('Hotta/Content/Resources/UI/wuqi/icon_element_huo');
      expect(url).toBe('https://cdn.tof-hub.com/assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
    });

    it('allows per-call base URL override', () => {
      const url = gameAsset({
        path: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo',
        baseUrl: '/custom-prefix',
      });
      expect(url).toBe('/custom-prefix/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp');
    });
  });

  describe('Manifest verification & Missing Asset Diagnostics', () => {
    it('verifies assets against registered manifest and emits diagnostic on missing asset', () => {
      // Simulate registering shared-media-manifest.json
      registerAssetManifest({
        assets: {
          'Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp': { width: 128 },
          'Hotta/Content/Resources/UI/wuqi/icon_fangyu.webp': { width: 128 },
        },
      });

      expect(hasRegisteredAssetManifest()).toBe(true);
      expect(isAssetInManifest('Hotta/Content/Resources/UI/wuqi/icon_element_huo')).toBe(true);
      expect(isAssetInManifest('Hotta/Content/Resources/UI/unknown/missing_asset')).toBe(false);

      // Resolving known asset -> no ASSET_NOT_FOUND diagnostic
      const knownRes = resolveGameAsset('Hotta/Content/Resources/UI/wuqi/icon_element_huo');
      expect(knownRes.diagnostics.some((d) => d.code === 'ASSET_NOT_FOUND')).toBe(false);

      // Resolving unknown asset -> ASSET_NOT_FOUND diagnostic emitted!
      const missingRes = resolveGameAsset('Hotta/Content/Resources/UI/unknown/missing_asset');
      const missingDiag = missingRes.diagnostics.find((d) => d.code === 'ASSET_NOT_FOUND');
      expect(missingDiag).toBeDefined();
      expect(missingDiag?.message).toContain('was not found in the registered asset manifest');
    });
  });

  describe('Live legacy catalog & manifest compatibility', () => {
    it('verifies real legacy paths from catalog.json resolve to canonical game-assets paths', async () => {
      const fs = await import('node:fs');
      const catalogPath = '/example/source/tools/data/catalog.json';
      if (!fs.existsSync(catalogPath)) {
        return;
      }

      const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

      // Check role icons: e.g. /datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_fangyu.webp
      for (const role of catalog.roles || []) {
        if (role.icon) {
          const webp = gameAsset(role.icon, 'webp');
          expect(webp).toMatch(/^\/game-assets\/webp\/Hotta\/Content\/.+\.webp$/);

          const png = gameAsset(role.icon, 'png');
          expect(png).toMatch(/^\/game-assets\/png\/Hotta\/Content\/.+\.png$/);
        }
      }

      // Check simulacra avatars and weapon icons
      const sampleSims = (catalog.simulacra || []).slice(0, 10);
      for (const sim of sampleSims) {
        if (sim.avatar) {
          const webp = gameAsset(sim.avatar, 'webp');
          expect(webp).toMatch(/^\/game-assets\/webp\/Hotta\/Content\/.+\.webp$/);
        }
        if (sim.weapon_icon) {
          const png = gameAsset(sim.weapon_icon, 'png');
          expect(png).toMatch(/^\/game-assets\/png\/Hotta\/Content\/.+\.png$/);
        }
      }
    });

    it('verifies real legacy manifest assets from shared-media-manifest.json', async () => {
      const fs = await import('node:fs');
      const manifestPath = '/example/source/datamine/shared-data/shared-media-manifest.json';
      if (!fs.existsSync(manifestPath)) {
        return;
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      registerAssetManifest(manifest);

      const entries = Object.entries(manifest.assets || {}).slice(0, 20);
      for (const [key, item] of entries) {
        const anyItem = item as any;
        if (anyItem.sourceAssetRef) {
          const res = resolveGameAsset(anyItem.sourceAssetRef);
          expect(res.url).toMatch(/^\/game-assets\/webp\/Hotta\/Content\/.+\.webp$/);
          expect(res.isFallback).toBe(false);
          // Registered manifest must recognize the asset
          expect(res.diagnostics.some((d) => d.code === 'ASSET_NOT_FOUND')).toBe(false);
        }
      }
    });
  });
});

