import {prepareJsonImport} from '../import/json-import';
import {UploadViolation} from '../security/abuse.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Inject, InternalServerErrorException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { JobQueueService, type PublicJob } from '../queue/job-queue.service';
import { createHash, createPrivateKey, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { SEALED_FILES, canonicalPlayerUid, canPublishCapture,WishImportV2PayloadSchema, WishPitySnapshotSchema, playerServerRefusal, resolvePlayerServer, type WishImportV2Payload } from '@tof-hub/contracts';
import { WISH_BANNER_TYPES } from '@tof-hub/game-domain';
import { WISH_REPOSITORY_TOKEN, type IWishRepository } from './adapters/wish-repository.interface';
import { normalizeIp } from './wish-query.validation';
import { WishAccessService } from './wish-access.service';
import type { WishBannerEntity, WishRecordEntity } from './entities/wish.entities';
import {decryptEnvelope,IMPORT_KEY_ID,importPublicKeyInfo,loadImportKey,sealedEnvelopeSchema} from '../import/sealed-envelope';
import {NotificationsService} from '../notifications/notifications.service';
import { outdatedCaptureApp } from '../import/capture-import-policy';

const MAX_PLAINTEXT_BYTES = 8 * 1024 * 1024;

const EnvelopeSchema = sealedEnvelopeSchema('wish', {
  extra: {
    manual_pity: z.array(WishPitySnapshotSchema.pick({ banner_type: true, current_pity: true, captured_at: true })).max(4).optional(),
  },
});

type Envelope = z.infer<typeof EnvelopeSchema>;
type CatalogBanner = {
  id: string; name: string; name_en: string; name_ru: string; banner_type: WishBannerEntity['bannerType'];
  character_id: string; weapon_id?: string; matrix_id?: string; pity_target: number;
  start_date: string; end_date: string; currency: string; cashback_currency: string;
  featured_ssr: string[]; standard_pool_items?: string[]; raw_banner_codes?: string[];
  assets: WishBannerEntity['assets'];
};
type CatalogItem = { id: string; name: string; description_ru?: string; quality: string };
type ImportResult = { profileId: string; inserted: number; duplicates: number; unresolved: number; accessToken?: string; uid?: string; nickname?: string | null; region?: string | null; serverId?: string | null };

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function catalogBannerEntity(source: CatalogBanner): WishBannerEntity {
  return {
    id: source.id, name: source.name, nameEn: source.name_en,
    nameRu: source.name_ru, bannerType: source.banner_type,
    characterId: source.character_id, weaponId: source.weapon_id,
    matrixId: source.matrix_id, pityTarget: source.pity_target,
    startDate: source.start_date, endDate: source.end_date,
    currency: source.currency, cashbackCurrency: source.cashback_currency,
    featuredSsr: source.featured_ssr, standardPoolItems: source.standard_pool_items,
    assets: source.assets,
  };
}

function comparePulls(a: WishRecordEntity, b: WishRecordEntity): boolean {
  // With the same source ticks the timestamp is only a derived view of `group_ticks`: older capture
  // files labelled the game server's local time as UTC, so it may differ by the server offset.
  const sameTicks = a.groupTicks !== undefined && a.groupTicks === b.groupTicks;
  return a.itemId.toLowerCase() === b.itemId.toLowerCase() && a.rarity === b.rarity && a.bannerType === b.bannerType
    && a.bannerId === b.bannerId && a.slot === b.slot
    && (sameTicks || a.pullTimestamp === b.pullTimestamp)
    && JSON.stringify(a.compensation ?? null) === JSON.stringify(b.compensation ?? null);
}

function chronological(a: WishRecordEntity, b: WishRecordEntity): number {
  return a.pullTimestamp.localeCompare(b.pullTimestamp)
    || (a.groupTicks ?? '').localeCompare(b.groupTicks ?? '')
    || (a.itemIndex ?? 0) - (b.itemIndex ?? 0);
}

function assertKeys(value: unknown, keys: readonly string[]): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => !keys.includes(key))) {
    throw new BadRequestException('Unexpected wish history field');
  }
}

