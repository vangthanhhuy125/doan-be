import { Module } from '@nestjs/common';
import { SolutionModelsController } from './MHGP.controller';
import { SolutionModelsService } from './MHGP.service';

@Module({
  controllers: [SolutionModelsController],
  providers: [SolutionModelsService],
})
export class SolutionModelsModule {}