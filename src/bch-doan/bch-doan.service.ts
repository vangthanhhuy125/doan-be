import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';

@Injectable()
export class YouthUnionService {
  private collectionName = 'YouthUnion';

  async getBCHData() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection(this.collectionName)
        .find({})
        .sort({ order: 1 })
        .toArray();
    } catch (error) {
      throw new InternalServerErrorException('Không thể lấy dữ liệu Ban chấp hành');
    }
  }

  async updateBCH(data: any[]) {
    try {
      const { db } = await connectToDatabase();

      const currentData = await db.collection(this.collectionName)
        .find({})
        .sort({ order: 1 })
        .toArray();

      const payload = data.map(item => ({
        role: item.role,
        isBanThuongVu: item.isBanThuongVu,
        full_name: item.name,
        avatar: item.avatar || null,
        order: item.order
      }));

      const isSame = JSON.stringify(currentData.map(({ _id, ...rest }) => rest)) === JSON.stringify(payload);

      if (isSame) {
        return { message: 'Dữ liệu không thay đổi' };
      }

      await db.collection(this.collectionName).deleteMany({});
      
      if (payload.length === 0) return { message: 'Đã xóa danh sách' };

      const result = await db.collection(this.collectionName).insertMany(payload);
      return result;
    } catch (error) {
      throw new InternalServerErrorException('Cập nhật nhân sự thất bại');
    }
  }
}