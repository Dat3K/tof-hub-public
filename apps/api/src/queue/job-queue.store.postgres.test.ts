// @vitest-environment node
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {Pool} from 'pg';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {DATABASE_BINARY_PART_BYTES} from '../database/binary-payload';
import {PrismaQueueStore} from './job-queue.store';

const url = process.env.TOF_HUB_TEST_DATABASE_URL;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

describe.skipIf(!url)('Queue payloads on a disposable PostgreSQL database', () => {
  let pool: Pool, prisma: PrismaClient, store: PrismaQueueStore;
  const jobIds: string[] = [];
  const job = () => {
    const id = randomUUID();
    jobIds.push(id);
    return {id, kind: 'players-import' as const, ipHash: id, ip: '192.0.2.1'};
  };

  beforeAll(async () => {
    if (!/\/[a-z0-9_]+_test(?:\?|$)/.test(url!)) throw new Error('Use a dedicated *_test database');
    pool = new Pool({connectionString: url, max: 2});
    prisma = new PrismaClient({adapter: new PrismaPg(pool)});
    store = new PrismaQueueStore(prisma);
    expect(await store.active()).toEqual([]);
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.queueJob.deleteMany({where: {id: {in: jobIds}}});
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }
  });

  it('claims a large upload byte for byte and leaves a missing part queued', async () => {
    const capture = job();
    const payload = randomBytes(18 * DATABASE_BINARY_PART_BYTES + 17);
    await store.insert({...capture, payload});
    const row = await prisma.queueJob.findUniqueOrThrow({
      where: {id: capture.id}, select: {payload: true, payloadBytes: true},
    });
    expect(row).toEqual({payload: null, payloadBytes: payload.length});
    const [{count, max} = {}] = await prisma.$queryRaw<{count: number; max: number}[]>`
      SELECT count(*)::int AS count, max(octet_length(bytes)) AS max FROM queue_job_payload_chunks WHERE job_id=${capture.id}`;
    expect(count).toBe(19);
    expect(max).toBe(DATABASE_BINARY_PART_BYTES);
    const last = await prisma.queueJobPayloadChunk.delete({where: {jobId_part: {jobId: capture.id, part: 18}}});
    await expect(store.claim(new Date())).rejects.toThrow('Missing or invalid binary payload part');
    expect((await store.get(capture.id))?.state).toBe('queued');
    await prisma.queueJobPayloadChunk.create({data: last});
    const claimed = await store.claim(new Date());
    expect(claimed?.id).toBe(capture.id);
    expect(hash(claimed!.payload)).toBe(hash(payload));
    await store.finish(capture.id, 'complete', {total: 1}, null, null, new Date());
    expect(await prisma.queueJobPayloadChunk.count({where: {jobId: capture.id}})).toBe(0);
  }, 60_000);

  it('reads pre-migration jobs and clears chunks on stale-job expiry', async () => {
    const legacy = job();
    const payload = randomBytes(DATABASE_BINARY_PART_BYTES + 7);
    await prisma.queueJob.create({data: {...legacy, state: 'queued', payload: new Uint8Array(payload)}});
    expect(hash((await store.claim(new Date()))!.payload)).toBe(hash(payload));
    await store.finish(legacy.id, 'complete', null, null, null, new Date());

    const abandoned = job();
    await store.insert({...abandoned, payload});
    await store.claim(new Date(Date.now() - 61 * 60 * 1000));
    expect(await store.expireStale()).toBe(1);
    expect((await store.get(abandoned.id))?.state).toBe('failed');
    expect(await prisma.queueJobPayloadChunk.count({where: {jobId: abandoned.id}})).toBe(0);
  }, 60_000);
});
