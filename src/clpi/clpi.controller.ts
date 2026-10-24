import { 
  Controller, Get, Post, Put, Delete, Body, Param, 
  Query, Req, UseInterceptors, UploadedFile 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClpiService } from './clpi.service';
import { 
  UpdateTaskProgressDto, CreateEvidenceDto, SaveMonthlyReportDraftDto, 
  SubmitMonthlyReportDto, SubmitSelfAssessmentDto, RequestRevisionDto, ApproveEvaluationDto,
  CreateCycleDto, UpdateWeightsDto, CreatePersonnelDto 
} from './clpi.dto';

@Controller('clpi')
export class ClpiController {
  constructor(private readonly clpiService: ClpiService) {}

  // 1. Chu kỳ CLPI
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

  // 2. Dashboard cán bộ
  @Get('dashboard')
  async getDashboard(@Req() req: any) {
    return this.clpiService.getDashboard(req);
  }

  // 3. Quản lý công việc & Minh chứng
  @Get('tasks')
  async getTasks(@Req() req: any) {
    return this.clpiService.getTasks(req);
  }

  @Get('tasks/:taskId')
  async getTaskDetail(@Param('taskId') taskId: string) {
    return this.clpiService.getTaskDetail(taskId);
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

  // 4. Báo cáo công tác tháng
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

  // 5. Tự đánh giá & Hồ sơ CLPI
  @Get('self-assessment/current')
  async getSelfAssessment(@Req() req: any) {
    return this.clpiService.getSelfAssessment(req);
  }

  @Post('self-assessment/submit')
  async submitSelfAssessment(
    @Body() dto: SubmitSelfAssessmentDto,
    @Req() req: any
  ) {
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

  // 6. Reviewer / Thẩm định hồ sơ
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

  // 7. Bảng điều khiển Đơn vị
  @Get('unit-dashboard')
  async getUnitDashboard(@Query('unitId') unitId?: string) {
    return this.clpiService.getUnitDashboard(unitId);
  }

  // 8. Bảng điều khiển BTV toàn khoa
  @Get('admin-dashboard')
  async getAdminDashboard() {
    return this.clpiService.getAdminDashboard();
  }

  // 9. Cấu hình Bộ chỉ số & Trọng số
  @Get('indicators')
  async getIndicatorsConfig() {
    return this.clpiService.getIndicatorsConfig();
  }

  @Put('indicators/weights')
  async updateWeights(@Body() dto: UpdateWeightsDto) {
    return this.clpiService.updateWeights(dto);
  }

  // 10. Quản lý nhân sự
  @Get('personnel')
  async getPersonnel() {
    return this.clpiService.getPersonnel();
  }

  @Post('personnel')
  async createPersonnel(@Body() dto: CreatePersonnelDto) {
    return this.clpiService.createPersonnel(dto);
  }

  // 11. Báo cáo & Thống kê
  @Get('analytics')
  async getAnalytics() {
    return this.clpiService.getAnalytics();
  }
}