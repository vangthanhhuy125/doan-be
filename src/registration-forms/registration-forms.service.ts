import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class RegistrationFormsService {
  private async resolveUserPermissions(db: any, existingForm: any, payload: any) {
    const rawIds = [
      payload?.user_id,
      payload?.account_id,
      payload?.profile_user_id,
      payload?.created_by,
      payload?.username,
      payload?.student_id,
      payload?._id
    ].filter(Boolean).map(x => String(x).trim());

    let isAdmin = 
      payload?.is_admin === true || 
      payload?.role === 'admin' || 
      payload?.username === 'admin' ||
      rawIds.map(x => x.toLowerCase()).includes('admin');

    if (rawIds.length > 0) {
      const objectIds = rawIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
      const userDoc = await db.collection('Accounts').findOne({
        $or: [
          { _id: { $in: objectIds } },
          { username: { $in: rawIds } },
          { user_id: { $in: rawIds } },
          { student_id: { $in: rawIds } }
        ]
      });

      if (userDoc) {
        if (userDoc.role === 'admin' || userDoc.username === 'admin') {
          isAdmin = true;
        }
        rawIds.push(
          String(userDoc._id),
          String(userDoc.username || ''),
          String(userDoc.user_id || ''),
          String(userDoc.student_id || '')
        );
      }
    }

    const creatorIds: string[] = [];
    if (existingForm?.created_by) {
      if (typeof existingForm.created_by === 'object') {
        creatorIds.push(
          String(existingForm.created_by._id || ''),
          String(existingForm.created_by.user_id || ''),
          String(existingForm.created_by.username || ''),
          String(existingForm.created_by.student_id || '')
        );
      } else {
        const cId = String(existingForm.created_by).trim();
        creatorIds.push(cId);
        if (ObjectId.isValid(cId)) {
          const creatorDoc = await db.collection('Accounts').findOne({ _id: new ObjectId(cId) });
          if (creatorDoc) {
            creatorIds.push(
              String(creatorDoc._id),
              String(creatorDoc.username || ''),
              String(creatorDoc.user_id || ''),
              String(creatorDoc.student_id || '')
            );
          }
        }
      }
    }

    const cleanReqIds = Array.from(new Set(rawIds.filter(Boolean).map(s => s.toLowerCase())));
    const cleanCreatorIds = Array.from(new Set(creatorIds.filter(Boolean).map(s => s.toLowerCase())));

    const isCreator = 
      isAdmin || 
      cleanCreatorIds.length === 0 || 
      cleanReqIds.some(id => cleanCreatorIds.includes(id));

    const sharedList = existingForm?.shared_permissions || [];
    const userPerm = sharedList.find((p: any) => {
      const pIds = [String(p.user_id || ''), String(p.username || '')].filter(Boolean).map(s => s.toLowerCase());
      return cleanReqIds.some(id => pIds.includes(id));
    });

    return { isAdmin, isCreator, userPerm };
  }

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
            programs: (form.programs || []).map((p: any) => ({
              ...p,
              target_intakes: Array.isArray(p.target_intakes) ? p.target_intakes : [],
            })),
            shared_permissions: form.shared_permissions || [],
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
        programs: (form.programs || []).map((p: any) => ({
          ...p,
          target_intakes: Array.isArray(p.target_intakes) ? p.target_intakes : [],
        })),
        shared_permissions: form.shared_permissions || [],
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
      const formattedPrograms = (payload.programs || []).map((p: any) => ({
        ...p,
        target_intakes: Array.isArray(p.target_intakes) ? p.target_intakes : [],
      }));

      const newForm = {
        title: payload.title || '',
        description: payload.description || '',
        created_at: payload.created_at || new Date().toISOString(),
        created_by: payload.created_by || payload.user_id || '',
        is_locked: payload.is_locked || false,
        programs: formattedPrograms,
        shared_permissions: payload.shared_permissions || []
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

      const { isCreator, userPerm } = await this.resolveUserPermissions(db, existingForm, payload);

      const isUpdatingPermissions = 
        payload.shared_permissions !== undefined && 
        JSON.stringify(payload.shared_permissions) !== JSON.stringify(existingForm.shared_permissions || []);

      if (isUpdatingPermissions && !isCreator) {
        throw new ForbiddenException('Chỉ người tạo phiếu mới có quyền quản lý chia sẻ!');
      }

      if (typeof payload.is_locked === 'boolean' && payload.is_locked !== existingForm.is_locked) {
        if (!isCreator && !userPerm?.can_lock) {
          throw new ForbiddenException('Bạn không có quyền khóa/mở khóa phiếu này!');
        }
      }

      const isEditingContent = 
        (payload.title !== undefined && payload.title !== existingForm.title) || 
        (payload.description !== undefined && payload.description !== existingForm.description) || 
        (payload.programs !== undefined && JSON.stringify(payload.programs) !== JSON.stringify(existingForm.programs || []));

      if (isEditingContent && !isCreator && !userPerm?.can_edit) {
        throw new ForbiddenException('Bạn không có quyền chỉnh sửa nội dung phiếu này!');
      }

      const updateData: any = {};
      if (payload.title !== undefined) updateData.title = payload.title;
      if (payload.description !== undefined) updateData.description = payload.description;
      if (payload.programs !== undefined) {
        updateData.programs = (payload.programs || []).map((p: any) => ({
          ...p,
          target_intakes: Array.isArray(p.target_intakes) ? p.target_intakes : [],
        }));
      }
      if (typeof payload.is_locked === 'boolean') updateData.is_locked = payload.is_locked;
      if (payload.shared_permissions !== undefined) updateData.shared_permissions = payload.shared_permissions;

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
        programs: (updatedDoc.programs || []).map((p: any) => ({
          ...p,
          target_intakes: Array.isArray(p.target_intakes) ? p.target_intakes : [],
        })),
        shared_permissions: updatedDoc.shared_permissions || [],
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

      const { isCreator, userPerm } = await this.resolveUserPermissions(db, existingForm, payload);

      if (!isCreator && !userPerm?.can_delete) {
        throw new ForbiddenException('Bạn không có quyền xóa phiếu này!');
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
        throw new BadRequestException('Phiếu đăng ký đã bị khóa. Không thể thực hiện đăng ký hoặc chỉnh sửa!');
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