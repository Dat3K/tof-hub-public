import type {
  VersionStatusState,
  SiteVersionStatus,
  LiveGlobalVersion,
  ReleaseManifest,
  VersionSource,
} from '@tof-hub/contracts';
import type { Locale } from '@tof-hub/i18n';

export type {
  VersionStatusState,
  SiteVersionStatus,
  LiveGlobalVersion,
  ReleaseManifest,
  VersionSource,
};

export interface VersionStatusLabels {
  version: string;
  versionUnavailable: string;
  loading: string;
  snapshot: string;
  tooltipTitle: string;
  updated: string;
  sources: string;
  global: string;
  updateAvailable: string;
  updateNotice: (version: string) => string;
  updateHelpText: string;
  howToHelp: string;
  howToHelpHref: string;
}

export interface SiteVersionStatusData extends Omit<SiteVersionStatus, 'formattedExportDate' | 'sourceBranch'> {
  formattedExportDate: Record<Locale, string>;
  sourceBranch: Record<Locale, string>;
  labels: Record<Locale, VersionStatusLabels>;
}
