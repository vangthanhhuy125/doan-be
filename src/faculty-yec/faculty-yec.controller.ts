import { Controller, Get, Post, Body, Query, Res } from '@nestjs/common';
import { YouthUnionService } from './faculty-yec.service';
import { Public } from '../public.decorator';

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

  @Public()
  @Get('export-excel')
  async exportExcel(@Query('scope') scope: string, @Res() res: any) {
    const targetScope = (scope || 'DOAN').toUpperCase();
    const buffer = await this.youthUnionService.generateExcel(targetScope);
    const fileName = targetScope === 'HOI' ? 'Thong_tin_Hoi_Sinh_vien.xlsx' : 'Thong_tin_Doan_Khoa.xlsx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.end(buffer);
  }
}

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

  @Public()
  @Get('export-excel')
  async exportExcel(@Res() res: any) {
    const buffer = await this.youthUnionService.generateExcel('HOI');
    const fileName = 'Thong_tin_Hoi_Sinh_vien.xlsx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.end(buffer);
  }
}