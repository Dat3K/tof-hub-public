'use client';

import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import React, { useState, useTransition } from 'react';
import { Button } from '@tof-hub/ui';
import {
  evaluateStreak,
  runWorstCase,
  runZeroExtraDeterministic,
  runMonteCarlo,
} from '@tof-hub/game-domain';
import type {
  WishSimulationConfig,
  WishSimulationResult,
  WishStreakOutcome,
  WishMatrixSlot,
} from '@tof-hub/contracts';
import { WISH_TRANSLATIONS, type WishLocale } from '../../wish-i18n';
import { useWishMediaMap } from '../../pull-media';

type MonteCarloPercentiles = WishSimulationResult['monteCarlo']['percentiles'];

const CDF_POINTS: Array<{ pct: number; key: keyof MonteCarloPercentiles }> = [
  { pct: 1, key: 'p1' },
  { pct: 10, key: 'p10' },
  { pct: 25, key: 'p25' },
  { pct: 50, key: 'p50' },
  { pct: 75, key: 'p75' },
  { pct: 90, key: 'p90' },
  { pct: 95, key: 'p95' },
  { pct: 99, key: 'p99' },
];

/**
 * Estimates P(pulls <= budget) by linearly interpolating the Monte Carlo
 * percentile ladder. Returns a display label: exact percent inside the
 * ladder range, '< 1%' below P1, '≥ 99%' above P99.
 */
export function estimateBudgetSuccessLabel(
  budget: number,
  percentiles: MonteCarloPercentiles
): string {
  if (!Number.isFinite(budget) || budget <= 0) return '0%';
  const pulls = CDF_POINTS.map(({ pct, key }) => [pct, percentiles[key]] as [number, number]);
  if (budget < pulls[0][1]) return '< 1%';
  for (let i = 0; i < pulls.length - 1; i++) {
    const [p0, x0] = pulls[i];
    const [p1, x1] = pulls[i + 1];
    if (budget <= x1) {
      if (!(x1 > x0)) return `${Math.round(p1)}%`;
      const t = (budget - x0) / (x1 - x0);
      return `${Math.round(p0 + t * (p1 - p0))}%`;
    }
  }
  return '≥ 99%';
}

interface SimulationTabProps {
  history: {
    profileId: string;
    weapon: { currentPity: number; lastOutcomes: WishStreakOutcome[] };
    matrix: { currentPity: number; lastOutcomes: WishStreakOutcome[] };
  };
  locale: WishLocale;
}

type StreakOverride = 'history' | 'neutral_50_50' | 'forced_win' | 'forced_loss';

function getStreakHistory(override: StreakOverride, history: WishStreakOutcome[]): WishStreakOutcome[] {
  if (override === 'history') return history;
  if (override === 'forced_win') return ['loss', 'loss'];
  if (override === 'forced_loss') return ['win', 'win'];
  return ['win', 'loss'];
}

