import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { AnnouncementsService } from './thong-bao.service';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  async getAll() {
    return await this.announcementsService.findAll();
  }

  @Post()
  async create(@Body() body: any) {
    return await this.announcementsService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return await this.announcementsService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.announcementsService.remove(id);
  }
}