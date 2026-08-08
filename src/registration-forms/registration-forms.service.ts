import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class RegistrationFormsService {
  async findAll() {
    try {
      const { db } = await connectToDatabase();
      const forms = await db.collection('RegistrationForms').find().sort({ created_at: -1 }).toArray();
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
      throw new InternalServerErrorException('Lỗi lấy chi tiết phiếu đăng ký');
    }
  }

  async create(payload: any) {
    try {
      const { db } = await connectToDatabase();
      const newForm = {
        title: payload.title,
        description: payload.description || '',
        created_at: payload.created_at || new Date().toISOString(),
        created_by: payload.created_by || payload.user_id || '',
        is_locked: payload.is_locked || false,
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

  async update(id: string, payload: any) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try {
        queryId = new ObjectId(id);
      } catch {
        queryId = id;
      }

      const existingForm = await db.collection('RegistrationForms').findOne({
        $or: [{ _id: queryId }, { _id: id }]
      });

      if (!existingForm) {
        throw new NotFoundException('Không tìm thấy phiếu đăng ký để cập nhật');
      }

      const requestUserId = payload.user_id || payload.created_by || '';
      if (existingForm.created_by && requestUserId && existingForm.created_by !== requestUserId) {
        throw new ForbiddenException('Chỉ người tạo phiếu mới có quyền chỉnh sửa hoặc khóa/mở khóa phiếu này!');
      }

      const updateData: any = {
        title: payload.title,
        description: payload.description,
        programs: payload.programs || []
      };
      if (typeof payload.is_locked === 'boolean') {
        updateData.is_locked = payload.is_locked;
      }

      const result = await db.collection('RegistrationForms').findOneAndUpdate(
        { $or: [{ _id: queryId }, { _id: id }] },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      const updatedDoc = (result as any)?.value || result;

      const submissions = await db.collection('RegistrationSubmissions')
        .find({ $or: [{ form_id: id }, { form_id: updatedDoc._id.toString() }] })
        .toArray();

      return {
        ...updatedDoc,
        _id: updatedDoc._id.toString(),
        submissions: submissions.map(sub => ({
          ...sub,
          _id: sub._id.toString()
        }))
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Lỗi cập nhật phiếu đăng ký');
    }
  }

  async delete(id: string, payload?: any) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try {
        queryId = new ObjectId(id);
      } catch {
        queryId = id;
      }

      const existingForm = await db.collection('RegistrationForms').findOne({
        $or: [{ _id: queryId }, { _id: id }]
      });

      if (!existingForm) {
        throw new NotFoundException('Không tìm thấy phiếu đăng ký để xóa');
      }

      const requestUserId = payload?.user_id || payload?.created_by || '';
      if (existingForm.created_by && requestUserId && existingForm.created_by !== requestUserId) {
        throw new ForbiddenException('Chỉ người tạo phiếu mới có quyền xóa phiếu này!');
      }

      const result = await db.collection('RegistrationForms').deleteOne({
        $or: [{ _id: queryId }, { _id: id }]
      });

      if (result.deletedCount === 0) {
        throw new NotFoundException('Không tìm thấy phiếu đăng ký để xóa');
      }

      await db.collection('RegistrationSubmissions').deleteMany({
        $or: [{ form_id: id }, { form_id: queryId?.toString() }]
      });

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Lỗi xóa phiếu đăng ký');
    }
  }

  async submitRegistration(formId: string, payload: any) {
    try {
      const { db } = await connectToDatabase();

      let queryId: any;
      try {
        queryId = new ObjectId(formId);
      } catch {
        queryId = formId;
      }

      const form = await db.collection('RegistrationForms').findOne({
        $or: [{ _id: queryId }, { _id: formId }]
      });

      if (form && form.is_locked) {
        throw new BadRequestException('Phiếu đăng ký này đã bị khóa. Không thể thực hiện đăng ký hoặc chỉnh sửa!');
      }

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
          leadership_choices: payload.leadership_choices || {},
          submitted_at: payload.submitted_at || new Date().toISOString()
        }
      };
      const result = await db.collection('RegistrationSubmissions').findOneAndUpdate(
        filter,
        updateDoc,
        { upsert: true, returnDocument: 'after' }
      );

      const updatedSub = (result as any)?.value || result;

      if (!updatedSub) {
        throw new InternalServerErrorException('Không thể lưu thông tin đăng ký');
      }
      return {
        ...updatedSub,
        _id: updatedSub._id ? updatedSub._id.toString() : new Date().getTime().toString()
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException('Lỗi nộp phiếu đăng ký');
    }
  }
}