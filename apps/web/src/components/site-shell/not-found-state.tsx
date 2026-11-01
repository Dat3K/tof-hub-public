'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { pageTitle } from '@/lib/seo';
import { StatusHomeAction, StatusPage } from './status-page';

/** Route-level 404: the requested path and a single way back to the hub root. */
export function NotFoundState() {
  const pathname = usePathname() || '/';
  const { t } = useI18n();

  return (
    <div className="shell-layout">
      <title>{pageTitle(t('common.status.notFound.title'))}</title>
      <StatusPage
        code="404"
        context={pathname}
        title={t('common.status.notFound.title')}
        lead={t('common.status.notFound.lead')}
        actions={<StatusHomeAction label={t('common.status.home')} />}
      />
    </div>
  );
}
