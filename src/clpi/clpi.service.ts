import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';
import * as jwt from 'jsonwebtoken';
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

@Injectable()
export class ClpiService {
  private colCycles = 'ClpiCycles';
  private colTasks = 'ClpiTasks';
  private colEvidences = 'ClpiEvidences';
  private colReports = 'ClpiMonthlyReports';
  private colEvaluations = 'ClpiEvaluations';
  private colRevisions = 'ClpiRevisionRequests';
  private colSettings = 'ClpiSettings';
  private colUsers = 'Users';

  private resolveUserInfo(
    req: any,
    fallbackId?: string
  ): { userId: string; fullName: string; role: string } {
    let userId = fallbackId ? String(fallbackId).trim() : '';
    let fullName = '';
    let role = 'officer';

    const headerId = req?.headers?.['x-user-id'];
    if (headerId && !userId) userId = String(headerId).trim();

    const authHeader = req?.headers?.['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded: any = jwt.decode(token);
        if (decoded) {
          if (!userId) {
            userId = String(decoded._id || decoded.user_id || decoded.id || decoded.sub || '');
          }
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

  private normalizeIsoDate(dateStr?: string): string {
    if (!dateStr) return '';
    const trimmed = String(dateStr).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [d, m, y] = trimmed.split('/');
      return `${y}-${m}-${d}`;
    }
    return trimmed.slice(0, 10);
  }

  private getLastDayOfMonthStr(monthYear: string): string {
    const parts = String(monthYear || '').split('/');
    if (parts.length === 2) {
      const month = parseInt(parts[0], 10);
      const year = parseInt(parts[1], 10);
      if (!isNaN(month) && !isNaN(year) && month >= 1 && month <= 12) {
        const lastDay = new Date(year, month, 0).getDate();
        return `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
      }
    }
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${String(lastDay).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}/${now.getFullYear()}`;
  }

  private computeClassification(score: number): string {
    if (score >= 90) return 'Xuất sắc';
    if (score >= 80) return 'Tốt';
    if (score >= 65) return 'Đạt';
    if (score >= 50) return 'Cần hỗ trợ';
    return 'Chưa đạt';
  }

  private async getUserProfile(db: any, userId: string, fallbackName = '') {
    if (!userId) {
      return {
        fullName: fallbackName || 'Cán bộ Đoàn',
        officerCode: '',
        positionName: 'Cán bộ Đoàn - Hội',
        unitBranch: 'Đoàn Khoa Công nghệ Phần mềm',
        avatarUrl: '',
      };
    }

    const conditions: any[] = [{ _id: userId }, { student_id: userId }, { mssv: userId }];
    if (ObjectId.isValid(userId)) {
      conditions.push({ _id: new ObjectId(userId) });
    }

    const userDoc: any = await db.collection(this.colUsers).findOne({ $or: conditions });
    const positions: string[] = Array.isArray(userDoc?.positions)
      ? userDoc.positions.filter(Boolean)
      : userDoc?.position || userDoc?.chuc_vu
      ? String(userDoc.position || userDoc.chuc_vu)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    return {
      fullName: userDoc?.full_name || userDoc?.name || fallbackName || 'Cán bộ Đoàn',
      officerCode: userDoc?.student_id || userDoc?.mssv || '',
      positionName: positions.length > 0 ? positions.join(', ') : 'Ủy viên BCH',
      unitBranch: userDoc?.class || 'Đoàn Khoa Công nghệ Phần mềm',
      avatarUrl: userDoc?.image_url || '',
    };
  }

  async getCurrentCycle() {
    try {
      const { db } = await connectToDatabase();
      const cycle: any = await db
        .collection(this.colCycles)
        .findOne({ status: { $ne: 'LOCKED' } }, { sort: { createdAt: -1 } });

      if (!cycle) return null;
      return { ...cycle, id: cycle._id.toString() };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải thông tin chu kỳ CLPI');
    }
  }

  async getAllCycles() {
    try {
      const { db } = await connectToDatabase();
      const [cycles, users] = await Promise.all([
        db.collection(this.colCycles).find({}).sort({ createdAt: -1 }).toArray(),
        db.collection(this.colUsers).find({}, { projection: { class: 1 } }).toArray(),
      ]);

      return cycles.map((c: any) => {
        const cycleUnits: string[] = Array.isArray(c.units) ? c.units : [];
        const matchedOfficers =
          cycleUnits.length > 0
            ? users.filter((u: any) => cycleUnits.includes(String(u.class || '').trim())).length
            : users.length;

        return {
          ...c,
          id: c._id.toString(),
          totalOfficers: matchedOfficers,
        };
      });
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
      const res = await db.collection(this.colCycles).updateOne(this.buildIdFilter(id), {
        $set: { status: 'LOCKED', lockedAt: new Date().toISOString() },
      });
      if (res.matchedCount === 0) {
        throw new NotFoundException('Không tìm thấy chu kỳ đánh giá');
      }
      return { success: true, message: 'Đã khóa chu kỳ đánh giá' };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new InternalServerErrorException('Lỗi khóa chu kỳ');
    }
  }

  async deleteCycle(id: string) {
    try {
      const { db } = await connectToDatabase();
      const filter = this.buildIdFilter(id);
      const cycle: any = await db.collection(this.colCycles).findOne(filter);
      if (!cycle) {
        throw new NotFoundException('Không tìm thấy chu kỳ đánh giá');
      }

      const cycleIdStr = cycle._id.toString();
      const evalCount = await db.collection(this.colEvaluations).countDocuments({ cycleId: cycleIdStr });
      if (evalCount > 0) {
        throw new BadRequestException(
          `Không thể xóa chu kỳ đã có ${evalCount} hồ sơ đánh giá. Vui lòng dùng tính năng Khóa chu kỳ.`
        );
      }

      await db.collection(this.colCycles).deleteOne(filter);
      return { success: true, message: 'Đã xóa chu kỳ đánh giá' };
    } catch (e) {
      if (e instanceof NotFoundException || e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('Lỗi xóa chu kỳ đánh giá');
    }
  }

  async getDashboard(req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId, fullName } = this.resolveUserInfo(req);
      const profile = await this.getUserProfile(db, userId, fullName);
      const cycle = await this.getCurrentCycle();
      const weightsCfg = await this.getIndicatorsConfig();

      const todayIso = new Date().toISOString().split('T')[0];
      const next7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      const taskQuery: any = userId
        ? {
            status: { $nin: ['CANCELLED', 'cancelled'] },
            $or: [
              { assigneeId: userId },
              { primaryAssigneeId: userId },
              { 'collaborators.id': userId },
            ],
          }
        : { _id: null };

      const userTasks: any[] = await db
        .collection(this.colTasks)
        .find(taskQuery)
        .sort({ deadlineIso: 1 })
        .toArray();

      const nonCompletedTasks = userTasks.filter(
        (t: any) => !['COMPLETED', 'completed'].includes(t.status)
      );
      const overdueTasks = nonCompletedTasks.filter((t: any) => {
        const dIso = t.deadlineIso || this.normalizeIsoDate(t.deadline);
        return Boolean(dIso && dIso < todayIso);
      });
      const upcomingTasks = nonCompletedTasks
        .filter((t: any) => {
          const dIso = t.deadlineIso || this.normalizeIsoDate(t.deadline);
          return !dIso || dIso <= next7Days;
        })
        .slice(0, 3);

      const ontimeRate =
        nonCompletedTasks.length > 0
          ? Math.round(
              ((nonCompletedTasks.length - overdueTasks.length) / nonCompletedTasks.length) * 100
            )
          : 100;

      const cycleId = cycle ? cycle.id || cycle._id.toString() : '';
      const evalDoc: any =
        userId && cycleId
          ? await db
              .collection(this.colEvaluations)
              .findOne({ officerId: userId, cycleId })
          : null;

      const pendingReports: any[] =
        userId && cycleId
          ? await db
              .collection(this.colReports)
              .find({
                officerId: userId,
                cycleId,
                status: { $in: ['DRAFT', 'NEEDS_REVISION', 'NOT_STARTED'] },
              })
              .toArray()
          : [];

      const submittedReportCount =
        userId && cycleId
          ? await db.collection(this.colReports).countDocuments({
              officerId: userId,
              cycleId,
              status: { $in: ['SUBMITTED', 'RESUBMITTED', 'APPROVED', 'LOCKED'] },
            })
          : 0;

      const lastFinalized: any = userId
        ? await db.collection(this.colEvaluations).findOne(
            { officerId: userId, status: { $in: ['APPROVED', 'FINALIZED', 'PUBLISHED'] } },
            { sort: { updatedAt: -1 } }
          )
        : null;

      const evalStatus = evalDoc?.status || 'NOT_STARTED';
      const statusLabels: Record<string, { label: string; next: string }> = {
        NOT_STARTED: { label: 'Chưa bắt đầu', next: 'Chờ cán bộ tự đánh giá' },
        DRAFT: { label: 'Đang tự đánh giá', next: 'Hoàn thiện và nộp hồ sơ' },
        SUBMITTED: { label: 'Đã nộp tự đánh giá', next: 'Chờ BTV Đoàn Khoa duyệt' },
        RESUBMITTED: { label: 'Đã nộp lại hồ sơ', next: 'Chờ BTV thẩm định lại' },
        UNDER_REVIEW: { label: 'BTV đang kiểm tra', next: 'Đang trong quá trình thẩm định' },
        NEEDS_REVISION: { label: 'Cần bổ sung hồ sơ', next: 'Vui lòng bổ sung theo yêu cầu BTV' },
        APPROVED: { label: 'Đã phê duyệt', next: 'Hoàn tất đánh giá chu kỳ' },
        FINALIZED: { label: 'Hoàn tất đánh giá', next: 'Đã công bố kết quả chính thức' },
      };

      const mappedStatus = statusLabels[evalStatus] || statusLabels.NOT_STARTED;

      const isSubmittedOrLater = [
        'SUBMITTED',
        'RESUBMITTED',
        'UNDER_REVIEW',
        'APPROVED',
        'FINALIZED',
      ].includes(evalStatus);
      const isReviewingOrLater = ['UNDER_REVIEW', 'APPROVED', 'FINALIZED'].includes(evalStatus);
      const isApproved = ['APPROVED', 'FINALIZED'].includes(evalStatus);

      return {
        officerName: profile.fullName,
        cycle,
        evaluationStatus: evalStatus,
        evaluationId: evalDoc?._id?.toString() || '',
        kpi: {
          activeTasks: nonCompletedTasks.length,
          upcomingTasksCount: upcomingTasks.length,
          overdueTasks: overdueTasks.length,
          ontimeRate,
          pendingMonthlyReports: pendingReports.length,
          pendingMonthLabel:
            pendingReports.length > 0
              ? `Tháng ${pendingReports[0].reportingMonth} (Chờ gửi)`
              : 'Đã hoàn thành báo cáo',
          clpiStatusLabel: mappedStatus.label,
          clpiNextStep: mappedStatus.next,
        },
        processSteps: [
          { id: 1, label: 'Khởi tạo', status: cycle ? 'completed' : 'pending' },
          { id: 2, label: 'Cập nhật CV', status: userTasks.length > 0 ? 'completed' : 'current' },
          {
            id: 3,
            label: 'Báo cáo tháng',
            status: submittedReportCount > 0 ? 'completed' : 'pending',
          },
          {
            id: 4,
            label: 'Tự đánh giá',
            status:
              evalStatus === 'NEEDS_REVISION'
                ? 'warning'
                : isSubmittedOrLater
                ? 'completed'
                : evalStatus === 'DRAFT'
                ? 'current'
                : 'pending',
          },
          {
            id: 5,
            label: 'Đã nộp',
            status: isSubmittedOrLater
              ? isReviewingOrLater
                ? 'completed'
                : 'current'
              : 'pending',
          },
          {
            id: 6,
            label: 'BTV kiểm tra',
            status: isApproved ? 'completed' : isReviewingOrLater ? 'current' : 'pending',
          },
          { id: 7, label: 'Phê duyệt', status: isApproved ? 'completed' : 'pending' },
        ],
        upcomingTasks: upcomingTasks.map((t: any) => ({
          id: t._id.toString(),
          title: t.title,
          activityName: t.activityName || '',
          priority: String(t.priority || 'NORMAL').toLowerCase(),
          progress: Number(t.progress || 0),
          deadline: t.deadline,
        })),
        lastResult: lastFinalized
          ? {
              cycleName: lastFinalized.cycleName,
              clpiScore: Number(lastFinalized.finalClpiScore || 0),
              hasResult: true,
              indicators: [
                {
                  code: 'WPI',
                  name: 'Nhiệm vụ',
                  weight: weightsCfg.weights.WPI,
                  score: Number(lastFinalized.wpiFinalScore || 0),
                },
                {
                  code: 'LEI',
                  name: 'Điều hành',
                  weight: weightsCfg.weights.LEI,
                  score: Number(lastFinalized.leiFinalScore || 0),
                },
                {
                  code: 'CEI',
                  name: 'Tương tác',
                  weight: weightsCfg.weights.CEI,
                  score: Number(lastFinalized.ceiFinalScore || 0),
                },
                {
                  code: 'SDI',
                  name: 'Phát triển',
                  weight: weightsCfg.weights.SDI,
                  score: Number(lastFinalized.sdiFinalScore || 0),
                },
              ],
            }
          : {
              cycleName: '',
              clpiScore: 0,
              hasResult: false,
              indicators: [],
            },
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải dữ liệu Dashboard CLPI');
    }
  }

  async getManagedTasks() {
    try {
      const { db } = await connectToDatabase();
      const tasks: any[] = await db
        .collection(this.colTasks)
        .find({})
        .sort({ createdAt: -1, deadlineIso: 1 })
        .toArray();

      return tasks.map((t: any) => ({
        ...t,
        id: t._id.toString(),
      }));
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải danh sách công việc quản trị');
    }
  }

  async createTask(dto: CreateClpiTaskDto, req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId, fullName } = this.resolveUserInfo(req);

      const cleanOutputs = (dto.expectedOutputs || [])
        .map((o) => String(o).trim())
        .filter(Boolean);
      if (cleanOutputs.length === 0) {
        throw new BadRequestException('Phải có ít nhất 01 sản phẩm đầu ra dự kiến');
      }

      const deadlineIso = this.normalizeIsoDate(dto.deadline);

      const newTask = {
        title: dto.title.trim(),
        cycleId: dto.cycleId || null,
        cycleName: dto.cycleName || '',
        activityId: dto.activityId || null,
        activityName: dto.activityName || '',
        shortDescription: dto.shortDescription?.trim() || '',
        description: dto.description.trim(),
        priority: dto.priority || 'NORMAL',
        startDate: dto.startDate || new Date().toISOString().slice(0, 10),
        deadline: dto.deadline,
        deadlineIso,
        assigneeId: String(dto.primaryAssigneeId),
        primaryAssigneeId: String(dto.primaryAssigneeId),
        primaryAssigneeName: dto.primaryAssigneeName || '',
        collaborators: Array.isArray(dto.collaborators) ? dto.collaborators : [],
        indicators: Array.isArray(dto.indicators) ? dto.indicators : ['WPI'],
        expectedOutputs: cleanOutputs,
        requireEvidence: dto.requireEvidence ?? true,
        assignedById: dto.assignedById || userId,
        assignedByName: dto.assignedByName || fullName || 'Ban Thường vụ Đoàn Khoa',
        assignedBy: dto.assignedByName || fullName || 'Ban Thường vụ Đoàn Khoa',
        status: 'NOT_STARTED',
        progress: 0,
        evidenceCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await db.collection(this.colTasks).insertOne(newTask);
      return { success: true, ...newTask, _id: res.insertedId, id: res.insertedId.toString() };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('Lỗi tạo và giao công việc CLPI');
    }
  }

  async updateTask(taskId: string, dto: UpdateClpiTaskDto) {
    try {
      const { db } = await connectToDatabase();
      const filter = this.buildIdFilter(taskId);

      const updateFields: any = {
        ...dto,
        updatedAt: new Date().toISOString(),
      };
      delete updateFields._id;
      delete updateFields.id;

      if (dto.primaryAssigneeId) {
        updateFields.assigneeId = String(dto.primaryAssigneeId);
      }
      if (dto.deadline) {
        updateFields.deadlineIso = this.normalizeIsoDate(dto.deadline);
      }

      const res = await db.collection(this.colTasks).updateOne(filter, { $set: updateFields });
      if (res.matchedCount === 0) {
        throw new NotFoundException('Không tìm thấy công việc để cập nhật');
      }

      return { success: true, message: 'Cập nhật công việc thành công' };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new InternalServerErrorException('Lỗi cập nhật công việc CLPI');
    }
  }

  async getTasks(req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId } = this.resolveUserInfo(req);
      if (!userId) return [];

      const tasks: any[] = await db
        .collection(this.colTasks)
        .find({
          status: { $nin: ['CANCELLED', 'cancelled'] },
          $or: [
            { assigneeId: userId },
            { primaryAssigneeId: userId },
            { 'collaborators.id': userId },
          ],
        })
        .sort({ deadlineIso: 1 })
        .toArray();

      return tasks.map((t: any) => ({ ...t, id: t._id.toString() }));
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải danh sách nhiệm vụ');
    }
  }

  async getTaskDetail(taskId: string) {
    try {
      const { db } = await connectToDatabase();
      const task: any = await db.collection(this.colTasks).findOne(this.buildIdFilter(taskId));
      if (!task) {
        throw new NotFoundException('Không tìm thấy thông tin công việc');
      }

      const evidences: any[] = await db
        .collection(this.colEvidences)
        .find({ taskId: { $in: [taskId, task._id.toString()] } })
        .toArray();

      return {
        ...task,
        id: task._id.toString(),
        primaryAssignee: task.primaryAssigneeName || task.primaryAssignee || '',
        assignedBy: task.assignedByName || task.assignedBy || 'Ban Thường vụ Đoàn Khoa',
        evidences: evidences.map((e: any) => ({ ...e, id: e._id.toString() })),
      };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
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
      if (dto.status) {
        updateData.status = dto.status;
      } else if (dto.progress === 100) {
        updateData.status = 'COMPLETED';
      } else if (dto.progress > 0) {
        updateData.status = 'IN_PROGRESS';
      }

      const res = await db.collection(this.colTasks).updateOne(filter, { $set: updateData });
      if (res.matchedCount === 0) {
        throw new NotFoundException('Không tìm thấy công việc để cập nhật tiến độ');
      }
      return { success: true, message: 'Đã cập nhật tiến độ công việc' };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
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
        url: dto.type === 'url' ? dto.url : file ? `/uploads/evidences/${file.filename}` : '',
        fileSize: file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Liên kết',
        createdBy: userId,
        createdAt: new Date().toLocaleDateString('vi-VN'),
      };

      const result = await db.collection(this.colEvidences).insertOne(newEvidence);
      await db
        .collection(this.colTasks)
        .updateOne(this.buildIdFilter(dto.taskId), { $inc: { evidenceCount: 1 } });

      return { ...newEvidence, id: result.insertedId.toString() };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi lưu minh chứng công việc');
    }
  }

