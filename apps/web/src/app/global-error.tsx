'use client';

import React, { useEffect, useState } from 'react';
import './globals.css';
import { logSanitizedError, sanitizeError } from '@tof-hub/ui';
import { DEFAULT_LOCALE, resources, type Locale } from '@tof-hub/i18n';
import { readClientCookieLocale } from '@/lib/i18n/cookie';
import { reportBrowserError } from '@/lib/report-browser-error';
import { pageTitle } from '@/lib/seo';
import { StatusHomeAction, StatusPage, StatusReference } from '@/components/site-shell/status-page';

/** Replaces the root layout when it fails, so it renders without the I18n provider or site shell. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => {
    setLocale(readClientCookieLocale()?.locale
      ?? (navigator.language.toLowerCase().startsWith('ru') ? 'ru' : DEFAULT_LOCALE));
    logSanitizedError('GlobalErrorBoundary', error);
    reportBrowserError('boundary', error);
  }, [error]);

  const copy = resources[locale].translation.common.status;
  const digest = sanitizeError(error).digest;

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-tof-canvas text-text-body antialiased">
        <title>{pageTitle(copy.fatal.title)}</title>
        <main className="shell-layout">
          <StatusPage
            code={copy.error.code}
            title={copy.fatal.title}
            lead={copy.fatal.lead}
            actions={<StatusHomeAction label={copy.home} />}
          >
            {digest ? (
              <StatusReference
                label={copy.error.reference}
                value={digest}
                copyLabel={copy.error.copy}
                copiedLabel={copy.error.copied}
              />
            ) : null}
          </StatusPage>
        </main>
      </body>
    </html>
  );
}
