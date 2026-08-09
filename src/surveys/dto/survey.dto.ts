export class QuestionOptionDto {
  id!: string;
  text!: string;
}

export class QuestionDto {
  id!: string;
  text!: string;
  type!: 'short_text' | 'paragraph' | 'multiple_choice' | 'checkboxes' | 'dropdown';
  required!: boolean;
  options?: QuestionOptionDto[];
  image_url?: string;
  section_id?: string;
}

export class SectionDto {
  id!: string;
  title!: string;
  description?: string;
}

export class CreateSurveyDto {
  voucherNo?: string;
  title!: string;
  description?: string;
  created_by?: string;
  is_locked?: boolean;
  sections?: SectionDto[];
  questions!: QuestionDto[];
}

export class UpdateSurveyDto {
  voucherNo?: string;
  title?: string;
  description?: string;
  is_locked?: boolean;
  sections?: SectionDto[];
  questions?: QuestionDto[];
}

export class SubmitSurveyResponseDto {
  student_id!: string;
  full_name?: string;
  answers!: {
    question_id: string;
    value: string | string[];
  }[];
}