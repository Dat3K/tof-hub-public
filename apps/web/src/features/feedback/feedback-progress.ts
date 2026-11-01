import { FEEDBACK_PATHS } from '@tof-hub/config';

export const FEEDBACK_STORAGE_KEY = 'tof-feedback-v1';
export const FEEDBACK_ACTIVE_MS = 15 * 60_000;
export const FEEDBACK_PAGE_COUNT = 10;
export const FEEDBACK_SESSION_GAP_MS = 30 * 60_000;
/** `pageViews` counts every switch to a known public page, revisits included; reloads and same-page changes do not count. */
export interface FeedbackProgress { version: 1; suppressed: boolean; activeMs: number; pageViews: number; lastActiveAt: number }

export function feedbackPage(pathname: string): string | null {
  const path = `${pathname.split(/[?#]/)[0].replace(/\/+$/, '')}/`;
  return FEEDBACK_PATHS.includes(path) ? path : null;
}

/** Older stored progress kept a list of distinct pages; its length is the closest equivalent. */
function pageViewCount(value: { pageViews?: unknown; pages?: unknown }): number {
  const count = Number.isFinite(value.pageViews) ? Number(value.pageViews) : Array.isArray(value.pages) ? value.pages.length : 0;
  return Math.max(0, Math.min(FEEDBACK_PAGE_COUNT, Math.floor(count)));
}

export function readFeedbackProgress(raw: string | null, now: number): FeedbackProgress {
  const empty: FeedbackProgress = { version: 1, suppressed: false, activeMs: 0, pageViews: 0, lastActiveAt: now };
  if (!raw) return empty;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1) return empty;
    if (value.suppressed === true) return { ...empty, suppressed: true };
    if (!Number.isFinite(value.lastActiveAt) || now - value.lastActiveAt > FEEDBACK_SESSION_GAP_MS || value.lastActiveAt > now) return empty;
    return { ...empty, activeMs: Number.isFinite(value.activeMs) ? Math.max(0, Math.min(FEEDBACK_ACTIVE_MS, value.activeMs)) : 0,
      pageViews: pageViewCount(value), lastActiveAt: value.lastActiveAt };
  } catch { return empty; }
}

export function invitationReason(progress: FeedbackProgress): 'time' | 'pages' | null {
  if (progress.suppressed) return null;
  if (progress.activeMs >= FEEDBACK_ACTIVE_MS) return 'time';
  return progress.pageViews >= FEEDBACK_PAGE_COUNT ? 'pages' : null;
}

/** Storage failure disables automatic invitations; the feedback form always remains usable. */
export function suppressFeedbackPrompt() {
  try {
    const progress = readFeedbackProgress(localStorage.getItem(FEEDBACK_STORAGE_KEY), Date.now());
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify({ ...progress, suppressed: true }));
  } catch { /* Storage can be disabled by the browser. */ }
  window.dispatchEvent(new Event('tof-feedback-suppressed'));
}
