'use client';

import React, { useEffect } from 'react';
import {
  LoadingState,
  LoadingStateProps,
} from './loading-state';
import {
  ErrorState,
  ErrorStateProps,
} from './error-state';
import { logSanitizedError, sanitizeError } from '@tof-hub/ui';
import { localizeUiCopy } from '@tof-hub/i18n';
import { useI18n } from '@/lib/i18n';
import { localeText } from '@/lib/i18n/text';
import type { SiteSection } from './site-header';

export interface SectionLoadingProps extends Omit<LoadingStateProps, 'message'> {
  /** Target section identifier */
  section?: SiteSection;
  /** Custom heading or section display name */
  title?: string;
  /** Primary loading message override */
  message?: string;
}

export interface SectionErrorProps extends Omit<ErrorStateProps, 'onRetry'> {
  /** Target section identifier */
  section?: SiteSection;
  /** Next.js Error object */
  error?: Error & { digest?: string };
  /** Next.js error boundary reset callback */
  reset?: () => void;
  /** Whether to log the error immediately upon mount (default: true) */
  autoLog?: boolean;
}

const SECTION_LOADING_METADATA: Record<
  string,
  { title: string; message: string; submessage: string }
> = {
  info: {
    title: 'Encyclopedia',
    message: 'Loading Simulacra & Equipment Archive...',
    submessage: 'Syncing character dossiers, matrices, relics, and fashion catalog',
  },
  datamine: {
    title: 'Datamine Archive',
    message: 'Loading Raw Game Tables & Telemetry...',
    submessage: 'Parsing bygone floors, sequential phantasm, and OOW parameters',
  },
  tools: {
    title: 'Squad & Raid Comp',
    message: 'Initializing Composition Engine...',
    submessage: 'Loading resonance calculations and damage simulators',
  },
  main: {
    title: 'Tower of Fantasy Hub',
    message: 'Loading Hub Records...',
    submessage: 'Preparing portal cards and navigation directory',
  },
};

const SECTION_ERROR_METADATA: Record<
  string,
  { homeHref: string; homeLabel: string; title: string }
> = {
  info: {
    homeHref: '/info',
    homeLabel: 'Return to Info Hub',
    title: 'Encyclopedia Section Anomaly',
  },
  datamine: {
    homeHref: '/datamine',
    homeLabel: 'Return to Datamine Archive',
    title: 'Datamine Section Anomaly',
  },
  tools: {
    homeHref: '/tools/comp',
    homeLabel: 'Return to Squad Comp',
    title: 'Tools Engine Anomaly',
  },
  main: {
    homeHref: '/',
    homeLabel: 'Return to Root Hub',
    title: 'System Anomaly Detected',
  },
};

/**
 * Section-level loading boundary component.
 * Used by section loading boundaries (e.g. apps/web/src/app/info/loading.tsx and apps/web/src/app/datamine/loading.tsx).
 */
export function SectionLoadingState({
  section = 'main',
  title,
  message,
  submessage,
  variant = 'spinner',
  fullPage = true,
  className = '',
  ...rest
}: SectionLoadingProps) {
  const { locale } = useI18n();
  const t = localeText(locale);
  const meta = localizeUiCopy(SECTION_LOADING_METADATA[section] || SECTION_LOADING_METADATA.main, locale);
  return <LoadingState message={localizeUiCopy(message || meta.message, locale)} submessage={localizeUiCopy(submessage || meta.submessage, locale)}
    variant={variant} fullPage={fullPage} className={className} {...rest} />;

}

/**
 * Section-level error boundary component.
 * Used by section error boundaries (e.g. apps/web/src/app/info/error.tsx and apps/web/src/app/datamine/error.tsx).
 * Automatically logs sanitized errors without credential leaks and provides section-aware recovery links.
 */
export function SectionErrorState({
  section = 'main',
  error,
  reset,
  title,
  message,
  homeHref,
  homeLabel,
  autoLog = true,
  className = '',
  ...rest
}: SectionErrorProps) {
  const { locale } = useI18n();
  const t = localeText(locale);
  const meta = localizeUiCopy(SECTION_ERROR_METADATA[section] || SECTION_ERROR_METADATA.main, locale);
  const displayTitle = localizeUiCopy(title || meta.title, locale);
  const displayHomeHref = homeHref || meta.homeHref;
  const displayHomeLabel = localizeUiCopy(homeLabel || meta.homeLabel, locale);

  // Automatically log sanitized error to console / telemetry on mount
  useEffect(() => {
    if (autoLog && error) {
      logSanitizedError(`SectionError:${section}`, error);
    }
  }, [autoLog, error, section]);

  const sanitized = error ? sanitizeError(error) : undefined;
  // Raw messages and stacks are developer detail; production shows only copy and the digest (as RouteErrorState).
  const isDev = process.env.NODE_ENV === 'development';
  const displayMessage =
    (message ? localizeUiCopy(message, locale) : undefined) ||
    (isDev ? sanitized?.message : undefined) ||
    localizeUiCopy('An unexpected error occurred while rendering this section. You may retry or return to the section hub.', locale);

  return (
    <div className={`w-full py-6 px-4 ${className}`}>
      {/* Section indicator */}
      <div className="flex justify-center mb-4">
        <span className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-negative/10 border border-negative/30 text-negative">
          {t('Section error')} // {section.toUpperCase()}
        </span>
      </div>

      <ErrorState
        title={displayTitle}
        message={displayMessage}
        digest={sanitized?.digest}
        onRetry={reset}
        retryLabel={t('Try Again')}
        homeHref={displayHomeHref}
        homeLabel={displayHomeLabel}
        secondaryAction={
          section !== 'main'
            ? {
                label: t('Return to Root Hub'),
                href: '/',
              }
            : undefined
        }
        details={isDev ? sanitized?.stack : undefined}
        {...rest}
      />
    </div>
  );
}
