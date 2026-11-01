'use client';

import { useGameData } from './use-game-data';
import type { UseGameDataOptions, UseGameDataReturn } from './types';
import type {
  SimulacraDataset,
  MatricesDataset,
  RelicsDataset,
  PetsDataset,
  CosmeticsDataset,
  ArtworksDataset,
  FceIndexDataset,
  OowCurrentSummaryDataset,
  BygoneDataset,
  SeqCacheDataset,
  MultypeRenamesDataset,
  DatamineItemsDataset,
} from '@tof-hub/contracts';

export function useSimulacraData(
  options?: UseGameDataOptions
): UseGameDataReturn<SimulacraDataset> {
  return useGameData<SimulacraDataset>('simulacra', options);
}

export function useMatricesData(
  options?: UseGameDataOptions
): UseGameDataReturn<MatricesDataset> {
  return useGameData<MatricesDataset>('matrices', options);
}

export function useRelicsData(
  options?: UseGameDataOptions
): UseGameDataReturn<RelicsDataset> {
  return useGameData<RelicsDataset>('relics', options);
}

export function usePetsData(
  options?: UseGameDataOptions
): UseGameDataReturn<PetsDataset> {
  return useGameData<PetsDataset>('pets', options);
}

export function useFoodData(
  options?: UseGameDataOptions
): UseGameDataReturn<any> {
  return useGameData<any>('food', options);
}

export function useFoodMmoData(
  options?: UseGameDataOptions
): UseGameDataReturn<any> {
  return useGameData<any>('food-mmo', options);
}

export function useCosmeticsData(
  options?: UseGameDataOptions
): UseGameDataReturn<CosmeticsDataset> {
  return useGameData<CosmeticsDataset>('cosmetics', options);
}

export function useArtsData(
  options?: UseGameDataOptions
): UseGameDataReturn<ArtworksDataset> {
  return useGameData<ArtworksDataset>('arts', options);
}

export function useFceData(
  options?: UseGameDataOptions
): UseGameDataReturn<FceIndexDataset> {
  return useGameData<FceIndexDataset>('fce', options);
}

export function useOowData(
  options?: UseGameDataOptions
): UseGameDataReturn<OowCurrentSummaryDataset> {
  return useGameData<OowCurrentSummaryDataset>('oow', options);
}

export function useBygoneData(
  options?: UseGameDataOptions
): UseGameDataReturn<BygoneDataset> {
  return useGameData<BygoneDataset>('bygone', options);
}

export function useSeqData(
  options?: UseGameDataOptions
): UseGameDataReturn<SeqCacheDataset> {
  return useGameData<SeqCacheDataset>('seq', options);
}

export function useMultypeData(
  options?: UseGameDataOptions
): UseGameDataReturn<MultypeRenamesDataset> {
  return useGameData<MultypeRenamesDataset>('multype', options);
}

export function useDatamineItemsData(
  options?: UseGameDataOptions
): UseGameDataReturn<DatamineItemsDataset> {
  return useGameData<DatamineItemsDataset>('items', options);
}

