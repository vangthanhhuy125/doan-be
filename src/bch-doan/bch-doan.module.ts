import { Module } from '@nestjs/common';
import { YouthUnionController } from './bch-doan.controller';
import { YouthUnionService } from './bch-doan.service';

@Module({
  controllers: [YouthUnionController],
  providers: [YouthUnionService],
})
export class YouthUnionModule {}