import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';
import * as jwt from 'jsonwebtoken';
import { 
  UpdateTaskProgressDto, CreateEvidenceDto, SaveMonthlyReportDraftDto, 
  SubmitMonthlyReportDto, SubmitSelfAssessmentDto, RequestRevisionDto, ApproveEvaluationDto,
  CreateCycleDto, UpdateWeightsDto, CreatePersonnelDto
} from './clpi.dto';

@Injectable()
export class ClpiService {
  private colCycles = 'ClpiCycles';
  private colTasks = 'ClpiTasks';
  private colEvidences = 'ClpiEvidences';
  private colReports = 'ClpiMonthlyReports';
  private colEvaluations = 'ClpiEvaluations';
  private colRevisions = 'ClpiRevisionRequests';
  private colSettings = 'ClpiSettings';
  private colPersonnel = 'ClpiPersonnel';

  private resolveUserInfo(req: any, fallbackId?: string): { userId: string; fullName: string; role: string } {
    let userId = fallbackId ? String(fallbackId).trim() : '';
    let fullName = 'Cán bộ Đoàn';
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

  async getCurrentCycle() {
    try {
      const { db } = await connectToDatabase();
      let cycle = await db.collection<any>(this.colCycles).findOne({ status: { $ne: 'LOCKED' } }, { sort: { createdAt: -1 } });
      if (cycle) {
        return { ...cycle, id: cycle._id.toString() };
      }

      const defaultCycle = {
        name: 'Chu kỳ CLPI Quý II/2026',
        quarter: 'Quý II',
        year: 2026,
        startDate: '01/04/2026',
        endDate: '30/06/2026',
        selfDeadline: '30/06/2026',
        reviewDeadline: '10/07/2026',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      };
      const res = await db.collection(this.colCycles).insertOne(defaultCycle);
      return { ...defaultCycle, _id: res.insertedId, id: res.insertedId.toString() };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải thông tin chu kỳ CLPI');
    }
  }

  async getAllCycles() {
    try {
      const { db } = await connectToDatabase();
      const cycles = await db.collection(this.colCycles).find().sort({ createdAt: -1 }).toArray();
      if (cycles.length === 0) {
        await this.getCurrentCycle();
        return await db.collection(this.colCycles).find().toArray();
      }
      return cycles.map(c => ({ ...c, id: c._id.toString() }));
    } catch (e) {
      throw new InternalServerErrorException('Lỗi lấy danh sách chu kỳ');
    }
  }

  async createCycle(dto: CreateCycleDto, req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId } = this.resolveUserInfo(req);

      const newCycle = {
        ...dto,
        status: 'OPEN',
        createdBy: userId,
        createdAt: new Date().toISOString(),
      };
      const res = await db.collection(this.colCycles).insertOne(newCycle);
      return { success: true, id: res.insertedId.toString(), ...newCycle };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi khởi tạo chu kỳ mới');
    }
  }

  async lockCycle(id: string) {
    try {
      const { db } = await connectToDatabase();
      await db.collection(this.colCycles).updateOne(this.buildIdFilter(id), {
        $set: { status: 'LOCKED', lockedAt: new Date().toISOString() }
      });
      return { success: true, message: 'Đã khóa chu kỳ đánh giá' };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi khóa chu kỳ');
    }
  }

  async getDashboard(req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId, fullName } = this.resolveUserInfo(req);
      const cycle = await this.getCurrentCycle();

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

      let evalDoc = await db.collection<any>(this.colEvaluations).findOne({
        $or: [{ officerId: userId }, { officerId: 'user_default' }],
        cycleId: cycle.id || cycle._id.toString()
      });

      const upcomingTasks = await db.collection<any>(this.colTasks)
        .find({ assigneeId: userId, status: { $in: ['not_started', 'in_progress'] } })
        .sort({ deadlineIso: 1 })
        .limit(3)
        .toArray();

      const lastFinalized = await db.collection<any>(this.colEvaluations).findOne(
        { officerId: userId, status: { $in: ['APPROVED', 'FINALIZED'] } },
        { sort: { approvedAt: -1 } }
      );

      return {
        officerName: fullName,
        cycle,
        evaluationStatus: evalDoc?.status || 'SUBMITTED',
        evaluationId: evalDoc?._id?.toString() || 'eval_current',
        kpi: {
          activeTasks: activeTasks || 5,
          upcomingTasksCount: upcomingTasks.length || 1,
          overdueTasks: overdueTasks || 0,
          ontimeRate: 100,
          pendingMonthlyReports: 1,
          pendingMonthLabel: 'Tháng 08/2026 (Chờ gửi)',
          clpiStatusLabel: evalDoc?.status === 'SUBMITTED' ? 'Đã nộp tự đánh giá' : 'Đang thực hiện',
          clpiNextStep: 'Chờ BTV Đoàn Khoa duyệt',
        },
        processSteps: [
          { id: 1, label: 'Khởi tạo', status: 'completed' },
          { id: 2, label: 'Cập nhật CV', status: 'completed' },
          { id: 3, label: 'Báo cáo tháng', status: 'completed' },
          { id: 4, label: 'Tự đánh giá', status: 'completed' },
          { id: 5, label: 'Đã nộp', status: 'current' },
          { id: 6, label: 'BTV kiểm tra', status: 'pending' },
          { id: 7, label: 'Phê duyệt', status: 'pending' },
        ],
        upcomingTasks: upcomingTasks.length > 0 ? upcomingTasks.map(t => ({ ...t, id: t._id.toString() })) : [
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
        lastResult: {
          cycleName: lastFinalized?.cycleName || 'Kết quả Quý I/2026',
          clpiScore: lastFinalized?.finalClpiScore || 93.0,
          hasResult: true,
          indicators: [
            { code: 'WPI', name: 'Nhiệm vụ', weight: 40, score: lastFinalized?.wpiFinalScore || 94.0 },
            { code: 'LEI', name: 'Điều hành', weight: 25, score: lastFinalized?.leiFinalScore || 92.0 },
            { code: 'CEI', name: 'Tương tác', weight: 20, score: lastFinalized?.ceiFinalScore || 91.0 },
            { code: 'SDI', name: 'Phát triển', weight: 15, score: lastFinalized?.sdiFinalScore || 93.0 },
          ],
        },
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải dữ liệu Dashboard CLPI');
    }
  }

  async getTasks(req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId } = this.resolveUserInfo(req);

      let tasks = await db.collection<any>(this.colTasks).find({
        $or: [{ assigneeId: userId }, { assigneeId: 'user_default' }]
      }).sort({ deadlineIso: 1 }).toArray();

      if (tasks.length === 0) {
        tasks = [
          {
            _id: 'task_01',
            title: 'Tổ chức Tập huấn Lập trình GamApp 2026',
            activityName: 'Mùa Hè Xanh',
            priority: 'high',
            deadline: '20/08/2026',
            deadlineIso: '2026-08-20',
            progress: 80,
            status: 'in_progress',
            evidenceCount: 2,
          },
          {
            _id: 'task_02',
            title: 'Tổng hợp Minh chứng Hoạt động Học thuật Q2',
            activityName: 'Công tác Đoàn',
            priority: 'medium',
            deadline: '25/08/2026',
            deadlineIso: '2026-08-25',
            progress: 45,
            status: 'in_progress',
            evidenceCount: 1,
          },
        ];
      }

      return tasks.map(t => ({ ...t, id: t._id.toString() }));
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải danh sách nhiệm vụ');
    }
  }

  async getTaskDetail(taskId: string) {
    try {
      const { db } = await connectToDatabase();
      let task: any = await db.collection<any>(this.colTasks).findOne(this.buildIdFilter(taskId));
      if (!task) {
        task = {
          _id: taskId,
          taskNumber: '3',
          title: 'Tổ chức Tập huấn Lập trình GamApp 2026',
          activityName: 'Mùa Hè Xanh 2026',
          shortDescription: 'Phụ trách nội dung giảng dạy và tài liệu chuyên môn cho học viên.',
          assignedBy: 'Bí thư Đoàn Khoa',
          primaryAssignee: 'Nguyễn Văn A',
          deadline: '20/08/2026',
          indicators: ['WPI', 'LEI'],
          progress: 80,
          description: 'Xây dựng chương trình 03 buổi tập huấn lập trình Game Mini bằng React & Canvas cho hội viên.',
          expectedOutputs: [
            'Bộ tài liệu giảng dạy 3 buổi bài giảng',
            'Đường dẫn Google Drive tổng hợp bài nộp',
            'Báo cáo sĩ số và kết quả đánh giá học viên'
          ],
          status: 'in_progress',
        };
      }
      const evidences = await db.collection(this.colEvidences).find({ taskId }).toArray();
      return { 
        ...task, 
        id: task._id.toString(),
        evidences: evidences.length > 0 ? evidences.map(e => ({ ...e, id: e._id.toString() })) : [
          {
            id: 'evi_01',
            title: 'Kế_hoạch_Tập_huấn_GamApp_2026.pdf',
            type: 'file',
            fileSize: '2.4 MB',
            createdAt: '12/08/2026'
          }
        ]
      };
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

      await db.collection(this.colTasks).updateOne(filter, { $set: updateData }, { upsert: true });
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

      return { ...newEvidence, id: result.insertedId.toString() };
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

  async getCurrentMonthlyReport(req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId, fullName } = this.resolveUserInfo(req);
      const cycle = await this.getCurrentCycle();

      const report = await db.collection<any>(this.colReports).findOne(
        { officerId: userId, cycleId: cycle.id || cycle._id?.toString() },
        { sort: { createdAt: -1 } }
      );

      if (report) return { ...report, id: report._id.toString() };

      return {
        id: `report_${Date.now()}`,
        reportingMonth: '08/2026',
        cycleName: cycle.name,
        officerName: fullName,
        positionName: 'Bí thư Chi đoàn',
        unitBranch: 'Chi đoàn KTPM2025.1',
        deadline: '28/08/2026',
        status: 'DRAFT',
        tasksSnapshot: [
          {
            taskId: 'task_01',
            title: 'Tập huấn Lập trình GamApp 2026',
            progress: 80,
            result: 'Hoàn thành 2/3 buổi học'
          },
          {
            taskId: 'task_04',
            title: 'Thiết kế Backdrop Ngày hội Tân SV',
            progress: 100,
            result: 'Đã in ấn & nghiệm thu'
          }
        ],
        selfAssessment: 'Trong tháng 08/2026, tôi đã chủ động hoàn thành các công việc được BTV giao đúng tiến độ, phối hợp tốt với Ban Học thuật tổ chức lớp tập huấn GamApp đạt chất lượng cao.',
        difficulties: 'Thời gian tổ chức tập huấn trùng với lịch thi cuối kỳ của một số cán bộ hỗ trợ nên công tác điểm danh còn chậm.',
        supportProposal: 'Đề xuất Đoàn Khoa hỗ trợ thêm kinh phí in ấn tài liệu cho học viên trong các đợt tiếp theo.',
        lastSavedAt: '16:45 hôm nay',
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

  async getSelfAssessment(req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId } = this.resolveUserInfo(req);
      const cycle = await this.getCurrentCycle();

      const evaluation = await db.collection<any>(this.colEvaluations).findOne({ 
        officerId: userId, 
        cycleId: cycle.id || cycle._id?.toString() 
      });

      return {
        cycleName: cycle.name,
        evaluationId: evaluation?._id?.toString() || 'eval_current',
        scores: evaluation?.selfScores || { WPI: 94, LEI: 92, CEI: 91, SDI: 93 },
        explanations: evaluation?.selfExplanations || {
          WPI: 'Đã hoàn thành 100% công việc trong quý đúng thời hạn. Có 1 nhiệm vụ vượt chỉ tiêu học viên.',
          LEI: 'Phối hợp nhịp nhàng với các Bí thư Chi đoàn bạn. Lãnh đạo Ban Tổ chức hoạt động chu đáo.',
          CEI: 'Tham gia đầy đủ 100% các cuộc họp giao ban BTV và các buổi sinh hoạt Chi đoàn chủ điểm.',
          SDI: 'Đã hoàn thành chứng chỉ Kỹ năng Lãnh đạo Cán bộ Trẻ do Trường Đại học CNTT cấp.'
        },
        status: evaluation?.status || 'SUBMITTED',
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
        cycleId: cycle.id || cycle._id?.toString(),
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

      const res = await db.collection(this.colEvaluations).updateOne(
        { officerId: userId, cycleId: cycle.id || cycle._id?.toString() },
        { $set: evalPayload },
        { upsert: true }
      );

      return { success: true, message: 'Nộp hồ sơ tự đánh giá CLPI thành công', evaluationId: res.upsertedId?.toString() };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi gửi hồ sơ tự đánh giá');
    }
  }

  async getEvaluationDetail(id: string, req?: any) {
    try {
      const { db } = await connectToDatabase();
      let evaluation: any = null;

      if (id !== 'current' && id !== 'eval_current') {
        evaluation = await db.collection<any>(this.colEvaluations).findOne(this.buildIdFilter(id));
      }

      if (!evaluation && req) {
        const { userId } = this.resolveUserInfo(req);
        evaluation = await db.collection<any>(this.colEvaluations).findOne({ officerId: userId });
      }

      if (!evaluation) {
        return {
          id: id || 'eval_current',
          cycleName: 'Quý II/2026',
          officerCode: 'CB-2025-014',
          fullName: 'Nguyễn Văn A',
          positionName: 'Bí thư Chi đoàn KTPM2025.1',
          unitName: 'Đoàn Khoa Công nghệ Phần mềm',
          approvedBy: 'Ban Thường vụ Đoàn Khoa CNPM',
          approvedAt: '28/06/2026',
          status: 'SUBMITTED',
          submittedAt: '14:20 15/08/2026',
          wpiScore: 94.0,
          leiScore: 92.0,
          ceiScore: 91.0,
          sdiScore: 93.0,
          totalSelfClpi: 93.0,
          selfClassification: 'Xuất sắc',
          finalClpiScore: 93.0,
          finalClassification: 'Xuất sắc',
          wpiFinalScore: 94.0,
          leiFinalScore: 92.0,
          ceiFinalScore: 91.0,
          sdiFinalScore: 93.0,
          selfScores: { WPI: 94, LEI: 92, CEI: 91, SDI: 93 },
          strengths: 'Đồng chí hoàn thành xuất sắc công tác chuyên môn học thuật, có sáng kiến hay trong hoạt động Mùa Hè Xanh. Tương tác tích cực với đoàn viên.',
          developmentRecommendation: 'Khuyến khích tiếp tục đăng ký tham gia các khóa đào tạo Lãnh đạo Cấp cao Đoàn Trường để nâng cao thêm chỉ số SDI.',
          isPublished: true,
          selfAssessmentText: 'Trong tháng 08/2026, tôi đã chủ động hoàn thành các công việc được BTV giao đúng tiến độ, phối hợp tốt với Ban Học thuật tổ chức lớp tập huấn GamApp đạt chất lượng cao.',
          difficultiesAndProposalText: 'Thời gian trùng lịch thi cuối kỳ. Đề xuất hỗ trợ thêm kinh phí in tài liệu đợt tới.',
          timeline: [
            { id: 1, label: 'Khởi tạo biểu mẫu', timeStr: '01/06/2026 08:00', status: 'completed' },
            { id: 2, label: 'Cán bộ nộp tự đánh giá', timeStr: '15/08/2026 14:20', status: 'completed' },
            { id: 3, label: 'BTV đang thẩm định', timeStr: 'Đang thực hiện (Hạn: 25/08)', status: 'current' },
            { id: 4, label: 'Phê duyệt & Công bố', timeStr: 'Chờ hoàn tất', status: 'pending' },
          ],
          evidences: [
            {
              id: 'evi_01',
              fileName: 'Kế_hoạch_Tập_huấn_GamApp_2026.pdf',
              fileSize: '2.4 MB',
              type: 'file',
              reviewerNote: 'Thẩm định: Minh chứng đầy đủ, có xác nhận của Cố vấn học tập.',
            }
          ]
        };
      }

      const evidences = await db.collection(this.colEvidences).find({ createdBy: evaluation.officerId }).toArray();
      return { 
        ...evaluation, 
        id: evaluation._id.toString(),
        evidences: evidences.map(e => ({ ...e, id: e._id.toString(), fileName: e.title })) 
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi lấy chi tiết hồ sơ đánh giá');
    }
  }

  async getReviewQueue(req: any) {
    try {
      const { db } = await connectToDatabase();
      const queue = await db.collection<any>(this.colEvaluations).find({
        status: { $in: ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'FINALIZED'] },
      }).sort({ submittedAt: -1 }).toArray();

      if (queue.length === 0) {
        return [
          {
            id: 'eval_01',
            fullName: 'Nguyễn Văn A',
            unitBranch: 'KTPM2025.1',
            positionName: 'Bí thư Chi đoàn',
            submittedAt: '15/08/2026',
            selfScore: 93.0,
            reviewerScore: null,
            status: 'SUBMITTED',
            isOverdue: false,
          },
          {
            id: 'eval_02',
            fullName: 'Trần Thị B',
            unitBranch: 'Ban Học thuật',
            positionName: 'Trưởng Ban',
            submittedAt: '14/08/2026',
            selfScore: 88.5,
            reviewerScore: null,
            status: 'SUBMITTED',
            isOverdue: true,
          },
        ];
      }

      return queue.map(q => ({
        ...q,
        id: q._id.toString(),
        selfScore: q.totalSelfClpi || q.selfScore || 90,
      }));
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải danh sách hồ sơ chờ thẩm định');
    }
  }

  async requestRevision(id: string, dto: RequestRevisionDto, req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId } = this.resolveUserInfo(req);
      const filter = this.buildIdFilter(id);

      await db.collection(this.colRevisions).insertOne({
        evaluationId: id,
        reviewerId: userId,
        reason: dto.reason,
        dueDate: dto.dueDate,
        requestedAt: new Date().toISOString(),
        status: 'OPEN',
      });

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

  async getUnitDashboard(unitId?: string) {
    try {
      const { db } = await connectToDatabase();
      const cycle = await this.getCurrentCycle();

      const evaluations = await db.collection<any>(this.colEvaluations).find().toArray();

      const members = [
        {
          id: 'user_01',
          fullName: 'Nguyễn Văn A',
          positionName: 'Bí thư Chi đoàn',
          wpiScore: 94.0,
          leiScore: 92.0,
          ceiScore: 91.0,
          sdiScore: 93.0,
          clpiScore: 93.0,
          classification: 'Xuất sắc',
        },
        {
          id: 'user_02',
          fullName: 'Trần Minh C',
          positionName: 'Phó Bí thư',
          wpiScore: 88.0,
          leiScore: 86.0,
          ceiScore: 85.0,
          sdiScore: 87.0,
          clpiScore: 86.8,
          classification: 'Tốt',
        },
        {
          id: 'user_03',
          fullName: 'Lê Hoàng D',
          positionName: 'Ủy viên BCH',
          wpiScore: 70.0,
          leiScore: 65.0,
          ceiScore: 60.0,
          sdiScore: 68.0,
          clpiScore: 66.2,
          classification: 'Đạt',
        },
      ];

      return {
        unitId: unitId || 'unit_ktpm2025_1',
        unitName: 'Chi đoàn KTPM2025.1',
        cycleName: cycle.name,
        totalMembers: members.length,
        onTimeReportRate: 88,
        averageClpi: 86.4,
        completedTasksRate: 92,
        members,
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải dữ liệu bảng điều khiển đơn vị');
    }
  }

  async getAdminDashboard() {
    try {
      const { db } = await connectToDatabase();
      const cycle = await this.getCurrentCycle();

      return {
        cycleName: cycle.name,
        stats: {
          totalOfficers: 42,
          submittedReports: 39,
          approvedEvaluations: 34,
          pendingReviews: 5,
          averageCLPI: 87.2,
          excellentRate: 28,
        },
        unitSummaries: [
          { id: '1', name: 'Chi đoàn KTPM2025.1', total: 6, submitted: 6, avgCLPI: 89.4, status: 'Hoàn thành' },
          { id: '2', name: 'Chi đoàn KTPM2024.1', total: 8, submitted: 8, avgCLPI: 88.1, status: 'Hoàn thành' },
          { id: '3', name: 'Ban Học thuật', total: 10, submitted: 9, avgCLPI: 86.5, status: 'Chờ duyệt 1' },
          { id: '4', name: 'Ban Phong trào', total: 9, submitted: 8, avgCLPI: 85.0, status: 'Chờ duyệt 1' },
          { id: '5', name: 'CLB GamApp', total: 9, submitted: 8, avgCLPI: 87.8, status: 'Chờ duyệt 1' },
        ],
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải Admin Dashboard CLPI');
    }
  }

  async getIndicatorsConfig() {
    try {
      const { db } = await connectToDatabase();
      const settings = await db.collection<any>(this.colSettings).findOne({ type: 'weights' });

      return {
        weights: settings?.weights || { WPI: 40, LEI: 25, CEI: 20, SDI: 15 },
        total: 100,
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi lấy cấu hình bộ chỉ số');
    }
  }

  async updateWeights(dto: UpdateWeightsDto) {
    const total = dto.WPI + dto.LEI + dto.CEI + dto.SDI;
    if (total !== 100) {
      throw new BadRequestException(`Tổng trọng số phải bằng 100% (Hiện tại: ${total}%)`);
    }

    try {
      const { db } = await connectToDatabase();
      await db.collection(this.colSettings).updateOne(
        { type: 'weights' },
        { $set: { weights: dto, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      return { success: true, message: 'Đã cập nhật bảng phân bổ trọng số CLPI thành công' };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi lưu cấu hình trọng số');
    }
  }

  async getPersonnel() {
    try {
      const { db } = await connectToDatabase();
      const list = await db.collection<any>(this.colPersonnel).find().toArray();
      if (list.length === 0) {
        return [
          { id: '1', code: 'CB-2025-014', name: 'Nguyễn Văn A', position: 'Bí thư Chi đoàn', unit: 'Chi đoàn KTPM2025.1', role: 'Unit Manager' },
          { id: '2', code: 'CB-2024-002', name: 'Trần Thị B', position: 'Trưởng Ban', unit: 'Ban Học thuật', role: 'Reviewer' },
          { id: '3', code: 'CB-2025-089', name: 'Lê Hoàng C', position: 'Chủ nhiệm CLB', unit: 'CLB GamApp', role: 'Unit Manager' },
          { id: '4', code: 'CB-2024-055', name: 'Phạm Minh D', position: 'Phó Bí thư Đoàn Khoa', unit: 'BTV Đoàn Khoa', role: 'CLPI Admin' },
          { id: '5', code: 'CB-2025-102', name: 'Võ Thị F', position: 'Ủy viên BCH', unit: 'Chi đoàn KTPM2025.1', role: 'Officer' },
        ];
      }
      return list.map(p => ({ ...p, id: p._id.toString() }));
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải danh sách nhân sự');
    }
  }

  async createPersonnel(dto: CreatePersonnelDto) {
    try {
      const { db } = await connectToDatabase();
      const res = await db.collection(this.colPersonnel).insertOne({
        ...dto,
        createdAt: new Date().toISOString(),
      });
      return { success: true, id: res.insertedId.toString() };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi thêm nhân sự');
    }
  }

  async getAnalytics() {
    try {
      return {
        topOfficers: [
          { name: 'Nguyễn Văn A', unit: 'Chi đoàn KTPM2025.1', score: 94.2 },
          { name: 'Phạm Minh D', unit: 'Chi đoàn KTPM2024.2', score: 93.8 },
          { name: 'Trần Thị B', unit: 'Ban Học thuật', score: 92.5 },
          { name: 'Lê Hoàng C', unit: 'CLB GamApp', score: 91.0 },
          { name: 'Võ Thị F', unit: 'Chi đoàn KTPM2025.1', score: 89.8 },
        ],
        quarterTrends: [
          { quarter: 'Q3/2025', score: 84.5 },
          { quarter: 'Q4/2025', score: 85.8 },
          { quarter: 'Q1/2026', score: 86.4 },
          { quarter: 'Q2/2026', score: 87.2 },
        ],
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải thống kê thi đua');
    }
  }
}