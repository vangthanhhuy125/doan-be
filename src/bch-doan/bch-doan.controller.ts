import { Controller, Get, Post, Body } from '@nestjs/common';
import { YouthUnionService } from './bch-doan.service';

@Controller('youth-union')
export class YouthUnionController {
  constructor(private readonly youthUnionService: YouthUnionService) {}

  @Get('bch')
  async getBCH() {
    return await this.youthUnionService.getBCHData();
  }

  @Post('bch/update')
  async updateBCH(@Body() body: any[]) {
    return await this.youthUnionService.updateBCH(body);
  }
}