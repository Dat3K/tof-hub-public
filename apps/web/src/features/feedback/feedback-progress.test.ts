import { describe, expect, it } from 'vitest';
import { FEEDBACK_ACTIVE_MS, FEEDBACK_PAGE_COUNT, FEEDBACK_SESSION_GAP_MS, feedbackPage, invitationReason, readFeedbackProgress } from './feedback-progress';

describe('Feedback invitation progress', () => {
  it('counts only known public canonical paths', () => {
    expect(feedbackPage('/info/food?item=secret#name')).toBe('/info/food/');
    expect(feedbackPage('/')).toBe('/');
    for (const path of ['/feedback/', '/tools/queue/', '/tools/build/123456789/', '//evil.test/']) expect(feedbackPage(path)).toBeNull();
  });
  it('triggers at either threshold but never below it', () => {
    const state = readFeedbackProgress(null, 1000);
    expect(invitationReason({ ...state, activeMs: FEEDBACK_ACTIVE_MS - 1, pageViews: FEEDBACK_PAGE_COUNT - 1 })).toBeNull();
    expect(invitationReason({ ...state, activeMs: FEEDBACK_ACTIVE_MS })).toBe('time');
    expect(invitationReason({ ...state, pageViews: FEEDBACK_PAGE_COUNT })).toBe('pages');
  });
  it('resets an expired visit while retaining permanent dismissal', () => {
    const old = { ...readFeedbackProgress(null, 1000), activeMs: FEEDBACK_ACTIVE_MS, pageViews: 3, lastActiveAt: 1000 };
    const now = 1000 + FEEDBACK_SESSION_GAP_MS + 1;
    expect(invitationReason(readFeedbackProgress(JSON.stringify(old), now))).toBeNull();
    expect(readFeedbackProgress(JSON.stringify({ ...old, suppressed: true }), now).suppressed).toBe(true);
  });
  it('counts repeated visits to the same pages and keeps counting from older stored progress', () => {
    const revisits = readFeedbackProgress(JSON.stringify({ version: 1, activeMs: 0, pageViews: 10, lastActiveAt: 1000 }), 1100);
    expect(invitationReason(revisits)).toBe('pages');
    expect(readFeedbackProgress(JSON.stringify({ version: 1, activeMs: 0, pages: ['/', '/info/'], lastActiveAt: 1000 }), 1100).pageViews).toBe(2);
  });
  it('handles malformed storage and caps untrusted progress', () => {
    expect(readFeedbackProgress('{broken', 1000).activeMs).toBe(0);
    const state = readFeedbackProgress(JSON.stringify({ version: 1, activeMs: 1e20, pageViews: 1e9, lastActiveAt: 1000 }), 1100);
    expect(state.pageViews).toBe(FEEDBACK_PAGE_COUNT);
    expect(state.activeMs).toBe(FEEDBACK_ACTIVE_MS);
    expect(invitationReason({ ...state, suppressed: true })).toBeNull();
  });
});
