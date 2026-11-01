import { describe, it, expect } from 'vitest';
import { runPipelineFixtureProof, REPRESENTATIVE_FIXTURE_ASSETS } from './pipeline-fixture';
import { resolveGameAsset, gameAssetSources } from '@tof-hub/game-assets';

describe('Pipeline Fixture Proof & Safety Verification', () => {
  it('executes full pipeline fixture proof across all 7 public Info sections', async () => {
    const report = await runPipelineFixtureProof();

    expect(report.safetyGuardsPassed).toBe(true);
    expect(report.totalChecksFailed).toBe(0);
    expect(report.totalChecksPassed).toBeGreaterThanOrEqual(100);

    // Public sections coverage
    expect(report.sectionsValidated).toEqual([
      'simulacra',
      'matrices',
      'relics',
      'pets',
      'food',
      'cosmetics',
      'arts',
    ]);

    // Validation invariants
    expect(report.zodValidationPassed).toBe(true);
    expect(report.localeMaterializationPassed).toBe(true);
    expect(report.manifestIdempotent).toBe(true);
    expect(report.stagingPortabilityPassed).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it('correctly resolves and normalizes all 7 representative asset paths', () => {
    expect(REPRESENTATIVE_FIXTURE_ASSETS).toHaveLength(7);

    for (const item of REPRESENTATIVE_FIXTURE_ASSETS) {
      const webpRes = resolveGameAsset(item.sourceAssetPath, 'webp');
      const pngRes = resolveGameAsset(item.sourceAssetPath, 'png');
      const sources = gameAssetSources(item.sourceAssetPath);

      expect(webpRes.url).toBe(item.resolvedWebpUrl);
      expect(webpRes.isFallback).toBe(false);

      expect(pngRes.url).toBe(item.resolvedPngUrl);
      expect(pngRes.isFallback).toBe(false);

      expect(sources.webp).toBe(item.resolvedWebpUrl);
      expect(sources.png).toBe(item.resolvedPngUrl);
    }
  });
});
