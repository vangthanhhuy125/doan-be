import { Module } from '@nestjs/common';
import { BannerConfigController } from './banner-config.controller';
import { BannerConfigService } from './banner-config.service';

@Module({
  controllers: [BannerConfigController],
  providers: [BannerConfigService],
})
export class BannerConfigModule {}