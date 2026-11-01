// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { EMPTY_FEEDBACK_CLIENT, FEEDBACK_SURVEY, emptyFeedbackRatings, type FeedbackSubmission } from '@tof-hub/contracts';
import { AbuseService } from '../security/abuse.service';
import { FeedbackService } from './feedback.service';
import { NotificationsService } from '../notifications/notifications.service';

const url = process.env.FEEDBACK_TEST_DATABASE_URL;
describe.skipIf(!url)('Feedback PostgreSQL integration (dedicated test database only)', () => {
  let pool: Pool, prisma: PrismaClient, abuse: AbuseService, service: FeedbackService;
  const suffix = Math.floor(Math.random() * 200) + 1;
  const ip = `192.0.2.${suffix}`, budgetIp = `198.51.100.${suffix}`, ids: string[] = [];
  beforeAll(async () => {
    if (!/\/(feedback_qa|[a-z0-9_]+_test)(\?|$)/.test(url!)) throw new Error('Use a dedicated feedback_qa or *_test database');
    vi.stubEnv('IP_HASH_SALT', 'feedback-postgres-integration-fixture-secret');
    vi.stubEnv('FEEDBACK_PROMPT_ENABLED', 'true');
    vi.stubEnv('TELEGRAM_MODE', 'producer');
    pool = new Pool({ connectionString: url!, max: 10 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    abuse = new AbuseService(prisma); service = new FeedbackService(abuse, new NotificationsService(prisma), prisma);
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.feedbackResponse.deleteMany({ where: { id: { in: ids } } });
      await prisma.notificationEvent.deleteMany({ where: { id: { in: ids } } });
      await prisma.feedbackPromptClaim.deleteMany({ where: { survey: FEEDBACK_SURVEY, networkKey: abuse.scopedIdentity(ip, FEEDBACK_SURVEY) } });
      await prisma.$executeRaw`DELETE FROM abuse_counters WHERE key=${abuse.scopedIdentity(ip, 'feedback-submit')}`;
      await prisma.$executeRaw`DELETE FROM abuse_counters WHERE key=${abuse.scopedIdentity(budgetIp, 'feedback-submit')}`;
      await prisma.$disconnect(); await pool.end();
    }
    vi.unstubAllEnvs();
  });
  it('allows exactly one concurrent claim in PostgreSQL', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => service.claim(ip, 'pages')));
    expect(results.filter(result => result.show)).toHaveLength(1);
    const restarted = new FeedbackService(new AbuseService(prisma), new NotificationsService(prisma), prisma);
    expect(await restarted.claim(ip, 'time')).toEqual({ show: false });
  });
  it('stores separate literal messages once despite concurrent submission retries', async () => {
    const id = randomUUID(); ids.push(id);
    const hostile = "'; DROP TABLE players;-- <script>alert(document.cookie)</script>";
    const value: FeedbackSubmission = { id, ratings: { ...emptyFeedbackRatings(), visual: 0, aiTrace: 10 }, notes: [
      { category: 'data', page: '/info/food/', message: hostile },
      { category: 'idea', page: '/tools/comp/', message: 'A separate page message' },
    ], aiComment: '', locale: 'en', source: 'direct', client: { player: { uid: '1300701214', nickname: null }, timeZone: 'Europe/Kyiv', screen: '390x844' } };
    const origin = { country: 'UA', device: 'mobile', os: 'iOS', browser: 'Safari' } as const;
    await Promise.all(Array.from({ length: 6 }, () => service.submit(value, ip, origin)));
    const stored = await prisma.feedbackResponse.findUniqueOrThrow({ where: { id }, include: { notes: { orderBy: { position: 'asc' } } } });
    expect(stored.visual).toBe(0); expect(stored.dataTrust).toBeNull();
    expect(stored).toMatchObject({ playerUid: '1300701214', playerNickname: null, country: 'UA', device: 'mobile', screen: '390x844' });
    expect(stored.notes).toHaveLength(2); expect(stored.notes[0].message).toBe(hostile);
    expect(stored.notes[0].page).not.toBe(stored.notes[1].page);
    const queued = await prisma.notificationEvent.findMany({ where: { id } });
    expect(queued).toHaveLength(1);
    expect(queued[0].event).toMatchObject({ category: 'feedback', type: 'feedback.submitted', feedback: value });
    // The hostile text was stored literally: the players table still exists (other suites may share its rows).
    expect(await prisma.$queryRaw`SELECT to_regclass('public.players') IS NOT NULL AS exists`).toEqual([{ exists: true }]);
    const report = await service.report();
    expect(report.metrics.visual.count).toBeGreaterThan(0);
    expect((await service.notes(undefined, '/info/food/')).notes.some(note => note.message === hostile)).toBe(true);
  });
  it('rolls back the review and page notes when durable notification intake fails', async () => {
    const id = randomUUID(); ids.push(id);
    const notifications = { acceptedFeedback: vi.fn().mockRejectedValue(new Error('Outbox failed')) };
    const failing = new FeedbackService(abuse, notifications as unknown as NotificationsService, prisma);
    await expect(failing.submit({ id, ratings: emptyFeedbackRatings(), aiComment: '', locale: 'ru', source: 'direct', client: EMPTY_FEEDBACK_CLIENT,
      notes: [{ category: 'idea', page: null, message: 'Must not be partly saved' }] }, ip, { country: null, device: 'unknown', os: null, browser: null })).rejects.toMatchObject({ status: 503 });
    expect(await prisma.feedbackResponse.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.feedbackNote.count({ where: { responseId: id } })).toBe(0);
    expect(await prisma.notificationEvent.count({ where: { id } })).toBe(0);
  });
  it('also rejects out-of-range scores at the database boundary', async () => {
    const id = randomUUID(); ids.push(id);
    await expect(prisma.feedbackResponse.create({ data: { id, survey: FEEDBACK_SURVEY, requestDigest: 'fixture', visual: 11,
      aiComment: '', locale: 'en', source: 'direct' } })).rejects.toBeDefined();
    expect(await prisma.feedbackResponse.findUnique({ where: { id } })).toBeNull();
  });
  it('enforces the shared daily budget atomically under concurrent spam', async () => {
    const results = await Promise.allSettled(Array.from({ length: 21 }, () => abuse.feedbackBudget(budgetIp)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(20);
    const denied = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(denied.reason.getStatus()).toBe(429);
  });
});