@Injectable()
export class WishImportService {
  private readonly queue: JobQueueService;
  private readonly privateKey: ReturnType<typeof createPrivateKey> | null;
  private readonly bannerCatalog: CatalogBanner[];
  private readonly itemCatalog: Map<string, CatalogItem>;

  constructor(
    @Inject(WISH_REPOSITORY_TOKEN) private readonly repository: IWishRepository,
    private readonly access: WishAccessService,
    @Optional() @Inject(JobQueueService) queue: JobQueueService | null = null,
    @Optional() @Inject(NotificationsService) private readonly notifications: NotificationsService | null = null,
  ) {
    this.queue = queue ?? new JobQueueService();
    this.queue.register('wish-import', (payload, { ip }) => this.process(payload, ip));
    this.privateKey = loadImportKey();
    const gameData = process.env.WISH_GAME_DATA_DIR ?? path.resolve(__dirname, '..', '..', '..', '..', 'apps', 'web', 'public', 'game-data');
    const bannerPath = path.join(gameData, 'wish-banners.json');
    const itemPath = path.join(gameData, 'en', 'datamine', 'items.json');
    this.bannerCatalog = fs.existsSync(bannerPath) ? JSON.parse(fs.readFileSync(bannerPath, 'utf8')) as CatalogBanner[] : [];
    const itemSource = fs.existsSync(itemPath) ? JSON.parse(fs.readFileSync(itemPath, 'utf8')) as Record<string, CatalogItem> : {};
    // UE item ids are case-insensitive: the client sends e.g. Matrix_SSR37_1 for catalog matrix_SSR37_1.
    this.itemCatalog = new Map(Object.values(itemSource).map((item) => [item.id.toLowerCase(), item]));
  }

  public async onApplicationBootstrap(): Promise<void> {
    try {
      const upgraded = await this.reconcileUnresolvedBanners();
      if (upgraded) console.log(`[wish] attributed ${upgraded} previously unresolved pulls to catalog banners`);
    } catch (error) {
      console.warn('[wish] unresolved banner reconciliation failed', error);
    }
  }

  /**
   * Pulls stored as `unresolved-*` before the generated catalog mapped their raw order code keep that
   * identity until the owner re-imports. Upgrade them in place from the current catalog (same rule as
   * the import path); codes the catalog still does not map stay unresolved.
   */
  public async reconcileUnresolvedBanners(): Promise<number> {
    const banners = new Map<string, WishBannerEntity>();
    const changed: WishRecordEntity[] = [];
    for (const record of await this.repository.getCommunityWishRecords()) {
      if (!record.bannerId.startsWith('unresolved-') || !record.rawBannerCode) continue;
      const source = this.bannerCatalog.find((candidate) => candidate.raw_banner_codes?.includes(record.rawBannerCode!));
      if (!source || source.banner_type !== record.bannerType) continue;
      const catalogItem = this.itemCatalog.get(record.itemId.toLowerCase());
      record.bannerId = source.id;
      if (catalogItem && record.itemName.toLowerCase() === record.itemId.toLowerCase()) record.itemName = catalogItem.name;
      record.isFeatured = record.rarity === 5 && source.featured_ssr.includes(record.itemId);
      record.streakOutcome = catalogItem && record.rarity === 5 && record.bannerType.includes('limited')
        ? (record.isFeatured ? 'win' : 'loss') : 'unknown';
      banners.set(source.id, catalogBannerEntity(source));
      changed.push(record);
    }
    for (const banner of banners.values()) await this.repository.saveBanner(banner);
    if (changed.length) await this.repository.updateWishRecordDerived(changed);
    return changed.length;
  }

  public getPublicKey(): { ready: boolean; key_id?: string; algorithm?: string; public_key_pem?: string } {
    // The wish import also needs the banner and item catalogs.
    if (this.bannerCatalog.length === 0 || this.itemCatalog.size === 0) return { ready: false };
    return importPublicKeyInfo(this.privateKey);
  }

