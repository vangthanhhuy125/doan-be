import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class RegistrationFormsService {
  
  // 1. Lấy danh sách tất cả phiếu đăng ký (kèm số lượng submissions)
  async findAll() {
    try {
      const { db } = await connectToDatabase();
      const forms = await db.collection('RegistrationForms').find().sort({ created_at: -1 }).toArray();

      // Lấy danh sách submissions để đếm tổng số lượt đăng ký cho từng phiếu
      const formsWithStats = await Promise.all(
        forms.map(async (form) => {
          const submissions = await db.collection('RegistrationSubmissions')
            .find({ form_id: form._id.toString() })
            .toArray();

          return {
            ...form,
            _id: form._id.toString(),
            submissions: submissions.map(sub => ({
              ...sub,
              _id: sub._id.toString()
            }))
          };
        })
      );

      return formsWithStats;
    } catch (error) {
      throw new InternalServerErrorException('Lỗi lấy danh sách phiếu đăng ký');
    }
  }

  // 2. Lấy chi tiết 1 phiếu đăng ký theo ID
  async findOne(id: string) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try {
        queryId = new ObjectId(id);
      } catch {
        queryId = id;
      }

      const form = await db.collection('RegistrationForms').findOne({
        $or: [{ _id: queryId }, { _id: id }]
      });

      if (!form) {
        throw new NotFoundException('Không tìm thấy phiếu đăng ký');
      }

      const submissions = await db.collection('RegistrationSubmissions')
        .find({ $or: [{ form_id: id }, { form_id: form._id.toString() }] })
        .toArray();

      return {
        ...form,
        _id: form._id.toString(),
        submissions: submissions.map(sub => ({
          ...sub,
          _id: sub._id.toString()
        }))
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi chi tiết phiếu đăng ký');
    }
  }

  // 3. Tạo phiếu đăng ký mới
  async create(payload: any) {
    try {
      const { db } = await connectToDatabase();

      const newForm = {
        title: payload.title,
        description: payload.description || '',
        created_at: payload.created_at || new Date().toISOString(),
        programs: payload.programs || []
      };

      const result = await db.collection('RegistrationForms').insertOne(newForm);

      return {
        _id: result.insertedId.toString(),
        ...newForm,
        submissions: []
      };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi tạo phiếu đăng ký');
    }
  }

  // 4. Cập nhật thông tin phiếu đăng ký
  async update(id: string, payload: any) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try {
        queryId = new ObjectId(id);
      } catch {
        queryId = id;
      }

      const updateData = {
        title: payload.title,
        description: payload.description,
        programs: payload.programs
      };

      const result = await db.collection('RegistrationForms').findOneAndUpdate(
        { $or: [{ _id: queryId }, { _id: id }] },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new NotFoundException('Không tìm thấy phiếu để cập nhật');
      }

      return {
        ...result,
        _id: result._id.toString()
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi cập nhật phiếu đăng ký');
    }
  }

  // 5. Xóa phiếu đăng ký (và xóa toàn bộ lượt đăng ký liên quan)
  async delete(id: string) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try {
        queryId = new ObjectId(id);
      } catch {
        queryId = id;
      }

      const result = await db.collection('RegistrationForms').deleteOne({
        $or: [{ _id: queryId }, { _id: id }]
      });

      if (result.deletedCount === 0) {
        throw new NotFoundException('Không tìm thấy phiếu đăng ký để xóa');
      }

      // Xóa kèm toàn bộ lượt đăng ký thuộc phiếu này
      await db.collection('RegistrationSubmissions').deleteMany({
        $or: [{ form_id: id }, { form_id: queryId?.toString() }]
      });

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi xóa phiếu đăng ký');
    }
  }

  // 6. Sinh viên nộp phiếu đăng ký
  // 6. Sinh viên nộp / cập nhật phiếu đăng ký (Ghi đè nếu đã tồn tại)
  async submitRegistration(formId: string, payload: any) {
    try {
      const { db } = await connectToDatabase();

      const filter = {
        form_id: formId,
        student_id: payload.student_id
      };

      const updateDoc = {
        $set: {
          form_id: formId,
          student_id: payload.student_id,
          full_name: payload.full_name,
          class_name: payload.class_name,
          choices: payload.choices || {},
          submitted_at: payload.submitted_at || new Date().toISOString()
        }
      };

      const result = await db.collection('RegistrationSubmissions').findOneAndUpdate(
        filter,
        updateDoc,
        { upsert: true, returnDocument: 'after' }
      );

      if (!result) {
        throw new InternalServerErrorException('Không thể lưu thông tin đăng ký');
      }

      return {
        ...result,
        _id: result._id.toString()
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException('Lỗi nộp phiếu đăng ký');
    }
  }
}