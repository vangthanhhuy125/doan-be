import { Module } from '@nestjs/common';
import { NhanSuController } from './nhan-su.controller';
import { NhanSuService } from './nhan-su.service';

@Module({
  controllers: [NhanSuController],
  providers: [NhanSuService],
})
export class NhanSuModule {}