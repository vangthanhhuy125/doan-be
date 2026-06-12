import { Module } from '@nestjs/common';
import { AnnouncementsController } from './notification.controller';
import { AnnouncementsService } from './notification.service';

@Module({
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}