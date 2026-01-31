import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ProgramsService } from './chuong-trinh.service';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  async getAll() {
    return await this.programsService.findAll();
  }

  @Post()
  async create(@Body() body: any) {
    return await this.programsService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return await this.programsService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.programsService.remove(id);
  }
}