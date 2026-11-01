import { Injectable, Logger } from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseResVersion,
  compareVersions,
  determineVersionStatus,
  formatSnapshotDate,
  type SiteVersionStatus,
  type LiveGlobalVersion,
  type ReleaseManifest,
  type VersionSource,
} from '@tof-hub/contracts';

const DEFAULT_GLOBAL_SOURCE_URL =
  'https://htkrydpatch1.wmupd.com/clientRes/OBPC_2_5/Version/Windows/config.xml';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

@Injectable()
export class VersionStatusService {
  private readonly logger = new Logger(VersionStatusService.name);

  private cachedLiveVersion: LiveGlobalVersion | null = null;
  private lastCheckedTimestamp = 0;
  private liveRequest:Promise<LiveGlobalVersion>|null=null;
  private retryAfter=0;

  /**
   * Resolves the filesystem path to release-manifest.json
   */
  private resolveManifestPath(): string {
    if (process.env.GAME_DATA_ROOT) {
      const customPath = path.resolve(process.env.GAME_DATA_ROOT, 'release-manifest.json');
      if (fs.existsSync(customPath)) return customPath;
    }

    // Standard monorepo candidates
    const candidates = [
      path.resolve(process.cwd(), 'apps', 'web', 'public', 'game-data', 'release-manifest.json'),
      path.resolve(process.cwd(), '..', 'web', 'public', 'game-data', 'release-manifest.json'),
      path.resolve(process.cwd(), 'public', 'game-data', 'release-manifest.json'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }

    return candidates[0];
  }

  /**
   * Loads release-manifest.json from the active game data root
   */
  public loadManifest(): ReleaseManifest | null {
    const manifestPath = this.resolveManifestPath();
    if (!fs.existsSync(manifestPath)) {
      this.logger.warn(`release-manifest.json not found at ${manifestPath}`);
      return null;
    }

    try {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      return JSON.parse(raw) as ReleaseManifest;
    } catch (err: any) {
      this.logger.error(`Failed to parse release-manifest.json: ${err?.message || err}`);
      return null;
    }
  }

  /**
   * Fetches the current live Global client version from the authoritative game launcher
   * upstream XML endpoint or cached memory (with graceful offline fallback).
   */
  public async getLiveGlobalVersion(sourceUrl?: string): Promise<LiveGlobalVersion> {
    if(this.cachedLiveVersion&&Date.now()-this.lastCheckedTimestamp<CACHE_TTL_MS)return this.cachedLiveVersion;
    if(this.liveRequest)return this.liveRequest;
    if(Date.now()<this.retryAfter)throw new Error('Live version source is temporarily unavailable');
    this.liveRequest=this.fetchLiveGlobalVersion(sourceUrl).finally(()=>{this.liveRequest=null;});
    return this.liveRequest;
  }

  private async fetchLiveGlobalVersion(sourceUrl?: string): Promise<LiveGlobalVersion> {
    const now = Date.now();
    if (this.cachedLiveVersion && now - this.lastCheckedTimestamp < CACHE_TTL_MS) {
      return this.cachedLiveVersion;
    }

    const url = sourceUrl || DEFAULT_GLOBAL_SOURCE_URL;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'TOF-Hub-Version-Status/1.0',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        throw new Error(`Upstream returned HTTP ${res.status}`);
      }

      const xmlText = await res.text();
      const version = parseResVersion(xmlText);

      this.cachedLiveVersion = {
        version,
        checkedAt: new Date().toISOString(),
        source: 'Tower of Fantasy Global Live launcher',
      };
      this.lastCheckedTimestamp = now;

      return this.cachedLiveVersion;
    } catch (err: any) {
      this.logger.warn(
        `Failed to fetch live Global version from ${url} (${err?.message || err}); attempting fallback`
      );

      // Return stale cache if available
      if (this.cachedLiveVersion) {
        this.lastCheckedTimestamp=now;
        return this.cachedLiveVersion;
      }

      // Fallback to manifest tracked version
      const manifest = this.loadManifest();
      const fallbackVersion = manifest?.clientVersions?.global?.version;
      if (fallbackVersion) {
        this.lastCheckedTimestamp=now;
        this.cachedLiveVersion={
          version: fallbackVersion,
          checkedAt: manifest?.clientVersions?.global?.lastChanged,
          source: 'release-manifest.json fallback',
        };
        return this.cachedLiveVersion;
      }

      this.retryAfter=now+60_000;
      throw new Error(`Could not resolve live Global version: ${err?.message || err}`);
    }
  }

  /**
   * Format source branches for human readability (EN/RU)
   */
  private formatSourceBranch(sources: VersionSource[]): { en: string; ru: string } {
    if (!sources || sources.length === 0) {
      return { en: '—', ru: '—' };
    }

    const en = sources
      .map((s) => `${s.client} — ${s.branch}`)
      .join(', ');
    const ru = sources
      .map((s) => `${s.clientRu || s.client} — ${s.branch}`)
      .join(', ');

    return { en, ru };
  }

  /**
   * Evaluates the comprehensive site version status against the published dataset and live Global version.
   */
  public async getVersionStatus(): Promise<SiteVersionStatus> {
    const manifest = this.loadManifest();
    let liveGlobal: LiveGlobalVersion | null = null;

    try {
      liveGlobal = await this.getLiveGlobalVersion();
    } catch {
      liveGlobal = null;
    }

    const datasetVersion = manifest?.snapshot?.version || manifest?.gameVersion || null;
    const globalVersion = liveGlobal?.version || manifest?.clientVersions?.global?.version || null;

    const { state, updateAvailable, isCurrent } = determineVersionStatus(
      datasetVersion,
      globalVersion
    );

    const exportedAt = manifest?.snapshot?.exportedAt || null;
    const sources: VersionSource[] = manifest?.snapshot?.sources || [];

    return {
      state,
      datasetVersion,
      globalVersion,
      isCurrent,
      updateAvailable,
      exportedAt,
      formattedExportDate: {
        en: formatSnapshotDate(exportedAt, 'en'),
        ru: formatSnapshotDate(exportedAt, 'ru'),
      },
      sources,
      sourceBranch: this.formatSourceBranch(sources),
      checkedAt: liveGlobal?.checkedAt || new Date().toISOString(),
    };
  }

  /**
   * Reset cache for testing
   */
  public _resetCache(): void {
    this.cachedLiveVersion = null;
    this.lastCheckedTimestamp = 0;
    this.retryAfter=0;
  }
}
