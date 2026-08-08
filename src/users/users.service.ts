import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  async getProfile(userId: string) {
    try {
      const { db } = await connectToDatabase();
      
      const isObjectId = ObjectId.isValid(userId);
      const queryId = isObjectId ? new ObjectId(userId) : null;

      const userMatchConditions: any[] = [
        { student_id: userId },
        { user_id: userId },
        { username: userId }
      ];
      if (queryId) {
        userMatchConditions.push({ _id: queryId });
      }

      const users = await db.collection('Users').find({
        $or: userMatchConditions
      }).toArray();

      if (users && users.length > 0) {
        return users[0];
      }

      const accountMatchConditions: any[] = [
        { user_id: userId },
        { username: userId }
      ];
      if (queryId) {
        accountMatchConditions.push({ _id: queryId });
      }

      const accountData = await db.collection('Accounts').aggregate([
        {
          $match: {
            $or: accountMatchConditions
          }
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

      const isObjectId = ObjectId.isValid(userId);
      let targetUserId: any = isObjectId ? new ObjectId(userId) : userId;

      if (isObjectId) {
        const acc = await db.collection('Accounts').findOne({ _id: new ObjectId(userId) });
        if (acc && acc.user_id) {
          targetUserId = ObjectId.isValid(acc.user_id) ? new ObjectId(acc.user_id) : acc.user_id;
        }
      }

      await db.collection('Users').updateOne(
        { $or: [{ _id: targetUserId }, { student_id: userId }] },
        { $set: payload },
        { upsert: true }
      );

      return { message: 'Cập nhật thông tin thành công' };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi hệ thống khi cập nhật thông tin');
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const { oldPassword, newPassword, confirmPassword } = dto;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không trùng khớp');
    }

    if (oldPassword === newPassword) {
      throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu cũ');
    }

    try {
      const { db } = await connectToDatabase();
      let account: any = null;

      if (ObjectId.isValid(userId)) {
        try {
          account = await db.collection('Accounts').findOne({ _id: new ObjectId(userId) });
        } catch (e) {}
      }

      if (!account) {
        account = await db.collection('Accounts').findOne({
          $or: [{ user_id: userId }, { username: userId }]
        });
      }

      if (!account) {
        throw new NotFoundException('Không tìm thấy tài khoản');
      }

      const dbPassword = account.password || '';
      let isMatch = false;

      // Kiểm tra xem mật khẩu DB là hash bcrypt hay text thô
      if (dbPassword.startsWith('$2b$') || dbPassword.startsWith('$2a$')) {
        isMatch = await bcrypt.compare(oldPassword, dbPassword);
      } else {
        // Trường hợp DB lưu text thô (123456)
        isMatch = dbPassword === oldPassword;
      }

      if (!isMatch) {
        throw new BadRequestException('Mật khẩu cũ không chính xác');
      }

      // Hash mật khẩu mới bằng bcrypt
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db.collection('Accounts').updateOne(
        { _id: account._id },
        { $set: { password: hashedPassword, updatedAt: new Date().toISOString() } }
      );

      return { message: 'Đổi mật khẩu thành công' };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Lỗi khi đổi mật khẩu');
    }
  }
}