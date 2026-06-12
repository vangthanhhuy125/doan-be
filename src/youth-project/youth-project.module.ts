import { Module } from '@nestjs/common';
import { YouthProjectsController } from './youth-project.controller';
import { YouthProjectsService } from './youth-project.service';

@Module({
  controllers: [YouthProjectsController],
  providers: [YouthProjectsService],
})
export class YouthProjectsModule {}