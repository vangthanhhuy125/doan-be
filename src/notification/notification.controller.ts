import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, HttpStatus, UseInterceptors, UploadedFile, Req, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AnnouncementsService } from './notification.service';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  async getAll(
    @Req() req: any, 
    @Query('userId') queryUserId?: string, 
    @Query('manage') isManage?: string
  ) {
    const headerUserId = req.headers['x-user-id'] || req.headers['X-User-Id'];
    const tokenUserId = req.user?.user_id || req.user?._id || req.user?.id;
    const finalUserId = (headerUserId || tokenUserId || queryUserId) as string;

    const manageMode = isManage === 'true';

    return this.announcementsService.findAll(finalUserId, manageMode);
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