  async deleteEvidence(evidenceId: string) {
    try {
      const { db } = await connectToDatabase();
      const evi: any = await db
        .collection(this.colEvidences)
        .findOne(this.buildIdFilter(evidenceId));
      if (!evi) {
        throw new NotFoundException('Không tìm thấy minh chứng');
      }

      await db.collection(this.colEvidences).deleteOne(this.buildIdFilter(evidenceId));
      if (evi.taskId) {
        await db
          .collection(this.colTasks)
          .updateOne(this.buildIdFilter(evi.taskId), { $inc: { evidenceCount: -1 } });
      }
      return { success: true, message: 'Đã gỡ minh chứng' };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new InternalServerErrorException('Lỗi xóa minh chứng');
    }
  }

  async getCurrentMonthlyReport(req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId, fullName } = this.resolveUserInfo(req);
      const profile = await this.getUserProfile(db, userId, fullName);
      const cycle = await this.getCurrentCycle();
      const cycleId = cycle ? cycle.id || cycle._id?.toString() : '';

      const now = new Date();
      const currentMonthStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const monthlyDeadline = this.getLastDayOfMonthStr(currentMonthStr);

      const report: any = userId
        ? await db
            .collection(this.colReports)
            .findOne({ officerId: userId, reportingMonth: currentMonthStr }, { sort: { createdAt: -1 } })
        : null;