  public getExporterCatalog(): { items: Record<string, number>; banners: Record<string, string>; banner_types: Record<string, string> } {
    const items: Record<string, number> = {};
    for (const item of this.itemCatalog.values()) {
      const rarity = item.quality === 'ITEM_QUALITY_LEGENDRY' ? 5
        : item.quality === 'ITEM_QUALITY_EPIC' ? 4
        : item.quality === 'ITEM_QUALITY_RARE' || item.quality === 'ITEM_QUALITY_COMMON' ? 3 : null;
      if (rarity) items[item.id] = rarity;
    }
    const banners: Record<string, string> = {};
    const banner_types: Record<string, string> = {};
    for (const banner of this.bannerCatalog) {
      for (const code of banner.raw_banner_codes ?? []) {
        banners[code] = banner.id;
        banner_types[code] = banner.banner_type;
      }
      for (const id of banner.featured_ssr) items[id] = 5;
    }
    return { items, banners, banner_types };
  }

  /**
   * POST /wish/import/jobs: the envelope is checked at once; decryption and the import wait in the shared queue
   * (docs/architecture/job-queue.md), one active operation per IP.
   */
  public async enqueue(body: unknown, ip: string, tokens:readonly string[]=[]): Promise<PublicJob> {
    if (!this.getPublicKey().ready) throw new ServiceUnavailableException('Wish import is not configured');
    if (Buffer.byteLength(JSON.stringify(body ?? null), 'utf8') > SEALED_FILES.wish.maxBytes) {
      throw new UploadViolation('File exceeds the 4 MiB limit');
    }
    body=prepareJsonImport('wish',body,this.privateKey);
    const parsed = EnvelopeSchema.safeParse(body);
    if (!parsed.success) throw new UploadViolation('Invalid .tofwish envelope');
    if (parsed.data.key_id !== IMPORT_KEY_ID) throw new BadRequestException('Unknown import key');
    return this.queue.enqueue('wish-import', Buffer.from(JSON.stringify({envelope:parsed.data,tokens:tokens.filter(token=>/^wtk_[a-f0-9]{48}$/.test(token)).slice(0,30)})), ip);
  }

  /** The job for the IP that queued it (a leaked id alone does not disclose pull counts or the profile id). */
  public getJob(id: string, requestIp?: string): Promise<PublicJob | null> {
    return this.queue.get(id, requestIp);
  }

  /** The queued work: decrypt, import, then grant the importer IP read access. */
  private async process(payload: Buffer, ip: string): Promise<ImportResult> {
    try {
      const queued=JSON.parse(payload.toString('utf8')) as {envelope:unknown;tokens:string[]};
      const envelope = EnvelopeSchema.parse(queued.envelope);
      const result = await this.importPayload(this.decrypt(envelope),ip,queued.tokens,
        owner => this.notifications?.acceptedImport('wish', envelope, owner) ?? Promise.resolve());
      // The updater IP gains read access; the first grant also mints the
      // device token returned once in the job result.
      const accessToken = this.access.grantImporterAccess(result.profileId, normalizeIp(ip));
      if (accessToken) result.accessToken = accessToken;
      return result;
    } catch (error) {
      if (error instanceof UploadViolation || error instanceof ForbiddenException || error instanceof BadRequestException || error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Import failed validation or could not be saved');
    }
  }

  private decrypt(envelope: Envelope): WishImportV2Payload {
    let parsed: unknown;
    try {
      parsed = decryptEnvelope(envelope,this.privateKey!,MAX_PLAINTEXT_BYTES);
    } catch {
      throw new UploadViolation('Invalid encrypted wish file');
    }
    const payload = this.validatePayload(parsed);
    if (!envelope.manual_pity?.length) return payload;
    const snapshots = payload.pity_snapshots?.filter(snapshot => !envelope.manual_pity!.some(value => value.banner_type === snapshot.banner_type)) ?? [];
    for (const value of envelope.manual_pity) {
      const latest = payload.batches.filter(batch => batch.banner_type === value.banner_type)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.group_ticks.localeCompare(b.group_ticks)).at(-1);
      snapshots.push({ ...value, source: 'manual', ...(latest ? {
        raw_banner_code: latest.raw_banner_code, group_ticks: latest.group_ticks,
        item_index: Math.max(...latest.pulls.map(pull => pull.index_in_batch)),
      } : {}) });
    }
    return this.validatePayload({ ...payload, pity_snapshots: snapshots });
  }

