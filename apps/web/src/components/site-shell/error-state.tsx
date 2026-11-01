'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { localeText } from '@/lib/i18n/text';

export interface ErrorStateProps {
  /** Error heading displayed on card */
  title?: string;
  /** User-friendly explanatory message */
  message?: string;
  /** Unique error reference or status code */
  errorCode?: string | number;
  /** Next.js server error digest hash */
  digest?: string;
  /** Retry callback invoked when the user clicks 'Try Again' */
  onRetry?: () => void;
  /** Label for the primary retry action */
  retryLabel?: string;
  /** Destination for the return navigation button */
  homeHref?: string;
  /** Label for the return navigation button */
  homeLabel?: string;
  /** Secondary action configuration */
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Pre-sanitized technical error diagnostics (collapsible) */
  details?: string;
  /** Custom CSS classes */
  className?: string;
}

export function ErrorState({
  title = 'System Anomaly Detected',
  message = 'An unexpected error occurred while loading this view. The site shell remains operational.',
  errorCode,
  digest,
  onRetry,
  retryLabel = 'Try Again',
  homeHref = '/',
  homeLabel = 'Return to Home',
  secondaryAction,
  details,
  className = '',
}: ErrorStateProps) {
  const [showCopied, setShowCopied] = useState(false);
  const t = localeText(useI18n().locale);

  const copyDigest = () => {
    if (!digest) return;
    navigator.clipboard?.writeText(digest).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    });
  };

  return (
    <div
      role="alert"
      className={`w-full max-w-[640px] mx-auto my-8 p-6 md:p-8 rounded-lg bg-panel/90 border border-negative/30 backdrop-blur-md shadow-2xl ${className}`}
      style={{
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 0 1px rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Icon & Status Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-negative/10 border border-negative/40 flex items-center justify-center text-negative shadow-[0_0_16px_rgba(223,137,155,0.25)]">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-lg font-semibold text-text-strong tracking-wide">
              {t(title)}
            </h2>
            {errorCode && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-negative/15 text-negative border border-negative/30 uppercase">
                CODE {errorCode}
              </span>
            )}
          </div>
          <p className="text-sm text-text-body leading-relaxed">
            {t(message)}
          </p>
        </div>
      </div>

      {/* Digest Reference Pill */}
      {digest && (
        <div className="mb-6 flex items-center justify-between p-2.5 rounded bg-black/40 border border-hairline font-mono text-xs text-text-muted">
          <div className="flex items-center gap-2 truncate">
            <span className="text-gold/80 font-bold uppercase tracking-wider">{t('Digest:')}</span>
            <span className="truncate text-text-body select-all">{digest}</span>
          </div>
          <button
            type="button"
            onClick={copyDigest}
            className="ml-2 text-[11px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gold transition border border-hairline"
            title={t('Copy error reference')}
          >
            {showCopied ? t('Copied') + '!' : t('Copy')}
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-sm bg-gold hover:bg-[#ffe58f] text-[#0b0d13] text-sm font-semibold tracking-wide transition shadow-sm focus-visible:outline-2 focus-visible:outline-gold active:scale-[0.98]"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {t(retryLabel)}
          </button>
        )}

        {secondaryAction?.onClick ? (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-sm bg-white/5 hover:bg-white/10 text-text-body text-sm font-medium border border-hairline transition focus-visible:outline-2 focus-visible:outline-gold active:scale-[0.98]"
          >
            {t(secondaryAction.label)}
          </button>
        ) : secondaryAction?.href ? (
          <a
            href={secondaryAction.href}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-sm bg-white/5 hover:bg-white/10 text-text-body text-sm font-medium border border-hairline transition focus-visible:outline-2 focus-visible:outline-gold active:scale-[0.98]"
          >
            {t(secondaryAction.label)}
          </a>
        ) : homeHref ? (
          <a
            href={homeHref}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-sm bg-white/5 hover:bg-white/10 text-text-body text-sm font-medium border border-hairline transition focus-visible:outline-2 focus-visible:outline-gold active:scale-[0.98]"
          >
            {t(homeLabel)}
          </a>
        ) : null}
      </div>

      {/* Collapsible Sanitized Technical Diagnostics */}
      {details && (
        <details className="mt-6 pt-4 border-t border-hairline text-xs text-text-muted group">
          <summary className="cursor-pointer font-medium hover:text-text-body transition select-none flex items-center justify-between">
            <span>{t('Diagnostics & Technical Details')}</span>
            <span className="font-mono text-[10px] uppercase opacity-70 group-open:hidden">{t('Show')}</span>
            <span className="font-mono text-[10px] uppercase opacity-70 hidden group-open:inline">{t('Hide')}</span>
          </summary>
          <pre className="mt-3 p-3 rounded bg-black/60 border border-hairline font-mono text-[11px] leading-relaxed text-text-sub overflow-x-auto whitespace-pre-wrap select-all">
            {details}
          </pre>
        </details>
      )}
    </div>
  );
}
