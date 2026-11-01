/**
 * dag-scheduler.js — Deterministic Dependency-Aware Pipeline Scheduler.
 *
 * Design contracts:
 * 1. Single Job Registry: Reads declared nodes, direct dependencies, resource classes, and estimates.
 * 2. Critical-Path Prioritization: Chooses ready jobs by estimated remaining critical-path cost (primary),
 *    longest processing time (secondary), and stable job ID (tie-breaker).
 * 3. Resource Caps & Concurrency Boundedness: Caps concurrent heavy disk/CPU jobs without stalling ready light tasks.
 * 4. Resilient Failure Isolation: On failure, halts dependent children and terminal publication without corrupting in-flight work.
 * 5. Adaptive Telemetry Integration: Updates timing history via EWMA on successful completion.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

class DAGScheduler {
  declare rawJobs: any;
  declare timingHistory: any;
  declare concurrency: any;
  declare maxHeavy: any;
  declare processorsDir: any;
  declare buildToolsDir: any;
  declare params: any;
  declare jobMap: any;
  declare dependentsMap: any;
  declare dependenciesMap: any;

  constructor({
    jobs = [],
    timingHistory = null,
    concurrency = 8,
    maxHeavy = 2,
    processorsDir = '',
    buildToolsDir = '',
    params = {}
  } = {}) {
    this.rawJobs = JSON.parse(JSON.stringify(jobs));
    this.timingHistory = timingHistory;
    this.concurrency = Math.max(1, concurrency);
    this.maxHeavy = Math.max(1, maxHeavy);
    this.processorsDir = processorsDir;
    this.buildToolsDir = buildToolsDir;
    this.params = params; // { rawDir, projectRoot, curatedInputDir, contractPath }

    this.jobMap = new Map<any, any>();
    this.dependentsMap = new Map<any, any>(); // jobId -> Set of downstream jobIds that depend on it
    this.dependenciesMap = new Map<any, any>(); // jobId -> Set of upstream jobIds it depends on

    for (const job of this.rawJobs) {
      this.jobMap.set(job.id, job);
      this.dependentsMap.set(job.id, new Set<any>());
      this.dependenciesMap.set(job.id, new Set<any>(job.dependsOn || []));
    }

    for (const job of this.rawJobs) {
      for (const depId of job.dependsOn || []) {
        if (this.dependentsMap.has(depId)) {
          this.dependentsMap.get(depId).add(job.id);
        }
      }
    }
  }

  /**
   * Validate DAG integrity: unique IDs, valid scripts, missing dependencies, cycles, and output conflicts.
   */
  validateDAG() {
    const errors = [];
    const seenIds = new Set<any>();
    const outputOwners = new Map<any, any>();

    // 1. Structural and dependency check
    for (const job of this.rawJobs) {
      if (!job.id || typeof job.id !== 'string') {
        errors.push(`Job missing valid 'id' property`);
        continue;
      }
      if (seenIds.has(job.id)) {
        errors.push(`Duplicate job ID declared: '${job.id}'`);
      }
      seenIds.add(job.id);

      if (!job.script || typeof job.script !== 'string') {
        errors.push(`Job '${job.id}' missing valid 'script' property`);
      }

      for (const depId of job.dependsOn || []) {
        if (!this.jobMap.has(depId)) {
          errors.push(`Job '${job.id}' depends on non-existent job '${depId}'`);
        }
      }

      // Check duplicate primary output ownership (for non-directory explicit files)
      for (const prod of job.produces || []) {
        if (prod && !prod.endsWith('/') && !prod.endsWith('\\') && path.extname(prod)) {
          const norm = prod.replace(/\\/g, '/');
          if (outputOwners.has(norm)) {
            errors.push(`Duplicate primary output ownership for '${norm}' between '${outputOwners.get(norm)}' and '${job.id}'`);
          } else {
            outputOwners.set(norm, job.id);
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`DAG validation failed with ${errors.length} error(s):\n  - ${errors.join('\n  - ')}`);
    }

    // 2. Cycle detection via Kahn's algorithm
    const inDegree = new Map<any, any>();
    for (const job of this.rawJobs) {
      inDegree.set(job.id, (job.dependsOn || []).length);
    }

    const queue = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    let visitedCount = 0;
    while (queue.length > 0) {
      const u = queue.shift();
      visitedCount++;
      for (const v of this.dependentsMap.get(u) || []) {
        const nextDeg = inDegree.get(v) - 1;
        inDegree.set(v, nextDeg);
        if (nextDeg === 0) queue.push(v);
      }
    }

    if (visitedCount !== this.rawJobs.length) {
      const cycleNodes = [];
      for (const [id, deg] of inDegree.entries()) {
        if (deg > 0) cycleNodes.push(id);
      }
      throw new Error(`DAG contains a circular dependency cycle involving: ${cycleNodes.join(', ')}`);
    }

    return true;
  }

  /**
   * Compute critical path costs using reverse topological sweep.
   */
  computeCriticalPaths(customDurations = null) {
    const selfCosts = new Map<any, any>();
    for (const job of this.rawJobs) {
      let cost = 10000;
      if (customDurations && typeof customDurations[job.id] === 'number') {
        cost = customDurations[job.id];
      } else if (this.timingHistory) {
        cost = this.timingHistory.getEstimate(job.id, job.estimatedMs || 10000);
      } else if (typeof job.estimatedMs === 'number') {
        cost = job.estimatedMs;
      }
      selfCosts.set(job.id, Math.max(10, cost));
    }

    // Topological order
    const inDegree = new Map<any, any>();
    for (const job of this.rawJobs) {
      inDegree.set(job.id, (job.dependsOn || []).length);
    }
    const queue = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    const topoOrder = [];
    while (queue.length > 0) {
      const u = queue.shift();
      topoOrder.push(u);
      for (const v of this.dependentsMap.get(u) || []) {
        const nextDeg = inDegree.get(v) - 1;
        inDegree.set(v, nextDeg);
        if (nextDeg === 0) queue.push(v);
      }
    }

    // Reverse topological traversal
    const critPathCosts = new Map<any, any>();
    for (let i = topoOrder.length - 1; i >= 0; i--) {
      const id = topoOrder[i];
      const selfCost = selfCosts.get(id);
      let maxChildCrit = 0;
      for (const childId of this.dependentsMap.get(id) || []) {
        const childCrit = critPathCosts.get(childId) || 0;
        if (childCrit > maxChildCrit) {
          maxChildCrit = childCrit;
        }
      }
      critPathCosts.set(id, selfCost + maxChildCrit);
    }

    return { selfCosts, critPathCosts, topoOrder };
  }

  /**
   * Sort ready candidates deterministically:
   * 1. remainingCriticalPathCost DESC
   * 2. selfCost DESC
   * 3. id ASC (stable tie-breaker)
   */
  sortReadyCandidates(candidates, critPathCosts, selfCosts) {
    return candidates.slice().sort((a, b) => {
      const cpA = critPathCosts.get(a.id) || 0;
      const cpB = critPathCosts.get(b.id) || 0;
      if (cpB !== cpA) return cpB - cpA;

      const scA = selfCosts.get(a.id) || 0;
      const scB = selfCosts.get(b.id) || 0;
      if (scB !== scA) return scB - scA;

      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Deterministic discrete-event simulation comparing DAG vs FIFO wave makespan.
   */
  simulate({ concurrency = this.concurrency, maxHeavy = this.maxHeavy, customDurations = null } = {}) {
    this.validateDAG();
    const { selfCosts, critPathCosts } = this.computeCriticalPaths(customDurations);

    const completed = new Set<any>();
    const inFlight = new Map<any, any>(); // jobId -> finishTime
    const remainingDeps = new Map<any, any>();

    for (const job of this.rawJobs) {
      remainingDeps.set(job.id, new Set<any>(job.dependsOn || []));
    }

    let currentTime = 0;
    const timeline = [];
    let heavyInFlight = 0;

    while (completed.size < this.rawJobs.length) {
      // Find ready jobs
      const readyJobs = [];
      for (const job of this.rawJobs) {
        if (!completed.has(job.id) && !inFlight.has(job.id) && remainingDeps.get(job.id).size === 0) {
          readyJobs.push(job);
        }
      }

      // Sort ready jobs by critical-path priority
      const sortedReady = this.sortReadyCandidates(readyJobs, critPathCosts, selfCosts);

      // Launch jobs up to concurrency and maxHeavy limits
      let launchedAny = false;
      for (const job of sortedReady) {
        if (inFlight.size >= concurrency) break;
        const isHeavy = job.resourceClass === 'heavy-disk' || job.resourceClass === 'heavy-cpu';
        if (isHeavy && heavyInFlight >= maxHeavy) {
          // Skip heavy job, allow light/default jobs to fill open slots
          continue;
        }

        const duration = selfCosts.get(job.id);
        const finishTime = currentTime + duration;
        inFlight.set(job.id, finishTime);
        if (isHeavy) heavyInFlight++;
        timeline.push({
          jobId: job.id,
          resourceClass: job.resourceClass,
          startMs: currentTime,
          endMs: finishTime,
          durationMs: duration,
          critPathEstimateMs: critPathCosts.get(job.id)
        });
        launchedAny = true;
      }

      if (inFlight.size === 0 && completed.size < this.rawJobs.length) {
        throw new Error('Simulation deadlock encountered');
      }

      // Advance time to next event (earliest finishing in-flight job)
      let earliestFinish = Infinity;
      let earliestJobId = null;
      for (const [id, finishTime] of inFlight.entries()) {
        if (finishTime < earliestFinish) {
          earliestFinish = finishTime;
          earliestJobId = id;
        }
      }

      currentTime = earliestFinish;

      // Complete finished jobs at currentTime
      const finishedNow = [];
      for (const [id, finishTime] of inFlight.entries()) {
        if (finishTime <= currentTime) {
          finishedNow.push(id);
        }
      }

      for (const id of finishedNow) {
        inFlight.delete(id);
        completed.add(id);
        const job = this.jobMap.get(id);
        if (job.resourceClass === 'heavy-disk' || job.resourceClass === 'heavy-cpu') {
          heavyInFlight = Math.max(0, heavyInFlight - 1);
        }

        // Notify dependents
        for (const childId of this.dependentsMap.get(id) || []) {
          if (remainingDeps.has(childId)) {
            remainingDeps.get(childId).delete(id);
          }
        }
      }
    }

    const makespanMs = currentTime;
    return {
      makespanMs,
      makespanSec: (makespanMs / 1000).toFixed(1),
      timeline
    };
  }

  /**
   * Deterministic simulation of the legacy FIFO Wave model for accurate makespan comparison.
   */
  simulateFIFOWave({
    concurrency = this.concurrency,
    maxHeavy = this.maxHeavy,
    customDurations = null,
    wave1JobIds = [],
    wave2JobIds = []
  } = {}) {
    const { selfCosts } = this.computeCriticalPaths(customDurations);

    // If wave IDs are not explicitly specified, divide into wave 1 (independents) and wave 2 (dependents + tools)
    let w1 = wave1JobIds;
    let w2 = wave2JobIds;
    if (!w1 || w1.length === 0) {
      w1 = this.rawJobs.filter((j) => (j.dependsOn || []).length === 0).map((j) => j.id);
      w2 = this.rawJobs.filter((j) => (j.dependsOn || []).length > 0).map((j) => j.id);
    }

    let currentTime = 0;
    const timeline = [];

    // Wave 1: FIFO parallel execution of wave 1 jobs with shared queue index
    let wave1Index = 0;
    const wave1Completed = new Set<any>();
    const inFlight = new Map<any, any>();

    while (wave1Completed.size < w1.length) {
      while (inFlight.size < concurrency && wave1Index < w1.length) {
        const id = w1[wave1Index++];
        const duration = selfCosts.get(id) || 10000;
        const finishTime = currentTime + duration;
        inFlight.set(id, finishTime);
        timeline.push({ jobId: id, wave: 1, startMs: currentTime, endMs: finishTime, durationMs: duration });
      }

      let earliestFinish = Infinity;
      for (const finishTime of inFlight.values()) {
        if (finishTime < earliestFinish) earliestFinish = finishTime;
      }
      currentTime = earliestFinish;

      const finishedNow = [];
      for (const [id, finishTime] of inFlight.entries()) {
        if (finishTime <= currentTime) finishedNow.push(id);
      }
      for (const id of finishedNow) {
        inFlight.delete(id);
        wave1Completed.add(id);
      }
    }

    // Wave 2: Sequential execution of wave 2 jobs after entire wave 1 barrier finishes
    for (const id of w2) {
      const duration = selfCosts.get(id) || 5000;
      const start = currentTime;
      const finish = start + duration;
      timeline.push({ jobId: id, wave: 2, startMs: start, endMs: finish, durationMs: duration });
      currentTime = finish;
    }

    return {
      makespanMs: currentTime,
      makespanSec: (currentTime / 1000).toFixed(1),
      timeline
    };
  }

  /**
   * Resolve template arguments for a job script.
   */
  resolveJobArgs(job) {
    const rawDir = this.params.rawDir || '';
    const projectRoot = this.params.projectRoot || '';
    const curatedInputDir = this.params.curatedInputDir || '';
    const contractPath = this.params.contractPath || '';

    const args = [];
    for (const item of job.argsTemplate || []) {
      const resolved = item
        .replace(/\{rawDir\}/g, rawDir)
        .replace(/\{projectRoot\}/g, projectRoot)
        .replace(/\{curatedInputDir\}/g, curatedInputDir)
        .replace(/\{contractPath\}/g, contractPath);
      args.push(resolved);
    }
    return args;
  }

  /**
   * Execute real child process for a job.
   */
  executeProcess(job) {
    return new Promise((resolve) => {
      const scriptDir = job.type === 'tool' ? this.buildToolsDir : this.processorsDir;
      const scriptPath = path.join(scriptDir, job.script);
      const args = this.resolveJobArgs(job);
      const started = Date.now();

      const child = spawn(process.execPath, [scriptPath, ...args], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { out += d; });

      child.on('error', (err) => {
        resolve({
          job,
          code: -1,
          out: String((err && err.message) || err),
          ms: Date.now() - started
        });
      });

      child.on('close', (code) => {
        resolve({
          job,
          code,
          out,
          ms: Date.now() - started
        });
      });
    });
  }

  /**
   * Run the full DAG pipeline.
   */
  async run({ onProgress, onJobStart, onJobFinish, executor = null }: Record<string, any> = {}) {
    this.validateDAG();
    const { selfCosts, critPathCosts } = this.computeCriticalPaths();

    const totalJobs = this.rawJobs.length;
    const completed = new Set<any>();
    const failed = new Map<any, any>();
    const blocked = new Set<any>();
    const inFlight = new Map<any, any>(); // jobId -> Promise / task
    const remainingDeps = new Map<any, any>();
    const queueEntryTimes = new Map<any, any>();

    const overallStart = Date.now();
    for (const job of this.rawJobs) {
      remainingDeps.set(job.id, new Set<any>(job.dependsOn || []));
      if ((job.dependsOn || []).length === 0) {
        queueEntryTimes.set(job.id, overallStart);
      }
    }

    let heavyInFlight = 0;
    const results = new Map<any, any>();

    const getBlockedSubtree = (failedId) => {
      const blockedNodes = new Set<any>();
      const stack = [failedId];
      while (stack.length > 0) {
        const u = stack.pop();
        for (const childId of this.dependentsMap.get(u) || []) {
          if (!blockedNodes.has(childId)) {
            blockedNodes.add(childId);
            stack.push(childId);
          }
        }
      }
      return blockedNodes;
    };

    while (completed.size + failed.size + blocked.size < totalJobs) {
      // Collect ready unblocked jobs
      const readyJobs = [];
      for (const job of this.rawJobs) {
        if (!completed.has(job.id) &&
            !failed.has(job.id) &&
            !blocked.has(job.id) &&
            !inFlight.has(job.id) &&
            remainingDeps.get(job.id).size === 0) {
          readyJobs.push(job);
        }
      }

      const sortedReady = this.sortReadyCandidates(readyJobs, critPathCosts, selfCosts);

      // Launch eligible ready jobs
      for (const job of sortedReady) {
        if (inFlight.size >= this.concurrency) break;
        const isHeavy = job.resourceClass === 'heavy-disk' || job.resourceClass === 'heavy-cpu';
        if (isHeavy && heavyInFlight >= this.maxHeavy) {
          continue;
        }

        const queueWaitMs = Date.now() - (queueEntryTimes.get(job.id) || overallStart);
        if (isHeavy) heavyInFlight++;

        const taskPromise = (async () => {
          if (onJobStart) onJobStart(job, { queueWaitMs, critPathCost: critPathCosts.get(job.id) });
          const res = executor
            ? await executor(job, this)
            : await this.executeProcess(job);

          return { job, res, queueWaitMs };
        })();

        inFlight.set(job.id, taskPromise);
      }

      if (inFlight.size === 0) {
        // No active jobs and no ready jobs can launch
        break;
      }

      // Wait for any in-flight task to complete
      const raceEntries = Array.from(inFlight.entries()).map(([id, p]) =>
        p.then((result) => ({ id, ...result }))
      );

      const finished = await Promise.race(raceEntries);
      inFlight.delete(finished.id);

      const job = finished.job;
      const res = finished.res;
      const queueWaitMs = finished.queueWaitMs;
      results.set(job.id, res);

      const isHeavy = job.resourceClass === 'heavy-disk' || job.resourceClass === 'heavy-cpu';
      if (isHeavy) heavyInFlight = Math.max(0, heavyInFlight - 1);

      if (res.code === 0) {
        completed.add(job.id);
        if (this.timingHistory) {
          this.timingHistory.recordRun(job.id, {
            durationMs: res.ms,
            queueWaitMs,
            success: true
          });
        }
        // Unlock dependents
        for (const childId of this.dependentsMap.get(job.id) || []) {
          if (remainingDeps.has(childId)) {
            remainingDeps.get(childId).delete(job.id);
            if (remainingDeps.get(childId).size === 0 && !queueEntryTimes.has(childId)) {
              queueEntryTimes.set(childId, Date.now());
            }
          }
        }
      } else {
        failed.set(job.id, res);
        if (this.timingHistory) {
          this.timingHistory.recordRun(job.id, {
            durationMs: res.ms,
            queueWaitMs,
            success: false
          });
        }
        // Cascade block to all downstream dependents
        const cascading = getBlockedSubtree(job.id);
        for (const bId of cascading) {
          blocked.add(bId);
        }
      }

      if (onJobFinish) onJobFinish(job, res, { completed: completed.size, total: totalJobs, failed: failed.size });
      if (onProgress) onProgress({ completed: completed.size, total: totalJobs, failed: failed.size, inFlight: inFlight.size });
    }

    // Await any remaining in-flight jobs before terminating
    if (inFlight.size > 0) {
      const remainingTasks = Array.from(inFlight.values());
      const remainingResults = await Promise.all(remainingTasks);
      for (const fin of remainingResults) {
        const job = fin.job;
        const res = fin.res;
        results.set(job.id, res);
        if (res.code === 0) completed.add(job.id);
        else failed.set(job.id, res);
      }
    }

    const makespanMs = Date.now() - overallStart;
    return {
      success: failed.size === 0 && blocked.size === 0 && completed.size === totalJobs,
      makespanMs,
      succeededCount: completed.size,
      failedCount: failed.size,
      blockedCount: blocked.size,
      results,
      failedJobs: Array.from(failed.keys()),
      blockedJobs: Array.from(blocked.values())
    };
  }
}

export {
  DAGScheduler,
};
