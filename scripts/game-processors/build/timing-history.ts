/**
 * timing-history.js — Adaptive duration history and EWMA estimation for process scheduler.
 *
 * Design contracts:
 * 1. Persists atomic, local timing history keyed by job ID and schema version.
 * 2. Uses bounded Exponentially Weighted Moving Average (EWMA, alpha = 0.3) so single abnormal runs
 *    do not permanently distort critical-path scheduling priority.
 * 3. Falls back to conservative checked-in defaults when history is absent.
 * 4. Safe atomic write via temporary file + rename to prevent corrupted files on unexpected termination.
 */

import fs from 'node:fs';
import path from 'node:path';

const SCHEMA_VERSION = 1;
const DEFAULT_ALPHA = 0.3;
const MAX_HISTORY_SAMPLES = 5;

// Conservative checked-in default estimates (in milliseconds) derived from authoritative measured runs.
const CHECKED_IN_ESTIMATES = {
  'build-items-json': 492000,
  'build-matrices': 265000,
  'build-outfits': 164000,
  'build-relics': 154000,
  'build-pets': 136000,
  'build-other-content': 91000,
  'build-simulacra': 85000,
  'build-extreme-trial': 68000,
  'build-bestiary': 35000,
  'extract-oow-deep-intel': 18000,
  'build-bygone': 16000,
  'build-seq-data': 15000,
  'build-gear-rolls': 14000,
  'build-user-stats': 12000,
  'parse-fce-mechanics': 12000,
  'generate-master-image-audit': 12000,
  'shard-oow-data': 10000,
  'build-gear-enhance': 10000,
  'build-enemies': 10000,
  'generate-coverage-ledger': 8000,
  'build-buffs': 8000,
  'build-void-rift': 7000,
  'build-multype-extra': 6000,
  'build-donation': 6000,
  'build-space-support': 5000,
  'build-suppressors': 5000,
  'build-calculator': 5000,
  'publish-managed': 5000,
  'validate-datamine': 4000,
  'build-fce-index': 4000,
  'generate-release-manifest': 3000,
  'finalize-public-bundle': 2000
};

class TimingHistory {
  declare filePath: any;
  declare data: any;

  constructor(filePath = '') {
    this.filePath = filePath;
    this.data = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      jobs: {}
    };
    if (filePath && fs.existsSync(filePath)) {
      this.load(filePath);
    }
  }

  load(filePath) {
    this.filePath = filePath;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.schemaVersion === SCHEMA_VERSION && parsed.jobs) {
        this.data = parsed;
      }
    } catch (e) {
      // In case of unreadable file, start fresh
      this.data = {
        schemaVersion: SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        jobs: {}
      };
    }
  }

  getEstimate(jobId, fallbackDefaultMs = 10000) {
    const record = this.data.jobs[jobId];
    if (record && typeof record.estimatedMs === 'number' && record.estimatedMs > 0) {
      return record.estimatedMs;
    }
    if (CHECKED_IN_ESTIMATES[jobId]) {
      return CHECKED_IN_ESTIMATES[jobId];
    }
    return fallbackDefaultMs;
  }

  recordRun(jobId, { durationMs, queueWaitMs = 0, success = true, inputFingerprint = '' }) {
    if (!jobId || typeof durationMs !== 'number' || durationMs <= 0) return;

    if (!this.data.jobs[jobId]) {
      const initialEstimate = CHECKED_IN_ESTIMATES[jobId] || durationMs;
      this.data.jobs[jobId] = {
        estimatedMs: initialEstimate,
        sampleCount: 0,
        lastRunMs: durationMs,
        lastQueueWaitMs: queueWaitMs,
        lastRunAt: new Date().toISOString(),
        lastStatus: success ? 'success' : 'failed',
        history: []
      };
    }

    const entry = this.data.jobs[jobId];
    entry.lastRunMs = durationMs;
    entry.lastQueueWaitMs = queueWaitMs;
    entry.lastRunAt = new Date().toISOString();
    entry.lastStatus = success ? 'success' : 'failed';
    if (inputFingerprint) entry.lastInputFingerprint = inputFingerprint;

    if (success) {
      entry.sampleCount = (entry.sampleCount || 0) + 1;
      const current = entry.estimatedMs || CHECKED_IN_ESTIMATES[jobId] || durationMs;

      // Bound sample between 0.2x and 5.0x of baseline to reject extreme anomalies
      const boundedSample = Math.max(current * 0.2, Math.min(current * 5.0, durationMs));
      const alpha = DEFAULT_ALPHA;
      entry.estimatedMs = Math.round(alpha * boundedSample + (1 - alpha) * current);

      if (!Array.isArray(entry.history)) entry.history = [];
      entry.history.push({
        durationMs,
        queueWaitMs,
        at: entry.lastRunAt
      });
      if (entry.history.length > MAX_HISTORY_SAMPLES) {
        entry.history.shift();
      }
    }

    this.data.updatedAt = new Date().toISOString();
  }

  save(targetPath = this.filePath) {
    if (!targetPath) return;
    try {
      const dir = path.dirname(targetPath);
      fs.mkdirSync(dir, { recursive: true });
      const tmpPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
      fs.renameSync(tmpPath, targetPath);
    } catch (e) {
      // Non-fatal telemetry save
    }
  }
}

export {
  TimingHistory,
  CHECKED_IN_ESTIMATES,
  SCHEMA_VERSION,
};
