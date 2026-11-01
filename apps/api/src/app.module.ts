import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { VersionStatusModule } from "./version-status";
import { WishModule } from "./wish/wish.module";
import { BuildModule } from './build/build.module';
import { RankingModule } from './ranking/ranking.module';
import { PlayersModule } from './players/players.module';
import { QueueModule } from './queue/queue.module';
import { DatabaseModule } from './database/database.module';
import {SecurityModule} from './security/security.module';
import {NotificationsModule} from './notifications/notifications.module';
import {FeedbackModule} from './feedback/feedback.module';

@Module({
  imports: [DatabaseModule, NotificationsModule, SecurityModule, FeedbackModule, VersionStatusModule, QueueModule, PlayersModule, WishModule, BuildModule, RankingModule],
  controllers: [HealthController],
})
export class AppModule {}
