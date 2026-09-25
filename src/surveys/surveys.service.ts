import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { CreateSurveyDto, UpdateSurveyDto, SubmitSurveyResponseDto } from './dto/survey.dto';

@Injectable()
export class SurveysService {
  private collectionName = 'SurveyForms';

  async findAll() {
    try {
      const { db } = await connectToDatabase();
      const surveys = await db.collection(this.collectionName).find().sort({ created_at: -1 }).toArray();

      return surveys.map(s => ({
        ...s,
        _id: s._id.toString(),
        voucherNo: s.voucherNo || `KS-2026-${String(s._id).slice(-3).toUpperCase()}`,
        target_intakes: Array.isArray(s.target_intakes) ? s.target_intakes : [],
        target_users: Array.isArray(s.target_users) ? s.target_users : [],
        sections: s.sections || [],
        questions: s.questions || [],
        responses: s.responses || []
      }));
    } catch (error) {
      throw new InternalServerErrorException('Lỗi lấy danh sách phiếu khảo sát');
    }
  }

  async findOne(id: string) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try { queryId = new ObjectId(id); } catch { queryId = id; }

      const survey = await db.collection(this.collectionName).findOne({
        $or: [{ _id: queryId }, { _id: id }, { voucherNo: id }]
      });

      if (!survey) {
        throw new NotFoundException('Không tìm thấy phiếu khảo sát');
      }

      return {
        ...survey,
        _id: survey._id.toString(),
        target_intakes: Array.isArray(survey.target_intakes) ? survey.target_intakes : [],
        target_users: Array.isArray(survey.target_users) ? survey.target_users : [],
        sections: survey.sections || [],
        questions: survey.questions || [],
        responses: survey.responses || []
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi lấy chi tiết phiếu khảo sát');
    }
  }

  async create(dto: CreateSurveyDto) {
    try {
      const { db } = await connectToDatabase();
      const year = new Date().getFullYear();

      const count = await db.collection(this.collectionName).countDocuments();
      const autoVoucherNo = dto.voucherNo || `KS-${year}-${String(count + 1).padStart(3, '0')}`;

      const newSurvey = {
        voucherNo: autoVoucherNo,
        title: dto.title || 'Mẫu khảo sát chưa có tiêu đề',
        description: dto.description || '',
        created_at: new Date().toISOString(),
        created_by: dto.created_by || '',
        is_locked: !!dto.is_locked,
        target_intakes: Array.isArray(dto.target_intakes) ? dto.target_intakes : [],
        target_users: Array.isArray(dto.target_users) ? dto.target_users : [],
        sections: dto.sections || [
          { id: 'sec_default', title: 'Mục chưa có tiêu đề', description: '' }
        ],
        questions: dto.questions || [],
        responses: []
      };

      const result = await db.collection(this.collectionName).insertOne(newSurvey);

      return {
        _id: result.insertedId.toString(),
        ...newSurvey
      };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi tạo phiếu khảo sát');
    }
  }

  async update(id: string, dto: UpdateSurveyDto) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try { queryId = new ObjectId(id); } catch { queryId = id; }

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.is_locked !== undefined) updateData.is_locked = dto.is_locked;
      if (dto.target_intakes !== undefined) {
        updateData.target_intakes = Array.isArray(dto.target_intakes) ? dto.target_intakes : [];
      }
      if (dto.target_users !== undefined) {
        updateData.target_users = Array.isArray(dto.target_users) ? dto.target_users : [];
      }
      if (dto.sections !== undefined) updateData.sections = dto.sections;
      if (dto.questions !== undefined) updateData.questions = dto.questions;

      const result = await db.collection(this.collectionName).findOneAndUpdate(
        { $or: [{ _id: queryId }, { _id: id }] },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      const updatedDoc = (result as any)?.value || result;

      if (!updatedDoc) {
        throw new NotFoundException('Không tìm thấy phiếu khảo sát để cập nhật');
      }

      return {
        ...updatedDoc,
        _id: updatedDoc._id.toString(),
        target_intakes: Array.isArray(updatedDoc.target_intakes) ? updatedDoc.target_intakes : [],
        target_users: Array.isArray(updatedDoc.target_users) ? updatedDoc.target_users : [],
        sections: updatedDoc.sections || [],
        questions: updatedDoc.questions || [],
        responses: updatedDoc.responses || []
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi khi cập nhật phiếu khảo sát');
    }
  }

  async delete(id: string) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try { queryId = new ObjectId(id); } catch { queryId = id; }

      const result = await db.collection(this.collectionName).deleteOne({
        $or: [{ _id: queryId }, { _id: id }]
      });

      if (result.deletedCount === 0) {
        throw new NotFoundException('Không tìm thấy phiếu khảo sát để xóa');
      }

      return { success: true, message: 'Xóa phiếu khảo sát thành công' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi khi xóa phiếu khảo sát');
    }
  }

  async submitResponse(surveyId: string, dto: SubmitSurveyResponseDto) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try { queryId = new ObjectId(surveyId); } catch { queryId = surveyId; }

      const survey = await db.collection(this.collectionName).findOne({
        $or: [{ _id: queryId }, { _id: surveyId }]
      });

      if (!survey) {
        throw new NotFoundException('Không tìm thấy phiếu khảo sát');
      }

      if (survey.is_locked) {
        throw new BadRequestException('Phiếu khảo sát này hiện đã bị khóa nhận câu trả lời!');
      }

      const responseObj = {
        student_id: dto.student_id,
        full_name: dto.full_name || '',
        answers: dto.answers || [],
        submitted_at: new Date().toISOString()
      };

      await db.collection(this.collectionName).updateOne(
        { $or: [{ _id: queryId }, { _id: surveyId }] },
        { $pull: { responses: { student_id: dto.student_id } } as any }
      );

      await db.collection(this.collectionName).updateOne(
        { $or: [{ _id: queryId }, { _id: surveyId }] },
        { $push: { responses: responseObj } as any }
      );

      return { success: true, message: 'Nộp phiếu khảo sát thành công' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Lỗi hệ thống khi nộp phiếu khảo sát');
    }
  }
}