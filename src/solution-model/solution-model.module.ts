import { Module } from '@nestjs/common';
import { SolutionModelsController } from './solution-model.controller';
import { SolutionModelsService } from './solution-model.service';

@Module({
  controllers: [SolutionModelsController],
  providers: [SolutionModelsService],
})
export class SolutionModelsModule {}