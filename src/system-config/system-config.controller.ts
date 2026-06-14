import { Controller, Get, Put, Body } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { UpdateSystemConfigDto } from './system-config.dto';

@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  async getConfig() {
    return await this.systemConfigService.getConfigData();
  }

  @Put()
  async updateConfig(@Body() body: UpdateSystemConfigDto) {
    return await this.systemConfigService.updateConfigData(body);
  }
}