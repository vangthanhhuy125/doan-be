import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class AccountsService {
  private collectionName = 'Accounts';

  async login(credentials: any) {
    try {
      const { db } = await connectToDatabase();
      const cleanUsername = credentials.username?.trim().toLowerCase();

      const user = await db.collection(this.collectionName).findOne({
        username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') },
        password: credentials.password,
      });

      if (!user) return null;

      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      throw new InternalServerErrorException('Lỗi hệ thống khi đăng nhập');
    }
  }

  async findAll() {
    try {
      const { db } = await connectToDatabase();
      const accounts = await db.collection(this.collectionName).find({}).toArray();
      return accounts.map(acc => ({
        ...acc,
        _id: acc._id.toString(),
        group_id: acc.group_id || acc.groupId || acc.permission_id || ''
      }));
    } catch (error) {
      console.error('Lỗi findAll Accounts:', error);
      throw new InternalServerErrorException('Lỗi DB');
    }
  }

  async create(data: any) {
    try {
      const { db } = await connectToDatabase();
      const cleanUsername = data.username?.trim().toLowerCase();

      // 1. Kiểm tra trùng tên đăng nhập (không phân biệt chữ hoa/thường)
      if (cleanUsername) {
        const existingUsername = await db.collection(this.collectionName).findOne({
          username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') }
        });
        if (existingUsername) {
          throw new BadRequestException(`Tên đăng nhập "${data.username}" đã tồn tại trên hệ thống!`);
        }
      }

      // 2. Kiểm tra xem Nhân sự này đã được cấp tài khoản chưa
      if (data.user_id) {
        const rawUserId = String(data.user_id);
        const existingUser = await db.collection(this.collectionName).findOne({
          $or: [
            { user_id: rawUserId },
            { user_id: ObjectId.isValid(rawUserId) ? new ObjectId(rawUserId) : rawUserId }
          ]
        });

        if (existingUser) {
          throw new BadRequestException(`Nhân sự "${data.displayName || 'này'}" đã được cấp tài khoản trước đó!`);
        }
      }

      const groupId = data.group_id || data.groupId || data.permission_id || '';

      const newAccount = {
        user_id: data.user_id ? (ObjectId.isValid(data.user_id) ? new ObjectId(data.user_id) : data.user_id) : null,
        displayName: data.displayName,
        username: cleanUsername, // Lưu dạng chữ thường chuẩn hóa
        password: data.password || '123456',
        group_id: groupId,          
        permission_id: groupId,     
        createdAt: new Date()
      };

      const result = await db.collection(this.collectionName).insertOne(newAccount);
      return { ...newAccount, _id: result.insertedId.toString() };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      console.error('Lỗi create Account:', error);
      throw new InternalServerErrorException('Lỗi tạo tài khoản');
    }
  }

  async update(id: string, data: any) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try { queryId = new ObjectId(id); } catch { queryId = id; }

      const cleanUsername = data.username?.trim().toLowerCase();

      // Kiểm tra trùng username với các tài khoản khác ngoại trừ chính nó
      if (cleanUsername) {
        const existingUsername = await db.collection(this.collectionName).findOne({
          _id: { $ne: queryId },
          username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') }
        });
        if (existingUsername) {
          throw new BadRequestException(`Tên đăng nhập "${data.username}" đã thuộc về tài khoản khác!`);
        }
      }

      const { _id, ...updateData } = data;
      
      if (updateData.user_id) {
        updateData.user_id = ObjectId.isValid(updateData.user_id) ? new ObjectId(updateData.user_id) : updateData.user_id;
      }

      if (cleanUsername) {
        updateData.username = cleanUsername;
      }

      const groupId = data.group_id || data.groupId || data.permission_id || '';
      if (groupId) {
        updateData.group_id = groupId;
        updateData.permission_id = groupId;
      }

      await db.collection(this.collectionName).updateOne(
        { $or: [{ _id: queryId }, { _id: id }] },
        { $set: updateData }
      );
      return { message: 'OK' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      console.error('Lỗi update Account:', error);
      throw new InternalServerErrorException('Lỗi cập nhật');
    }
  }

  async remove(id: string) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try { queryId = new ObjectId(id); } catch { queryId = id; }

      await db.collection(this.collectionName).deleteOne({
        $or: [{ _id: queryId }, { _id: id }]
      });
      return { message: 'OK' };
    } catch (error) {
      console.error('Lỗi remove Account:', error);
      throw new InternalServerErrorException('Lỗi xóa');
    }
  }
}