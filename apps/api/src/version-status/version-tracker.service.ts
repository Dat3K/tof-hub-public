import { Inject, Injectable, Logger, Optional, ServiceUnavailableException, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { versionTrackerSchema, type VersionTracker, type TrackedBranch } from '@tof-hub/contracts';
import { PRISMA } from '../database/database.module';
import { resolveLauncherVersion, type LauncherObservation } from './launcher-version-source';

const POLL_MS = 10 * 60 * 1000;
const iso = (value: Date | null) => value?.toISOString() ?? null;

/** Launcher observations persist independently of visits. PostgreSQL locks coordinate API replicas. */
@Injectable()
export class VersionTrackerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VersionTrackerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private seed: VersionTracker | null = null;
  constructor(@Optional() @Inject(PRISMA) private readonly prisma: PrismaClient | null) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), POLL_MS);
    this.timer.unref();
    void this.tick();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private loadSeed(): VersionTracker {
    if (this.seed) return this.seed;
    const candidates = [
      process.env.GAME_DATA_ROOT && path.resolve(process.env.GAME_DATA_ROOT, 'version-tracker.json'),
      path.resolve(process.cwd(), 'apps/web/public/game-data/version-tracker.json'),
      path.resolve(process.cwd(), '../web/public/game-data/version-tracker.json'),
      path.resolve(process.cwd(), 'public/game-data/version-tracker.json'),
    ];
    const file = candidates.find((candidate): candidate is string => !!candidate && fs.existsSync(candidate));
    if (!file) throw new Error('Generated version-tracker.json is missing');
    this.seed = versionTrackerSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
    return this.seed;
  }

  private async initialize() {
    if (!this.prisma) return;
    const seed = this.loadSeed();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(716204)`;
      for (const branch of seed.branches) {
        if (await tx.gameVersionBranch.findUnique({where: {id: branch.id}})) {
          // Previous monitors read this exact static URL; preserve its provenance before rotation.
          await tx.gameVersionBranch.updateMany({where: {id: branch.id, resourceBranch: null}, data: {resourceBranch: branch.branch, sourceUrl: branch.sourceUrl}});
          await tx.gameVersionEvent.updateMany({where: {branchId: branch.id, resourceBranch: null}, data: {resourceBranch: branch.branch, sourceUrl: branch.sourceUrl}});
          continue;
        }
        await tx.gameVersionBranch.create({data: {id: branch.id, version: branch.version, changedAt: branch.changedAt, resourceBranch: branch.branch, sourceUrl: branch.sourceUrl}});
        if (branch.history.length) await tx.gameVersionEvent.createMany({data: branch.history.map((event) => ({...event, branchId: branch.id})), skipDuplicates: true});
      }
    });
  }

  async tick() {
    if (!this.prisma || this.running) return;
    this.running = true;
    try {
      await this.initialize();
      await Promise.allSettled(this.loadSeed().branches.map(async (branch) => {
        try { await this.checkBranch(branch); }
        catch { this.logger.warn(`Could not persist version observation for ${branch.id}`); }
      }));
    } catch { this.logger.warn('Version tracker initialization unavailable; retrying on next interval'); }
    finally { this.running = false; }
  }

  async checkBranch(branch: TrackedBranch) {
    if (!this.prisma) return;
    await this.prisma.$transaction(async (tx) => {
      // Hold the lock through the bounded fetch: another replica cannot write an older result afterward.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`version-tracker:${branch.id}`}))`;
      const stored = await tx.gameVersionBranch.findUniqueOrThrow({where: {id: branch.id}});
      // Newly added launcher discovery must not wait behind a successful poll of an obsolete static URL.
      if (stored.attemptedAt && Date.now() - stored.attemptedAt.getTime() < POLL_MS && (!branch.launcher || stored.launcherVersion || stored.error)) return;
      const now = new Date();
      let observation: LauncherObservation;
      try {
        observation = await resolveLauncherVersion(branch);
      } catch {
        await tx.gameVersionBranch.update({where: {id: branch.id}, data: {attemptedAt: now, error: true}});
        return;
      }
      const changed = stored.version !== observation.version || (stored.resourceBranch ?? branch.branch) !== observation.resourceBranch
        || (!!stored.launcherVersion && stored.launcherVersion !== observation.launcherVersion);
      if (changed) await tx.gameVersionEvent.create({data: {id: randomUUID(), branchId: branch.id, ...observation, observedAt: now, precision: 'instant', origin: 'monitor'}});
      await tx.gameVersionBranch.update({where: {id: branch.id}, data: {
        ...observation, attemptedAt: now, checkedAt: now, error: false,
        ...(changed ? {changedAt: now} : {}),
      }});
    }, {timeout: 12000, maxWait: 1500});
  }

  async getTracker(): Promise<VersionTracker> {
    if (!this.prisma) throw new ServiceUnavailableException('Persistent version tracker requires PostgreSQL');
    try {
      const seed = this.loadSeed();
      const rows = await this.prisma.gameVersionBranch.findMany({include: {events: {orderBy: [{observedAt: 'desc'}, {id: 'desc'}], take: 100}}});
      if (!rows.length) throw new Error('Tracker initializing');
      return versionTrackerSchema.parse({schemaVersion: 1, mode: 'live', branches: seed.branches.map((source) => {
        const row = rows.find((item) => item.id === source.id);
        return row ? {...source, branch: row.resourceBranch ?? source.branch, sourceUrl: row.sourceUrl ?? source.sourceUrl, launcherVersion: row.launcherVersion,
          version: row.version, changedAt: iso(row.changedAt), checkedAt: iso(row.checkedAt),
          attemptedAt: iso(row.attemptedAt), error: row.error,
          history: row.events.sort((a, b) => {
            const delta = b.observedAt.getTime() - a.observedAt.getTime();
            if (delta || a.origin !== 'legacy' || b.origin !== 'legacy') return delta;
            return source.history.findIndex((event) => event.id === a.id) - source.history.findIndex((event) => event.id === b.id);
          }).map((event) => ({id: event.id, version: event.version, observedAt: event.observedAt.toISOString(), precision: event.precision, origin: event.origin,
            resourceBranch: event.resourceBranch, sourceUrl: event.sourceUrl, launcherVersion: event.launcherVersion}))} : source;
      })});
    } catch { throw new ServiceUnavailableException('Version tracker temporarily unavailable'); }
  }
}
