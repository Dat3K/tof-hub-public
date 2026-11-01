import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { emptyFeedbackRatings, type FeedbackSubmission } from '@tof-hub/contracts';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.module';
import type { AbuseService } from '../security/abuse.service';
import type { NotificationsService } from '../notifications/notifications.service';

const ip = '192.0.2.10';
const origin = { country: null, device: 'desktop', os: 'Windows', browser: 'Chrome' } as const;
function setup() {
  const responses = new Map<string, { requestDigest: string }>(), claims = new Set<string>(), notes: unknown[] = [];
  const tx = {
    feedbackResponse: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => responses.get(where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => responses.get(where.id)!),
      createMany: vi.fn(async ({ data }: { data: { id: string; requestDigest: string }[] }) => {
        if (responses.has(data[0].id)) return { count: 0 };
        responses.set(data[0].id, data[0]); return { count: 1 };
      }),
    },
    feedbackNote: { createMany: vi.fn(async ({ data }: { data: unknown[] }) => { notes.push(...data); return { count: data.length }; }) },
    feedbackPromptClaim: { createMany: vi.fn(async ({ data }: { data: { survey: string; networkKey: string }[] }) => {
      const key = `${data[0].survey}:${data[0].networkKey}`;
      if (claims.has(key)) return { count: 0 };
      claims.add(key); return { count: 1 };
    }) },
  };
  const database = { ...tx, $transaction: async (callback: (client: typeof tx) => Promise<void>) => callback(tx) };
  const abuse = { scopedIdentity: vi.fn(() => 'purpose-scoped-hmac'), feedbackBudget: vi.fn(async () => {}) };
  const notifications = { acceptedFeedback: vi.fn(async () => {}) };
  const service = new FeedbackService(abuse as unknown as AbuseService, notifications as unknown as NotificationsService, database as unknown as PrismaClient);
  return { service, database, abuse, notifications, notes, claims, responses };
}
const input = (): FeedbackSubmission => ({ id: randomUUID(), ratings: { ...emptyFeedbackRatings(), visual: 0 },
  notes: [{ page: '/info/food/', category: 'data', message: "<img onerror=alert(1)> '; DROP TABLE players;--" },
    { page: '/tools/comp/', category: 'idea', message: 'Another independent message' }], aiComment: '', locale: 'ru', source: 'direct',
  client: { player: { uid: '1300701214', nickname: 'Nick' }, timeZone: 'Europe/Kyiv', screen: '1920x1080' } });

describe('Feedback API', () => {
  beforeEach(() => { vi.unstubAllEnvs(); });
  it('atomically claims once and fails closed without persistent storage', async () => {
    vi.stubEnv('FEEDBACK_PROMPT_ENABLED', 'true');
    const { service } = setup();
    expect(await Promise.all([service.claim(ip, 'time'), service.claim(ip, 'pages')])).toEqual([{ show: true }, { show: false }]);
    expect(await new FeedbackService({} as AbuseService, {} as NotificationsService, null).claim(ip, 'time')).toEqual({ show: false });
  });
  it('enables invitations by default and respects an explicit disable flag', async () => {
    vi.stubEnv('FEEDBACK_PROMPT_ENABLED', undefined);
    expect(await setup().service.claim(ip, 'pages')).toEqual({ show: true });
    vi.stubEnv('FEEDBACK_PROMPT_ENABLED', 'false');
    const { service, database } = setup();
    expect(await service.claim(ip, 'pages')).toEqual({ show: false });
    expect(database.feedbackPromptClaim.createMany).not.toHaveBeenCalled();
  });
  it('keeps page messages separate and exact retries idempotent', async () => {
    const { service, notes, responses, abuse, notifications } = setup(), value = input();
    expect(await service.submit(value, ip, origin)).toEqual({ accepted: true, id: value.id });
    await service.submit(value, ip, origin);
    expect(responses.size).toBe(1); expect(notes).toHaveLength(2);
    expect(responses.get(value.id)).toMatchObject({ playerUid: '1300701214', playerNickname: 'Nick', timeZone: 'Europe/Kyiv', screen: '1920x1080', os: 'Windows' });
    expect(notes[0]).toMatchObject({ page: '/info/food/', message: value.notes[0].message, responseId: value.id });
    expect(abuse.feedbackBudget).toHaveBeenCalledTimes(1);
    expect(notifications.acceptedFeedback).toHaveBeenCalledTimes(1);
    expect(notifications.acceptedFeedback).toHaveBeenCalledWith(expect.anything(), value, origin, null);
    await expect(service.submit({ ...value, aiComment: 'Changed payload' }, ip, origin)).rejects.toBeInstanceOf(ConflictException);
  });
  it('allows a later new review, but enforces spam limits before saving', async () => {
    const { service, responses, abuse } = setup();
    await service.submit(input(), ip, origin); await service.submit(input(), ip, origin);
    expect(responses.size).toBe(2);
    abuse.feedbackBudget.mockRejectedValueOnce(new HttpException('Limit', 429));
    await expect(service.submit(input(), ip, origin)).rejects.toMatchObject({ status: 429 });
    expect(responses.size).toBe(2);
    await expect(new FeedbackService(abuse as unknown as AbuseService, {} as NotificationsService, null).submit(input(), ip, origin)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('rejects private/unknown pages, extra fields and cross-origin-compatible writes', () => {
    const { service } = setup(), controller = new FeedbackController(service);
    expect(() => controller.submit(input(), ip)).toThrow(ForbiddenException);
    expect(() => controller.submit({ ...input(), sql: 'SELECT *' }, ip, '1')).toThrow(BadRequestException);
    expect(() => controller.submit({ ...input(), notes: [{ page: '/unavailable/', category: 'idea', message: 'test' }] }, ip, '1')).toThrow(BadRequestException);
    expect(() => controller.submit({ ...input(), notes: [{ page: '/tools/nonexistent/', category: 'idea', message: 'test' }] }, ip, '1')).toThrow(BadRequestException);
  });
  it('requires a strong administrative credential even in development', () => {
    vi.stubEnv('FEEDBACK_ADMIN_KEY', 'a'.repeat(40));
    const controller = new FeedbackController(setup().service);
    expect(() => controller.report()).toThrow(ForbiddenException);
    expect(() => controller.report('b'.repeat(40))).toThrow(ForbiddenException);
    expect(() => controller.report('a'.repeat(40), 'bad cursor')).toThrow(BadRequestException);
    vi.stubEnv('FEEDBACK_ADMIN_KEY', 'short');
    expect(() => controller.notes('short')).toThrow(ForbiddenException);
  });
});
