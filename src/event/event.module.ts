import { Module } from '@nestjs/common';
import { EventsController } from './event.controller';
import { EventsService } from './event.service';
import { EventsCronService } from './cron/event-cron.service';

@Module({
  controllers: [EventsController],
  providers: [EventsService, EventsCronService],
  exports: [EventsService],
})
export class EventsModule {}