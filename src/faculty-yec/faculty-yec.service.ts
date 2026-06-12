import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class YouthUnionService {
  private collectionName = 'YouthUnion';

  async getBCHData() {
    try {
      const { db } = await connectToDatabase();
      
      return await db.collection(this.collectionName).aggregate([
        {
          // Chuyển string user_id sang ObjectId để so khớp
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
          // QUAN TRỌNG: from phải là 'Users' (khớp với hình bạn chụp)
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
            // Nếu có dữ liệu trong bảng Users thì lấy, không thì dùng dữ liệu cũ trong YouthUnion
            full_name: { $ifNull: ['$user_info.full_name', '$full_name'] },
            avatar: { $ifNull: ['$user_info.image_url', '$avatar'] }
          }
        },
        { $sort: { order: 1 } }
      ]).toArray();
    } catch (error) {
      throw new InternalServerErrorException('Không thể lấy dữ liệu Ban chấp hành');
    }
  }

  async updateBCH(data: any[]) {
    try {
      const { db } = await connectToDatabase();
      const currentData = await db.collection(this.collectionName).find({}).toArray();

      const payload = data.map(item => ({
        user_id: item.user_id || null,
        role: item.role,
        isBanThuongVu: item.isBanThuongVu,
        full_name: item.name,
        avatar: item.avatar || null,
        order: item.order
      }));

      const isSame = JSON.stringify(currentData.map(({ _id, ...rest }) => rest)) === JSON.stringify(payload);
      if (isSame) return { message: 'Dữ liệu không thay đổi' };

      await db.collection(this.collectionName).deleteMany({});
      if (payload.length === 0) return { message: 'Đã xóa danh sách' };

      const result = await db.collection(this.collectionName).insertMany(payload);
      return result;
    } catch (error) {
      throw new InternalServerErrorException('Cập nhật nhân sự thất bại');
    }
  }
}