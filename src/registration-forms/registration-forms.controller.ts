import { Controller, Get, Post, Put, Patch, Delete, Param, Body, HttpCode, HttpStatus, Headers } from '@nestjs/common';
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
  async create(
    @Body() body: any,
    @Headers('x-user-id') headerUserId?: string
  ) {
    const userId = headerUserId || body?.created_by || body?.user_id || '';
    const payload = {
      ...body,
      created_by: userId,
      user_id: userId,
      target_intakes: Array.isArray(body?.target_intakes) ? body.target_intakes : [],
    };
    return this.registrationFormsService.create(payload);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string, 
    @Body() body: any,
    @Headers('x-user-id') headerUserId?: string
  ) {
    const userId = headerUserId || body?.user_id || body?.created_by || '';
    const payload = {
      ...body,
      user_id: userId,
      target_intakes: Array.isArray(body?.target_intakes) ? body.target_intakes : [],
    };
    return this.registrationFormsService.update(id, payload);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async patchUpdate(
    @Param('id') id: string, 
    @Body() body: any,
    @Headers('x-user-id') headerUserId?: string
  ) {
    const userId = headerUserId || body?.user_id || body?.created_by || '';
    const payload = {
      ...body,
      user_id: userId,
      target_intakes: Array.isArray(body?.target_intakes) ? body.target_intakes : [],
    };
    return this.registrationFormsService.update(id, payload);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @Headers('x-user-id') headerUserId?: string,
    @Body() body?: any
  ) {
    const userId = headerUserId || body?.user_id || body?.created_by || '';
    return this.registrationFormsService.delete(id, { user_id: userId });
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.CREATED)
  async submitRegistration(@Param('id') id: string, @Body() body: any) {
    return this.registrationFormsService.submitRegistration(id, body);
  }
}