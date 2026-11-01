import {
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  Query,
  Post,
  Body,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WishService } from './wish.service';
import { WishImportService } from './wish-import.service';
import { WishAccessService } from './wish-access.service';
import { checkAdminKey } from '../security/admin-key';
import {
  assertExportRateLimit,
  assertJobId,
  assertReadableProfileId,
  isDemoProfileId,
  parseAnalyticsQuery,
  parsePullsQuery,
} from './wish-query.validation';

type WishRequest = { ip?: string; socket: { remoteAddress?: string } };

function requestIp(request: WishRequest): string {
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}
import type {
  WishBannerDto,
  WishProfileSummaryDto,
  WishPullsResponseDto,
  WishAnalyticsDto,
  WishImportV2Payload,
} from '@tof-hub/contracts';

@Controller('wish')
export class WishController {
  constructor(
    private readonly wishService: WishService,
    private readonly wishImport: WishImportService,
    private readonly access: WishAccessService
  ) {}

  private assertProfileAccess(
    profileId: string,
    request: WishRequest,
    token: string | undefined
  ): void {
    // The demo profile stays public; imported profiles require either a
    // device token (survives IP changes) or a previously seen updater IP.
    if (isDemoProfileId(profileId)) return;
    if (this.access.checkAccess(profileId, { token, ip: requestIp(request) })) return;
    throw new NotFoundException('Profile not found');
  }

  @Get('import/public-key')
  public getImportPublicKey() {
    return this.wishImport.getPublicKey();
  }

  @Get('import/catalog')
  public getImportCatalog() {
    return this.wishImport.getExporterCatalog();
  }

  @Post('import/jobs')
  public createImportJob(@Body() body: unknown, @Req() request: WishRequest,@Headers('x-wish-import-tokens') tokenHeader?:string) {
    const tokens=typeof tokenHeader==='string'&&tokenHeader.length<=2000?tokenHeader.split(','):[];
    return this.wishImport.enqueue(body, requestIp(request),tokens);
  }

  @Get('import/jobs/:jobId')
  public async getImportJob(
    @Param('jobId') jobId: string,
    @Req() request: WishRequest
  ) {
    assertJobId(jobId);
    const job = await this.wishImport.getJob(jobId, requestIp(request));
    if (!job) throw new NotFoundException('Import job not found');
    return job;
  }

  @Get('banners')
  public async getBanners(): Promise<{ success: boolean; data: WishBannerDto[] }> {
    const banners = await this.wishService.getBanners();
    return { success: true, data: banners };
  }

  @Get('tally')
  public async getCommunityTally() {
    return { success: true, data: await this.wishService.getCommunityTally() };
  }

  /** Dev1 directory of imported players. Admin key only: profile histories stay behind their own access grants. */
  @Get('players') @Header('Cache-Control', 'no-store')
  public async getCommunityPlayers(@Headers('x-admin-key') key?: string) {
    const expected = process.env.WISH_ADMIN_KEY || process.env.ADMIN_KEY;
    if (!expected || expected.length < 32 || !checkAdminKey(key, expected)) throw new ForbiddenException();
    return { success: true, data: await this.wishService.getCommunityPlayers() };
  }

  @Get('profiles/:profileId/imported')
  public async getImportedProfile(
    @Param('profileId') profileId: string,
    @Req() request: WishRequest,
    @Headers('x-wish-token') headerToken?: string,
    @Query('token') queryToken?: string
  ) {
    assertReadableProfileId(profileId);
    this.assertProfileAccess(profileId, request, headerToken ?? queryToken);
    return this.wishService.getImportedProfile(profileId);
  }

  @Get('profiles/:profileId/summary')
  public async getSummary(
    @Param('profileId') profileId: string,
    @Req() request: WishRequest,
    @Headers('x-wish-token') headerToken?: string,
    @Query('token') queryToken?: string
  ): Promise<{ success: boolean; data: WishProfileSummaryDto }> {
    assertReadableProfileId(profileId);
    this.assertProfileAccess(profileId, request, headerToken ?? queryToken);
    const summary = await this.wishService.getProfileSummary(profileId);
    return { success: true, data: summary };
  }

