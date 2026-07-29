import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { RegistrationFormsService } from './registration-forms.service';

@Controller('registration-forms')
export class RegistrationFormsController {
  constructor(private readonly registrationFormsService: RegistrationFormsService) {}

  @Get()
  async getAll() {
    return this.registrationFormsService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.registrationFormsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any) {
    return this.registrationFormsService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.registrationFormsService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    return this.registrationFormsService.delete(id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.CREATED)
  async submitRegistration(@Param('id') id: string, @Body() body: any) {
    return this.registrationFormsService.submitRegistration(id, body);
  }
}