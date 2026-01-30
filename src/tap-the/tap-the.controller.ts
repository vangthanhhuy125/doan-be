import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { OrganizationsService } from './tap-the.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  async getAll() {
    return await this.organizationsService.findAll();
  }

  @Post()
  async create(@Body() body: any) {
    return await this.organizationsService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return await this.organizationsService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.organizationsService.remove(id);
  }
}