import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class UsersService {
  async getProfile(userId: string) {
    try {
      const { db } = await connectToDatabase();
      
      const users = await db.collection('Users').aggregate([
        {
          $match: {
            $or: [
              { _id: new ObjectId(userId) },
              { student_id: userId }
            ]
          }
        }
      ]).toArray();

      if (users && users.length > 0) {
        return users[0];
      }

      const accountData = await db.collection('Accounts').aggregate([
        {
          $match: { _id: new ObjectId(userId) }
        },
        {
          $addFields: {
            user_id_obj: {
              $convert: {
                input: "$user_id",
                to: "objectId",
                onError: null,
                onNull: null
              }
            }
          }
        },
        {
          $lookup: {
            from: 'Users',
            localField: 'user_id_obj',
            foreignField: '_id',
            as: 'user_info'
          }
        },
        {
          $unwind: {
            path: '$user_info',
            preserveNullAndEmptyArrays: true
          }
        }
      ]).toArray();

      if (!accountData || accountData.length === 0) {
        throw new NotFoundException('Không tìm thấy thông tin người dùng');
      }

      const acc = accountData[0];
      return {
        _id: acc.user_info?._id || acc._id,
        user_id: acc.user_id,
        username: acc.username,
        full_name: acc.user_info?.full_name || acc.username,
        student_id: acc.user_info?.student_id || acc.username,
        class: acc.user_info?.class || 'Chưa cập nhật',
        email: acc.user_info?.email || '',
        personal_email: acc.user_info?.personal_email || '',
        phone: acc.user_info?.phone || '',
        birthday: acc.user_info?.birthday || '',
        image_url: acc.user_info?.image_url || '',
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi hệ thống khi lấy thông tin cá nhân');
    }
  }

  async updateProfile(userId: string, updateData: { 
    full_name?: string; 
    student_id?: string;
    email?: string; 
    personal_email?: string;
    class?: string; 
    phone?: string; 
    birthday?: string; 
    image_url?: string;
  }) {
    try {
      const { db } = await connectToDatabase();
      const payload: Record<string, any> = {};

      if (updateData.full_name !== undefined) payload.full_name = updateData.full_name;
      if (updateData.student_id !== undefined) payload.student_id = updateData.student_id;
      if (updateData.email !== undefined) payload.email = updateData.email;
      if (updateData.personal_email !== undefined) payload.personal_email = updateData.personal_email;
      if (updateData.class !== undefined) payload.class = updateData.class;
      if (updateData.phone !== undefined) payload.phone = updateData.phone;
      if (updateData.birthday !== undefined) payload.birthday = updateData.birthday;
      if (updateData.image_url !== undefined) payload.image_url = updateData.image_url;

      let targetUserId = userId;
      try {
        const acc = await db.collection('Accounts').findOne({ _id: new ObjectId(userId) });
        if (acc && acc.user_id) {
          targetUserId = acc.user_id;
        }
      } catch (e) {
        // userId đã là _id của Users
      }

      await db.collection('Users').updateOne(
        { _id: new ObjectId(targetUserId) },
        { $set: payload }
      );

      return { message: 'Cập nhật thông tin thành công' };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi hệ thống khi cập nhật thông tin');
    }
  }
}