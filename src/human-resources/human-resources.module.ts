import { Module } from '@nestjs/common';
import { NhanSuController } from './human-resources.controller';
import { NhanSuService } from './human-resources.service';

@Module({
  controllers: [NhanSuController],
  providers: [NhanSuService],
})
export class NhanSuModule {}