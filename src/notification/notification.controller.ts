import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, HttpStatus, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AnnouncementsService } from './notification.service';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  async getAll() {
    return this.announcementsService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file')) 
  async create(@Body() body: any, @UploadedFile() file: Express.Multer.File) {
    return this.announcementsService.create(body, file);
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('file'))
  async update(@Param('id') id: string, @Body() body: any, @UploadedFile() file: Express.Multer.File) {
    return this.announcementsService.update(id, body, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    return this.announcementsService.delete(id);
  }
}