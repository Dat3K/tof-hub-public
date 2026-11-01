import { Module } from '@nestjs/common';
import { WishController } from './wish.controller';
import { WishService } from './wish.service';
import { WISH_REPOSITORY_TOKEN } from './adapters/wish-repository.interface';
import { SqliteWishRepository } from './adapters/sqlite-wish-repository';
import { PostgresWishRepository } from './adapters/postgres-wish-repository';
import { WishAccessService } from './wish-access.service';
import { WishImportService } from './wish-import.service';
import type { PrismaClient } from '@prisma/client';
import { PRISMA } from '../database/database.module';

@Module({
  controllers: [WishController],
  providers: [
    WishService,
    WishAccessService,
    WishImportService,
    {
      provide: WISH_REPOSITORY_TOKEN,
      // The shared Postgres client (DatabaseModule) when configured, otherwise the local SQLite store.
      inject: [PRISMA],
      useFactory: (prisma: PrismaClient | null) => prisma ? new PostgresWishRepository(prisma) : new SqliteWishRepository(),
    },
  ],
  exports: [WishService, WISH_REPOSITORY_TOKEN],
})
export class WishModule {}
