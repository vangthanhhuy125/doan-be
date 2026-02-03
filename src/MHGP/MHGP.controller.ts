import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { SolutionModelsService } from './MHGP.service';

@Controller('solution-models')
export class SolutionModelsController {
  constructor(private readonly solutionModelsService: SolutionModelsService) {}

  @Get()
  async getAll() {
    return await this.solutionModelsService.findAll();
  }

  @Post()
  async create(@Body() body: any) {
    return await this.solutionModelsService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return await this.solutionModelsService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.solutionModelsService.remove(id);
  }
}