import { Module } from '@nestjs/common';
import { AnnouncementsController } from './thong-bao.controller';
import { AnnouncementsService } from './thong-bao.service';

@Module({
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}