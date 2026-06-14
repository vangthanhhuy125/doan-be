import { Controller, Get, Put, Body } from '@nestjs/common';
import { BannerConfigService } from './banner-config.service';

@Controller('banner-config')
export class BannerConfigController {
  constructor(private readonly bannerConfigService: BannerConfigService) {}

  @Get()
  async getBanner() {
    return await this.bannerConfigService.getBannerImages();
  }

  @Put()
  // Không dùng Interceptor bắt file nữa, nhận body chứa mảng chuỗi Base64 trực tiếp
  async updateBanner(@Body() body: { images: string[] }) {
    return await this.bannerConfigService.updateBannerImages(body.images);
  }
}