  /**
   * The capture app does not ship game catalogs: it may leave rarity, featured flags,
   * nickname and server empty. The site fills them from its generated catalogs and the
   * UID's origin-server prefix (including 7-digit servers). Missing item rarity is retained as unknown (0).
   */
  private completeFromCatalogs(source: Record<string, unknown>): void {
    const account = source.account as Record<string, unknown>;
    if(typeof account.uid==='string')account.uid=canonicalPlayerUid(account.uid,
      {serverId:typeof account.server_id==='string'?account.server_id:null});
    if (account.nickname === null) delete account.nickname;
    const { server, regionCode } = resolvePlayerServer({
      uid: typeof account.uid === 'string' ? account.uid : null,
      serverId: typeof account.server_id === 'string' ? account.server_id : null,
    });
    if ((account.server_id === null || account.server_id === undefined) && server) account.server_id = server.id;
    if ((account.region === 'unknown' || account.region === '') && regionCode) account.region = regionCode;
    for (const batch of source.batches as Record<string, unknown>[]) {
      const banner = this.bannerCatalog.find((candidate) => candidate.raw_banner_codes?.includes(String(batch.raw_banner_code)));
      // Capture versions used heuristics for this hint (e.g. ArtifactLottery_1
      // was exported as weapon_limited). Verified source-code mappings win.
      if (banner) batch.banner_type = banner.banner_type;
      for (const pull of batch.pulls as Record<string, unknown>[]) {
        const canonical = this.itemCatalog.get(String(pull.item_id).toLowerCase())?.id;
        if (canonical) pull.item_id = canonical;
        const itemId = String(pull.item_id);
        if (pull.rarity === null || pull.rarity === 0) pull.rarity = this.catalogRarity(itemId, banner) ?? 0;
        if (pull.is_featured === null) pull.is_featured = Boolean(banner && pull.rarity === 5 && banner.featured_ssr.includes(itemId));
      }
    }
  }

  private catalogRarity(itemId: string, banner?: CatalogBanner): number | null {
    if (banner?.featured_ssr.includes(itemId)) return 5;
    const quality = this.itemCatalog.get(itemId.toLowerCase())?.quality;
    return quality === 'ITEM_QUALITY_LEGENDRY' ? 5 : quality === 'ITEM_QUALITY_EPIC' ? 4
      : quality === 'ITEM_QUALITY_RARE' || quality === 'ITEM_QUALITY_COMMON' ? 3 : null;
  }

