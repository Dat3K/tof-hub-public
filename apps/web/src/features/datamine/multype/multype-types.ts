import type { MultypeRenamesDataset } from '@tof-hub/contracts';

export type MultypeMode = 'renamed' | 'combined' | 'datamined' | 'ai-guess';
export type MultypeRenameFilter = 'all' | 'renamed' | 'unrenamed';
export type MultypeElementFilter =
  | 'all'
  | 'final'
  | 'fire'
  | 'ice'
  | 'volt'
  | 'phys'
  | 'super';
export type MultypePalette = 'light' | 'dark';

export interface MultypeValueItem {
  primaryValueKey: string;
  allValueKeys: string[];
  valueBaseKey: string;
  canonicalValueBaseKey: string;
  hasRename: boolean;
  displayLabel: string;
  originalLabel: string;
  renameLabel: string;
  manualRenameLabels: string[];
  renameSource: 'exact' | 'group' | '';
  tooltipTitle: string;
  tooltipLines: string[];
  isDeduped: boolean;
  aiGuessLabel: string;
  aiGuessConfidence: number | null;
  aiGuessEvidence: string[];
  aiGuessSuitName?: string;
}

export interface MultypeSubColumnSurface {
  accent: string;
  accentSoft: string;
  accentLine: string;
  accentWash: string;
  accentPanel: string;
  accentInk: string;
}

export interface MultypeSubColumn {
  subKey: string;
  subRenameKey: string;
  displayLabel: string;
  surface: MultypeSubColumnSurface;
  values: MultypeValueItem[];
}

export interface MultypeMainGroup {
  mainKey: string;
  displayLabel: string;
  accent: string;
  accentSoft: string;
  accentLine: string;
  accentWash: string;
  accentPanel: string;
  accentInk: string;
  subColumns: MultypeSubColumn[];
}

export interface MultypeViewModel {
  groups: MultypeMainGroup[];
  totalGroups: number;
  totalVisibleSubs: number;
  totalVisibleValues: number;
  mainOptions: string[];
  subOptions: string[];
}

export interface MultypeGlobalStats {
  totalCategories: number;
  totalSubcategories: number;
  totalBuffs: number;
  renamedMainCount: number;
  renamedSubCount: number;
  renamedValueCount: number;
}

export interface MultypeFilterState {
  mode: MultypeMode;
  search: string;
  mainFilter: string;
  subFilter: string;
  renameFilter: MultypeRenameFilter;
  elementFilter: MultypeElementFilter;
  palette: MultypePalette;
  scale: number;
}

export interface MultypeViewProps {
  initialData?: MultypeRenamesDataset | null;
  initialLocale?: string;
  initialMode?: MultypeMode;
  initialSearch?: string | null;
  initialMainFilter?: string | null;
  initialSubFilter?: string | null;
  initialRenameFilter?: MultypeRenameFilter | null;
  initialElementFilter?: MultypeElementFilter | null;
  initialPalette?: MultypePalette | null;
}

