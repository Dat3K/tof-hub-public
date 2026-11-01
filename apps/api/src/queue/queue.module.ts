import {Controller,Get,Global,Header,Ip,Module,NotFoundException,Param} from '@nestjs/common';
import type {PrismaClient} from '@prisma/client';
import {PRISMA} from '../database/database.module';
import {JobQueueService,QUEUE_STORE} from './job-queue.service';
import {MemoryQueueStore,PrismaQueueStore} from './job-queue.store';

@Controller('queue')
export class QueueController {
  constructor(private readonly queue:JobQueueService) {}
  /** Every queued and recent job without who sent it (/tools/queue). */
  @Get() @Header('Cache-Control','no-store') board(@Ip() ip:string) {return this.queue.board(ip);}
  /** One job for the IP that queued it. */
  @Get('jobs/:id') @Header('Cache-Control','no-store')
  async job(@Param('id') id:string,@Ip() ip:string) {
    const job=await this.queue.get(id,ip);
    if(!job)throw new NotFoundException('Job not found');
    return job;
  }
  /** One-time response required by the page that submitted a build-card import. */
  @Get('jobs/:id/delivery') @Header('Cache-Control','no-store')
  async delivery(@Param('id') id:string,@Ip() ip:string) {
    const result=await this.queue.takeDelivery(id,ip);
    if(result===null)throw new NotFoundException('Job result not found');
    return result;
  }
}

@Global()
@Module({
  controllers:[QueueController],
  // Postgres keeps the queue across restarts; without it the queue lives in memory (local runs).
  providers:[JobQueueService,{provide:QUEUE_STORE,inject:[PRISMA],
    useFactory:(prisma:PrismaClient|null)=>prisma?new PrismaQueueStore(prisma):new MemoryQueueStore()}],
  exports:[JobQueueService],
})
export class QueueModule {}
