import { Module } from '@nestjs/common';
import { ClpiController } from './clpi.controller';
import { ClpiService } from './clpi.service';

@Module({
  controllers: [ClpiController],
  providers: [ClpiService],
  exports: [ClpiService],
})
export class ClpiModule {}