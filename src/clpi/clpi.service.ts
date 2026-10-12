import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';
import * as jwt from 'jsonwebtoken';
import { 
  UpdateTaskProgressDto, CreateEvidenceDto, SaveMonthlyReportDraftDto, 
  SubmitMonthlyReportDto, SubmitSelfAssessmentDto, RequestRevisionDto, ApproveEvaluationDto 
} from './clpi.dto';

@Injectable()
export class ClpiService {
  private colCycles = 'ClpiCycles';
  private colTasks = 'ClpiTasks';
  private colEvidences = 'ClpiEvidences';
  private colReports = 'ClpiMonthlyReports';
  private colEvaluations = 'ClpiEvaluations';
  private colRevisions = 'ClpiRevisionRequests';

  private resolveUserInfo(req: any, fallbackId?: string): { userId: string; fullName: string; role: string } {
    let userId = fallbackId ? String(fallbackId).trim() : '';
    let fullName = 'Cán bộ';
    let role = 'officer';

    const headerId = req?.headers?.['x-user-id'];
    if (headerId && !userId) userId = String(headerId).trim();

    const authHeader = req?.headers?.['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded: any = jwt.decode(token);
        if (decoded) {
          if (!userId) userId = String(decoded._id || decoded.user_id || decoded.id || decoded.sub || '');
          fullName = decoded.displayName || decoded.full_name || decoded.name || fullName;
          role = decoded.role || role;
        }
      } catch (e) {}
    }

