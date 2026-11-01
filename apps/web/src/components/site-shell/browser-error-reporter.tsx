'use client';
import { useEffect } from 'react';
import { reportBrowserError } from '@/lib/report-browser-error';

export function BrowserErrorReporter() {
  useEffect(() => {
    const error = (event: ErrorEvent) => { if (event.error) reportBrowserError('window', event.error); };
    const promise = (event: PromiseRejectionEvent) => reportBrowserError('promise', event.reason);
    window.addEventListener('error', error);
    window.addEventListener('unhandledrejection', promise);
    return () => { window.removeEventListener('error', error); window.removeEventListener('unhandledrejection', promise); };
  }, []);
  return null;
}
