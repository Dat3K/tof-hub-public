import { runMonteCarlo } from '@tof-hub/game-domain';
import type { WishSimulationConfig } from '@tof-hub/contracts';

self.onmessage = (e: MessageEvent<{ config: WishSimulationConfig }>) => {
  const { config } = e.data;

  try {
    const result = runMonteCarlo(config, (progress) => {
      self.postMessage({ type: 'progress', progress });
    });

    self.postMessage({ type: 'done', result });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', error: errorMessage });
  }
};
