import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class PermissionsService {
  async findAll() {
    try {
      const { db } = await connectToDatabase();
      // Sắp xếp ưu tiên order tăng dần, sau đó đến ngày tạo
      const permissions = await db.collection('Permissions').find().sort({ order: 1, created_at: -1 }).toArray();

      const permissionsWithCount = await Promise.all(
        permissions.map(async (item) => {
          const membersCount = await db.collection('Accounts').countDocuments({
            $or: [
              { group_id: item._id.toString() },
              { group_id: item._id },
              { permission_id: item._id.toString() }
            ]
          });

          return {
            ...item,
            _id: item._id.toString(),
            order: item.order ?? 1,
            membersCount: membersCount || item.membersCount || 0,
            permissions: item.permissions || []
          };
        })
      );

      return permissionsWithCount;
    } catch (error) {
      throw new InternalServerErrorException('Lỗi lấy danh sách phân quyền');
    }
  }

  async findOne(id: string) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try { queryId = new ObjectId(id); } catch { queryId = id; }

      const permission = await db.collection('Permissions').findOne({
        $or: [{ _id: queryId }, { _id: id }]
      });

      if (!permission) {
        throw new NotFoundException('Không tìm thấy thông tin phân quyền');
      }

      const membersCount = await db.collection('Accounts').countDocuments({
        $or: [
          { group_id: permission._id.toString() },
          { group_id: permission._id },
          { permission_id: permission._id.toString() }
        ]
      });

      return {
        ...permission,
        _id: permission._id.toString(),
        order: permission.order ?? 1,
        membersCount: membersCount || permission.membersCount || 0,
        permissions: permission.permissions || []
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi lấy chi tiết phân quyền');
    }
  }

  async create(payload: any) {
    try {
      const { db } = await connectToDatabase();
      if (!payload.name) {
        throw new BadRequestException('Tên nhóm quyền không được để trống');
      }

      const newPermission = {
        name: payload.name,
        description: payload.description || '',
        order: Number(payload.order) || 1, // 🟢 Lưu thứ tự hiển thị
        permissions: payload.permissions || [],
        membersCount: 0,
        created_at: payload.created_at || new Date().toISOString()
      };

      const result = await db.collection('Permissions').insertOne(newPermission);
      return {
        _id: result.insertedId.toString(),
        ...newPermission
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Lỗi tạo phân quyền');
    }
  }

  async update(id: string, payload: any) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try { queryId = new ObjectId(id); } catch { queryId = id; }

      const updateData: any = {};
      if (payload.name) updateData.name = payload.name;
      if (payload.description !== undefined) updateData.description = payload.description;
      if (payload.order !== undefined) updateData.order = Number(payload.order) || 1; // 🟢 Cập nhật thứ tự
      if (Array.isArray(payload.permissions)) updateData.permissions = payload.permissions;

      const result = await db.collection('Permissions').findOneAndUpdate(
        { $or: [{ _id: queryId }, { _id: id }] },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      const updatedDoc = (result as any)?.value || result;
      if (!updatedDoc) {
        throw new NotFoundException('Không tìm thấy thông tin để cập nhật');
      }

      return {
        ...updatedDoc,
        _id: updatedDoc._id.toString()
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi cập nhật phân quyền');
    }
  }

  async delete(id: string) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try { queryId = new ObjectId(id); } catch { queryId = id; }

      const result = await db.collection('Permissions').deleteOne({
        $or: [{ _id: queryId }, { _id: id }]
      });

      if (result.deletedCount === 0) {
        throw new NotFoundException('Không tìm thấy nhóm quyền để xóa');
      }

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi xóa nhóm quyền');
    }
  }
}