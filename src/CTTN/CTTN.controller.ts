import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { YouthProjectsService } from './CTTN.service';

@Controller('youth-projects')
export class YouthProjectsController {
  constructor(private readonly youthProjectsService: YouthProjectsService) {}

  @Get()
  async getAll() {
    return await this.youthProjectsService.findAll();
  }

  @Post()
  async create(@Body() body: any) {
    return await this.youthProjectsService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return await this.youthProjectsService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.youthProjectsService.remove(id);
  }
}