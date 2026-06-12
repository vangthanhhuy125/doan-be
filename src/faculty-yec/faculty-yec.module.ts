import { Module } from '@nestjs/common';
import { YouthUnionController } from './faculty-yec.controller';
import { YouthUnionService } from './faculty-yec.service';

@Module({
  controllers: [YouthUnionController],
  providers: [YouthUnionService],
})
export class YouthUnionModule {}