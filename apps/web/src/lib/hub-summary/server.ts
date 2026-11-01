import { loadServerGameData } from '@/lib/game-data-server';
import type { HubSummary } from './types';

/** Pipeline-generated hub summary; null when the data root has none yet (cards then show no preview). */
export function loadHubSummary(): Promise<HubSummary | null> {
  return loadServerGameData<HubSummary | null>('', 'hub-summary', { throwOnNotFound: false });
}
