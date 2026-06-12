import { Module } from '@nestjs/common';
import { DocumentsController } from './document.controller';
import { DocumentsService } from './document.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}