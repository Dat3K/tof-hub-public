import { BadRequestException, Body, Controller, ForbiddenException, Get, Header, Headers, HttpCode, Ip, Module, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { FEEDBACK_PATHS } from '@tof-hub/config';
import { FeedbackPromptClaimSchema, FeedbackSubmissionSchema } from '@tof-hub/contracts';
import { checkAdminKey } from '../security/admin-key';
import { FeedbackService } from './feedback.service';
import { feedbackOrigin } from './feedback-origin';
import { NotificationsModule } from '../notifications/notifications.module';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post() @HttpCode(201) @Header('Cache-Control', 'no-store')
  submit(@Body() body: unknown, @Ip() ip: string, @Headers('x-feedback-request') requestMarker?: string,
    @Headers() headers: Record<string, string | string[] | undefined> = {}) {
    if (requestMarker !== '1') throw new ForbiddenException('Same-origin feedback requests only');
    const parsed = FeedbackSubmissionSchema.safeParse(body);
    if (!parsed.success || parsed.data.notes.some(note => note.page !== null && !FEEDBACK_PATHS.includes(note.page))) {
      throw new BadRequestException('Invalid feedback. Choose a rating or write a comment.');
    }
    return this.feedback.submit(parsed.data, ip, feedbackOrigin(headers));
  }

  @Post('prompt/claim') @HttpCode(200) @Header('Cache-Control', 'no-store')
  claim(@Body() body: unknown, @Ip() ip: string, @Headers('x-feedback-request') requestMarker?: string) {
    if (requestMarker !== '1') throw new ForbiddenException('Same-origin feedback requests only');
    const parsed = FeedbackPromptClaimSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid invitation reason');
    return this.feedback.claim(ip, parsed.data.reason);
  }

  @Get('admin') @Header('Cache-Control', 'no-store')
  report(@Headers('x-admin-key') key?: string, @Query('cursor') cursor?: string) {
    const expected = process.env.FEEDBACK_ADMIN_KEY || process.env.ADMIN_KEY;
    if (!expected || expected.length < 32 || !checkAdminKey(key, expected)) throw new ForbiddenException();
    if (cursor && !z.uuid().safeParse(cursor).success) throw new BadRequestException('Invalid cursor');
    return this.feedback.report(cursor);
  }

  @Get('admin/notes') @Header('Cache-Control', 'no-store')
  notes(@Headers('x-admin-key') key?: string, @Query('cursor') cursor?: string, @Query('page') page?: string) {
    const expected = process.env.FEEDBACK_ADMIN_KEY || process.env.ADMIN_KEY;
    if (!expected || expected.length < 32 || !checkAdminKey(key, expected)) throw new ForbiddenException();
    if ((cursor && !z.uuid().safeParse(cursor).success) || (page && page !== 'site' && !FEEDBACK_PATHS.includes(page))) throw new BadRequestException('Invalid filter');
    return this.feedback.notes(cursor, page);
  }
}

@Module({ imports: [NotificationsModule], controllers: [FeedbackController], providers: [FeedbackService] })
export class FeedbackModule {}
