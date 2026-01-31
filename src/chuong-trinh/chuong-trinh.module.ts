import { Module } from '@nestjs/common';
import { ProgramsController } from './chuong-trinh.controller';
import { ProgramsService } from './chuong-trinh.service';

@Module({
  controllers: [ProgramsController],
  providers: [ProgramsService],
})
export class ProgramsModule {}