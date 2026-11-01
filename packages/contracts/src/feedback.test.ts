import { describe, expect, it } from 'vitest';
import { FeedbackSubmissionSchema, emptyFeedbackRatings, feedbackSummary } from './feedback';

const base = () => ({ id: 'c06df873-55f5-4326-a932-367794622a98', ratings: emptyFeedbackRatings(),
  notes: [], aiComment: '', locale: 'ru', source: 'direct' });

describe('Feedback contract', () => {
  it('keeps a real zero, ten, and nulls separate', () => {
    const result = FeedbackSubmissionSchema.parse({ ...base(), ratings: { ...emptyFeedbackRatings(), visual: 0, aiTrace: 10 } });
    expect(result.ratings).toEqual({ visual: 0, aiTrace: 10, dataTrust: null, usability: null, usefulness: null });
  });
  it.each([-1, 11, 1.5, '10', NaN])('rejects invalid scores: %s', value => {
    expect(FeedbackSubmissionSchema.safeParse({ ...base(), ratings: { ...emptyFeedbackRatings(), visual: value } }).success).toBe(false);
  });
  it('allows independent page messages without any ratings', () => {
    const notes = [{ page: '/info/food/', category: 'data', message: ' A correction ' }, { page: '/tools/comp/', category: 'idea', message: 'A suggestion' }];
    const result = FeedbackSubmissionSchema.parse({ ...base(), notes });
    expect(result.notes).toHaveLength(2);
    expect(result.notes[0].message).toBe('A correction');
  });
  it('rejects empty, unbounded and unexpected input', () => {
    expect(FeedbackSubmissionSchema.safeParse(base()).success).toBe(false);
    const note = { page: null, category: 'idea', message: 'x'.repeat(3000) };
    for (const notes of [[{ ...note, message: ' ' }], [{ ...note, message: 'x'.repeat(3001) }], Array(21).fill(note), Array(5).fill(note)]) {
      expect(FeedbackSubmissionSchema.safeParse({ ...base(), notes }).success).toBe(false);
    }
    expect(FeedbackSubmissionSchema.safeParse({ ...base(), aiComment: 'ok', sql: 'DROP TABLE players' }).success).toBe(false);
    expect(FeedbackSubmissionSchema.safeParse({ ...base(), aiComment: 'x'.repeat(1001) }).success).toBe(false);
    expect(FeedbackSubmissionSchema.safeParse({ ...base(), aiComment: '\u0000' }).success).toBe(false);
    expect(FeedbackSubmissionSchema.safeParse({ ...base(), notes: [{ ...note, message: 'text\u0000text' }] }).success).toBe(false);
  });
  it('treats markup and SQL as bounded text, and rejects unsafe paths', () => {
    const message = "<script>alert(1)</script>'; DROP TABLE players;--";
    expect(FeedbackSubmissionSchema.parse({ ...base(), notes: [{ category: 'other', page: null, message }] }).notes[0].message).toBe(message);
    for (const page of ['//evil.test/', '/tools/build/?token=secret', '/unavailable/;DROP TABLE players;', '/tools/build/123456789/']) {
      expect(FeedbackSubmissionSchema.safeParse({ ...base(), notes: [{ category: 'other', page, message }] }).success).toBe(false);
    }
  });
  it('computes weighted medians per answered question without mixing AI visibility', () => {
    const summary = feedbackSummary([{ metric: 'visual', value: 0, count: 1 }, { metric: 'visual', value: 10, count: 1 }, { metric: 'aiTrace', value: 9, count: 3 }]);
    expect(summary.visual.median).toBe(5);
    expect(summary.visual.count).toBe(2);
    expect(summary.aiTrace.median).toBe(9);
    expect(summary.dataTrust.median).toBeNull();
    expect(summary.dataTrust.count).toBe(0);
  });
});
