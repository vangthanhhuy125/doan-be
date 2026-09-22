import { Controller, Get, Post, Body } from '@nestjs/common';
import { YouthUnionService } from './faculty-yec.service';

// --- CONTROLLER CHO ĐOÀN KHOA (/youth-union) ---
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

  // Hỗ trợ thêm endpoint phụ /youth-union/lch nếu FE gọi theo nhóm
  @Get('lch')
  async getLCH() {
    return await this.youthUnionService.getLCHData();
  }

  @Post('lch/update')
  async updateLCH(@Body() body: any[]) {
    return await this.youthUnionService.updateLCH(body);
  }
}

// --- CONTROLLER CHO LIÊN CHI HỘI KHOA (/student-association) ---
@Controller('student-association')
export class StudentAssociationController {
  constructor(private readonly youthUnionService: YouthUnionService) {}

  @Get('bch')
  async getBCH() {
    return await this.youthUnionService.getLCHData();
  }

  @Post('bch/update')
  async updateBCH(@Body() body: any[]) {
    return await this.youthUnionService.updateLCH(body);
  }
}