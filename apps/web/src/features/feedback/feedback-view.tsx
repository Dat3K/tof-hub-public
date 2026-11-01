'use client';

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Button, EditorialHeader } from '@tof-hub/ui';
import { FEEDBACK_METRICS, emptyFeedbackRatings, FeedbackClientSchema, type FeedbackClient, type FeedbackMetric, type FeedbackNote, type FeedbackSubmission } from '@tof-hub/contracts';
import { type Locale } from '@tof-hub/i18n';
import { useI18n } from '@/lib/i18n';
import { pageTargets, type FeedbackPageTarget } from './feedback-pages';
import { FEEDBACK_COPY } from './feedback-copy';
import { suppressFeedbackPrompt } from './feedback-progress';
import type { BrowserOwner } from '../players/browser-owner';
import { useBrowserOwner } from '../players/use-browser-owner';
import styles from './feedback.module.css';

type Copy = typeof FEEDBACK_COPY.en;
type DraftNote = FeedbackNote & { key: number; specific: boolean };
type Target = FeedbackPageTarget;
const scores = Array.from({ length: 11 }, (_, index) => index);

/** Browser context attached to a review; values the shared schema would reject are dropped, not sent. */
function feedbackClient(owner: BrowserOwner | null): FeedbackClient {
  let timeZone: string | null = null;
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { /* Unknown time zone. */ }
  const screen = `${Math.round(window.screen.width)}x${Math.round(window.screen.height)}`;
  const parsed = FeedbackClientSchema.safeParse({ player: owner, timeZone, screen });
  return parsed.success ? parsed.data : { player: FeedbackClientSchema.shape.player.safeParse(owner).data ?? null, timeZone: null, screen: null };
}

function RatingField({ metric, value, onChange, t }: {
  metric: FeedbackMetric; value: number | null; onChange: (value: number | null) => void; t: Copy;
}) {
  const id = useId(), labels = t.metrics[metric];
  return <fieldset className={styles.rating} aria-describedby={`${id}-question ${id}-ends`}>
    <legend>{labels[0]}</legend>
    <p id={`${id}-question`} className={styles.question}>{labels[1]}</p>
    <div className={styles.scale}>
      {scores.map(score => <label key={score} className={styles.score}>
        <input type="radio" name={metric} value={score} checked={value === score} onChange={() => onChange(score)} />
        <span>{score}</span>
      </label>)}
    </div>
    <div id={`${id}-ends`} className={styles.ends}><span>0 — {labels[2]}</span><span>10 — {labels[3]}</span></div>
    <button type="button" className={styles.skip} onClick={() => onChange(null)} disabled={value === null}>{t.skip}</button>
  </fieldset>;
}

