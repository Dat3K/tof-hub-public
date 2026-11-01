'use client';

import React, { useEffect } from 'react';
import { reportBrowserError } from '@/lib/report-browser-error';
import { RouteErrorState, logSanitizedError } from '@/components/site-shell';

export default function RootError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    // Safely log error without leaking secrets, tokens, or credentials
    logSanitizedError('RootErrorBoundary', error);
    reportBrowserError('boundary', error);
  }, [error]);

  return <RouteErrorState error={error} />;
}