    return { userId, fullName, role };
  }

  private buildIdFilter(id: string): any {
    if (ObjectId.isValid(id)) return { _id: new ObjectId(id) };
    return { _id: id };
  }

  // 1. Chu kỳ CLPI hiện hành
  async getCurrentCycle() {
    try {
      const { db } = await connectToDatabase();
      const cycle = await db.collection<any>(this.colCycles).findOne({ status: { $ne: 'LOCKED' } }, { sort: { createdAt: -1 } });
      if (cycle) return cycle;

      return {
        id: 'cycle_q2_2026',
        name: 'Chu kỳ CLPI Quý II/2026',
        quarter: 'Quý II',
        year: 2026,
        startDate: '01/04/2026',
        endDate: '30/06/2026',
        selfAssessmentDeadline: '30/06/2026',
        status: 'OPEN',
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải thông tin chu kỳ CLPI');
    }
  }

  // 2. Dashboard cán bộ (Màn hình 1)
  async getDashboard(req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId, fullName } = this.resolveUserInfo(req);

      const cycle = await this.getCurrentCycle();

      // Đếm tasks
      const activeTasks = await db.collection(this.colTasks).countDocuments({
        assigneeId: userId,
        status: { $in: ['not_started', 'in_progress'] },
      });

      const today = new Date().toISOString().split('T')[0];
      const overdueTasks = await db.collection(this.colTasks).countDocuments({
        assigneeId: userId,
        status: { $nin: ['completed', 'cancelled'] },
        deadlineIso: { $lt: today },
      });

      // Lấy hồ sơ đánh giá hiện tại
      let evalDoc = await db.collection<any>(this.colEvaluations).findOne({ officerId: userId, cycleId: cycle.id || cycle._id });

      const upcomingTasks = await db.collection<any>(this.colTasks)
        .find({ assigneeId: userId, status: { $in: ['not_started', 'in_progress'] } })
        .sort({ deadlineIso: 1 })
        .limit(3)
        .toArray();

      // Kỳ gần nhất đã finalized
      const lastFinalized = await db.collection<any>(this.colEvaluations).findOne(
        { officerId: userId, status: { $in: ['APPROVED', 'FINALIZED'] } },
        { sort: { approvedAt: -1 } }
      );

      return {
        officerName: fullName,
        cycle,
        evaluationStatus: evalDoc?.status || 'NOT_STARTED',
        evaluationId: evalDoc?._id || 'eval_current',
        kpi: {
          activeTasks: activeTasks || 5,
          upcomingTasksCount: upcomingTasks.length,
          overdueTasks: overdueTasks || 0,
          ontimeRate: activeTasks + overdueTasks > 0 ? Math.round(((activeTasks) / (activeTasks + overdueTasks)) * 100) : 100,
          pendingMonthlyReports: 1,
          pendingMonthLabel: 'Tháng 08/2026 (Chờ gửi)',
          clpiStatusLabel: evalDoc?.status === 'SUBMITTED' ? 'Đã nộp tự đánh giá' : 'Đang thực hiện',
          clpiNextStep: 'Chờ BTV Đoàn Khoa duyệt',
        },
        processSteps: [
          { id: 1, label: 'Khởi tạo', status: 'completed' },
          { id: 2, label: 'Cập nhật CV', status: 'completed' },
          { id: 3, label: 'Báo cáo tháng', status: 'completed' },
          { id: 4, label: 'Tự đánh giá', status: evalDoc?.status ? 'completed' : 'current' },
          { id: 5, label: 'Đã nộp', status: evalDoc?.status === 'SUBMITTED' ? 'current' : 'pending' },
          { id: 6, label: 'BTV kiểm tra', status: 'pending' },
          { id: 7, label: 'Phê duyệt', status: 'pending' },
        ],
        upcomingTasks: upcomingTasks.length > 0 ? upcomingTasks : [
          {
            id: 'task_01',
            title: 'Tổ chức Tập huấn Lập trình GamApp 2026',
            activityName: 'Mùa Hè Xanh 2026',
            priority: 'high',
            progress: 80,
            deadline: '20/08/2026',
          },
          {
            id: 'task_02',
            title: 'Tổng hợp Minh chứng Hoạt động Học thuật Q2',
            activityName: 'Công tác Đoàn',
            priority: 'medium',
            progress: 45,
            deadline: '25/08/2026',
          },
        ],
        lastResult: lastFinalized ? {
          cycleName: lastFinalized.cycleName || 'Kết quả Quý I/2026',
          clpiScore: lastFinalized.finalClpiScore || 93.0,
          hasResult: true,
          indicators: [
            { code: 'WPI', name: 'Nhiệm vụ', weight: 40, score: lastFinalized.wpiFinalScore || 94.0 },
            { code: 'LEI', name: 'Điều hành', weight: 25, score: lastFinalized.leiFinalScore || 92.0 },
            { code: 'CEI', name: 'Tương tác', weight: 20, score: lastFinalized.ceiFinalScore || 91.0 },
            { code: 'SDI', name: 'Phát triển', weight: 15, score: lastFinalized.sdiFinalScore || 93.0 },
          ],
        } : {
          cycleName: 'Kết quả Quý I/2026',
          clpiScore: 93.0,
          hasResult: true,
          indicators: [
            { code: 'WPI', name: 'Nhiệm vụ', weight: 40, score: 94.0 },
            { code: 'LEI', name: 'Điều hành', weight: 25, score: 92.0 },
            { code: 'CEI', name: 'Tương tác', weight: 20, score: 91.0 },
            { code: 'SDI', name: 'Phát triển', weight: 15, score: 93.0 },
          ],
        },
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải dữ liệu Dashboard CLPI');
    }
  }

  // 3. Quản lý công việc (Màn hình 2 & 3)
  async getTasks(req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId } = this.resolveUserInfo(req);

      const filter: any = {};
      if (userId) filter.assigneeId = userId;

      const tasks = await db.collection(this.colTasks).find(filter).sort({ deadlineIso: 1 }).toArray();
      return tasks;
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải danh sách nhiệm vụ');
    }
  }

  async getTaskDetail(taskId: string) {
    try {
      const { db } = await connectToDatabase();
      const task = await db.collection<any>(this.colTasks).findOne(this.buildIdFilter(taskId));
      if (!task) {
        return null;
      }
      const evidences = await db.collection(this.colEvidences).find({ taskId }).toArray();
      return { ...task, evidences };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi lấy chi tiết công việc');
    }
  }

  async updateTaskProgress(taskId: string, dto: UpdateTaskProgressDto, req: any) {
    try {
      const { db } = await connectToDatabase();
      const filter = this.buildIdFilter(taskId);

      const updateData: any = {
        progress: dto.progress,
        updatedAt: new Date().toISOString(),
      };
      if (dto.status) updateData.status = dto.status;
      if (dto.progress === 100) updateData.status = 'completed';

      await db.collection(this.colTasks).updateOne(filter, { $set: updateData });
      return { success: true, message: 'Đã cập nhật tiến độ công việc' };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi cập nhật tiến độ công việc');
    }
  }

  async createEvidence(dto: CreateEvidenceDto, file: any, req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId } = this.resolveUserInfo(req);

      const newEvidence = {
        taskId: dto.taskId,
        title: dto.title,
        type: dto.type,
        url: dto.type === 'url' ? dto.url : (file ? `/uploads/evidences/${file.filename}` : ''),
        fileSize: file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Liên kết',
        createdBy: userId,
        createdAt: new Date().toLocaleDateString('vi-VN'),
      };

      const result = await db.collection(this.colEvidences).insertOne(newEvidence);
      await db.collection(this.colTasks).updateOne(this.buildIdFilter(dto.taskId), { $inc: { evidenceCount: 1 } });

      return { ...newEvidence, _id: result.insertedId };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi lưu minh chứng công việc');
    }
  }

  async deleteEvidence(evidenceId: string) {
    try {
      const { db } = await connectToDatabase();
      const evi = await db.collection<any>(this.colEvidences).findOne(this.buildIdFilter(evidenceId));
      if (evi) {
        await db.collection(this.colEvidences).deleteOne(this.buildIdFilter(evidenceId));
        await db.collection(this.colTasks).updateOne(this.buildIdFilter(evi.taskId), { $inc: { evidenceCount: -1 } });
      }
      return { success: true, message: 'Đã gỡ minh chứng' };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi xóa minh chứng');
    }
  }

  // 4. Báo cáo công tác tháng (Màn hình 4)
  async getCurrentMonthlyReport(req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId } = this.resolveUserInfo(req);
      const cycle = await this.getCurrentCycle();

      const report = await db.collection<any>(this.colReports).findOne(
        { officerId: userId, cycleId: cycle.id || cycle._id },
        { sort: { createdAt: -1 } }
      );

      if (report) return report;

      // Đồng bộ snapshot task hiện hành
      const currentTasks = await db.collection<any>(this.colTasks).find({ assigneeId: userId }).toArray();
      const tasksSnapshot = currentTasks.map(t => ({
        taskId: t._id || t.id,
        title: t.title,
        progress: t.progress,
        result: t.result || 'Đang triển khai',
      }));

      return {
        id: `report_${Date.now()}`,
        reportingMonth: '08/2026',
        cycleName: cycle.name,
        status: 'DRAFT',
        tasksSnapshot,
        selfAssessment: '',
        difficulties: '',
        supportProposal: '',
        lastSavedAt: 'Chưa lưu',
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải báo cáo công tác tháng');
    }
  }

  async saveMonthlyReportDraft(reportId: string, dto: SaveMonthlyReportDraftDto, req: any) {
    try {
      const { db } = await connectToDatabase();
      const filter = this.buildIdFilter(reportId);

      await db.collection(this.colReports).updateOne(
        filter,
        {
          $set: {
            ...dto,
            status: 'DRAFT',
            updatedAt: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
      return { success: true, message: 'Đã lưu bản nháp' };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi lưu nháp báo cáo tháng');
    }
  }

  async submitMonthlyReport(reportId: string, dto: SubmitMonthlyReportDto, req: any) {
    try {
      const { db } = await connectToDatabase();
      const filter = this.buildIdFilter(reportId);

      await db.collection(this.colReports).updateOne(
        filter,
        {
          $set: {
            selfAssessment: dto.selfAssessment,
            difficulties: dto.difficulties || '',
            supportProposal: dto.supportProposal || '',
            tasksSnapshot: dto.tasksSnapshot || [],
            status: 'SUBMITTED',
            submittedAt: new Date().toLocaleString('vi-VN'),
            updatedAt: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
      return { success: true, message: 'Nộp báo cáo công tác tháng thành công' };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi nộp báo cáo tháng');
    }
  }

  // 5. Tự đánh giá & Hồ sơ CLPI (Màn hình 5, 6, 7)
  async getSelfAssessment(req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId } = this.resolveUserInfo(req);
      const cycle = await this.getCurrentCycle();

      const evaluation = await db.collection<any>(this.colEvaluations).findOne({ officerId: userId, cycleId: cycle.id || cycle._id });

      return {
        cycleName: cycle.name,
        evaluationId: evaluation?._id || 'eval_current',
        scores: evaluation?.selfScores || { WPI: 94, LEI: 92, CEI: 91, SDI: 93 },
        explanations: evaluation?.selfExplanations || { WPI: '', LEI: '', CEI: '', SDI: '' },
        status: evaluation?.status || 'NOT_STARTED',
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải dữ liệu tự đánh giá');
    }
  }

  async submitSelfAssessment(dto: SubmitSelfAssessmentDto, req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId, fullName } = this.resolveUserInfo(req);
      const cycle = await this.getCurrentCycle();

      const now = new Date();
      const evalPayload = {
        cycleId: cycle.id || cycle._id,
        cycleName: cycle.name,
        officerId: userId,
        fullName,
        selfScores: dto.scores,
        selfExplanations: dto.explanations,
        totalSelfClpi: dto.calculatedClpi,
        status: dto.isRevision ? 'RESUBMITTED' : 'SUBMITTED',
        submittedAt: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + now.toLocaleDateString('vi-VN'),
        updatedAt: now.toISOString(),
      };

      await db.collection(this.colEvaluations).updateOne(
        { officerId: userId, cycleId: cycle.id || cycle._id },
        { $set: evalPayload },
        { upsert: true }
      );

      return { success: true, message: 'Nộp hồ sơ tự đánh giá CLPI thành công' };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi gửi hồ sơ tự đánh giá');
    }
  }

  async getEvaluationDetail(id: string) {
    try {
      const { db } = await connectToDatabase();
      const evaluation = await db.collection<any>(this.colEvaluations).findOne(this.buildIdFilter(id));
      if (!evaluation) return null;

      const evidences = await db.collection(this.colEvidences).find({ createdBy: evaluation.officerId }).toArray();
      return { ...evaluation, evidences };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi lấy chi tiết hồ sơ đánh giá');
    }
  }

  // 6. Hàng đợi Thẩm định & Reviewer (Màn hình 8 & 9)
  async getReviewQueue(req: any) {
    try {
      const { db } = await connectToDatabase();
      const queue = await db.collection(this.colEvaluations).find({
        status: { $in: ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'FINALIZED'] },
      }).sort({ submittedAt: -1 }).toArray();

      return queue;
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải danh sách hồ sơ chờ thẩm định');
    }
  }

  async requestRevision(id: string, dto: RequestRevisionDto, req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId } = this.resolveUserInfo(req);
      const filter = this.buildIdFilter(id);

      // 1. Tạo bản ghi yêu cầu bổ sung riêng biệt
      await db.collection(this.colRevisions).insertOne({
        evaluationId: id,
        reviewerId: userId,
        reason: dto.reason,
        dueDate: dto.dueDate,
        requestedAt: new Date().toISOString(),
        status: 'OPEN',
      });

      // 2. Chuyển trạng thái hồ sơ sang NEEDS_REVISION
      await db.collection(this.colEvaluations).updateOne(filter, {
        $set: {
          status: 'NEEDS_REVISION',
          revisionReason: dto.reason,
          revisionDeadline: dto.dueDate,
          draftReviewerScores: dto.draftScores || {},
          updatedAt: new Date().toISOString(),
        },
      });

      return { success: true, message: 'Đã gửi yêu cầu bổ sung hồ sơ thành công' };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi gửi yêu cầu bổ sung hồ sơ');
    }
  }

  async approveEvaluation(id: string, dto: ApproveEvaluationDto, req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId, fullName } = this.resolveUserInfo(req);
      const filter = this.buildIdFilter(id);

      const now = new Date();
      await db.collection(this.colEvaluations).updateOne(filter, {
        $set: {
          reviewerScores: dto.scores,
          wpiFinalScore: dto.scores.WPI,
          leiFinalScore: dto.scores.LEI,
          ceiFinalScore: dto.scores.CEI,
          sdiFinalScore: dto.scores.SDI,
          finalClpiScore: dto.finalScore,
          finalClassification: dto.classification,
          approvedBy: fullName || 'Ban Thường vụ Đoàn Khoa CNPM',
          approverId: userId,
          approvedAt: now.toLocaleDateString('vi-VN'),
          reviewerComment: dto.comment || '',
          status: 'FINALIZED',
          isPublished: true,
          updatedAt: now.toISOString(),
        },
      });

      return { success: true, message: 'Phê duyệt kết quả CLPI thành công' };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi phê duyệt kết quả CLPI');
    }
  }

  // 7. Bảng điều khiển Đơn vị (Màn hình 10)
  async getUnitDashboard(unitId?: string) {
    try {
      const { db } = await connectToDatabase();
      const cycle = await this.getCurrentCycle();

      const evaluations = await db.collection<any>(this.colEvaluations).find({
        cycleId: cycle.id || cycle._id,
      }).toArray();

      const finalizedEvals = evaluations.filter(e => e.finalClpiScore !== undefined && e.finalClpiScore !== null);
      const avgScore = finalizedEvals.length > 0
        ? finalizedEvals.reduce((sum, item) => sum + (item.finalClpiScore || 0), 0) / finalizedEvals.length
        : 86.4;

      const members = evaluations.map(e => ({
        id: e._id || e.id,
        fullName: e.fullName || 'Cán bộ',
        positionName: e.positionName || 'Bí thư Chi đoàn',
        wpiScore: e.wpiFinalScore ?? e.selfScores?.WPI ?? null,
        leiScore: e.leiFinalScore ?? e.selfScores?.LEI ?? null,
        ceiScore: e.ceiFinalScore ?? e.selfScores?.CEI ?? null,
        sdiScore: e.sdiFinalScore ?? e.selfScores?.SDI ?? null,
        clpiScore: e.finalClpiScore ?? e.totalSelfClpi ?? null,
        classification: e.finalClassification ?? e.selfClassification ?? null,
      }));

      return {
        unitId: unitId || 'unit_ktpm2025_1',
        unitName: 'Chi đoàn KTPM2025.1',
        cycleName: cycle.name,
        totalMembers: members.length || 5,
        onTimeReportRate: 88,
        averageClpi: Math.round(avgScore * 10) / 10,
        completedTasksRate: 92,
        members: members.length > 0 ? members : [],
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải dữ liệu bảng điều khiển đơn vị');
    }
  }
}