'use client';

import React from 'react';
import { sanitizeError } from '@tof-hub/ui';
import { useI18n } from '@/lib/i18n';
import { pageTitle } from '@/lib/seo';
import { StatusDetails, StatusHomeAction, StatusPage, StatusReference } from './status-page';

export interface RouteErrorStateProps {
  error: Error & { digest?: string };
}

/**
 * Route-level error boundary page. The site header and footer stay rendered;
 * the server digest is the reference users can quote in a report.
 */
export function RouteErrorState({ error }: RouteErrorStateProps) {
  const { t } = useI18n();
  const sanitized = sanitizeError(error);
  const details = process.env.NODE_ENV === 'development'
    ? sanitized.stack || `${sanitized.name}: ${sanitized.message}`
    : undefined;

  return (
    <div className="shell-layout">
      <title>{pageTitle(t('common.status.error.title'))}</title>
      <StatusPage
        code={t('common.status.error.code')}
        title={t('common.status.error.title')}
        lead={t('common.status.error.lead')}
        actions={<StatusHomeAction label={t('common.status.home')} />}
        footer={details ? <StatusDetails summary={t('common.status.error.details')}>{details}</StatusDetails> : undefined}
      >
        {sanitized.digest ? (
          <StatusReference
            label={t('common.status.error.reference')}
            value={sanitized.digest}
            copyLabel={t('common.status.error.copy')}
            copiedLabel={t('common.status.error.copied')}
          />
        ) : null}
      </StatusPage>
    </div>
  );
}