      if (report) {
        return {
          ...report,
          id: report._id.toString(),
          deadline: this.getLastDayOfMonthStr(report.reportingMonth || currentMonthStr),
        };
      }

      const userTasks = await this.getTasks(req);
      const tasksSnapshot = userTasks.map((t: any) => ({
        taskId: t.id,
        title: t.title,
        progress: Number(t.progress || 0),
        result: t.result || (Number(t.progress) === 100 ? 'Đã hoàn thành' : 'Đang triển khai'),
      }));

      const newDraft = {
        reportingMonth: currentMonthStr,
        cycleId,
        cycleName: cycle?.name || '',
        officerId: userId,
        officerName: profile.fullName,
        positionName: profile.positionName,
        unitBranch: profile.unitBranch,
        deadline: monthlyDeadline,
        status: 'DRAFT',
        tasksSnapshot,
        selfAssessment: '',
        difficulties: '',
        supportProposal: '',
        lastSavedAt: '',
        createdAt: new Date().toISOString(),
      };

      const inserted = await db.collection(this.colReports).insertOne(newDraft);
      return { ...newDraft, _id: inserted.insertedId, id: inserted.insertedId.toString() };
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
            lastSavedAt: new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            }),
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
      const cycleId = cycle ? cycle.id || cycle._id?.toString() : '';

      const evaluation: any =
        userId && cycleId
          ? await db.collection(this.colEvaluations).findOne({ officerId: userId, cycleId })
          : null;

      return {
        cycleName: cycle?.name || '',
        evaluationId: evaluation?._id?.toString() || '',
        scores: evaluation?.selfScores || { WPI: 0, LEI: 0, CEI: 0, SDI: 0 },
        explanations: evaluation?.selfExplanations || { WPI: '', LEI: '', CEI: '', SDI: '' },
        revisionReason: evaluation?.revisionReason || '',
        revisionDeadline: evaluation?.revisionDeadline || '',
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
      if (!userId) {
        throw new BadRequestException('Không xác định được thông tin cán bộ đăng nhập');
      }

      const profile = await this.getUserProfile(db, userId, fullName);
      const cycle = await this.getCurrentCycle();
      if (!cycle) {
        throw new BadRequestException('Hiện chưa có chu kỳ đánh giá CLPI nào đang mở');
      }

      const cycleId = cycle.id || cycle._id.toString();
      const now = new Date();
      const timeStr = `${now.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })} ${now.toLocaleDateString('vi-VN')}`;

      const evalPayload = {
        cycleId,
        cycleName: cycle.name,
        officerId: userId,
        officerCode: profile.officerCode,
        fullName: profile.fullName,
        positionName: profile.positionName,
        unitBranch: profile.unitBranch,
        unitName: profile.unitBranch,
        selfScores: dto.scores,
        selfExplanations: dto.explanations,
        totalSelfClpi: dto.calculatedClpi,
        selfClassification: this.computeClassification(dto.calculatedClpi),
        status: dto.isRevision ? 'RESUBMITTED' : 'SUBMITTED',
        submittedAt: timeStr,
        updatedAt: now.toISOString(),
      };

      const existing: any = await db
        .collection(this.colEvaluations)
        .findOne({ officerId: userId, cycleId });

      if (existing) {
        await db
          .collection(this.colEvaluations)
          .updateOne({ _id: existing._id }, { $set: evalPayload });
        return {
          success: true,
          message: 'Nộp hồ sơ tự đánh giá CLPI thành công',
          evaluationId: existing._id.toString(),
        };
      } else {
        const res = await db.collection(this.colEvaluations).insertOne({
          ...evalPayload,
          createdAt: now.toISOString(),
        });
        return {
          success: true,
          message: 'Nộp hồ sơ tự đánh giá CLPI thành công',
          evaluationId: res.insertedId.toString(),
        };
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('Lỗi gửi hồ sơ tự đánh giá');
    }
  }

  async getEvaluationDetail(id: string, req?: any) {
    try {
      const { db } = await connectToDatabase();
      let evaluation: any = null;

      if (id && id !== 'current' && id !== 'eval_current') {
        evaluation = await db
          .collection(this.colEvaluations)
          .findOne(this.buildIdFilter(id));
      }

      if (!evaluation && req) {
        const { userId } = this.resolveUserInfo(req);
        if (userId) {
          evaluation = await db
            .collection(this.colEvaluations)
            .findOne({ officerId: userId }, { sort: { updatedAt: -1 } });
        }
      }

      if (!evaluation) {
        throw new NotFoundException('Không tìm thấy hồ sơ đánh giá CLPI');
      }

      const evidences: any[] = await db
        .collection(this.colEvidences)
        .find({ createdBy: evaluation.officerId })
        .toArray();

      const latestReport: any = await db
        .collection(this.colReports)
        .findOne(
          { officerId: evaluation.officerId, cycleId: evaluation.cycleId },
          { sort: { updatedAt: -1 } }
        );

      const isSubmitted = [
        'SUBMITTED',
        'RESUBMITTED',
        'UNDER_REVIEW',
        'NEEDS_REVISION',
        'APPROVED',
        'FINALIZED',
      ].includes(evaluation.status);
      const isApproved = ['APPROVED', 'FINALIZED'].includes(evaluation.status);

      const timeline = [
        {
          id: 1,
          label: 'Khởi tạo biểu mẫu',
          timeStr: evaluation.createdAt
            ? new Date(evaluation.createdAt).toLocaleString('vi-VN')
            : '',
          status: 'completed',
        },
        {
          id: 2,
          label: 'Cán bộ nộp tự đánh giá',
          timeStr: evaluation.submittedAt || 'Chưa nộp',
          status: isSubmitted ? 'completed' : 'current',
        },
        {
          id: 3,
          label: 'BTV đang thẩm định',
          timeStr: isApproved
            ? 'Đã hoàn tất thẩm định'
            : evaluation.status === 'NEEDS_REVISION'
            ? 'Đã yêu cầu bổ sung hồ sơ'
            : isSubmitted
            ? 'Đang thực hiện'
            : 'Chờ nộp hồ sơ',
          status: isApproved
            ? 'completed'
            : evaluation.status === 'NEEDS_REVISION'
            ? 'warning'
            : isSubmitted
            ? 'current'
            : 'pending',
        },
        {
          id: 4,
          label: 'Phê duyệt & Công bố',
          timeStr: evaluation.approvedAt || 'Chờ hoàn tất',
          status: isApproved ? 'completed' : 'pending',
        },
      ];

      return {
        ...evaluation,
        id: evaluation._id.toString(),
        wpiScore: Number(evaluation.selfScores?.WPI || 0),
        leiScore: Number(evaluation.selfScores?.LEI || 0),
        ceiScore: Number(evaluation.selfScores?.CEI || 0),
        sdiScore: Number(evaluation.selfScores?.SDI || 0),
        selfAssessmentText: latestReport?.selfAssessment || '',
        difficultiesAndProposalText: [
          latestReport?.difficulties,
          latestReport?.supportProposal,
        ]
          .filter(Boolean)
          .join(' | '),
        timeline,
        evidences: evidences.map((e: any) => ({
          ...e,
          id: e._id.toString(),
          fileName: e.title,
        })),
      };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new InternalServerErrorException('Lỗi lấy chi tiết hồ sơ đánh giá');
    }
  }

  async getReviewQueue(req: any) {
    try {
      const { db } = await connectToDatabase();
      const queue: any[] = await db
        .collection(this.colEvaluations)
        .find({
          status: {
            $in: [
              'SUBMITTED',
              'RESUBMITTED',
              'UNDER_REVIEW',
              'NEEDS_REVISION',
              'APPROVED',
              'FINALIZED',
            ],
          },
        })
        .sort({ updatedAt: -1 })
        .toArray();

      return queue.map((q: any) => ({
        ...q,
        id: q._id.toString(),
        selfScore: Number(q.totalSelfClpi || 0),
        reviewerScore: q.finalClpiScore != null ? Number(q.finalClpiScore) : null,
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

      const res = await db.collection(this.colEvaluations).updateOne(filter, {
        $set: {
          status: 'NEEDS_REVISION',
          revisionReason: dto.reason,
          revisionDeadline: dto.dueDate,
          draftReviewerScores: dto.draftScores || {},
          updatedAt: new Date().toISOString(),
        },
      });

      if (res.matchedCount === 0) {
        throw new NotFoundException('Không tìm thấy hồ sơ đánh giá');
      }

      return { success: true, message: 'Đã gửi yêu cầu bổ sung hồ sơ thành công' };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new InternalServerErrorException('Lỗi gửi yêu cầu bổ sung hồ sơ');
    }
  }

  async approveEvaluation(id: string, dto: ApproveEvaluationDto, req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId, fullName } = this.resolveUserInfo(req);
      const filter = this.buildIdFilter(id);

      const now = new Date();
      const res = await db.collection(this.colEvaluations).updateOne(filter, {
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
          strengths: dto.strengths || dto.comment || '',
          developmentRecommendation: dto.developmentRecommendation || '',
          status: 'FINALIZED',
          isPublished: true,
          updatedAt: now.toISOString(),
        },
      });

      if (res.matchedCount === 0) {
        throw new NotFoundException('Không tìm thấy hồ sơ đánh giá');
      }

      return { success: true, message: 'Phê duyệt kết quả CLPI thành công' };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new InternalServerErrorException('Lỗi phê duyệt kết quả CLPI');
    }
  }

  async getUnitDashboard(unitId?: string) {
    try {
      const { db } = await connectToDatabase();
      const cycle = await this.getCurrentCycle();
      const cycleId = cycle ? cycle.id || cycle._id.toString() : '';

      const userQuery: any = unitId ? { class: unitId } : {};
      const users: any[] = await db.collection(this.colUsers).find(userQuery).toArray();

      const evalQuery: any = cycleId ? { cycleId } : {};
      const evaluations: any[] = await db.collection(this.colEvaluations).find(evalQuery).toArray();
      const evalByUser = new Map<string, any>();
      evaluations.forEach((ev: any) => {
        if (ev.officerId) evalByUser.set(String(ev.officerId), ev);
      });

      const members = users.map((u: any) => {
        const uid = u._id.toString();
        const ev = evalByUser.get(uid);
        const isFinal = ev && ['APPROVED', 'FINALIZED', 'PUBLISHED'].includes(ev.status);
        const positions: string[] = Array.isArray(u.positions)
          ? u.positions
          : u.position
          ? [u.position]
          : [];

        return {
          id: uid,
          fullName: u.full_name || u.name || '',
          positionName: positions.join(', ') || 'Ủy viên BCH',
          wpiScore: isFinal ? Number(ev.wpiFinalScore ?? 0) : null,
          leiScore: isFinal ? Number(ev.leiFinalScore ?? 0) : null,
          ceiScore: isFinal ? Number(ev.ceiFinalScore ?? 0) : null,
          sdiScore: isFinal ? Number(ev.sdiFinalScore ?? 0) : null,
          clpiScore: isFinal ? Number(ev.finalClpiScore ?? 0) : null,
          classification: isFinal ? ev.finalClassification || '' : 'Chưa có kết quả',
        };
      });

      const finalizedMembers = members.filter((m) => m.clpiScore !== null);
      const averageClpi =
        finalizedMembers.length > 0
          ? Number(
              (
                finalizedMembers.reduce((acc, m) => acc + Number(m.clpiScore || 0), 0) /
                finalizedMembers.length
              ).toFixed(1)
            )
          : 0;

      const userIds = users.map((u: any) => u._id.toString());
      const unitTasks: any[] =
        userIds.length > 0
          ? await db
              .collection(this.colTasks)
              .find({
                primaryAssigneeId: { $in: userIds },
                status: { $nin: ['CANCELLED', 'cancelled'] },
              })
              .toArray()
          : [];
      const completedTasks = unitTasks.filter((t: any) =>
        ['COMPLETED', 'completed'].includes(t.status)
      );
      const completedTasksRate =
        unitTasks.length > 0 ? Math.round((completedTasks.length / unitTasks.length) * 100) : 0;

      const unitReports: any[] =
        userIds.length > 0 && cycleId
          ? await db
              .collection(this.colReports)
              .find({ officerId: { $in: userIds }, cycleId })
              .toArray()
          : [];
      const submittedReports = unitReports.filter((r: any) =>
        ['SUBMITTED', 'RESUBMITTED', 'APPROVED', 'LOCKED'].includes(r.status)
      );
      const onTimeReportRate =
        unitReports.length > 0
          ? Math.round((submittedReports.length / unitReports.length) * 100)
          : 0;

      return {
        unitId: unitId || 'all',
        unitName: unitId || 'Toàn Đoàn Khoa CNPM',
        cycleName: cycle?.name || '',
        totalMembers: members.length,
        onTimeReportRate,
        averageClpi,
        completedTasksRate,
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
      const cycleId = cycle ? cycle.id || cycle._id.toString() : '';

      const users: any[] = await db.collection(this.colUsers).find({}).toArray();
      const evalQuery: any = cycleId ? { cycleId } : {};
      const evaluations: any[] = await db.collection(this.colEvaluations).find(evalQuery).toArray();

      const submittedEvaluations = evaluations.filter((e: any) =>
        [
          'SUBMITTED',
          'RESUBMITTED',
          'UNDER_REVIEW',
          'NEEDS_REVISION',
          'APPROVED',
          'FINALIZED',
        ].includes(e.status)
      );
      const approvedEvaluations = evaluations.filter((e: any) =>
        ['APPROVED', 'FINALIZED'].includes(e.status)
      );
      const pendingReviews = evaluations.filter((e: any) =>
        ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'].includes(e.status)
      );

      const averageCLPI =
        approvedEvaluations.length > 0
          ? Number(
              (
                approvedEvaluations.reduce(
                  (s: number, e: any) => s + Number(e.finalClpiScore || 0),
                  0
                ) / approvedEvaluations.length
              ).toFixed(1)
            )
          : 0;

      const excellentCount = approvedEvaluations.filter(
        (e: any) => Number(e.finalClpiScore || 0) >= 90
      ).length;
      const excellentRate =
        approvedEvaluations.length > 0
          ? Math.round((excellentCount / approvedEvaluations.length) * 100)
          : 0;

      const unitMap = new Map<string, any[]>();
      users.forEach((u: any) => {
        const unitName = u.class || 'Chưa phân đơn vị';
        if (!unitMap.has(unitName)) unitMap.set(unitName, []);
        unitMap.get(unitName)!.push(u);
      });

      const evalByOfficer = new Map<string, any>();
      evaluations.forEach((e: any) => {
        if (e.officerId) evalByOfficer.set(String(e.officerId), e);
      });

      const unitSummaries = Array.from(unitMap.entries()).map(([unitName, members], idx) => {
        const memberEvals = members
          .map((m: any) => evalByOfficer.get(m._id.toString()))
          .filter(Boolean);
        const submitted = memberEvals.filter((e: any) =>
          [
            'SUBMITTED',
            'RESUBMITTED',
            'UNDER_REVIEW',
            'NEEDS_REVISION',
            'APPROVED',
            'FINALIZED',
          ].includes(e.status)
        ).length;
        const approved = memberEvals.filter((e: any) =>
          ['APPROVED', 'FINALIZED'].includes(e.status)
        );
        const avgCLPI =
          approved.length > 0
            ? Number(
                (
                  approved.reduce((s: number, e: any) => s + Number(e.finalClpiScore || 0), 0) /
                  approved.length
                ).toFixed(1)
              )
            : 0;

        const pendingCount = submitted - approved.length;
        return {
          id: String(idx + 1),
          name: unitName,
          total: members.length,
          submitted,
          avgCLPI,
          status:
            members.length > 0 && approved.length === members.length
              ? 'Hoàn thành'
              : pendingCount > 0
              ? `Chờ duyệt ${pendingCount}`
              : 'Đang thực hiện',
        };
      });

      return {
        cycleName: cycle?.name || '',
        stats: {
          totalOfficers: users.length,
          submittedReports: submittedEvaluations.length,
          approvedEvaluations: approvedEvaluations.length,
          pendingReviews: pendingReviews.length,
          averageCLPI,
          excellentRate,
        },
        unitSummaries,
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải Admin Dashboard CLPI');
    }
  }

  async getIndicatorsConfig() {
    try {
      const { db } = await connectToDatabase();
      const [settings, profiles] = await Promise.all([
        db.collection(this.colSettings).findOne({ type: 'weights' }),
        db
          .collection(this.colSettings)
          .find({ type: 'weight_profile' })
          .sort({ createdAt: 1 })
          .toArray(),
      ]);

      return {
        weights: settings?.weights || { WPI: 40, LEI: 25, CEI: 20, SDI: 15 },
        activeProfileId: settings?.activeProfileId || '',
        profiles: profiles.map((p: any) => ({
          id: p._id.toString(),
          title: p.title,
          weights: p.weights,
        })),
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

  async createWeightProfile(dto: CreateWeightProfileDto) {
    const total = dto.WPI + dto.LEI + dto.CEI + dto.SDI;
    if (total !== 100) {
      throw new BadRequestException(`Tổng trọng số phải bằng 100% (Hiện tại: ${total}%)`);
    }

    try {
      const { db } = await connectToDatabase();
      const doc = {
        type: 'weight_profile',
        title: dto.title.trim(),
        weights: {
          WPI: dto.WPI,
          LEI: dto.LEI,
          CEI: dto.CEI,
          SDI: dto.SDI,
        },
        createdAt: new Date().toISOString(),
      };
      const res = await db.collection(this.colSettings).insertOne(doc);
      return {
        success: true,
        id: res.insertedId.toString(),
        title: doc.title,
        weights: doc.weights,
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tạo bộ trọng số mới');
    }
  }

  async deleteWeightProfile(id: string) {
    try {
      const { db } = await connectToDatabase();
      const res = await db
        .collection(this.colSettings)
        .deleteOne({ ...this.buildIdFilter(id), type: 'weight_profile' });
      if (res.deletedCount === 0) {
        throw new NotFoundException('Không tìm thấy bộ trọng số để xóa');
      }
      return { success: true, message: 'Đã xóa bộ trọng số' };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new InternalServerErrorException('Lỗi xóa bộ trọng số');
    }
  }

  async updatePersonnel(id: string, dto: UpdatePersonnelDto) {
    try {
      const { db } = await connectToDatabase();
      const filter = this.buildIdFilter(id);

      const updateFields: any = { updatedAt: new Date() };
      if (dto.code !== undefined) updateFields.student_id = dto.code;
      if (dto.name !== undefined) updateFields.full_name = dto.name;
      if (dto.position !== undefined) {
        updateFields.position = dto.position;
        updateFields.positions = dto.position
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (dto.unit !== undefined) updateFields.class = dto.unit;
      if (dto.role !== undefined) updateFields.clpiRole = dto.role;

      const res = await db.collection(this.colUsers).updateOne(filter, { $set: updateFields });
      if (res.matchedCount === 0) {
        throw new NotFoundException('Không tìm thấy cán bộ để cập nhật');
      }

      return { success: true, message: 'Đã cập nhật thông tin và vai trò CLPI' };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new InternalServerErrorException('Lỗi cập nhật thông tin cán bộ');
    }
  }

  async getPersonnel() {
    try {
      const { db } = await connectToDatabase();
      const users: any[] = await db.collection(this.colUsers).find({}).toArray();

      return users.map((u: any) => {
        const positions: string[] = Array.isArray(u.positions)
          ? u.positions.filter(Boolean)
          : u.position || u.chuc_vu
          ? String(u.position || u.chuc_vu)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        return {
          id: u._id.toString(),
          _id: u._id.toString(),
          code: u.student_id || u.mssv || '',
          name: u.full_name || u.name || '',
          position: positions.join(', '),
          positions,
          unit: u.class || '',
          role: u.clpiRole || 'Officer',
        };
      });
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải danh sách nhân sự');
    }
  }

  async createPersonnel(dto: CreatePersonnelDto) {
    try {
      const { db } = await connectToDatabase();
      const res = await db.collection(this.colUsers).insertOne({
        student_id: dto.code,
        full_name: dto.name,
        position: dto.position,
        positions: dto.position
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        class: dto.unit,
        clpiRole: dto.role,
        createdAt: new Date(),
      });
      return { success: true, id: res.insertedId.toString() };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi thêm nhân sự');
    }
  }

  async getAnalytics() {
    try {
      const { db } = await connectToDatabase();
      const cycle = await this.getCurrentCycle();
      const cycleId = cycle ? cycle.id || cycle._id.toString() : '';

      const finalizedQuery: any = { status: { $in: ['APPROVED', 'FINALIZED'] } };
      if (cycleId) finalizedQuery.cycleId = cycleId;

      const topDocs: any[] = await db
        .collection(this.colEvaluations)
        .find(finalizedQuery)
        .sort({ finalClpiScore: -1 })
        .limit(5)
        .toArray();

      const topOfficers = topDocs.map((d: any) => ({
        name: d.fullName || '',
        unit: d.unitName || d.unitBranch || '',
        score: Number(d.finalClpiScore || 0),
      }));

      const allCycles: any[] = await db
        .collection(this.colCycles)
        .find({})
        .sort({ year: 1, createdAt: 1 })
        .toArray();

      const quarterTrends: { quarter: string; score: number }[] = [];
      for (const c of allCycles) {
        const cId = c._id.toString();
        const evals: any[] = await db
          .collection(this.colEvaluations)
          .find({ cycleId: cId, status: { $in: ['APPROVED', 'FINALIZED'] } })
          .toArray();

        const avg =
          evals.length > 0
            ? Number(
                (
                  evals.reduce((s: number, e: any) => s + Number(e.finalClpiScore || 0), 0) /
                  evals.length
                ).toFixed(1)
              )
            : 0;

        quarterTrends.push({
          quarter: `${c.quarter || ''}/${c.year || ''}`.replace(/^\/|\/$/g, '') || c.name,
          score: avg,
        });
      }

      return {
        topOfficers,
        quarterTrends,
      };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi tải thống kê thi đua');
    }
  }
}