'use client';

import { useGameData } from '@/lib/game-data-client';
import type { UseGameDataOptions, UseGameDataReturn } from '@/lib/game-data-client';
import type {
  FceIndexDataset,
  OowCurrentSummaryDataset,
  BygoneDataset,
  SeqCacheDataset,
  MultypeRenamesDataset,
  DatamineItemsDataset,
} from '@tof-hub/contracts';

/**
 * Client Hook: FCE Boss Mechanics Catalog
 */
export function useFceIndexData(
  options?: UseGameDataOptions
): UseGameDataReturn<FceIndexDataset> {
  return useGameData<FceIndexDataset>('fce', options);
}

/**
 * Client Hook: Origin of War Summary & Active Seasons
 */
export function useOowSummaryData(
  options?: UseGameDataOptions
): UseGameDataReturn<OowCurrentSummaryDataset> {
  return useGameData<OowCurrentSummaryDataset>('oow', options);
}

/**
 * Client Hook: Bygone Phantasm (Floors 1-600)
 */
export function useBygoneData(
  options?: UseGameDataOptions
): UseGameDataReturn<BygoneDataset> {
  return useGameData<BygoneDataset>('bygone', options);
}

/**
 * Client Hook: Sequential Phantasm (Stages 1-35)
 */
export function useSeqCacheData(
  options?: UseGameDataOptions
): UseGameDataReturn<SeqCacheDataset> {
  return useGameData<SeqCacheDataset>('seq', options);
}

/**
 * Client Hook: Multi-type Multipliers Taxonomy
 */
export function useMultypeData(
  options?: UseGameDataOptions
): UseGameDataReturn<MultypeRenamesDataset> {
  return useGameData<MultypeRenamesDataset>('multype', options);
}

/**
 * Client Hook: Datamine Items Catalog
 */
export function useDatamineItemsData(
  options?: UseGameDataOptions
): UseGameDataReturn<DatamineItemsDataset> {
  return useGameData<DatamineItemsDataset>('items', options);
}
