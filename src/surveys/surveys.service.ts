import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { CreateSurveyDto, UpdateSurveyDto, SubmitSurveyResponseDto } from './dto/survey.dto';

@Injectable()
export class SurveysService {
  private collectionName = 'SurveyForms';

  // 🟢 1. LẤY TẤT CẢ PHIẾU KHẢO SÁT
  async findAll() {
    try {
      const { db } = await connectToDatabase();
      const surveys = await db.collection(this.collectionName).find().sort({ created_at: -1 }).toArray();

      return surveys.map(s => ({
        ...s,
        _id: s._id.toString(),
        voucherNo: s.voucherNo || `KS-2026-${String(s._id).slice(-3).toUpperCase()}`,
        sections: s.sections || [],
        questions: s.questions || [],
        responses: s.responses || []
      }));
    } catch (error) {
      throw new InternalServerErrorException('Lỗi lấy danh sách phiếu khảo sát');
    }
  }

  // 🟢 2. LẤY CHI TIẾT 1 PHIẾU KHẢO SÁT
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
        sections: survey.sections || [],
        questions: survey.questions || [],
        responses: survey.responses || []
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi lấy chi tiết phiếu khảo sát');
    }
  }

  // 🟢 3. TẠO MỚI PHIẾU KHẢO SÁT (TỰ ĐỘNG TẠO MÃ VOUCHERNO)
  async create(dto: CreateSurveyDto) {
    try {
      const { db } = await connectToDatabase();
      const year = new Date().getFullYear();

      // Đếm số lượng phiếu để sinh mã voucherNo chuẩn KS-2026-001
      const count = await db.collection(this.collectionName).countDocuments();
      const autoVoucherNo = dto.voucherNo || `KS-${year}-${String(count + 1).padStart(3, '0')}`;

      const newSurvey = {
        voucherNo: autoVoucherNo,
        title: dto.title || 'Mẫu khảo sát chưa có tiêu đề',
        description: dto.description || '',
        created_at: new Date().toISOString(),
        created_by: dto.created_by || '',
        is_locked: !!dto.is_locked,
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

  // 🟢 4. CẬP NHẬT PHIẾU KHẢO SÁT
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
        _id: updatedDoc._id.toString()
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi khi cập nhật phiếu khảo sát');
    }
  }

  // 🟢 5. XÓA PHIẾU KHẢO SÁT
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

  // 🟢 6. NỘP BÀI KHẢO SÁT (GHI ĐÈ NẾU THỰC HIỆN LẠI)
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

      // Xóa câu trả lời cũ của sinh viên này (nếu nộp lại)
      await db.collection(this.collectionName).updateOne(
        { $or: [{ _id: queryId }, { _id: surveyId }] },
        { $pull: { responses: { student_id: dto.student_id } } as any }
      );

      // Thêm câu trả lời mới
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