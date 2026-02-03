import { Module } from '@nestjs/common';
import { YouthProjectsController } from './CTTN.controller';
import { YouthProjectsService } from './CTTN.service';

@Module({
  controllers: [YouthProjectsController],
  providers: [YouthProjectsService],
})
export class YouthProjectsModule {}