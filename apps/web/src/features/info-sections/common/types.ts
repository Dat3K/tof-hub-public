import type { ReactNode } from 'react';
import type { Locale } from '@tof-hub/i18n';

export interface BaseCatalogViewProps<T> {
  initialData?: T | null;
  initialLocale?: Locale;
}

export interface LightboxState {
  isOpen: boolean;
  src: string;
  webpSrc?: string;
  caption: string;
  alt?: string;
}
