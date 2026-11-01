'use client';

import React, { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@tof-hub/ui';
import styles from './status-page.module.css';

export interface StatusPageProps {
  /** Short status marker, e.g. `404`; rendered in the mono eyebrow. */
  code: string;
  /** Optional mono context after the code (requested path). */
  context?: ReactNode;
  title: ReactNode;
  lead: ReactNode;
  /** Page-specific content between the lead and the action (error reference). */
  children?: ReactNode;
  /** The page's single action. */
  actions?: ReactNode;
  /** Secondary content below a hairline (development diagnostics). */
  footer?: ReactNode;
}

/** Shared layout for route-level status pages: 404, error boundary and global error. */
export function StatusPage({ code, context, title, lead, children, actions, footer }: StatusPageProps) {
  return (
    <section className={styles.page} aria-labelledby="status-page-title">
      <p className={styles.eyebrow}>
        <span className={styles.code}>{code}</span>
        {context ? <span className={styles.context}>{context}</span> : null}
      </p>
      <h1 id="status-page-title" className={styles.title}>{title}</h1>
      <p className={styles.lead}>{lead}</p>
      {children}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </section>
  );
}

/** The one recovery action every status page offers: back to the hub root. */
export function StatusHomeAction({ label }: { label: string }) {
  return <Button variant="gold" size="lg" href="/">{label}</Button>;
}

/** Error reference with a copy action; the value is selectable as a fallback. */
export function StatusReference({ label, value, copyLabel, copiedLabel }: {
  label: ReactNode;
  value: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <p className={styles.reference}>
      <span>{label}</span>
      <code className={styles.referenceValue}>{value}</code>
      <button
        type="button"
        className={styles.referenceCopy}
        onClick={() => { void navigator.clipboard?.writeText(value).then(() => setCopied(true), () => undefined); }}
      >
        <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
      </button>
    </p>
  );
}

export function StatusDetails({ summary, children }: { summary: ReactNode; children: string }) {
  return (
    <details className={styles.details}>
      <summary>{summary}</summary>
      <pre>{children}</pre>
    </details>
  );
}
