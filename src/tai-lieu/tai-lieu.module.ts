import { Module } from '@nestjs/common';
import { DocumentsController } from './tai-lieu.controller';
import { DocumentsService } from './tai-lieu.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}