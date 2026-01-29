import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { NhanSuService } from './nhan-su.service';

@Controller('nhan-su')
export class NhanSuController {
  constructor(private readonly nhanSuService: NhanSuService) {}

  @Get()
  async getAll() {
    return await this.nhanSuService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return await this.nhanSuService.findOne(id);
  }

  @Post()
  async create(@Body() body: any) {
    return await this.nhanSuService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return await this.nhanSuService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.nhanSuService.remove(id);
  }
}