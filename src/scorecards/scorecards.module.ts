import { Module } from '@nestjs/common';
import { PerformanceController } from './scorecards.controller';
import { PerformanceService } from './scorecards.service';

@Module({
  controllers: [PerformanceController],
  providers: [PerformanceService],
})
export class PerformanceModule {}