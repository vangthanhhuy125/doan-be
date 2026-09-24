import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  async getAll() {
    return await this.permissionsService.getAll();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return await this.permissionsService.getById(id);
  }

  @Post()
  async create(@Body() body: any) {
    return await this.permissionsService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return await this.permissionsService.update(id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return await this.permissionsService.delete(id);
  }
}