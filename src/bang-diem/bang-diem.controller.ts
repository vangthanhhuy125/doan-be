import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { PerformanceService } from './bang-diem.service';

@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get()
  async getAll() {
    return await this.performanceService.findAll();
  }

  @Post()
  async create(@Body() body: any) {
    return await this.performanceService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return await this.performanceService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.performanceService.remove(id);
  }
}