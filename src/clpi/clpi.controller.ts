import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClpiService } from './clpi.service';
import {
  CreateClpiTaskDto,
  UpdateClpiTaskDto,
  UpdateTaskProgressDto,
  CreateEvidenceDto,
  SaveMonthlyReportDraftDto,
  SubmitMonthlyReportDto,
  SubmitSelfAssessmentDto,
  RequestRevisionDto,
  ApproveEvaluationDto,
  CreateCycleDto,
  UpdateWeightsDto,
  CreatePersonnelDto,
  UpdatePersonnelDto,
  CreateWeightProfileDto,
} from './clpi.dto';

@Controller('clpi')
export class ClpiController {
  constructor(private readonly clpiService: ClpiService) {}

  @Get('cycles/current')
  async getCurrentCycle() {
    return this.clpiService.getCurrentCycle();
  }

  @Get('cycles')
  async getAllCycles() {
    return this.clpiService.getAllCycles();
  }

  @Post('cycles')
  async createCycle(@Body() dto: CreateCycleDto, @Req() req: any) {
    return this.clpiService.createCycle(dto, req);
  }

  @Put('cycles/:id/lock')
  async lockCycle(@Param('id') id: string) {
    return this.clpiService.lockCycle(id);
  }

  @Delete('cycles/:id')
  async deleteCycle(@Param('id') id: string) {
    return this.clpiService.deleteCycle(id);
  }

  @Get('dashboard')
  async getDashboard(@Req() req: any) {
    return this.clpiService.getDashboard(req);
  }

  @Get('tasks/manage')
  async getManagedTasks() {
    return this.clpiService.getManagedTasks();
  }

  @Post('tasks')
  async createTask(@Body() dto: CreateClpiTaskDto, @Req() req: any) {
    return this.clpiService.createTask(dto, req);
  }

  @Get('tasks')
  async getTasks(@Req() req: any) {
    return this.clpiService.getTasks(req);
  }

  @Get('tasks/:taskId')
  async getTaskDetail(@Param('taskId') taskId: string) {
    return this.clpiService.getTaskDetail(taskId);
  }

  @Put('tasks/:taskId')
  async updateTask(@Param('taskId') taskId: string, @Body() dto: UpdateClpiTaskDto) {
    return this.clpiService.updateTask(taskId, dto);
  }

  @Put('tasks/:taskId/progress')
  async updateTaskProgress(
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskProgressDto,
    @Req() req: any
  ) {
    return this.clpiService.updateTaskProgress(taskId, dto, req);
  }

  @Post('evidences')
  @UseInterceptors(FileInterceptor('file'))
  async createEvidence(
    @Body() dto: CreateEvidenceDto,
    @UploadedFile() file: any,
    @Req() req: any
  ) {
    return this.clpiService.createEvidence(dto, file, req);
  }

  @Delete('evidences/:id')
  async deleteEvidence(@Param('id') id: string) {
    return this.clpiService.deleteEvidence(id);
  }

  @Get('monthly-reports/current')
  async getCurrentMonthlyReport(@Req() req: any) {
    return this.clpiService.getCurrentMonthlyReport(req);
  }

  @Put('monthly-reports/:id/draft')
  async saveMonthlyReportDraft(
    @Param('id') id: string,
    @Body() dto: SaveMonthlyReportDraftDto,
    @Req() req: any
  ) {
    return this.clpiService.saveMonthlyReportDraft(id, dto, req);
  }

  @Post('monthly-reports/:id/submit')
  async submitMonthlyReport(
    @Param('id') id: string,
    @Body() dto: SubmitMonthlyReportDto,
    @Req() req: any
  ) {
    return this.clpiService.submitMonthlyReport(id, dto, req);
  }

  @Get('self-assessment/current')
  async getSelfAssessment(@Req() req: any) {
    return this.clpiService.getSelfAssessment(req);
  }

  @Post('self-assessment/submit')
  async submitSelfAssessment(@Body() dto: SubmitSelfAssessmentDto, @Req() req: any) {
    return this.clpiService.submitSelfAssessment(dto, req);
  }

  @Get('evaluations/:id')
  async getEvaluationDetail(@Param('id') id: string, @Req() req: any) {
    return this.clpiService.getEvaluationDetail(id, req);
  }

  @Get('evaluations/:id/result')
  async getEvaluationResult(@Param('id') id: string, @Req() req: any) {
    return this.clpiService.getEvaluationDetail(id, req);
  }

  @Get('review/queue')
  async getReviewQueue(@Req() req: any) {
    return this.clpiService.getReviewQueue(req);
  }

  @Get('review/:id')
  async getReviewDetail(@Param('id') id: string, @Req() req: any) {
    return this.clpiService.getEvaluationDetail(id, req);
  }

  @Post('review/:id/request-revision')
  async requestRevision(
    @Param('id') id: string,
    @Body() dto: RequestRevisionDto,
    @Req() req: any
  ) {
    return this.clpiService.requestRevision(id, dto, req);
  }

  @Post('review/:id/approve')
  async approveEvaluation(
    @Param('id') id: string,
    @Body() dto: ApproveEvaluationDto,
    @Req() req: any
  ) {
    return this.clpiService.approveEvaluation(id, dto, req);
  }

  @Get('unit-dashboard')
  async getUnitDashboard(@Query('unitId') unitId?: string) {
    return this.clpiService.getUnitDashboard(unitId);
  }

  @Get('admin-dashboard')
  async getAdminDashboard() {
    return this.clpiService.getAdminDashboard();
  }

  @Get('indicators')
  async getIndicatorsConfig() {
    return this.clpiService.getIndicatorsConfig();
  }

  @Put('indicators/weights')
  async updateWeights(@Body() dto: UpdateWeightsDto) {
    return this.clpiService.updateWeights(dto);
  }

  @Post('indicators/profiles')
  async createWeightProfile(@Body() dto: CreateWeightProfileDto) {
    return this.clpiService.createWeightProfile(dto);
  }

  @Delete('indicators/profiles/:id')
  async deleteWeightProfile(@Param('id') id: string) {
    return this.clpiService.deleteWeightProfile(id);
  }

  @Get('personnel')
  async getPersonnel() {
    return this.clpiService.getPersonnel();
  }

  @Post('personnel')
  async createPersonnel(@Body() dto: CreatePersonnelDto) {
    return this.clpiService.createPersonnel(dto);
  }

  @Put('personnel/:id')
  async updatePersonnel(@Param('id') id: string, @Body() dto: UpdatePersonnelDto) {
    return this.clpiService.updatePersonnel(id, dto);
  }

  @Get('analytics')
  async getAnalytics() {
    return this.clpiService.getAnalytics();
  }
}