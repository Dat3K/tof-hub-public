'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FEEDBACK_STORAGE_KEY, FEEDBACK_ACTIVE_MS, FEEDBACK_PAGE_COUNT, feedbackPage, invitationReason, readFeedbackProgress, suppressFeedbackPrompt } from './feedback-progress';

const Invitation = dynamic(() => import('./feedback-invitation'), { ssr: false });

const LAST_PAGE_KEY = 'tof-feedback-last-page';

/** Counts a switch to `path`. A reload or a second render of the same page is not a switch; revisiting an earlier page is. */
function countPageView(path: string) {
  try {
    if (sessionStorage.getItem(LAST_PAGE_KEY) === path) return;
    sessionStorage.setItem(LAST_PAGE_KEY, path);
    const progress = readFeedbackProgress(localStorage.getItem(FEEDBACK_STORAGE_KEY), Date.now());
    if (progress.suppressed) return;
    progress.pageViews = Math.min(FEEDBACK_PAGE_COUNT, progress.pageViews + 1);
    progress.lastActiveAt = Date.now();
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(progress));
  } catch { /* Storage can be disabled by the browser. */ }
}

function safeMoment() {
  return document.visibilityState === 'visible' && document.hasFocus()
    && !document.querySelector('[role="dialog"], [aria-busy="true"], [data-exporting="true"]')
    && !document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
}

/** Progress stays local. Only one permission request is sent once a threshold is reached. */
export function FeedbackPrompt() {
  const pathname = usePathname(), router = useRouter();
  const attempted = useRef(false), lastInputAt = useRef(0);
  const [open, setOpen] = useState(false);
  const invitationPage = useRef<string | null>(null);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('tof-feedback-suppressed', close);
    const storage = (event: StorageEvent) => {
      if (event.key === FEEDBACK_STORAGE_KEY && readFeedbackProgress(event.newValue, Date.now()).suppressed) close();
    };
    window.addEventListener('storage', storage);
    const input = () => { lastInputAt.current = performance.now(); };
    window.addEventListener('pointerdown', input, { passive: true });
    window.addEventListener('wheel', input, { passive: true });
    window.addEventListener('touchmove', input, { passive: true });
    window.addEventListener('keydown', input);
    return () => {
      window.removeEventListener('tof-feedback-suppressed', close); window.removeEventListener('storage', storage);
      window.removeEventListener('pointerdown', input); window.removeEventListener('keydown', input);
      window.removeEventListener('wheel', input); window.removeEventListener('touchmove', input);
    };
  }, []);

  useEffect(() => {
    const path = feedbackPage(pathname);
    if (!path || attempted.current) return;
    let cancelled = false, lastTick = performance.now();
    let wasActive = document.visibilityState === 'visible' && document.hasFocus();
    const controller = new AbortController();
    async function tick(allowClaim = true) {
      const now = performance.now(), elapsed = Math.min(6000, Math.max(0, now - lastTick));
      lastTick = now;
      const active = document.visibilityState === 'visible' && document.hasFocus();
      const countedTime = wasActive && active ? elapsed : 0;
      wasActive = active;
      if (!active || cancelled || attempted.current) return;
      try {
        const progress = readFeedbackProgress(localStorage.getItem(FEEDBACK_STORAGE_KEY), Date.now());
        if (progress.suppressed) return;
        progress.activeMs = Math.min(FEEDBACK_ACTIVE_MS, progress.activeMs + countedTime);
        progress.lastActiveAt = Date.now();
        localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(progress));
        if (!allowClaim) return;
        const reason = invitationReason(progress);
        // Canvas tools keep their working area uninterrupted; offer on the next suitable page.
        if (!reason || /^\/(tools\/build|datamine\/fce)(\/|$)/.test(pathname) || !safeMoment() || now - lastInputAt.current < 5000) return;
        attempted.current = true;
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
          const response = await fetch('/api/v1/feedback/prompt/claim', { method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Feedback-Request': '1' }, body: JSON.stringify({ reason }), signal: controller.signal });
          const result = response.ok ? await response.json() : { show: false };
          if (cancelled) return;
          // Even a lost/declined claim must not repeatedly interrupt the same browser.
          suppressFeedbackPrompt();
          if (result.show === true && safeMoment()) { invitationPage.current = path; setOpen(true); }
        } finally { clearTimeout(timeout); }
      } catch {
        // Storage/network failure is quiet and cannot break the page or start a retry loop.
      }
    }
    const visibility = () => { lastTick = performance.now(); wasActive = document.visibilityState === 'visible' && document.hasFocus(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', visibility); window.addEventListener('blur', visibility);
    const timer = window.setInterval(() => { void tick(); }, 5000);
    countPageView(path);
    void tick(false);
    return () => {
      cancelled = true; controller.abort(); window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', visibility); window.removeEventListener('blur', visibility);
    };
  }, [pathname]);

  return open ? <Invitation onClose={() => setOpen(false)} onAccept={() => {
    setOpen(false);
    const query = new URLSearchParams({ from: 'prompt', ...(invitationPage.current ? { page: invitationPage.current } : {}) });
    router.push(`/feedback/?${query}`);
  }} /> : null;
}
