import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { DocumentsService } from './tai-lieu.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async getAll() {
    return await this.documentsService.findAll();
  }

  @Post()
  async create(@Body() body: any) {
    return await this.documentsService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return await this.documentsService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.documentsService.remove(id);
  }
}