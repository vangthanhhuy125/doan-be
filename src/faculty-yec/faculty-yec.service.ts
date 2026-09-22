import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';

@Injectable()
export class YouthUnionService {
  private unionCollection = 'YouthUnion'; // Dữ liệu BCH Đoàn Khoa
  private lchCollection = 'FacultyLCH';    // Dữ liệu BCH Liên Chi hội Khoa

  // ==================== 1. ĐOÀN KHOA ====================
  async getBCHData() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection(this.unionCollection).aggregate([
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
        },
        {
          $project: {
            _id: 1,
            role: 1,
            isBanThuongVu: 1,
            order: 1,
            user_id: 1,
            full_name: { $ifNull: ['$user_info.full_name', '$full_name'] },
            avatar: { $ifNull: ['$user_info.image_url', '$avatar'] }
          }
        },
        { $sort: { order: 1 } }
      ]).toArray();
    } catch (error) {
      throw new InternalServerErrorException('Không thể lấy dữ liệu Ban Chấp hành Đoàn khoa');
    }
  }

  async updateBCH(data: any[]) {
    try {
      const { db } = await connectToDatabase();
      const currentData = await db.collection(this.unionCollection).find({}).toArray();

      const payload = data.map(item => ({
        user_id: item.user_id || null,
        role: item.role,
        isBanThuongVu: item.isBanThuongVu ?? false,
        full_name: item.name || item.full_name || '',
        avatar: item.avatar || null,
        order: item.order
      }));

      const isSame = JSON.stringify(currentData.map(({ _id, ...rest }) => rest)) === JSON.stringify(payload);
      if (isSame) return { message: 'Dữ liệu không thay đổi' };

      await db.collection(this.unionCollection).deleteMany({});
      if (payload.length === 0) return { message: 'Đã xóa danh sách' };

      return await db.collection(this.unionCollection).insertMany(payload);
    } catch (error) {
      throw new InternalServerErrorException('Cập nhật nhân sự Đoàn khoa thất bại');
    }
  }

  // ==================== 2. LIÊN CHI HỘI KHOA ====================
  async getLCHData() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection(this.lchCollection).aggregate([
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
        },
        {
          $project: {
            _id: 1,
            role: 1,
            isThuongTruc: 1,
            order: 1,
            user_id: 1,
            full_name: { $ifNull: ['$user_info.full_name', '$full_name'] },
            avatar: { $ifNull: ['$user_info.image_url', '$avatar'] }
          }
        },
        { $sort: { order: 1 } }
      ]).toArray();
    } catch (error) {
      throw new InternalServerErrorException('Không thể lấy dữ liệu BCH Liên Chi hội');
    }
  }

  async updateLCH(data: any[]) {
    try {
      const { db } = await connectToDatabase();
      const currentData = await db.collection(this.lchCollection).find({}).toArray();

      const payload = data.map(item => ({
        user_id: item.user_id || null,
        role: item.role,
        isThuongTruc: item.isThuongTruc ?? false, // 1 Trưởng + 2 Phó là Thường trực
        full_name: item.name || item.full_name || '',
        avatar: item.avatar || null,
        order: item.order
      }));

      const isSame = JSON.stringify(currentData.map(({ _id, ...rest }) => rest)) === JSON.stringify(payload);
      if (isSame) return { message: 'Dữ liệu không thay đổi' };

      await db.collection(this.lchCollection).deleteMany({});
      if (payload.length === 0) return { message: 'Đã xóa danh sách' };

      return await db.collection(this.lchCollection).insertMany(payload);
    } catch (error) {
      throw new InternalServerErrorException('Cập nhật nhân sự Liên Chi hội thất bại');
    }
  }
}