  @Get('profiles/:profileId/pulls')
  public async getPulls(
    @Param('profileId') profileId: string,
    @Req() request: WishRequest,
    @Headers('x-wish-token') headerToken?: string,
    @Query('token') queryToken?: string,
    @Query('bannerType') bannerType?: string,
    @Query('bannerId') bannerId?: string,
    @Query('rarity') rarity?: string,
    @Query('streakOutcome') streakOutcome?: string,
    @Query('slot') slot?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ): Promise<{ success: boolean; data: WishPullsResponseDto }> {
    assertReadableProfileId(profileId);
    this.assertProfileAccess(profileId, request, headerToken ?? queryToken);
    const parsed = parsePullsQuery({ bannerType, bannerId, rarity, streakOutcome, slot, cursor, limit });

    const res = await this.wishService.getPulls({
      profileId,
      bannerType: parsed.bannerType,
      bannerId: parsed.bannerId,
      rarity: parsed.rarity,
      streakOutcome: parsed.streakOutcome,
      slot: parsed.slot,
      cursor: parsed.cursor,
      limit: parsed.limit,
    });

    return { success: true, data: res };
  }

  @Get('profiles/:profileId/analytics')
  public async getAnalytics(
    @Param('profileId') profileId: string,
    @Req() request: WishRequest,
    @Headers('x-wish-token') headerToken?: string,
    @Query('token') queryToken?: string,
    @Query('bannerType') bannerType?: string,
    @Query('bannerId') bannerId?: string
  ): Promise<{ success: boolean; data: WishAnalyticsDto }> {
    assertReadableProfileId(profileId);
    this.assertProfileAccess(profileId, request, headerToken ?? queryToken);
    const parsed = parseAnalyticsQuery({ bannerType, bannerId });
    const analytics = await this.wishService.getAnalytics(
      profileId,
      parsed.bannerType,
      parsed.bannerId
    );
    return { success: true, data: analytics };
  }

  @Get('profiles/:profileId/export')
  public async exportData(
    @Param('profileId') profileId: string,
    @Req() request: WishRequest,
    @Headers('x-wish-token') headerToken?: string,
    @Query('token') queryToken?: string
  ): Promise<{ success: boolean; data: WishImportV2Payload }> {
    assertReadableProfileId(profileId);
    this.assertProfileAccess(profileId, request, headerToken ?? queryToken);
    assertExportRateLimit(requestIp(request));
    const payload = await this.wishService.exportProfile(profileId);
    return { success: true, data: payload };
  }

  @Post('profiles/:profileId/tokens')
  public issueDeviceToken(
    @Param('profileId') profileId: string,
    @Req() request: WishRequest,
    @Headers('x-wish-token') headerToken?: string,
    @Query('token') queryToken?: string,
    @Body() body?: { label?: string }
  ): { success: boolean; data: { token: string } } {
    assertReadableProfileId(profileId);
    if (isDemoProfileId(profileId)) throw new ForbiddenException('Demo profile needs no tokens');
    this.assertProfileAccess(profileId, request, headerToken ?? queryToken);
    const label = typeof body?.label === 'string' ? body.label : undefined;
    return { success: true, data: { token: this.access.issueDeviceToken(profileId, label) } };
  }

  @Delete('profiles/:profileId/tokens')
  public revokeDeviceToken(
    @Param('profileId') profileId: string,
    @Headers('x-wish-token') headerToken?: string,
    @Query('token') queryToken?: string
  ): { success: boolean; data: { revoked: boolean } } {
    assertReadableProfileId(profileId);
    // Revocation is destructive: only the token itself can revoke itself.
    const revoked = this.access.revokeToken(profileId, headerToken ?? queryToken);
    if (!revoked) throw new NotFoundException('Token not found');
    return { success: true, data: { revoked: true } };
  }

  @Delete('profiles/:profileId/ips')
  public clearProfileIps(
    @Param('profileId') profileId: string,
    @Headers('x-wish-token') headerToken?: string,
    @Query('token') queryToken?: string
  ): { success: boolean; data: { cleared: boolean } } {
    assertReadableProfileId(profileId);
    if (!this.access.checkToken(profileId, headerToken ?? queryToken)) {
      throw new ForbiddenException('Device token required');
    }
    this.access.clearIps(profileId);
    return { success: true, data: { cleared: true } };
  }
}