function NoteEditor({ note, index, targets, t, invalid, onChange, onRemove }: {
  note: DraftNote; index: number; targets: Target[]; t: Copy; invalid: boolean;
  onChange: (patch: Partial<DraftNote>) => void; onRemove: () => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const matches = targets.filter(target => target.path === note.page || `${target.label} ${target.path}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className={styles.note} aria-labelledby={`${id}-title`}>
    <div className={styles.noteHeader}><h3 id={`${id}-title`}>{t.note} {index + 1}</h3>
      <button type="button" className={styles.remove} onClick={onRemove} aria-label={`${t.remove} ${index + 1}`}>{t.remove}</button></div>
    <div className={styles.twoFields}>
      <label>{t.scope}<select value={note.specific ? 'page' : 'site'} onChange={event => onChange({ specific: event.target.value === 'page', page: null })}>
        <option value="site">{t.site}</option><option value="page">{t.specific}</option>
      </select></label>
      <label>{t.category}<select value={note.category} onChange={event => onChange({ category: event.target.value as FeedbackNote['category'] })}>
        {Object.entries(t.categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    {note.specific && <div className={styles.pageFields}>
      <label>{t.search}<input type="search" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} /></label>
      <label>{t.selectPage}<select value={note.page ?? ''} aria-invalid={invalid && !note.page} required onChange={event => onChange({ page: event.target.value || null })}>
        <option value="">{matches.length ? t.selectPage : t.noPages}</option>
        {t.groups.map((group, groupIndex) => <optgroup key={group} label={group}>
          {matches.filter(target => target.group === groupIndex).map(target => <option key={target.path} value={target.path}>{target.label} · {target.path}</option>)}
        </optgroup>)}
      </select></label>
    </div>}
    <label>{t.message}<textarea rows={4} maxLength={3000} value={note.message} required
      aria-invalid={invalid && !note.message.trim()} aria-describedby={`${id}-hint`}
      onChange={event => onChange({ message: event.target.value })} /></label>
    <div className={styles.fieldHint}><p id={`${id}-hint`}>{note.category === 'data' ? t.dataHint : t.messageHint}</p><span>{note.message.length}/3000</span></div>
  </section>;
}

export function FeedbackView({ initialLocale, source, initialPage }: {
  initialLocale: Locale; source: FeedbackSubmission['source']; initialPage: string | null;
}) {
  const { locale } = useI18n();
  const lang = locale ?? initialLocale, t = FEEDBACK_COPY[lang];
  const targets = useMemo(() => pageTargets(lang), [lang]);
  const [ratings, setRatings] = useState(emptyFeedbackRatings);
  const [aiComment, setAiComment] = useState('');
  const [notes, setNotes] = useState<DraftNote[]>([]);
  const nextKey = useRef(0), pendingSubmission = useRef<{ body: string; id: string } | null>(null);
  const [sending, setSending] = useState(false), [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<keyof Pick<Copy, 'empty' | 'incomplete' | 'tooLong' | 'error' | 'rateError'> | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null), successRef = useRef<HTMLHeadingElement>(null);
  const owner = useBrowserOwner();
  useEffect(() => { suppressFeedbackPrompt(); setReady(true); }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { if (saved) successRef.current?.focus(); }, [saved]);

  function addNote() {
    setNotes(current => [...current, { key: nextKey.current++, specific: !!initialPage, page: initialPage, category: 'idea', message: '' }]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setError(null);
    if (notes.some(note => !note.message.trim() || (note.specific && !note.page))) { setError('incomplete'); return; }
    if (!Object.values(ratings).some(value => value !== null) && !notes.length && !aiComment.trim()) { setError('empty'); return; }
    if (notes.reduce((sum, note) => sum + note.message.trim().length, aiComment.trim().length) > 12000) { setError('tooLong'); return; }
    const payload = { ratings, notes: notes.map(note => ({ page: note.specific ? note.page : null, category: note.category, message: note.message.trim() })),
      aiComment: aiComment.trim(), locale: lang, source, client: feedbackClient(owner) };
    const body = JSON.stringify(payload);
    if (pendingSubmission.current?.body !== body) pendingSubmission.current = { body, id: crypto.randomUUID() };
    setSending(true);
    try {
      const response = await fetch('/api/v1/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Feedback-Request': '1' },
        body: JSON.stringify({ id: pendingSubmission.current!.id, ...payload }), signal: AbortSignal.timeout(20_000) });
      if (!response.ok) { setError(response.status === 429 ? 'rateError' : 'error'); return; }
      const result = await response.json();
      if (result.accepted !== true) { setError('error'); return; }
      suppressFeedbackPrompt();
      setSaved(true);
    } catch { setError('error'); } finally { setSending(false); }
  }

  function reset() {
    setRatings(emptyFeedbackRatings()); setAiComment(''); setNotes([]); setError(null);
    pendingSubmission.current = null; setSaved(false);
  }

  return <div className={`editorial-page editorial-layout ${styles.page}`}>
    <EditorialHeader title={t.title} description={t.intro} />
    {saved ? <section className={styles.success} aria-live="polite">
      <h2 ref={successRef} tabIndex={-1}>{t.success}</h2><p>{t.successDetail}</p>
      <Button variant="primary" size="lg" onClick={reset}>{t.again}</Button>
    </section> : <form onSubmit={submit} onChange={() => setError(null)} noValidate aria-busy={sending || !ready}>
      <fieldset className={styles.formFields} disabled={sending || !ready}>
        <section aria-labelledby="feedback-ratings">
          <div className={styles.sectionHead}><h2 id="feedback-ratings">{t.ratings}</h2><span>{t.optional}</span></div>
          {FEEDBACK_METRICS.slice(0, 4).map(metric => <RatingField key={metric} metric={metric} value={ratings[metric]} t={t} onChange={value => setRatings(current => ({ ...current, [metric]: value }))} />)}
          <div className={styles.aiSection}><p>{t.aiDisclosure}</p>
            <RatingField metric="aiTrace" value={ratings.aiTrace} t={t} onChange={aiTrace => setRatings(current => ({ ...current, aiTrace }))} />
            <p className={styles.aiHint}>{t.aiHint}</p>
            <label className={styles.aiLabel}>{t.aiLabel}<textarea rows={3} maxLength={1000} value={aiComment} onChange={event => setAiComment(event.target.value)} /></label>
          </div>
        </section>
        <section className={styles.notesSection} aria-labelledby="feedback-notes">
          <h2 id="feedback-notes">{t.notesTitle}</h2><p className={styles.notesIntro}>{t.notesIntro}</p>
          {notes.map((note, index) => <NoteEditor key={note.key} note={note} index={index} targets={targets} t={t} invalid={error === 'incomplete'}
            onChange={patch => setNotes(current => current.map(value => value.key === note.key ? { ...value, ...patch } : value))}
            onRemove={() => setNotes(current => current.filter(value => value.key !== note.key))} />)}
          <Button variant="secondary" size="lg" onClick={addNote} type="button" disabled={notes.length >= 20}>{notes.length ? t.addMore : t.add}</Button>
        </section>
      </fieldset>
      <div className={styles.submitArea}>
        <p className={styles.contextNote}>{owner ? t.contextPlayer(owner.nickname ? `${owner.nickname} · UID ${owner.uid}` : `UID ${owner.uid}`) : t.contextAnonymous}</p>
        {error && <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{t[error]}</p>}
        <Button type="submit" size="lg" variant="primary" isLoading={sending} disabled={sending || !ready}>{sending ? t.sending : t.submit}</Button>
      </div>
    </form>}
  </div>;
}
