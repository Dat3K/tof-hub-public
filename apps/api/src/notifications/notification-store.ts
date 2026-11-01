import { Prisma, type PrismaClient } from '@prisma/client';
import { DEFAULT_NOTIFICATION_SETTINGS, NotificationSettingsSchema, type NotificationEvent, type NotificationSettings } from '@tof-hub/contracts';

export class NotificationStore {
  constructor(readonly prisma: PrismaClient) {}
  async add(event: NotificationEvent, client: Pick<PrismaClient, 'notificationEvent'> = this.prisma) {
    await client.notificationEvent.createMany({ data: [{ id: event.id, event: event as unknown as Prisma.InputJsonValue }], skipDuplicates: true });
  }
  async settings(): Promise<NotificationSettings> {
    const row = await this.prisma.notificationSettings.upsert({ where: { id: 'telegram' },
      create: { id: 'telegram', value: DEFAULT_NOTIFICATION_SETTINGS }, update: {} });
    return NotificationSettingsSchema.parse(row.value);
  }
  async updateSettings(value: NotificationSettings) {
    await this.prisma.notificationSettings.update({ where: { id: 'telegram' }, data: { value } });
  }
  async offset(): Promise<number> {
    const row = await this.prisma.notificationSettings.findUnique({ where: { id: 'telegram' } });
    return Number(row?.updateOffset ?? 0);
  }
  async setOffset(offset: number) {
    await this.prisma.notificationSettings.update({ where: { id: 'telegram' }, data: { updateOffset: BigInt(offset) } });
  }
  async lock<T>(key: number, work: () => Promise<T>): Promise<T | undefined> {
    return this.prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${key}::bigint) AS locked`;
      return rows[0]?.locked ? work() : undefined;
    }, { timeout: 45_000, maxWait: 1000 });
  }
}
