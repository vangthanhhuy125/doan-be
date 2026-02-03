import { Module } from '@nestjs/common';
import { PerformanceController } from './bang-diem.controller';
import { PerformanceService } from './bang-diem.service';

@Module({
  controllers: [PerformanceController],
  providers: [PerformanceService],
})
export class PerformanceModule {}