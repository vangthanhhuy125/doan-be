import { 
  Controller, Get, Post, Put, Delete, Param, Body, 
  HttpCode, HttpStatus, Headers 
} from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { CreateSurveyDto, UpdateSurveyDto, SubmitSurveyResponseDto } from './dto/survey.dto';

@Controller('surveys')
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @Get()
  async getAll() {
    return this.surveysService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.surveysService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateSurveyDto, 
    @Headers('x-user-id') headerUserId: string
  ) {
    const userId = headerUserId || dto.created_by || '';
    return this.surveysService.create({ ...dto, created_by: userId });
  }

  @Put(':id')
  async update(
    @Param('id') id: string, 
    @Body() dto: UpdateSurveyDto
  ) {
    return this.surveysService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.surveysService.delete(id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.CREATED)
  async submit(
    @Param('id') id: string, 
    @Body() dto: SubmitSurveyResponseDto
  ) {
    return this.surveysService.submitResponse(id, dto);
  }
}