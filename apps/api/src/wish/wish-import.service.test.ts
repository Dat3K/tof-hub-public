import { afterEach, describe, expect, it } from 'vitest';
import { createCipheriv, generateKeyPairSync, publicEncrypt, randomBytes, constants } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteWishRepository } from './adapters/sqlite-wish-repository';
import { WishAccessService } from './wish-access.service';
import { WishImportService } from './wish-import.service';
import { WishService } from './wish.service';
import type { PublicJob } from '../queue/job-queue.service';
import {scanFixture} from '../import/scan-session.fixture';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinishedJob = PublicJob & { result?: any };
const directories: string[] = [];

afterEach(() => {
  delete process.env.WISH_IMPORT_PRIVATE_KEY_PEM;
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function seal(payload: unknown, publicKey: string, keyId: string) {
  const key = randomBytes(32);
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(`tof-hub-wish-sealed:1:${keyId}`));
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(payload))), cipher.final()]);
  return {
    format: 'tof-hub-wish-sealed', version: 1, key_id: keyId,
    wrapped_key: publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key).toString('base64url'),
    nonce: nonce.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'),
  };
}

async function awaitFinished(service: WishImportService, id: string): Promise<FinishedJob> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const job = (await service.getJob(id));
    if (job?.state === 'complete' || job?.state === 'failed') return job as FinishedJob;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Import did not finish');
}

