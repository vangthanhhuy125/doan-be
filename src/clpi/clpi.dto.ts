import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsObject,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';

export class CreateClpiTaskDto {
  @IsNotEmpty({ message: 'Tên công việc không được để trống' })
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  cycleId?: string | null;

  @IsOptional()
  @IsString()
  cycleName?: string;

  @IsOptional()
  @IsString()
  activityId?: string | null;

  @IsOptional()
  @IsString()
  activityName?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsNotEmpty({ message: 'Mô tả công việc không được để trống' })
  @IsString()
  description!: string;

  @IsNotEmpty({ message: 'Độ ưu tiên không được để trống' })
  @IsString()
  priority!: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsNotEmpty({ message: 'Hạn hoàn thành không được để trống' })
  @IsString()
  deadline!: string;

  @IsNotEmpty({ message: 'Cán bộ chịu trách nhiệm chính không được để trống' })
  @IsString()
  primaryAssigneeId!: string;

  @IsOptional()
  @IsString()
  primaryAssigneeName?: string;

  @IsOptional()
  @IsArray()
  collaborators?: { id: string; name: string }[];

  @IsNotEmpty({ message: 'Phải chọn ít nhất 01 chỉ số CLPI' })
  @IsArray()
  indicators!: string[];

  @IsNotEmpty({ message: 'Phải nhập ít nhất 01 sản phẩm đầu ra dự kiến' })
  @IsArray()
  expectedOutputs!: string[];

  @IsOptional()
  @IsBoolean()
  requireEvidence?: boolean;

  @IsOptional()
  @IsString()
  assignedById?: string;

  @IsOptional()
  @IsString()
  assignedByName?: string;
}

export class UpdateClpiTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  cycleId?: string | null;

  @IsOptional()
  @IsString()
  cycleName?: string;

  @IsOptional()
  @IsString()
  activityId?: string | null;

  @IsOptional()
  @IsString()
  activityName?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsString()
  primaryAssigneeId?: string;

  @IsOptional()
  @IsString()
  primaryAssigneeName?: string;

  @IsOptional()
  @IsArray()
  collaborators?: { id: string; name: string }[];

  @IsOptional()
  @IsArray()
  indicators?: string[];

  @IsOptional()
  @IsArray()
  expectedOutputs?: string[];

  @IsOptional()
  @IsBoolean()
  requireEvidence?: boolean;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  progress?: number;
}

export class UpdateTaskProgressDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  progress!: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateEvidenceDto {
  @IsNotEmpty({ message: 'Task ID không được để trống' })
  @IsString()
  taskId!: string;

  @IsNotEmpty({ message: 'Tiêu đề minh chứng không được để trống' })
  @IsString()
  title!: string;

  @IsNotEmpty({ message: 'Loại minh chứng không được để trống' })
  @IsString()
  type!: 'file' | 'url';

  @IsOptional()
  @IsString()
  url?: string;
}

export class SaveMonthlyReportDraftDto {
  @IsOptional()
  @IsString()
  selfAssessment?: string;

  @IsOptional()
  @IsString()
  difficulties?: string;

  @IsOptional()
  @IsString()
  supportProposal?: string;

  @IsOptional()
  @IsString()
  lastSavedAt?: string;
}

export class SubmitMonthlyReportDto {
  @IsNotEmpty({ message: 'Tự đánh giá kết quả công tác tối thiểu 20 ký tự' })
  @IsString()
  selfAssessment!: string;

  @IsOptional()
  @IsString()
  difficulties?: string;

  @IsOptional()
  @IsString()
  supportProposal?: string;

  @IsOptional()
  @IsArray()
  tasksSnapshot?: any[];
}

export class SubmitSelfAssessmentDto {
  @IsNotEmpty({ message: 'Điểm các chỉ số không được để trống' })
  @IsObject()
  scores!: {
    WPI: number;
    LEI: number;
    CEI: number;
    SDI: number;
  };

  @IsNotEmpty({ message: 'Nội dung giải trình các chỉ số không được để trống' })
  @IsObject()
  explanations!: {
    WPI: string;
    LEI: string;
    CEI: string;
    SDI: string;
  };

  @IsNumber()
  calculatedClpi!: number;

  @IsOptional()
  @IsBoolean()
  isRevision?: boolean;
}

export class RequestRevisionDto {
  @IsNotEmpty({ message: 'Lý do yêu cầu bổ sung không được để trống' })
  @IsString()
  reason!: string;

  @IsNotEmpty({ message: 'Hạn bổ sung không được để trống' })
  @IsString()
  dueDate!: string;

  @IsOptional()
  @IsObject()
  draftScores?: Record<string, number>;
}

export class ApproveEvaluationDto {
  @IsNotEmpty({ message: 'Điểm thẩm định các chỉ số không được để trống' })
  @IsObject()
  scores!: {
    WPI: number;
    LEI: number;
    CEI: number;
    SDI: number;
  };

  @IsNumber()
  finalScore!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsNotEmpty({ message: 'Xếp loại không được để trống' })
  @IsString()
  classification!: string;

  @IsOptional()
  @IsString()
  strengths?: string;

  @IsOptional()
  @IsString()
  developmentRecommendation?: string;
}

export class CreateCycleDto {
  @IsNotEmpty({ message: 'Tên chu kỳ không được để trống' })
  @IsString()
  name!: string;

  @IsNotEmpty({ message: 'Quý đánh giá không được để trống' })
  @IsString()
  quarter!: string;

  @IsNotEmpty({ message: 'Năm đánh giá không được để trống' })
  @IsNumber()
  year!: number;

  @IsNotEmpty()
  @IsString()
  startDate!: string;

  @IsNotEmpty()
  @IsString()
  endDate!: string;

  @IsNotEmpty()
  @IsString()
  selfDeadline!: string;

  @IsNotEmpty()
  @IsString()
  reviewDeadline!: string;

  @IsOptional()
  @IsArray()
  units?: string[];

  @IsOptional()
  @IsString()
  weightProfile?: string;
}

export class UpdateWeightsDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  WPI!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  LEI!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  CEI!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  SDI!: number;
}

export class CreatePersonnelDto {
  @IsNotEmpty()
  @IsString()
  code!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsString()
  position!: string;

  @IsNotEmpty()
  @IsString()
  unit!: string;

  @IsNotEmpty()
  @IsString()
  role!: string;
}

export class UpdatePersonnelDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class CreateWeightProfileDto {
  @IsNotEmpty({ message: 'Tên bộ trọng số không được để trống' })
  @IsString()
  title!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  WPI!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  LEI!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  CEI!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  SDI!: number;
}