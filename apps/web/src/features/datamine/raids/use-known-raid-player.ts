'use client';

import {useEffect, useState} from 'react';
import {loadRaidPlayers} from './raid-player-cache';

type KnownRaidPlayer = {identifier: string; nickname: string; uid?: string | null};
export type KnownRaidPlayerStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Share identity lookups (keyed by role ID) between participant hovers and the player's showcase. */
export function useKnownRaidPlayer(identifier: string | undefined, enabled = true, refreshKey = 0) {
  const [result, setResult] = useState<{identifier?: string; entry: KnownRaidPlayer | null; failed: boolean}>({entry: null, failed: false});
  useEffect(() => {
    if (!identifier || !enabled) return;
    let active = true;
    void loadRaidPlayers([identifier]).then(data => {if (active) setResult({identifier, entry: data.entries.find(entry => entry.identifier === identifier) ?? null, failed: !data.available});})
      .catch(() => {if (active) setResult({identifier, entry: null, failed: true});});
    return () => {active = false;};
  }, [identifier, enabled, refreshKey]);
  // A refresh keeps the previous answer for this role ID instead of flashing back to loading.
  const settled = result.identifier === identifier;
  const status: KnownRaidPlayerStatus = !identifier || !enabled && !settled ? 'idle' : !settled ? 'loading' : result.failed && !result.entry ? 'error' : 'ready';
  return {player: settled ? result.entry : null, status};
}
