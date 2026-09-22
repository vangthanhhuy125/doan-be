import { Module } from '@nestjs/common';
import { YouthUnionController, StudentAssociationController } from './faculty-yec.controller';
import { YouthUnionService } from './faculty-yec.service';

@Module({
  controllers: [YouthUnionController, StudentAssociationController],
  providers: [YouthUnionService],
  exports: [YouthUnionService],
})
export class YouthUnionModule {}