'use client';

import React from 'react';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter, Button, Collapsible } from '@tof-hub/ui';
import disclosureStyles from './info-disclosure.module.css';

/** Explanation dialog opened from a tool rail (Wish rules, capture app, Build fields and calculations). */
export function ToolInfoModal({ isOpen, onClose, eyebrow, title, intro, closeLabel, children }: {
  isOpen: boolean; onClose: () => void; eyebrow: string; title: string; intro?: React.ReactNode; closeLabel: string; children: React.ReactNode;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      appearance="table"
      overlayClassName="z-[70] items-start px-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] pb-3 sm:items-center sm:p-4"
      className="max-w-4xl shadow-[0_24px_80px_rgba(0,0,0,.72)] sm:translate-y-4"
    >
      {/* Compact plain header (2026-10-08): no gradient, smaller title and spacing. */}
      <ModalHeader className="border-b border-white/[0.08] px-5 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-amber-300">{eyebrow}</div>
          <ModalTitle className="text-base font-bold tracking-tight text-[#f6f3ed]">{title}</ModalTitle>
          {intro && <p className="mt-0.5 max-w-3xl text-xs leading-snug text-slate-400">{intro}</p>}
        </div>
      </ModalHeader>
      <ModalBody className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        <div className="space-y-6 text-sm text-slate-200">{children}</div>
      </ModalBody>
      <ModalFooter className="border-t border-white/[0.08] px-5 py-3.5 sm:px-7">
        <Button variant="secondary" onClick={onClose}>{closeLabel}</Button>
      </ModalFooter>
    </Modal>
  );
}

export function InfoCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <article className={`rounded-xl tool-table-card border p-4 sm:p-5 ${className}`}>{children}</article>;
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-white">{children}</h3>;
}

/**
 * An `InfoCard` that folds with an accessible button and the shared animated disclosure panel.
 */
export function InfoDisclosure({ title, children, className = '' }: { title: React.ReactNode; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(true);
  const panelId = React.useId();

  return (
    <section className={`rounded-xl tool-table-card border p-4 sm:p-5 ${disclosureStyles.disclosure} ${className}`}>
      <button type="button" className={disclosureStyles.summary} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
        <SectionHeading>{title}</SectionHeading>
        <span aria-hidden="true" className={disclosureStyles.chevron} data-open={open || undefined} />
      </button>
      <Collapsible open={open} id={panelId}>
        <div className={disclosureStyles.body}>{children}</div>
      </Collapsible>
    </section>
  );
}

export function RulePoint({ title, text }: { title: React.ReactNode; text: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden="true" className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
      <p><strong className="font-semibold text-slate-200">{title}</strong> {text}</p>
    </li>
  );
}

export function InfoNote({ label, children, tone = 'amber' }: { label?: string; children: React.ReactNode; tone?: 'amber' | 'sky' }) {
  const style = tone === 'sky' ? 'border-sky-300/10 bg-sky-300/[0.035] [&_strong]:text-sky-200' : 'border-amber-300/15 bg-amber-300/[0.045] [&_strong]:text-amber-200';
  return <aside className={`rounded-lg border px-4 py-3 text-xs leading-relaxed text-slate-300 ${style}`}>{label && <strong className="font-semibold">{label}</strong>} {children}</aside>;
}

/**
 * A framed list of rows inside an `InfoCard` (Build "Rules", Wish rates/pity/cashback): name with an optional formula or
 * value on one line, the explanation under it; rows are divided by thin lines.
 */
export function InfoRows({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-[10px] border border-white/[0.08] bg-black/20 ${className}`}>{children}</div>;
}

export function InfoRow({ title, formula, value, valueClassName = 'text-slate-100', children }: {
  title: React.ReactNode; formula?: React.ReactNode; value?: React.ReactNode; valueClassName?: string; children?: React.ReactNode;
}) {
  return (
    <div className="px-3.5 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3.5 gap-y-1">
        <b className="text-[13px] font-semibold text-slate-200">{title}</b>
        {formula && <code className="rounded-[5px] bg-black/30 px-1.5 py-0.5 font-mono text-[11.5px] leading-snug text-[#f8e7b0]">{formula}</code>}
        {value !== undefined && <span className={`font-mono text-sm font-bold ${valueClassName}`}>{value}</span>}
      </div>
      {children && <p className="mt-1 text-xs leading-relaxed text-slate-400">{children}</p>}
    </div>
  );
}