describe('WishImportService', () => {
  it('uses verified raw codes over capture track hints across permanent and limited orders', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wish-import-'));
    directories.push(directory);
    const repository = new SqliteWishRepository(path.join(directory, 'wish.sqlite'));
    await repository.init();
    const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const archived:Array<[string,unknown,unknown]>=[];
    const service = new WishImportService(repository, new WishAccessService(path.join(directory, 'access.json')),null,
      {acceptedImport:async(kind:string,envelope:unknown,owner:unknown)=>{archived.push([kind,envelope,owner]);}} as never);
    const publicKey = service.getPublicKey();
    const payload = {
      version: 2,
      export_metadata: { exported_at: '2026-09-29T00:00:00.000Z', exporter_name: 'tof-live-capture', exporter_version: '2.0.0' },
      account: { uid: '1300242918', avatar_id: 'Avatar05', avatar_frame_id: 'AvatarFrame_100', region: 'unknown', server_id: null, nickname: null, timezone: 'UTC' },
      batches: [
        ['WeaponLottery_2', 'standard_weapon', 'digger_thunder'],
        ['ArtifactLottery_1', 'standard_matrix', 'Matrix_SSR37_1'],
        ['WeaponLottery_1', 'black_nucleus', 'digger_thunder'],
        ['WeaponLottery_ZY_1', 'weapon_limited', 'Zoey_Phy'],
        ['ArtifactLottery_ZY_1', 'matrix_limited', 'Matrix_SSR37_1'],
      ].map(([code, , item], index) => ({
        batch_id: `batch_${code}`, banner_id: 'untrusted-hint', raw_banner_code: code,
        // Older Capture exports labelled ArtifactLottery_1 as weapon_limited.
        banner_type: 'weapon_limited', group_ticks: `63894700000000000${index}`,
        timestamp: '2026-09-29T00:00:00.000Z',
        pulls: [{ index_in_batch: 0, item_id: item, rarity: null, is_featured: null }],
      })),
    };
    const envelope = seal(payload, publicKey.public_key_pem!, publicKey.key_id!);
    for(const environment of ['test','unknown'] as const) {
      const rejectedPayload={...payload,export_metadata:{...payload.export_metadata,scan:scanFixture(environment)}};
      const rejected=await awaitFinished(service,(await service.enqueue(seal(rejectedPayload,publicKey.public_key_pem!,publicKey.key_id!),'192.0.2.41')).id);
      expect(rejected.state).toBe('failed');expect(rejected.error?.message).toContain('not accepted');
      expect(await repository.getImportedProfileByUid(payload.account.uid)).toBeNull();
    }
    expect(archived).toHaveLength(0);
    const damaged={...envelope,tag:'A'.repeat(22)};
    const rejectedFile=await awaitFinished(service,(await service.enqueue(damaged,'192.0.2.41')).id);
    expect(rejectedFile.state).toBe('failed');
    expect(archived).toHaveLength(0);
    const completed = await awaitFinished(service, (await service.enqueue(envelope, '192.0.2.41',['wtk_'+'a'.repeat(48)])).id);
    expect(archived).toEqual([['wish',envelope,{uid:payload.account.uid,nickname:null}]]);
    expect(archived[0]![1]).not.toHaveProperty('tokens');
    expect(completed.error).toBeUndefined();
    expect(completed.state).toBe('complete');
    expect(completed.result).toMatchObject({ inserted: 5, duplicates: 0, unresolved: 1 });
    const records = await repository.getAllWishRecords(completed.result!.profileId);
    expect(records).toHaveLength(5);
    expect(await repository.getProfile(completed.result!.profileId)).toMatchObject({ avatarId:'Avatar05', avatarFrameId:'AvatarFrame_100' });
    expect(records.map((record) => [record.rawBannerCode, record.bannerType, record.bannerId])).toEqual(expect.arrayContaining([
      ['WeaponLottery_2', 'standard_weapon', 'standard-weapon'],
      ['ArtifactLottery_1', 'standard_matrix', 'standard-matrix'],
      ['WeaponLottery_1', 'black_nucleus', 'black-nucleus'],
      ['WeaponLottery_ZY_1', 'weapon_limited', 'weapon-zoey'],
      ['ArtifactLottery_ZY_1', 'matrix_limited', 'matrix-zoey'],
    ]));
    expect(records.find((record) => record.bannerType === 'black_nucleus')).toMatchObject({ pityCount: -1, isGuaranteedPity: false });
    expect(records.find((record) => record.bannerId === 'weapon-zoey')).toMatchObject({ isFeatured: true, rarity: 5 });
    const repeated = await awaitFinished(service, (await service.enqueue(envelope, '192.0.2.41')).id);
    expect(repeated.result).toMatchObject({ inserted: 0, duplicates: 5 });
    const withoutAppearance = { ...payload, account: {...payload.account, avatar_id:undefined, avatar_frame_id:undefined} };
    const olderFile = await awaitFinished(service, (await service.enqueue(seal(withoutAppearance, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.41')).id);
    expect(olderFile.result).toMatchObject({inserted:0,duplicates:5});
    expect(await repository.getProfile(completed.result!.profileId)).toMatchObject({avatarId:'Avatar05',avatarFrameId:'AvatarFrame_100'});
    const withCounters = { ...envelope, manual_pity: [
      { banner_type: 'weapon_limited', current_pity: 23, captured_at: '2026-09-29T01:00:00.000Z' },
      { banner_type: 'matrix_limited', current_pity: 31, captured_at: '2026-09-29T01:00:00.000Z' },
    ] };
    const counterImport = await awaitFinished(service, (await service.enqueue(withCounters, '192.0.2.41')).id);
    expect(counterImport.error).toBeUndefined();
    expect(counterImport.result).toMatchObject({ inserted: 0, duplicates: 5 });
    expect((await repository.getAllWishRecords(completed.result!.profileId)).find(record => record.bannerId === 'weapon-zoey'))
      .toMatchObject({ trackPullNumber: 23, pityCount: 23 });
    expect((await repository.getProfile(completed.result!.profileId))?.pitySnapshots).toEqual(expect.arrayContaining([
      expect.objectContaining({ banner_type: 'matrix_limited', current_pity: 31, source: 'manual' }),
    ]));
    const counterRepeat = await awaitFinished(service, (await service.enqueue(withCounters, '192.0.2.41')).id);
    expect(counterRepeat.result).toMatchObject({ inserted: 0, duplicates: 5 });
    const olderCounter = await awaitFinished(service, (await service.enqueue({ ...envelope, manual_pity: [
      { banner_type: 'weapon_limited', current_pity: 22, captured_at: '2026-09-29T00:30:00.000Z' },
    ] }, '192.0.2.41')).id);
    expect(olderCounter.error).toBeUndefined();
    expect((await repository.getProfile(completed.result!.profileId))?.pitySnapshots?.find(value => value.banner_type === 'weapon_limited')?.current_pity).toBe(23);
    const invalidCounter = await awaitFinished(service, (await service.enqueue({ ...envelope, manual_pity: [
      { banner_type: 'matrix_limited', current_pity: 40, captured_at: '2026-09-29T01:00:00.000Z' },
    ] }, '192.0.2.41')).id);
    expect(invalidCounter.state).toBe('failed');
    const anchored = { ...payload, batches: payload.batches.map((batch, i) => ({ ...batch,
      pulls: batch.pulls.map(pull => ({ ...pull, track_pull_number: [41, 31, 1, 23, 31][i] })),
    })) };
    const enriched = await awaitFinished(service, (await service.enqueue(seal(anchored, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.41')).id);
    expect(enriched.result).toMatchObject({ inserted: 0, duplicates: 5 });
    expect((await repository.getAllWishRecords(completed.result!.profileId)).find(record => record.bannerId === 'weapon-zoey'))
      .toMatchObject({ trackPullNumber: 23, pityCount: 23, isGuaranteedPity: false });
    await repository.close();
    await repository.init();
    expect(await repository.getProfile(completed.result!.profileId)).toMatchObject({avatarId:'Avatar05',avatarFrameId:'AvatarFrame_100'});
    expect((await repository.getAllWishRecords(completed.result!.profileId)).find(record => record.bannerId === 'standard-weapon'))
      .toMatchObject({ trackPullNumber: 41, pityCount: 41 });
    const conflictingAnchor = structuredClone(anchored);
    conflictingAnchor.batches[3].pulls[0].track_pull_number = 24;
    const conflict = await awaitFinished(service, (await service.enqueue(seal(conflictingAnchor, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.41')).id);
    expect(conflict.state).toBe('failed');
    expect(conflict.error?.message).toBe('Conflicting track pull number');
    const unknown = structuredClone(payload);
    unknown.batches = [{ ...unknown.batches[0], raw_banner_code: 'WeaponLottery_unknown', banner_type: 'standard_matrix' }];
    const rejected = await awaitFinished(service, (await service.enqueue(seal(unknown, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.41')).id);
    expect(rejected.state).toBe('failed');
    expect(rejected.error?.message).toBe('Weapon banner track mismatch');
    expect(await repository.getAllWishRecords(completed.result!.profileId)).toHaveLength(5);
    await repository.close();
  });

  it('keeps game standard pity snapshots stamped with the anchored last pull time', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wish-import-'));
    directories.push(directory);
    const repository = new SqliteWishRepository(path.join(directory, 'wish.sqlite'));
    await repository.init();
    const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const service = new WishImportService(repository, new WishAccessService(path.join(directory, 'access.json')));
    const publicKey = service.getPublicKey();
    // source observation: one standard matrix pull, lottery-state w8 = 11 (11/40 on screen); Weapons Galore 32/80
    // has no captured history row, so its snapshot carries no anchor.
    const payload = {
      version: 2,
      export_metadata: { exported_at: '2026-10-06T16:53:00.000Z', exporter_name: 'tof-live-capture', exporter_version: '2.0.0' },
      account: { uid: '1300506653', region: 'unknown', server_id: null, timezone: 'UTC' },
      pity_snapshots: [
        { banner_type: 'standard_weapon', current_pity: 32, captured_at: '2026-08-24T21:30:18.000Z', source: 'game' },
        { banner_type: 'standard_matrix', current_pity: 11, captured_at: '2026-10-06T18:52:00.000Z', source: 'game',
          raw_banner_code: 'ArtifactLottery_1', group_ticks: '639269095205500000', item_index: 0 },
      ],
      batches: [{
        batch_id: 'batch_ArtifactLottery_1_639269095205500000', banner_id: 'ArtifactLottery_1', raw_banner_code: 'ArtifactLottery_1',
        banner_type: 'standard_matrix', group_ticks: '639269095205500000', timestamp: '2026-10-06T18:52:00.000Z',
        pulls: [{ index_in_batch: 0, item_id: 'matrix_SR2_2', rarity: null, is_featured: null }],
      }],
    };
    const job = await awaitFinished(service, (await service.enqueue(seal(payload, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.41')).id);
    expect(job.error).toBeUndefined();
    const records = await repository.getAllWishRecords(job.result!.profileId);
    expect(records.find(record => record.rawBannerCode === 'ArtifactLottery_1')).toMatchObject({ trackPullNumber: 11, pityCount: 11 });
    const snapshots = (await repository.getProfile(job.result!.profileId))?.pitySnapshots;
    expect(snapshots?.map(snapshot => [snapshot.banner_type, snapshot.current_pity, snapshot.source]))
      .toEqual(expect.arrayContaining([['standard_weapon', 32, 'game'], ['standard_matrix', 11, 'game']]));
    // The legacy timestamp above is the server's local clock (+2 h). A file that declares the offset
    // corrects it; re-importing the legacy file afterwards is a duplicate, not a conflict.
    const corrected = { ...payload, pity_snapshots: undefined,
      account: { ...payload.account, server_utc_offset_minutes: 120 },
      batches: payload.batches.map(batch => ({ ...batch, timestamp: '2026-10-06T16:52:00.000Z' })) };
    const fixedJob = await awaitFinished(service, (await service.enqueue(seal(corrected, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.41')).id);
    expect(fixedJob.error).toBeUndefined();
    expect(fixedJob.result).toMatchObject({ inserted: 0, duplicates: 1 });
    const fixedRecord = async () => (await repository.getAllWishRecords(job.result!.profileId)).find(record => record.rawBannerCode === 'ArtifactLottery_1');
    expect(await fixedRecord()).toMatchObject({ pullTimestamp: '2026-10-06T16:52:00.000Z', trackPullNumber: 11 });
    const legacyAgain = await awaitFinished(service, (await service.enqueue(seal({ ...payload, pity_snapshots: undefined }, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.41')).id);
    expect(legacyAgain.error).toBeUndefined();
    expect((await fixedRecord())?.pullTimestamp).toBe('2026-10-06T16:52:00.000Z');
    await repository.close();
  });

  it('attributes stored unresolved pulls once the catalog maps their raw code, without a re-import', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wish-import-'));
    directories.push(directory);
    const repository = new SqliteWishRepository(path.join(directory, 'wish.sqlite'));
    await repository.init();
    try {
      const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
      process.env.WISH_IMPORT_PRIVATE_KEY_PEM = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      const service = new WishImportService(repository, new WishAccessService(path.join(directory, 'access.json')));
      const publicKey = service.getPublicKey();
      // Controlled catalog-update fixture: hide one mapped code during the import, then restore it.
      const catalog = (service as unknown as { bannerCatalog: { id: string; raw_banner_codes?: string[] }[] }).bannerCatalog;
      const banner = catalog.find(item => item.raw_banner_codes?.length && item.id.startsWith('weapon-'))!;
      const code = banner.raw_banner_codes![0];
      const saved = banner.raw_banner_codes;
      banner.raw_banner_codes = saved!.filter(value => value !== code);
      const batch = (rawCode: string, ticks: string) => ({
        batch_id: `batch_${rawCode}_${ticks}`, banner_id: rawCode, raw_banner_code: rawCode, banner_type: 'weapon_limited',
        group_ticks: ticks, timestamp: '2026-10-06T16:50:00.000Z',
        pulls: [{ index_in_batch: 0, item_id: 'bow_fire', rarity: null, is_featured: null }],
      });
      const job = await awaitFinished(service, (await service.enqueue(seal({
        version: 2,
        export_metadata: { exported_at: '2026-10-06T18:21:52.877Z', exporter_name: 'tof-live-capture', exporter_version: '2.0.0' },
        account: { uid: '1300506653', region: 'unknown', server_id: null, timezone: 'UTC' },
        batches: [batch(code, '639269094000000000'), batch('WeaponLottery_NotInCatalog_1', '639269095000000000')],
      }, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.41')).id);
      expect(job.error).toBeUndefined();
      banner.raw_banner_codes = saved;

      expect(await service.reconcileUnresolvedBanners()).toBe(1);
      const records = await repository.getAllWishRecords(job.result!.profileId);
      expect(records.find(record => record.rawBannerCode === code)?.bannerId).toBe(banner.id);
      expect(records.find(record => record.rawBannerCode === 'WeaponLottery_NotInCatalog_1')?.bannerId).toMatch(/^unresolved-/);
      expect(await service.reconcileUnresolvedBanners()).toBe(0);
      expect(await new WishService(repository).getCommunityPlayers()).toEqual([expect.objectContaining({
        id: job.result!.profileId, total_pulls: 2, unresolved_pulls: 1,
        pulls_by_track: { weapon_limited: 2, matrix_limited: 0, standard_weapon: 0, standard_matrix: 0, black_nucleus: 0 },
      })]);
    } finally { await repository.close(); }
  });

  it('upgrades rerun rows and numbers the shared event track from the anchored game counter', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wish-import-'));
    directories.push(directory);
    const repository = new SqliteWishRepository(path.join(directory, 'wish.sqlite'));
    await repository.init();
    try {
    const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const access = new WishAccessService(path.join(directory, 'access.json'));
    const service = new WishImportService(repository, access);
    const publicKey = service.getPublicKey();
    // The user's 2026-10-06 file: ZY event plus the Berry rerun (raw codes *_Mei_1), server-local times.
    const rows: [string, string, string, string, string][] = [
      ['WeaponLottery_ZY_1', 'weapon_limited', '639254655207570000', '2026-09-20T01:45:20.000Z', 'bow_fire'],
      ['WeaponLottery_ZY_1', 'weapon_limited', '639254655284690000', '2026-09-20T01:45:28.000Z', 'bow_fire'],
      ['WeaponLottery_ZY_1', 'weapon_limited', '639254665056570000', '2026-09-20T02:01:45.000Z', 'cannon_ice'],
      ['WeaponLottery_ZY_1', 'weapon_limited', '639254683125690000', '2026-09-20T02:31:52.000Z', 'sword_thunder'],
      ['ArtifactLottery_ZY_1', 'matrix_limited', '639255472211890000', '2026-09-21T00:27:01.000Z', 'matrix_R4_2'],
      ['WeaponLottery_ZY_1', 'weapon_limited', '639256179390190000', '2026-09-21T20:05:39.000Z', 'sword_thunder'],
      ['WeaponLottery_ZY_1', 'weapon_limited', '639269094076850000', '2026-10-06T18:50:07.000Z', 'bow_fire'],
      ['ArtifactLottery_ZY_1', 'matrix_limited', '639269094258530000', '2026-10-06T18:50:25.000Z', 'matrix_SR7_2'],
      ['WeaponLottery_Mei_1', 'weapon_limited', '639269094493940000', '2026-10-06T18:50:49.000Z', 'sword_thunder'],
      ['ArtifactLottery_Mei_1', 'matrix_limited', '639269094747440000', '2026-10-06T18:51:14.000Z', 'matrix_R3_4'],
    ];
    const batches = (shiftHours: number) => rows.map(([code, type, ticks, timestamp, item]) => ({
      batch_id: `batch_${code}_${ticks}`, banner_id: code, raw_banner_code: code, banner_type: type, group_ticks: ticks,
      timestamp: new Date(Date.parse(timestamp) - shiftHours * 3600000).toISOString(),
      pulls: [{ index_in_batch: 0, item_id: item, rarity: null, is_featured: null }],
    }));
    const account = { uid: '1300506653', region: 'unknown', server_id: null, timezone: 'UTC' };
    const meta = { exported_at: '2026-10-06T18:21:52.877Z', exporter_name: 'tof-live-capture', exporter_version: '2.0.0-dev' };
    // Before the catalog knew the rerun codes they were imported as unresolved orders.
    const catalog = (service as unknown as { bannerCatalog: { raw_banner_codes?: string[] }[] }).bannerCatalog;
    // Controlled catalog-update fixtures, independent of the production raw-code registry.
    // This test exercises re-attribution after a mapping appears; it does not assert game banner facts.
    for (const [id,code] of [['weapon-berry','WeaponLottery_Mei_1'],['matrix-berry','ArtifactLottery_Mei_1']]) {
      const banner = (catalog as {id:string;raw_banner_codes?:string[]}[]).find(item=>item.id===id)!;
      banner.raw_banner_codes=[...(banner.raw_banner_codes??[]),code];
    }
    const rerunCodes = new Set(['WeaponLottery_Mei_1', 'ArtifactLottery_Mei_1']);
    const saved = catalog.map(banner => banner.raw_banner_codes);
    for (const banner of catalog) banner.raw_banner_codes = banner.raw_banner_codes?.filter(code => !rerunCodes.has(code));
    const legacy = await awaitFinished(service, (await service.enqueue(seal({ version: 2, export_metadata: meta, account, batches: batches(0) },
      publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.41')).id);
    expect(legacy.error).toBeUndefined();
    catalog.forEach((banner, index) => { banner.raw_banner_codes = saved[index]; });
    const records = async () => repository.getAllWishRecords(legacy.result!.profileId);
    expect((await records()).find(record => record.rawBannerCode === 'WeaponLottery_Mei_1')?.bannerId).toMatch(/^unresolved-/);

    const current = {
      version: 2, export_metadata: meta, account: { ...account, server_utc_offset_minutes: 120 }, batches: batches(2),
      pity_snapshots: [
        { banner_type: 'weapon_limited', current_pity: 25, captured_at: '2026-10-06T16:50:49.000Z', source: 'game',
          raw_banner_code: 'WeaponLottery_Mei_1', group_ticks: '639269094493940000', item_index: 0 },
        { banner_type: 'matrix_limited', current_pity: 33, captured_at: '2026-10-06T16:51:14.000Z', source: 'game',
          raw_banner_code: 'ArtifactLottery_Mei_1', group_ticks: '639269094747440000', item_index: 0 },
      ],
    };
    const job = await awaitFinished(service, (await service.enqueue(seal(current, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.41')).id);
    expect(job.error).toBeUndefined();
    expect(job.result).toMatchObject({ inserted: 0, duplicates: 10 });
    const after = await records();
    const numbers = (code: string) => after.filter(record => record.rawBannerCode === code).map(record => record.trackPullNumber);
    expect(numbers('WeaponLottery_ZY_1')).toEqual([19, 20, 21, 22, 23, 24]);
    expect(numbers('WeaponLottery_Mei_1')).toEqual([25]);
    expect(numbers('ArtifactLottery_ZY_1')).toEqual([31, 32]);
    expect(numbers('ArtifactLottery_Mei_1')).toEqual([33]);
    expect(after.find(record => record.rawBannerCode === 'WeaponLottery_Mei_1')).toMatchObject({ bannerId: 'weapon-berry', pullTimestamp: '2026-10-06T16:50:49.000Z' });
    expect(after.find(record => record.rawBannerCode === 'ArtifactLottery_Mei_1')?.bannerId).toBe('matrix-berry');
    const snapshots = (await repository.getProfile(job.result!.profileId))?.pitySnapshots;
    expect(snapshots?.map(snapshot => [snapshot.banner_type, snapshot.current_pity])).toEqual(expect.arrayContaining([['weapon_limited', 25], ['matrix_limited', 33]]));
    } finally {await repository.close();}
  });

  it('decrypts, queues by IP, deduplicates and rejects conflicting history', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wish-import-'));
    directories.push(directory);
    const repository = new SqliteWishRepository(path.join(directory, 'wish.sqlite'));
    await repository.init();
    const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const service = new WishImportService(repository, new WishAccessService(path.join(directory, 'access.json')));
    const publicKey = service.getPublicKey();
    expect(publicKey.ready).toBe(true);
    const payload = {
      version: 2,
      export_metadata: { exported_at: '2026-09-29T00:00:00.000Z', exporter_name: 'test', exporter_version: '2.0.0' },
      account: { uid: '1300242918', region: 'global', server_id: '1300', nickname: 'Test', timezone: 'UTC' },
      batches: [{ batch_id: 'batch_638947000000000000', banner_id: 'standard-weapon', raw_banner_code: 'WeaponLottery_2',
        banner_type: 'standard_weapon', group_ticks: '638947000000000000', timestamp: '2026-09-29T00:00:00.000Z',
        pulls: [{ index_in_batch: 0, item_id: 'digger_thunder', rarity: 5, is_featured: false,
          compensation: { currency_id: 'test_currency', amount: 1, extra_items: [] } }] }],
    };
    const envelope = seal(payload, publicKey.public_key_pem!, publicKey.key_id!);
    const first = (await service.enqueue(envelope, '192.0.2.1'));
    await expect(service.enqueue(envelope, '192.0.2.1')).rejects.toThrow();
    const completed = await awaitFinished(service, first.id);
    expect(completed.state).toBe('complete');
    expect(completed.result?.inserted).toBe(1);
    expect(completed.result?.unresolved).toBe(0);
    const records = await repository.getAllWishRecords(completed.result!.profileId);
    expect(records).toHaveLength(1);
    expect(records[0].itemId).toBe('digger_thunder');
    expect(records[0].compensation?.amount).toBe(1);

    const repeat = (await service.enqueue(envelope, '192.0.2.1'));
    const duplicate = await awaitFinished(service, repeat.id);
    expect(duplicate.result?.inserted).toBe(0);
    expect(duplicate.result?.duplicates).toBe(1);

    const additional = structuredClone(payload);
    additional.batches[0].group_ticks = '638947000000000001';
    additional.batches[0].batch_id = 'batch_638947000000000001';
    const unauthorized=await service.enqueue(seal(additional,publicKey.public_key_pem!,publicKey.key_id!),'192.0.2.8');
    const denied=await awaitFinished(service,unauthorized.id);
    expect(denied.error).toMatchObject({status:403,data:{code:'WISH_ACCESS_REQUIRED'}});
    expect(await repository.getAllWishRecords(completed.result!.profileId)).toHaveLength(1);
    const shared = (await service.enqueue(seal(additional, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.2',[completed.result!.accessToken!]));
    const sharedResult = await awaitFinished(service, shared.id);
    expect(sharedResult.result?.profileId).toBe(completed.result?.profileId);
    expect(sharedResult.result?.inserted).toBe(1);
    expect(await repository.getAllWishRecords(completed.result!.profileId)).toHaveLength(2);

    const altered = structuredClone(payload);
    altered.batches[0].pulls[0].item_id = 'sickle_fire';
    const conflict = (await service.enqueue(seal(altered, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.3'));
    const failed = await awaitFinished(service, conflict.id);
    expect(failed.state).toBe('failed');
    expect(await repository.getAllWishRecords(completed.result!.profileId)).toHaveLength(2);
    await repository.close();
  });

  it('binds job polling to the enqueue requester', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wish-import-'));
    directories.push(directory);
    const repository = new SqliteWishRepository(path.join(directory, 'wish.sqlite'));
    await repository.init();
    const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const service = new WishImportService(repository, new WishAccessService(path.join(directory, 'access.json')));
    const publicKey = service.getPublicKey();
    const payload = {
      version: 2,
      export_metadata: { exported_at: '2026-09-29T00:00:00.000Z', exporter_name: 'test', exporter_version: '2.0.0' },
      account: { uid: '1300242918', region: 'global', server_id: '1300', nickname: 'Test', timezone: 'UTC' },
      batches: [{ batch_id: 'batch_638947000000000000', banner_id: 'standard-weapon', raw_banner_code: 'WeaponLottery_2',
        banner_type: 'standard_weapon', group_ticks: '638947000000000000', timestamp: '2026-09-29T00:00:00.000Z',
        pulls: [{ index_in_batch: 0, item_id: 'digger_thunder', rarity: 5, is_featured: false,
          compensation: { currency_id: 'test_currency', amount: 1, extra_items: [] } }] }],
    };
    const job = (await service.enqueue(seal(payload, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.9'));
    expect((await service.getJob(job.id))).not.toBeNull();
    expect((await service.getJob(job.id, '192.0.2.9'))).not.toBeNull();
    expect((await service.getJob(job.id, '192.0.2.10'))).toBeNull();
    expect((await service.getJob('not-a-uuid'))).toBeNull();
    await awaitFinished(service, job.id);
    expect((await service.getJob(job.id, '192.0.2.10'))).toBeNull();
    await repository.close();
  });

  it('issues a device token on first import and reuses grants on update', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wish-import-'));
    directories.push(directory);
    const repository = new SqliteWishRepository(path.join(directory, 'wish.sqlite'));
    await repository.init();
    const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const access = new WishAccessService(path.join(directory, 'access.json'));
    const service = new WishImportService(repository, access);
    const publicKey = service.getPublicKey();
    const payload = {
      version: 2,
      export_metadata: { exported_at: '2026-09-29T00:00:00.000Z', exporter_name: 'test', exporter_version: '2.0.0' },
      account: { uid: '1300242918', region: 'global', server_id: '1300', nickname: 'Test', timezone: 'UTC' },
      batches: [{ batch_id: 'batch_638947000000000000', banner_id: 'standard-weapon', raw_banner_code: 'WeaponLottery_2',
        banner_type: 'standard_weapon', group_ticks: '638947000000000000', timestamp: '2026-09-29T00:00:00.000Z',
        pulls: [{ index_in_batch: 0, item_id: 'digger_thunder', rarity: 5, is_featured: false,
          compensation: { currency_id: 'test_currency', amount: 1, extra_items: [] } }] }],
    };
    const first = (await service.enqueue(seal(payload, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.21'));
    const completed = await awaitFinished(service, first.id);
    expect(completed.state).toBe('complete');
    expect(completed.result?.accessToken).toMatch(/^wtk_[a-f0-9]{48}$/);
    const token = completed.result!.accessToken!;
    // Token works from a different IP; the importer IP works without a token.
    expect(access.checkAccess(completed.result!.profileId, { token, ip: '192.0.2.99' })).toBe(true);
    expect(access.checkAccess(completed.result!.profileId, { ip: '192.0.2.21' })).toBe(true);
    expect(access.checkAccess(completed.result!.profileId, { ip: '192.0.2.99' })).toBe(true);
    expect(access.checkAccess(completed.result!.profileId, { ip: '192.0.2.100' })).toBe(false);
    // An update import notes the new IP but does not mint another token.
    const update = (await service.enqueue(seal(payload, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.22',[token]));
    const updated = await awaitFinished(service, update.id);
    expect(updated.state).toBe('complete');
    expect(updated.result?.accessToken).toBeUndefined();
    expect(access.checkAccess(completed.result!.profileId, { ip: '192.0.2.22' })).toBe(true);
    expect(token).not.toBe(access.issueDeviceToken(completed.result!.profileId, 'phone'));
    await repository.close();
  });

  it('ignores forged banner ids and server-computes record identity', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wish-import-'));
    directories.push(directory);
    const repository = new SqliteWishRepository(path.join(directory, 'wish.sqlite'));
    await repository.init();
    const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const service = new WishImportService(repository, new WishAccessService(path.join(directory, 'access.json')));
    const publicKey = service.getPublicKey();
    const payload = {
      version: 2,
      export_metadata: { exported_at: '2026-09-29T00:00:00.000Z', exporter_name: 'test', exporter_version: '2.0.0' },
      account: { uid: '1300242918', region: 'global', server_id: '1300', nickname: 'Test', timezone: 'UTC' },
      batches: [{ batch_id: 'batch_638947000000000000', banner_id: 'forged-limited-banner-id', raw_banner_code: 'WeaponLottery_2',
        banner_type: 'standard_weapon', group_ticks: '638947000000000000', timestamp: '2026-09-29T00:00:00.000Z',
        pulls: [{ index_in_batch: 0, item_id: 'digger_thunder', rarity: 5, is_featured: false,
          compensation: { currency_id: 'test_currency', amount: 1, extra_items: [] } }] }],
    };
    const job = (await service.enqueue(seal(payload, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.11'));
    const completed = await awaitFinished(service, job.id);
    expect(completed.state).toBe('complete');
    const records = await repository.getAllWishRecords(completed.result!.profileId);
    expect(records).toHaveLength(1);
    expect(records[0].bannerId).not.toBe('forged-limited-banner-id');
    await repository.close();
  });

  it('fills rarity, featured flag, nickname and server from the site catalogs for capture-app files', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wish-import-'));
    directories.push(directory);
    const repository = new SqliteWishRepository(path.join(directory, 'wish.sqlite'));
    await repository.init();
    const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const service = new WishImportService(repository, new WishAccessService(path.join(directory, 'access.json')));
    const publicKey = service.getPublicKey();
    const payload = {
      version: 2,
      export_metadata: { exported_at: '2026-09-29T00:00:00.000Z', exporter_name: 'tof-live-capture', exporter_version: '2.0.0' },
      account: { uid: '1300701214', avatar_id: 'Avatar05', avatar_frame_id: 'AvatarFrame_100', region: 'unknown', server_id: null, nickname: null, timezone: 'UTC' },
      batches: [{ batch_id: 'batch_WeaponLottery_2_638947000000000000', banner_id: 'WeaponLottery_2', raw_banner_code: 'WeaponLottery_2',
        banner_type: 'standard_weapon', group_ticks: '638947000000000000', timestamp: '2026-09-29T00:00:00.000Z',
        pulls: [{ index_in_batch: 0, item_id: 'digger_thunder', rarity: null, is_featured: null },
          // The client may spell an id with another case than the catalog (matrix_SSR37_1).
          { index_in_batch: 1, item_id: 'Matrix_SSR37_1', rarity: null, is_featured: null }] }],
    };
    const job = (await service.enqueue(seal(payload, publicKey.public_key_pem!, publicKey.key_id!), '192.0.2.31'));
    const completed = await awaitFinished(service, job.id);
    expect(completed.error).toBeUndefined();
    expect(completed.state).toBe('complete');
    const profile = await repository.getProfile(completed.result!.profileId);
    expect(profile?.server).toBe('13007');
    expect(profile?.uid).toBe('130071214');
    expect(profile?.region).toBe('EU');
    const records = await repository.getAllWishRecords(completed.result!.profileId);
    expect(records[0].rarity).toBe(5);
    const matrix = records.find((record) => record.itemId.toLowerCase() === 'matrix_ssr37_1');
    expect(matrix?.itemId).toBe('matrix_SSR37_1');
    expect(matrix?.rarity).toBe(5);
    const current={...payload,account:{...payload.account,uid:'130071214'}};
    const repeated=await service.enqueue(seal(current,publicKey.public_key_pem!,publicKey.key_id!),'192.0.2.31');
    const again=await awaitFinished(service,repeated.id);
    expect(again.state).toBe('complete');
    expect(again.result?.profileId).toBe(completed.result!.profileId);
    expect(await repository.getAllWishRecords(completed.result!.profileId)).toHaveLength(records.length);
    await repository.close();
  });
});