  private validatePayload(value: unknown): WishImportV2Payload {
    assertKeys(value, ['version', '$schema', 'export_metadata', 'account', 'batches', 'pity_snapshots']);
    const source = value as Record<string, unknown>;
    assertKeys(source.export_metadata, ['exported_at', 'exporter_name', 'exporter_version','scan']);
    assertKeys(source.account, ['uid', 'region', 'server_id', 'nickname', 'timezone', 'avatar_id', 'avatar_frame_id', 'server_utc_offset_minutes']);
    if (!Array.isArray(source.batches)) throw new BadRequestException('Invalid batches');
    for (const batch of source.batches) {
      assertKeys(batch, ['batch_id', 'banner_id', 'raw_banner_code', 'banner_type', 'group_ticks', 'timestamp', 'pulls']);
      const rawBatch = batch as Record<string, unknown>;
      if (!Array.isArray(rawBatch.pulls)) throw new BadRequestException('Invalid pulls');
      for (const pull of rawBatch.pulls) {
        assertKeys(pull, ['index_in_batch', 'track_pull_number', 'item_id', 'rarity', 'is_featured', 'slot', 'compensation']);
        const rawPull = pull as Record<string, unknown>;
        if (rawPull.compensation !== undefined) {
          assertKeys(rawPull.compensation, ['currency_id', 'amount', 'extra_items']);
          const compensation = rawPull.compensation as Record<string, unknown>;
          if (!Array.isArray(compensation.extra_items)) throw new BadRequestException('Invalid compensation');
          for (const item of compensation.extra_items) assertKeys(item, ['item_id', 'count']);
        }
      }
    }
    this.completeFromCatalogs(source);
    const parsed = WishImportV2PayloadSchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException('Invalid wish history schema');
    const payload = parsed.data;
    const outdated = outdatedCaptureApp(payload.export_metadata.exporter_version);
    if (outdated) throw new BadRequestException(`The capture app is older than ${outdated}: update it and export again`);
    if(!canPublishCapture(payload.export_metadata.scan))throw new BadRequestException('Test-server and unresolved wish histories are not accepted');
    if (source.$schema !== undefined && source.$schema !== 'https://tof-hub.com/schemas/wish-history-v2.json') throw new BadRequestException('Unknown wish schema');
    if (!Number.isFinite(Date.parse(payload.export_metadata.exported_at))
      || payload.export_metadata.exporter_name.length > 80
      || payload.export_metadata.exporter_version.length > 32) throw new BadRequestException('Invalid export metadata');
    if (!/^\d{6,24}$/.test(payload.account.uid) || !/^\d{1,16}$/.test(payload.account.server_id)) throw new BadRequestException('Invalid game account');
    const refusal = playerServerRefusal({ uid: payload.account.uid, serverId: payload.account.server_id });
    if (refusal === 'unknown-server') throw new BadRequestException('Wish histories from servers missing from the site catalog are not accepted');
    if (refusal) throw new BadRequestException('Wish histories from Warp (MMO) servers are not accepted yet');
    if ((payload.batches.length < 1 && !payload.pity_snapshots?.length) || payload.batches.length > 2000) throw new BadRequestException('Invalid batch count');
    if (payload.account.nickname && payload.account.nickname.length > 64) throw new BadRequestException('Nickname too long');
    if (payload.account.region.length > 32 || payload.account.timezone.length > 64) throw new BadRequestException('Account field too long');
    const snapshotTracks = new Set<string>();
    for (const snapshot of payload.pity_snapshots ?? []) {
      const target = snapshot.banner_type.includes('matrix') ? 40 : 80;
      if (snapshot.banner_type === 'black_nucleus' || snapshot.current_pity >= target || snapshotTracks.has(snapshot.banner_type)) throw new BadRequestException('Invalid pity snapshot');
      snapshotTracks.add(snapshot.banner_type);
      const parts = [snapshot.raw_banner_code, snapshot.group_ticks, snapshot.item_index];
      if (parts.some(part => part !== undefined) && parts.some(part => part === undefined)) throw new BadRequestException('Incomplete pity snapshot anchor');
    }
    let pullCount = 0;
    const identities = new Map<string, string>();
    for (const batch of payload.batches) {
      if (!/^[A-Za-z0-9_]{1,80}$/.test(batch.raw_banner_code)
        || !/^[A-Za-z0-9_-]{1,100}$/.test(batch.banner_id)
        || !/^\d{15,20}$/.test(batch.group_ticks)
        || batch.pulls.length < 1 || batch.pulls.length > 10
        || !Number.isFinite(Date.parse(batch.timestamp))) throw new BadRequestException('Invalid batch');
      const knownBanner = this.bannerCatalog.some((banner) => banner.raw_banner_codes?.includes(batch.raw_banner_code));
      if (!knownBanner && batch.raw_banner_code.startsWith('WeaponLottery_') && batch.banner_type !== 'weapon_limited') throw new BadRequestException('Weapon banner track mismatch');
      if (!knownBanner && batch.raw_banner_code.startsWith('ArtifactLottery_') && batch.banner_type !== 'matrix_limited') throw new BadRequestException('Matrix banner track mismatch');
      if (batch.banner_id.length > 100 || batch.batch_id.length > 100) throw new BadRequestException('Invalid identifier');
      const indexes = new Set<number>();
      for (const pull of batch.pulls) {
        if (indexes.has(pull.index_in_batch) || !/^[A-Za-z0-9_:-]{1,120}$/.test(pull.item_id)) throw new BadRequestException('Invalid pull');
        indexes.add(pull.index_in_batch);
        const identity = `${payload.account.uid}:${batch.raw_banner_code}:${batch.group_ticks}:${pull.index_in_batch}`;
        const signature = JSON.stringify([
          pull.item_id, pull.rarity, batch.banner_type, batch.timestamp, pull.track_pull_number ?? null,
          pull.slot ?? null, pull.compensation ?? null,
        ]);
        if (identities.has(identity) && identities.get(identity) !== signature) throw new ConflictException('Conflicting pulls in file');
        identities.set(identity, signature);
        pullCount++;
      }
    }
    if (pullCount > 20000) throw new BadRequestException('Too many pulls');
    return payload;
  }

