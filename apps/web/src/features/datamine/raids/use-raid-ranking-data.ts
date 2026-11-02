'use client';

import {useEffect, useMemo, useState} from 'react';
import {RaidRankingDatasetSchema} from '@tof-hub/contracts';
import type {RaidRankingDataset} from '@tof-hub/game-domain';
import {fetchGameData, gameDataCache} from '@/lib/game-data-client';
import {runtimeDetailPath} from '@/lib/game-data-runtime';

const boardSchema = RaidRankingDatasetSchema.shape.boards.element;
type Board = RaidRankingDataset['boards'][number];
const needsDetail = (board: Board) => runtimeDetailPath(board) && board.entries.length !== board.entryCount;
function validateBoard(board: Board, value: unknown): Board {
  const detail = boardSchema.parse(value);
  if (detail.id !== board.id || detail.seasonId !== board.seasonId || detail.sourceId !== board.sourceId || detail.entries.length !== board.entryCount) {
    throw new Error('Raid observation does not match its index');
  }
  return detail;
}

/** Only the chosen observations leave static storage; shared browser promises deduplicate their immutable paths. */
export function useRaidRankingData(index: RaidRankingDataset | null, boardIds: string[], enabled = true) {
  const selection = JSON.stringify([...new Set(boardIds)].sort());
  const wanted = useMemo(() => {
    const ids = new Set<string>(JSON.parse(selection));
    return (index?.boards ?? []).filter(board => ids.has(board.id));
  }, [index, selection]);
  // History navigation may supply a fresh index object for already-loaded boards.
  // Restore those synchronously, avoiding a loading flash that would destroy list/scroll state.
  const prepared = useMemo(() => wanted.map(board => {
    if (!needsDetail(board)) return board;
    const cached = gameDataCache.getResolved<unknown>('handbook', runtimeDetailPath(board)!);
    if (cached === undefined) return board;
    try {return validateBoard(board,cached);} catch {return board;}
  }), [wanted]);
  const pending = useMemo(() => prepared.filter(needsDetail), [prepared]);
  const key = JSON.stringify(pending.map(board => [board.id, board._detail]));
  const [state, setState] = useState<{index: RaidRankingDataset | null; key: string; boards: RaidRankingDataset['boards']; error?: Error}>({index: null, key: '', boards: []});
  const settled = state.index === index && state.key === key;

  useEffect(() => {
    if (!enabled || !pending.length) return;
    let active = true, failed = false, cursor = 0;
    const loaded = new Map<string, RaidRankingDataset['boards'][number]>();
    const worker = async () => {
      while (active && !failed && cursor < pending.length) {
        const board = pending[cursor++]!;
        try {
          const detail = validateBoard(board,await fetchGameData<unknown>('handbook', runtimeDetailPath(board)!));
          loaded.set(board.id, detail);
        } catch (error) { failed = true; throw error; }
      }
    };
    void Promise.all(Array.from({length: Math.min(4, pending.length)}, worker)).then(() => {
      if (active) setState({index, key, boards: prepared.map(board => loaded.get(board.id) ?? board)});
    }).catch((error: unknown) => {
      if (active) setState({index, key, boards: [], error: error instanceof Error ? error : new Error(String(error))});
    });
    return () => {active = false;};
  }, [enabled, index, key, pending, prepared]);

  const data = useMemo(() => index && enabled ? {...index, boards: settled && pending.length ? state.boards : prepared} : index,
    [index, enabled, settled, pending.length, state.boards, prepared]);
  return {data, isLoading: enabled && pending.length > 0 && !settled, error: enabled && settled ? state.error : undefined};
}
