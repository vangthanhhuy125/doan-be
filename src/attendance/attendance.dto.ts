import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export class CheckInRecordDto {
  @IsNotEmpty({ message: 'MSSV không được để trống' })
  @IsString()
  student_id!: string;

  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  class_name?: string;

  @IsOptional()
  @IsString()
  status?: AttendanceStatus;

  @IsOptional()
  @IsString()
  checkin_time?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class SharedUserDto {
  @IsNotEmpty()
  @IsString()
  user_id!: string;

  @IsOptional()
  @IsString()
  user_name?: string;

  @IsOptional()
  @IsString()
  username?: string;
}

export class CreateAttendanceDto {
  @IsNotEmpty({ message: 'Tiêu đề buổi điểm danh không được để trống' })
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  start_time?: string;

  @IsOptional()
  @IsString()
  end_time?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  target_intakes?: string[];

  @IsOptional()
  @IsBoolean()
  is_locked?: boolean;

  @IsOptional()
  @IsString()
  created_by?: string;

  @IsOptional()
  @IsArray()
  shared_users?: SharedUserDto[];
}

export class UpdateAttendanceDto extends CreateAttendanceDto {
  @IsOptional()
  @IsArray()
  records?: CheckInRecordDto[];
}