  private async importPayload(payload: WishImportV2Payload,ip:string,tokens:readonly string[],beforeSave?:(owner:{uid:string;nickname:string|null})=>Promise<void>): Promise<ImportResult> {
    const uid = payload.account.uid;
    const oldProfile = await this.repository.getImportedProfileByUid(uid);
    if(oldProfile&&(!this.access.hasGrants(oldProfile.id)||(!this.access.checkAccess(oldProfile.id,{ip})&&!tokens.some(token=>this.access.checkToken(oldProfile.id,token))))) {
      throw new ForbiddenException({code:'WISH_ACCESS_REQUIRED',message:'Use a device token or the original importing network to update this history'});
    }
    if (oldProfile && (oldProfile.server !== payload.account.server_id || oldProfile.region !== payload.account.region)) {
      throw new ConflictException('UID already belongs to a different server or region');
    }
    const profileId = oldProfile?.id ?? `import-${randomUUID().replace(/-/g, '')}`;
    const existing = await this.repository.getAllWishRecords(profileId);
    const oldById = new Map(existing.map((record) => [record.id, record]));
    const oldBySource = new Map(existing.map(record => [`${record.rawBannerCode}:${record.groupTicks}:${record.itemIndex}`, record.id]));
    const banners = new Map<string, WishBannerEntity>();
    const records: WishRecordEntity[] = [];
    const pendingById = new Map<string, WishRecordEntity>();
    let unresolved = 0;
    for (const batch of payload.batches) {
      const sourceBanner = this.bannerCatalog.find((candidate) => candidate.raw_banner_codes?.includes(batch.raw_banner_code));
      if (sourceBanner && sourceBanner.banner_type !== batch.banner_type) throw new BadRequestException('Banner track mismatch');
      // The uploaded banner_id is advisory. Only generated raw-code mappings
      // can resolve the official banner identity.
      const bannerId = sourceBanner?.id ?? `unresolved-${sha256(`${batch.banner_type}:${batch.raw_banner_code}`).slice(0, 24)}`;
      if (sourceBanner && !banners.has(bannerId)) banners.set(bannerId, catalogBannerEntity(sourceBanner));
      if (!sourceBanner && !banners.has(bannerId)) {
        const pityTarget = batch.banner_type === 'black_nucleus' ? 0 : batch.banner_type.includes('matrix') ? 40 : 80;
        banners.set(bannerId, {
          id: bannerId, name: `Unresolved order ${batch.raw_banner_code}`,
          nameEn: `Unresolved order ${batch.raw_banner_code}`,
          nameRu: `Неопределённый заказ ${batch.raw_banner_code}`,
          bannerType: batch.banner_type, characterId: '', pityTarget,
          startDate: batch.timestamp, endDate: batch.timestamp,
          currency: 'unknown', cashbackCurrency: 'none', featuredSsr: [], assets: { background: '', splash: '', icon: '' },
        });
      }
      for (const pull of batch.pulls) {
        const id = oldBySource.get(`${batch.raw_banner_code}:${batch.group_ticks}:${pull.index_in_batch}`) ?? sha256(`${uid}:${batch.raw_banner_code}:${batch.group_ticks}:${pull.index_in_batch}`);
        const catalogItem = this.itemCatalog.get(pull.item_id.toLowerCase());
        const expectedRarity = this.catalogRarity(pull.item_id, sourceBanner);
        if (expectedRarity !== null && expectedRarity !== pull.rarity) throw new BadRequestException('Item rarity mismatch');
        const knownFeatured = Boolean(sourceBanner && pull.rarity === 5 && sourceBanner.featured_ssr.includes(pull.item_id));
        const record: WishRecordEntity = {
          id, profileId, bannerId, bannerType: batch.banner_type,
          itemId: pull.item_id, itemName: catalogItem?.name ?? pull.item_id,
          itemType: batch.banner_type.includes('matrix') ? 'matrix' : 'weapon',
          rarity: pull.rarity, trackPullNumber: pull.track_pull_number, pityCount: -1, isGuaranteedPity: false,
          isFeatured: knownFeatured,
          streakOutcome: sourceBanner && catalogItem && pull.rarity === 5 && batch.banner_type.includes('limited')
            ? (knownFeatured ? 'win' : 'loss') : 'unknown',
          slot: pull.slot, pullTimestamp: batch.timestamp, groupTicks: batch.group_ticks,
          rawBannerCode: batch.raw_banner_code,
          itemIndex: pull.index_in_batch, compensation: pull.compensation,
        };
        const old = oldById.get(id);
        if(old&&catalogItem&&old.itemId.toLowerCase()===record.itemId.toLowerCase()
          &&old.itemName.toLowerCase()===old.itemId.toLowerCase())old.itemName=record.itemName;
        // A raw code that the generated catalog resolves later (e.g. a rerun's own code) upgrades the
        // earlier unresolved row instead of conflicting with it.
        if (old && sourceBanner && old.bannerId.startsWith('unresolved-') && old.itemId.toLowerCase() === record.itemId.toLowerCase()) {
          old.bannerId = record.bannerId;
          old.itemName = record.itemName;
          old.isFeatured = record.isFeatured;
          old.streakOutcome = record.streakOutcome;
        }
        // A later catalog can identify previously unknown rarity without duplicating a pull.
        if(old&&old.rarity===0&&old.itemId.toLowerCase()===record.itemId.toLowerCase()&&record.rarity!==0) {
          old.rarity=record.rarity;old.itemName=record.itemName;
          old.isFeatured=record.isFeatured;old.streakOutcome=record.streakOutcome;
        }
        if(old&&record.rarity===0&&old.itemId.toLowerCase()===record.itemId.toLowerCase())record.rarity=old.rarity;
        if (old && record.trackPullNumber !== undefined) {
          if (old.trackPullNumber !== undefined && old.trackPullNumber !== record.trackPullNumber) throw new ConflictException('Conflicting track pull number');
          old.trackPullNumber = record.trackPullNumber;
        }
        if (old && !comparePulls(old, record)) throw new ConflictException('Existing pull conflicts with import');
        // Only a file that declares the server clock offset carries a true UTC time for these ticks.
        if (old && payload.account.server_utc_offset_minutes !== undefined && old.pullTimestamp !== record.pullTimestamp) old.pullTimestamp = record.pullTimestamp;
        if (!old && !pendingById.has(id)) {
          records.push(record);
          pendingById.set(id, record);
        }
        if (!sourceBanner || !catalogItem) unresolved++;
      }
    }

    // Pity is replayed from the full chronological track, including earlier
    // imports. Existing rows are not overwritten by an uploaded file.
    const merged = [...existing, ...records].sort(chronological);
    const snapshots = [...oldProfile?.pitySnapshots ?? []];
    for (const snapshot of payload.pity_snapshots ?? []) {
      const prior = snapshots.find(value => value.banner_type === snapshot.banner_type);
      if (prior && prior.captured_at > snapshot.captured_at) continue;
      const track = merged.filter(record => record.bannerType === snapshot.banner_type);
      if (snapshot.group_ticks !== undefined) {
        const anchorIndex = track.findIndex(record => record.rawBannerCode === snapshot.raw_banner_code
          && record.groupTicks === snapshot.group_ticks && record.itemIndex === snapshot.item_index);
        if (anchorIndex < 0) throw new BadRequestException('Pity snapshot anchor not found');
        const target = snapshot.banner_type.includes('matrix') ? 40 : 80;
        // The counter identifies a phase, not lifetime pulls. Choose the smallest
        // compatible cycle that fits the observed records and previous anchors.
        let minimum = anchorIndex + 1;
        for (let i = 0; i <= anchorIndex; i++) if (track[i].trackPullNumber !== undefined) minimum = Math.max(minimum, track[i].trackPullNumber! + anchorIndex - i);
        const phase = snapshot.current_pity || target;
        let number = phase + Math.max(0, Math.ceil((minimum - phase) / target)) * target;
        for (let i = anchorIndex; i >= 0; i--) {
          const known = track[i].trackPullNumber;
          if (known !== undefined) {
            if (known > number || (i === anchorIndex && (known - 1) % target + 1 !== phase)) throw new ConflictException('Pity snapshot conflicts with history');
            number = known;
          } else track[i].trackPullNumber = number;
          number--;
        }
      }
      if (prior) snapshots.splice(snapshots.indexOf(prior), 1);
      snapshots.push(snapshot);
    }
    // A newer history row invalidates an older bar snapshot. Keep the derived
    // record positions, but do not display a stale current counter.
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (merged.some(record => record.bannerType === snapshots[i].banner_type && record.pullTimestamp > snapshots[i].captured_at)) snapshots.splice(i, 1);
    }
    for (const type of WISH_BANNER_TYPES) {
      const track = merged.filter((record) => record.bannerType === type);
      const target = type === 'black_nucleus' ? 0 : type.includes('matrix') ? 40 : 80;
      let previousNumber = 0;
      let observedSinceAnchor = 0;
      for (const record of track) {
        observedSinceAnchor++;
        const number = record.trackPullNumber;
        if (number !== undefined && number - previousNumber < observedSinceAnchor) throw new ConflictException('Track pull numbers must increase chronologically');
        if (number !== undefined) {previousNumber = number; observedSinceAnchor = 0;}
        record.pityCount = number === undefined ? -1 : target ? (number - 1) % target + 1 : number;
        record.isGuaranteedPity = target > 0 && record.pityCount === target && record.rarity === 5;
      }
    }
    await beforeSave?.({uid,nickname:payload.account.nickname??oldProfile?.name??null});
    const now = new Date().toISOString();
    await this.repository.saveProfile({
      id: profileId, uid, name: payload.account.nickname ?? oldProfile?.name ?? `UID ${uid}`,
      avatarId: payload.account.avatar_id ?? oldProfile?.avatarId, avatarFrameId: payload.account.avatar_frame_id ?? oldProfile?.avatarFrameId,
      isDefault: false, isDemo: false, pitySnapshots: snapshots, region: payload.account.region,
      server: payload.account.server_id, createdAt: oldProfile?.createdAt ?? now, updatedAt: now,
    });
    for (const banner of banners.values()) await this.repository.saveBanner(banner);
    const inserted = await this.repository.insertWishRecords(records);
    await this.repository.updateWishRecordDerived(merged);
    const finalNickname = payload.account.nickname ?? oldProfile?.name ?? null;
    return {
      profileId,
      inserted,
      duplicates: payload.batches.reduce((sum, batch) => sum + batch.pulls.length, 0) - inserted,
      unresolved,
      uid,
      nickname: finalNickname,
      region: payload.account.region ?? null,
      serverId: payload.account.server_id ?? null,
    };
  }
}
