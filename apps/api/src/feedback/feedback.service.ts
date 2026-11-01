import { ConflictException, HttpException, Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { FEEDBACK_SURVEY, feedbackSummary, type FeedbackOrigin, type FeedbackSubmission } from '@tof-hub/contracts';
import { PRISMA } from '../database/database.module';
import { AbuseService } from '../security/abuse.service';
import { NotificationsService } from '../notifications/notifications.service';

const unavailable = () => new ServiceUnavailableException('Feedback storage is temporarily unavailable');

@Injectable()
export class FeedbackService {
  constructor(
    private readonly abuse: AbuseService,
    private readonly notifications: NotificationsService,
    @Optional() @Inject(PRISMA) private readonly prisma: PrismaClient | null = null,
  ) {}

  private networkKey(ip: string) { return this.abuse.scopedIdentity(ip, FEEDBACK_SURVEY); }

  async claim(ip: string, reason: 'time' | 'pages') {
    if ((process.env.FEEDBACK_PROMPT_ENABLED ?? 'true') !== 'true') return { show: false };
    if (!this.prisma || ip === 'unknown') return { show: false };
    try {
      // The compound primary key makes this atomic across tabs, processes and restarts.
      const result = await this.prisma.feedbackPromptClaim.createMany({
        data: [{ survey: FEEDBACK_SURVEY, networkKey: this.networkKey(ip), reason }], skipDuplicates: true,
      });
      return { show: result.count === 1 };
    } catch { return { show: false }; } // Never show an invitation without a durable claim.
  }

  async submit(input: FeedbackSubmission, ip: string, origin: FeedbackOrigin) {
    if (!this.prisma) throw unavailable();
    const { id, ratings, notes, client, ...details } = input;
    // The digest covers only what the browser sent, so retries from another network still match.
    const requestDigest = createHash('sha256').update(JSON.stringify({ ratings, notes, ...details, client })).digest('hex');
    const context = { playerUid: client.player?.uid ?? null, playerNickname: client.player?.nickname ?? null,
      timeZone: client.timeZone, screen: client.screen, ...origin };
    try {
      const previous = await this.prisma.feedbackResponse.findUnique({ where: { id }, select: { requestDigest: true } });
      if (previous && previous.requestDigest !== requestDigest) throw new ConflictException('Submission ID already used');
      if (!previous) await this.abuse.feedbackBudget(ip);
      const release = (process.env.APP_RELEASE ?? process.env.GIT_SHA ?? '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64) || null;
      await this.prisma.$transaction(async tx => {
        // Retries return success only for the exact same validated payload.
        const created = await tx.feedbackResponse.createMany({ data: [{ id, survey: FEEDBACK_SURVEY, requestDigest, ...ratings, ...details, ...context, release }], skipDuplicates: true });
        const stored = await tx.feedbackResponse.findUniqueOrThrow({ where: { id }, select: { requestDigest: true } });
        if (stored.requestDigest !== requestDigest) throw new ConflictException('Submission ID already used');
        if (created.count && notes.length) await tx.feedbackNote.createMany({ data: notes.map((note, position) => ({
          id: randomUUID(), responseId: id, position, ...note,
        })) });
        if (created.count) await this.notifications.acceptedFeedback(tx, input, origin, release);
        await tx.feedbackPromptClaim.createMany({ data: [{ survey: FEEDBACK_SURVEY, networkKey: this.networkKey(ip), reason: 'submitted' }], skipDuplicates: true });
      });
      return { accepted: true, id };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Prisma errors can contain parameters. Do not put a visitor's free text in diagnostics.
      throw unavailable();
    }
  }

  async report(cursor?: string) {
    if (!this.prisma) throw unavailable();
    try {
      const [total, bins, responses] = await Promise.all([
        this.prisma.feedbackResponse.count({ where: { survey: FEEDBACK_SURVEY } }),
        this.prisma.$queryRaw<{ metric: string; value: number; count: number }[]>`
          SELECT score.metric, score.value, COUNT(*)::integer AS count
          FROM feedback_responses r CROSS JOIN LATERAL (VALUES
            ('visual',r.visual),('dataTrust',r.data_trust),('usability',r.usability),
            ('usefulness',r.usefulness),('aiTrace',r.ai_trace)
          ) AS score(metric,value)
          WHERE r.survey=${FEEDBACK_SURVEY} AND score.value IS NOT NULL
          GROUP BY score.metric,score.value`,
        this.prisma.feedbackResponse.findMany({
          where: { survey: FEEDBACK_SURVEY }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 101,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, createdAt: true, visual: true, dataTrust: true, usability: true, usefulness: true,
            aiTrace: true, aiComment: true, locale: true, source: true, release: true, playerUid: true, playerNickname: true,
            timeZone: true, screen: true, country: true, device: true, os: true, browser: true,
            notes: { orderBy: { position: 'asc' }, select: { id: true, category: true, page: true, message: true } } },
        }),
      ]);
      return { survey: FEEDBACK_SURVEY, total, metrics: feedbackSummary(bins), responses: responses.slice(0, 100),
        nextCursor: responses.length > 100 ? responses[99]!.id : null };
    } catch { throw unavailable(); }
  }

  async notes(cursor?: string, page?: string) {
    if (!this.prisma) throw unavailable();
    try {
      const where = { response: { survey: FEEDBACK_SURVEY }, ...(page ? { page: page === 'site' ? null : page } : {}) };
      const [total, rows] = await Promise.all([
        this.prisma.feedbackNote.count({ where }),
        this.prisma.feedbackNote.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 101,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, responseId: true, page: true, category: true, message: true, createdAt: true } }),
      ]);
      return { total, notes: rows.slice(0, 100), nextCursor: rows.length > 100 ? rows[99]!.id : null };
    } catch { throw unavailable(); }
  }
}
