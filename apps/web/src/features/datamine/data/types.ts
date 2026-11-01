import type { Locale } from '@tof-hub/i18n';
import type {
  FceIndexDataset,
  FceBossDetailDataset,
  OowCurrentSummaryDataset,
  OowSeasonDataset,
  BygoneDataset,
  SeqCacheDataset,
  MultypeRenamesDataset,
  DatamineItemsDataset,
} from '@tof-hub/contracts';

export type {
  FceIndexDataset,
  FceBossDetailDataset,
  OowCurrentSummaryDataset,
  OowSeasonDataset,
  BygoneDataset,
  SeqCacheDataset,
  MultypeRenamesDataset,
  DatamineItemsDataset,
};

export interface DatamineServerLoaderOptions {
  dataRoot?: string;
  throwOnNotFound?: boolean;
}