export function SimulationTab({
  history,
  locale,
}: SimulationTabProps) {
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;
  const mediaMap = useWishMediaMap();
  const [isPending, startTransition] = useTransition();

  // Form Parameters
  const [mode, setMode] = useState<'weapon' | 'matrix' | 'both'>('both');
  const [targetWeaponAdvancement, setTargetWeaponAdvancement] = useState<number>(6); // A6
  const [targetMatrixCopiesPerSlot, setTargetMatrixCopiesPerSlot] = useState<number>(4); // 3-star (4 copies per slot)
  const [currentWeaponCopies, setCurrentWeaponCopies] = useState<number>(0);
  const [currentMatrixCopies, setCurrentMatrixCopies] = useState<Record<WishMatrixSlot, number>>({
    mind: 0,
    memory: 0,
    belief: 0,
    emotion: 0,
  });
  const [currentWeaponPity, setCurrentWeaponPity] = useState<number>(
    Math.max(0, Math.min(79, history.weapon.currentPity))
  );
  const [currentMatrixPity, setCurrentMatrixPity] = useState<number>(
    Math.max(0, Math.min(39, history.matrix.currentPity))
  );
  const [weaponStreakOverride, setWeaponStreakOverride] = useState<StreakOverride>('history');
  const [matrixStreakOverride, setMatrixStreakOverride] = useState<StreakOverride>('history');
  const [initialFlameGold, setInitialFlameGold] = useState<number>(0);
  const [initialOverclockingChips, setInitialOverclockingChips] = useState<number>(0);
  const [bought50Box, setBought50Box] = useState<boolean>(false);
  const [autoBlock, setAutoBlock] = useState<boolean>(true);

  // Results State
  const [progress, setProgress] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [worstCaseResult, setWorstCaseResult] = useState<WishSimulationResult['worstCase'] | null>(null);
  const [zeroExtraResult, setZeroExtraResult] = useState<WishSimulationResult['zeroExtraDeterministic'] | null>(null);
  const [monteCarloResult, setMonteCarloResult] = useState<WishSimulationResult['monteCarlo'] | null>(null);

  const simulationPresets = [
    { id: 'c0', title: t.simPresetC0, description: t.simPresetC0Desc, mode: 'weapon', weaponAdvancement: 0, matrixCopiesPerSlot: 1 },
    { id: 'c1r0', title: t.simPresetC1R0, description: t.simPresetC1R0Desc, mode: 'both', weaponAdvancement: 1, matrixCopiesPerSlot: 1 },
    { id: 'c6r0', title: t.simPresetC6R0, description: t.simPresetC6R0Desc, mode: 'both', weaponAdvancement: 6, matrixCopiesPerSlot: 1 },
    { id: 'c6r3', title: t.simPresetC6R3, description: t.simPresetC6R3Desc, mode: 'both', weaponAdvancement: 6, matrixCopiesPerSlot: 4 },
  ] as const;
  const activePresetId = simulationPresets.find(
    (preset) => preset.mode === mode
      && preset.weaponAdvancement === targetWeaponAdvancement
      && preset.matrixCopiesPerSlot === targetMatrixCopiesPerSlot,
  )?.id;

  const workerRef = React.useRef<Worker | null>(null);

  // Clean up worker on unmount
  React.useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const historySyncKey = `${history.profileId}:${history.weapon.currentPity}:${history.weapon.lastOutcomes.join(',')}:${history.matrix.currentPity}:${history.matrix.lastOutcomes.join(',')}`;
  React.useEffect(() => {
    setCurrentWeaponPity(Math.max(0, Math.min(79, history.weapon.currentPity)));
    setCurrentMatrixPity(Math.max(0, Math.min(39, history.matrix.currentPity)));
    setWeaponStreakOverride('history');
    setMatrixStreakOverride('history');
  }, [historySyncKey, history.weapon.currentPity, history.matrix.currentPity]);

  const weaponStreakHistory = getStreakHistory(weaponStreakOverride, history.weapon.lastOutcomes);
  const matrixStreakHistory = getStreakHistory(matrixStreakOverride, history.matrix.lastOutcomes);
  const weaponStreakPrediction = evaluateStreak(weaponStreakHistory).nextPrediction;
  const matrixStreakPrediction = evaluateStreak(matrixStreakHistory).nextPrediction;
  const streakPredictionLabel = (prediction: ReturnType<typeof evaluateStreak>['nextPrediction']) => {
    if (prediction === 'forced_win') return t.simGuaranteeWin;
    if (prediction === 'forced_loss') return t.simGuaranteeLoss;
    if (prediction === 'neutral_50_50') return t.simGuaranteeNeutral;
    return t.simGuaranteeNoHistory;
  };

  // Sync state from history
  const handleSyncFromHistory = () => {
    setCurrentWeaponPity(Math.max(0, Math.min(79, history.weapon.currentPity)));
    setCurrentMatrixPity(Math.max(0, Math.min(39, history.matrix.currentPity)));
    setWeaponStreakOverride('history');
    setMatrixStreakOverride('history');
  };

  const handleCancelSimulation = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsCalculating(false);
    setProgress(0);
  };

  // Run simulation
  const handleRunSimulation = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    setIsCalculating(true);
    setProgress(0);

    const config: WishSimulationConfig = {
      mode,
      targetWeaponAdvancement,
      targetMatrixCopiesPerSlot,
      currentWeaponCopies,
      currentMatrixCopies,
      currentWeaponPity,
      currentMatrixPity,
      recentWeaponStreaks: weaponStreakHistory,
      recentMatrixStreaks: matrixStreakHistory,
      initialFlameGold,
      initialOverclockingChips,
      bought50Box: mode !== 'weapon' && bought50Box,
      blockedSlot: null,
      autoBlock: mode !== 'weapon' && autoBlock,
      srMaxed: true,
      standardSsrMaxed: true,
      trials: 10000,
    };

    // Immediate deterministic calculation
    const worst = runWorstCase(config);
    const zero = runZeroExtraDeterministic(config);
    setWorstCaseResult(worst);
    setZeroExtraResult(zero);

    // Launch 10,000 Monte Carlo runs inside dedicated Web Worker
    try {
      const worker = new Worker(new URL('../../simulation.worker.ts', import.meta.url));
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (data.type === 'progress') {
          setProgress(data.progress);
        } else if (data.type === 'done') {
          setMonteCarloResult(data.result);
          setIsCalculating(false);
          worker.terminate();
          workerRef.current = null;
        } else if (data.type === 'error') {
          console.error('Simulation worker error:', data.error);
          setIsCalculating(false);
          worker.terminate();
          workerRef.current = null;
        }
      };

      worker.onerror = (err) => {
        console.warn('Worker instantiation fallback to main thread:', err);
        try {
          const mc = runMonteCarlo(config, (p) => setProgress(p));
          setMonteCarloResult(mc);
        } finally {
          setIsCalculating(false);
          workerRef.current = null;
        }
      };

      worker.postMessage({ config });
    } catch {
      // Direct execution fallback if environment does not support new Worker()
      try {
        const mc = runMonteCarlo(config, (p) => setProgress(p));
        setMonteCarloResult(mc);
      } finally {
        setIsCalculating(false);
      }
    }
  };


  return (
    <div className="space-y-4">
      {/* Simulation Form Card */}
      <div className="rounded-[14px] border border-white/15 bg-[var(--surface-panel)] p-4 shadow-lg">
        <div className="mb-3 flex flex-col justify-between gap-2 border-b border-white/10 pb-2.5 sm:flex-row sm:items-center">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#fbbf24]" />
            {t.simTitle}
          </h3>
          <Button variant="outline" size="sm" onClick={handleSyncFromHistory}>
            {t.simSyncFromHistory}
          </Button>
        </div>
        <p className="-mt-1 mb-3 text-[11px] leading-relaxed text-slate-400">{t.simHistoryStateHint}</p>

        <section className="mb-4 rounded-xl border border-amber-300/25 bg-[#0d1119] p-3" aria-labelledby="simulation-presets-title">
          <div className="mb-2.5">
            <h4 id="simulation-presets-title" className="text-sm font-bold text-white">{t.simPresetsTitle}</h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{t.simPresetsHint}</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-4">
            {simulationPresets.map((preset) => {
              const isActive = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setMode(preset.mode);
                    setTargetWeaponAdvancement(preset.weaponAdvancement);
                    setTargetMatrixCopiesPerSlot(preset.matrixCopiesPerSlot);
                  }}
                  className={`group/preset relative min-h-[78px] overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                    isActive
                      ? 'border-amber-300/80 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),var(--surface-panel)_68%)] shadow-[inset_0_0_0_1px_rgba(252,211,77,0.08)]'
                      : 'border-white/15 bg-[var(--surface-panel)] hover:border-amber-300/45 hover:bg-[var(--surface-raised)]'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`font-mono text-sm font-black tracking-wide ${isActive ? 'text-amber-200' : 'text-slate-100'}`}>
                      {preset.title}
                    </span>
                    <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors ${isActive ? 'border-amber-200/70 bg-amber-300 text-[#17120a]' : 'border-white/20 text-transparent group-hover/preset:border-amber-200/50'}`}>
                      ✓
                    </span>
                  </span>
                  <span className={`mt-1.5 block text-[11px] leading-snug ${isActive ? 'text-amber-50/85' : 'text-slate-300'}`}>{preset.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="simulation-goal-title" className="space-y-2.5">
          <h4 id="simulation-goal-title" className="text-sm font-bold text-white">{t.simGoalSection}</h4>
          <div className="grid grid-cols-1 gap-2.5 text-xs md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block font-medium text-slate-300">{t.simTargetMode}</label>
              <div className="grid grid-cols-1 gap-1 rounded-lg border border-white/15 bg-[var(--surface-inset)] p-1 sm:grid-cols-3">
                {(['weapon', 'matrix', 'both'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className={`min-h-10 rounded-md px-3 py-2 text-center font-bold transition-colors ${
                      mode === m ? 'bg-amber-300 text-[#0b0d13] shadow-sm' : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    {m === 'weapon' ? t.simTargetWeapon : m === 'matrix' ? t.simTargetMatrix : t.simTargetBoth}
                  </button>
                ))}
              </div>
            </div>

            {mode !== 'matrix' && (
              <div className="rounded-lg border border-white/15 bg-[var(--surface-panel)] p-2.5">
                <label className="mb-1.5 block font-medium text-slate-300" htmlFor="sim-target-weapon">{t.simWeaponAdv}</label>
                <select
                  id="sim-target-weapon"
                  value={targetWeaponAdvancement}
                  onChange={(e) => setTargetWeaponAdvancement(Number(e.target.value))}
                  className="min-h-10 w-full rounded-md border border-white/15 bg-[var(--surface-inset)] px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  {Array.from({ length: 7 }, (_, rank) => (
                    <option key={rank} value={rank}>
                      {rank}★
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{t.simWeaponTargetHint}</p>
              </div>
            )}

            {mode !== 'weapon' && (
              <div className="rounded-lg border border-white/15 bg-[var(--surface-panel)] p-2.5">
                <label className="mb-1.5 block font-medium text-slate-300" htmlFor="sim-target-matrix">{t.simMatrixAdv}</label>
                <select
                  id="sim-target-matrix"
                  value={targetMatrixCopiesPerSlot}
                  onChange={(e) => setTargetMatrixCopiesPerSlot(Number(e.target.value))}
                  className="min-h-10 w-full rounded-md border border-white/15 bg-[var(--surface-inset)] px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  {Array.from({ length: 4 }, (_, rank) => (
                    <option key={rank} value={rank + 1}>
                      R{rank} · {t.simMatrixRoundLabels[rank]}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{t.simMatrixTargetHint}</p>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="simulation-start-title" className="mt-4 border-t border-white/10 pt-3">
          <h4 id="simulation-start-title" className="mb-2.5 text-sm font-bold text-white">{t.simStartingSection}</h4>
          <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {mode !== 'matrix' && (
              <label className="rounded-lg border border-white/15 bg-[var(--surface-panel)] p-2.5">
                <span className="mb-1.5 block font-medium text-slate-200">{t.simCurrentPity} · {t.simWeaponPityRange}</span>
                <input
                  type="number" min={0} max={79} value={currentWeaponPity}
                  onChange={(e) => setCurrentWeaponPity(Math.max(0, Math.min(79, Number(e.target.value))))}
                  className="min-h-10 w-full rounded-md border border-white/15 bg-[var(--surface-inset)] px-3 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                />
              </label>
            )}
            {mode !== 'matrix' && (
              <div className="rounded-lg border border-white/15 bg-[var(--surface-panel)] p-2.5">
                <label className="mb-1.5 block font-medium text-slate-200" htmlFor="sim-weapon-guarantee">{t.simWeaponNextOutcome}</label>
                <select
                  id="sim-weapon-guarantee"
                  value={weaponStreakOverride}
                  onChange={(event) => setWeaponStreakOverride(event.target.value as StreakOverride)}
                  className="min-h-10 w-full rounded-md border border-white/15 bg-[var(--surface-inset)] px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  <option value="history">{t.simUseHistory} · {streakPredictionLabel(evaluateStreak(history.weapon.lastOutcomes).nextPrediction)}</option>
                  <option value="neutral_50_50">{t.simGuaranteeNeutral}</option>
                  <option value="forced_win">{t.simGuaranteeWin}</option>
                  <option value="forced_loss">{t.simGuaranteeLoss}</option>
                </select>
              </div>
            )}
            {mode !== 'weapon' && (
              <label className="rounded-lg border border-white/15 bg-[var(--surface-panel)] p-2.5">
                <span className="mb-1.5 block font-medium text-slate-200">{t.simCurrentPity} · {t.simMatrixPityRange}</span>
                <input
                  type="number" min={0} max={39} value={currentMatrixPity}
                  onChange={(e) => setCurrentMatrixPity(Math.max(0, Math.min(39, Number(e.target.value))))}
                  className="min-h-10 w-full rounded-md border border-white/15 bg-[var(--surface-inset)] px-3 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                />
              </label>
            )}
            {mode !== 'weapon' && (
              <div className="rounded-lg border border-white/15 bg-[var(--surface-panel)] p-2.5">
                <label className="mb-1.5 block font-medium text-slate-200" htmlFor="sim-matrix-guarantee">{t.simMatrixNextOutcome}</label>
                <select
                  id="sim-matrix-guarantee"
                  value={matrixStreakOverride}
                  onChange={(event) => setMatrixStreakOverride(event.target.value as StreakOverride)}
                  className="min-h-10 w-full rounded-md border border-white/15 bg-[var(--surface-inset)] px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  <option value="history">{t.simUseHistory} · {streakPredictionLabel(evaluateStreak(history.matrix.lastOutcomes).nextPrediction)}</option>
                  <option value="neutral_50_50">{t.simGuaranteeNeutral}</option>
                  <option value="forced_win">{t.simGuaranteeWin}</option>
                  <option value="forced_loss">{t.simGuaranteeLoss}</option>
                </select>
              </div>
            )}
            {mode !== 'matrix' && (
              <label className="rounded-lg border border-white/15 bg-[var(--surface-panel)] p-2.5">
                <span className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-200">
                  {t.simInitialCashback} ·
                  {mediaMap?.byKey.flame_gold?.image ? (
                    <img src={mediaMap.byKey.flame_gold.image} alt="" title={t.simFlameGoldStart} className="h-4 w-4 object-contain" />
                  ) : t.simFlameGoldStart}
                </span>
                <input
                  type="number" min={0} value={initialFlameGold}
                  onChange={(e) => setInitialFlameGold(Math.max(0, Number(e.target.value)))}
                  className="min-h-10 w-full rounded-md border border-white/15 bg-[var(--surface-inset)] px-3 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                />
              </label>
            )}
            {mode !== 'weapon' && (
              <label className="rounded-lg border border-white/15 bg-[var(--surface-panel)] p-2.5">
                <span className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-200">
                  {t.simInitialCashback} ·
                  {mediaMap?.byKey.overclocking_chip?.image ? (
                    <img src={mediaMap.byKey.overclocking_chip.image} alt="" title={t.simChipsStart} className="h-4 w-4 object-contain" />
                  ) : t.simChipsStart}
                </span>
                <input
                  type="number" min={0} value={initialOverclockingChips}
                  onChange={(e) => setInitialOverclockingChips(Math.max(0, Number(e.target.value)))}
                  className="min-h-10 w-full rounded-md border border-white/15 bg-[var(--surface-inset)] px-3 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                />
              </label>
            )}
          </div>
        </section>

        {/* Matrix-only options */}
        {mode !== 'weapon' && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
          <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${bought50Box ? 'border-amber-300/35 bg-amber-300/[0.08] text-slate-100' : 'border-white/15 bg-[var(--surface-panel)] text-slate-300 hover:border-amber-300/30 hover:bg-[var(--surface-raised)]'}`}>
            <input
              type="checkbox"
              checked={bought50Box}
              onChange={(e) => setBought50Box(e.target.checked)}
              className="peer sr-only"
            />
            <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--surface-panel)] ${bought50Box ? 'border-amber-200 bg-amber-300 text-[#17120a]' : 'border-white/35 bg-[var(--surface-inset)] text-transparent'}`}>
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none"><path d="m3 8 3.1 3.1L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span>{t.simBox50Purchased}</span>
          </label>

          <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${autoBlock ? 'border-amber-300/35 bg-amber-300/[0.08] text-slate-100' : 'border-white/15 bg-[var(--surface-panel)] text-slate-300 hover:border-amber-300/30 hover:bg-[var(--surface-raised)]'}`}>
            <input
              type="checkbox"
              checked={autoBlock}
              onChange={(e) => setAutoBlock(e.target.checked)}
              className="peer sr-only"
            />
            <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--surface-panel)] ${autoBlock ? 'border-amber-200 bg-amber-300 text-[#17120a]' : 'border-white/35 bg-[var(--surface-inset)] text-transparent'}`}>
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none"><path d="m3 8 3.1 3.1L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span>{t.simAutoBlock}</span>
          </label>
          </div>
        )}

        {/* Submit and Cancel buttons */}
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleRunSimulation}
            disabled={isCalculating}
          >
            {isCalculating ? `${t.simCalculating} (${progress}%)` : t.simRunBtn}
          </Button>

          {isCalculating && (
            <Button
              variant="outline"
              onClick={handleCancelSimulation}
              className="text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
            >
              {localeText(locale)('Cancel', 'Отмена')}
            </Button>
          )}
        </div>

      </div>

      {/* Results Section */}
      {(monteCarloResult || zeroExtraResult || worstCaseResult) && (
        <div className="space-y-6">
          {/* Monte Carlo Results */}
          {monteCarloResult && (
            <div className="p-5 rounded-[14px] bg-[var(--surface-panel)] border border-[#fbbf24]/25">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#fbbf24]" />
                {t.simMonteCarloTitle}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3.5">
                  <span className="text-[11px] leading-snug text-[#aeb5c1]">{t.simAvgPulls}</span>
                  <span className="font-mono text-[28px] font-bold leading-none text-white tabular-nums">
                    {Math.round(monteCarloResult.meanPulls)}
                  </span>
                </div>

                <div className="flex flex-col justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3.5">
                  <span className="text-[11px] leading-snug text-[#aeb5c1]">{t.simMedianPulls}</span>
                  <span className="font-mono text-[28px] font-bold leading-none text-[#fbbf24] tabular-nums">
                    {monteCarloResult.medianPulls}
                  </span>
                </div>

                <div className="flex flex-col justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3.5">
                  <span className="text-[11px] leading-snug text-[#aeb5c1]">{t.simP90Pulls}</span>
                  <span className="font-mono text-[28px] font-bold leading-none text-[#fbbf24] tabular-nums">
                    {monteCarloResult.percentiles.p90}
                  </span>
                </div>

              </div>

              {/* Full Percentiles Spectrum Ladder */}
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] mb-2 gap-1">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    {t.simPercentilesLadder}
                  </span>
                  <span className="text-[#9ca3af]">
                    {t.simPercentilesLadderSubtitle}
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center font-mono">
                  <div className="p-2 rounded bg-[var(--surface-inset)] border border-[#10b981]/30">
                    <span className="text-[10px] text-[#10b981] font-bold block">{t.simPercentileLabels[0]}</span>
                    <span className="text-sm font-black text-white">{monteCarloResult.percentiles.p1}</span>
                  </div>
                  <div className="p-2 rounded bg-[var(--surface-inset)] border border-white/15">
                    <span className="text-[10px] text-[#9ca3af] block">{t.simPercentileLabels[1]}</span>
                    <span className="text-sm font-bold text-white">{monteCarloResult.percentiles.p10}</span>
                  </div>
                  <div className="p-2 rounded bg-[var(--surface-inset)] border border-[#34d399]/30">
                    <span className="text-[10px] text-[#34d399] font-bold block">{t.simPercentileLabels[2]}</span>
                    <span className="text-sm font-bold text-white">{monteCarloResult.percentiles.p25}</span>
                  </div>
                  <div className="p-2 rounded bg-[var(--surface-inset)] border border-[#fbbf24]/40 bg-[#fbbf24]/5">
                    <span className="text-[10px] text-[#fbbf24] font-bold block">{t.simPercentileLabels[3]}</span>
                    <span className="text-sm font-black text-[#fbbf24]">{monteCarloResult.percentiles.p50}</span>
                  </div>
                  <div className="p-2 rounded bg-[var(--surface-inset)] border border-white/15">
                    <span className="text-[10px] text-[#9ca3af] block">{t.simPercentileLabels[4]}</span>
                    <span className="text-sm font-bold text-white">{monteCarloResult.percentiles.p75}</span>
                  </div>
                  <div className="p-2 rounded bg-[var(--surface-inset)] border border-white/15">
                    <span className="text-[10px] text-[#fbbf24] block">{t.simPercentileLabels[5]}</span>
                    <span className="text-sm font-bold text-white">{monteCarloResult.percentiles.p90}</span>
                  </div>
                  <div className="p-2 rounded bg-[var(--surface-inset)] border border-[#f97316]/30">
                    <span className="text-[10px] text-[#f97316] font-bold block">{t.simPercentileLabels[6]}</span>
                    <span className="text-sm font-bold text-white">{monteCarloResult.percentiles.p95}</span>
                  </div>
                  <div className="p-2 rounded bg-[var(--surface-inset)] border border-[#ef4444]/40 bg-[#ef4444]/5">
                    <span className="text-[10px] text-[#ef4444] font-bold block">{t.simPercentileLabels[7]}</span>
                    <span className="text-sm font-black text-red-400">{monteCarloResult.percentiles.p99}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Zero-Extra & Worst-Case Deterministic Scenarios */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Zero-Extra (Only 80/40) */}
            {zeroExtraResult && (
              <div className="p-5 rounded-[14px] bg-[var(--surface-panel)] border border-white/10 shadow-lg">
                <h4 className="text-sm font-bold text-white mb-2 pb-2 border-b border-white/5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#a855f7]" />
                  {t.simZeroExtraTitle}
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center p-2 rounded bg-[var(--surface-inset)]">
                    <span className="text-[#9ca3af]">{t.kpiPulls}:</span>
                    <span className="font-mono font-bold text-white text-base">
                      {zeroExtraResult.totalPulls}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-[var(--surface-inset)]">
                    <span className="text-[#9ca3af]">{localeText(locale)('Weapon Pulls:', 'Крутки оружия:')}</span>
                    <span className="font-mono font-bold text-[#fbbf24]">
                      {zeroExtraResult.weaponPulls}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-[var(--surface-inset)]">
                    <span className="text-[#9ca3af]">{localeText(locale)('Matrix Pulls:')}</span>
                    <span className="font-mono font-bold text-[#c084fc]">
                      {zeroExtraResult.matrixPulls}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Worst-Case Permissible */}
            {worstCaseResult && (
              <div className="p-5 rounded-[14px] bg-[var(--surface-panel)] border border-white/10 shadow-lg">
                <h4 className="text-sm font-bold text-white mb-2 pb-2 border-b border-white/5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                  {t.simWorstCaseTitle}
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center p-2 rounded bg-[var(--surface-inset)]">
                    <span className="text-[#9ca3af]">{localeText(locale)('Max Bounded Pulls:', 'Максимум круток (Worst-Case):')}</span>
                    <span className="font-mono font-black text-red-400 text-base">
                      {worstCaseResult.totalPulls}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-[var(--surface-inset)]">
                    <span className="text-[#9ca3af]">{localeText(locale)('Weapon Bound:', 'Потолок оружия:')}</span>
                    <span className="font-mono font-bold text-[#fbbf24]">
                      {worstCaseResult.weaponPulls}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-[var(--surface-inset)]">
                    <span className="text-[#9ca3af]">{localeText(locale)('Matrix Bound:', 'Потолок матриц:')}</span>
                    <span className="font-mono font-bold text-[#c084fc]">
                      {worstCaseResult.matrixPulls}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-[var(--surface-inset)] text-[11px] text-[#9ca3af] leading-relaxed">
                    {localeText(locale)('Bounds account for two-loss streak forced win rule, store redemptions, and single slot blocking.', 'Ограничение учитывает правило двух поражений (L-L -> W), покупку копий в магазине и блокировку одного слота.')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
