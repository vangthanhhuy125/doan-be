import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class AnnouncementsService {
  private collectionName = 'Announcements';

  async findAll() {
    try {
      const { db } = await connectToDatabase();
      // Sắp xếp thông báo mới nhất lên đầu dựa trên ngày đăng
      return await db.collection(this.collectionName)
        .find({})
        .sort({ posted_at: -1 })
        .toArray();
    } catch (error) {
      throw new InternalServerErrorException('Không thể lấy danh sách thông báo');
    }
  }

  async create(data: any) {
    try {
      const { db } = await connectToDatabase();
      // Đảm bảo posted_at luôn là kiểu Date ISO string
      const payload = {
        ...data,
        posted_at: data.posted_at || new Date().toISOString(),
        createdAt: new Date()
      };
      return await db.collection(this.collectionName).insertOne(payload);
    } catch (error) {
      throw new InternalServerErrorException('Thêm thông báo thất bại');
    }
  }

  async update(id: string, data: any) {
    try {
      const { db } = await connectToDatabase();
      const { _id, ...updateData } = data;
      
      const result = await db.collection(this.collectionName).updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: {
            ...updateData,
            updatedAt: new Date()
          } 
        }
      );

      if (result.matchedCount === 0) throw new NotFoundException('Không tìm thấy thông báo');
      return result;
    } catch (error) {
      throw new InternalServerErrorException('Cập nhật thông báo thất bại');
    }
  }

  async remove(id: string) {
    try {
      const { db } = await connectToDatabase();
      const result = await db.collection(this.collectionName).deleteOne({
        _id: new ObjectId(id),
      });

      if (result.deletedCount === 0) throw new NotFoundException('Không tìm thấy thông báo để xóa');
      return { success: true };
    } catch (error) {
      throw new InternalServerErrorException('Xóa thông báo thất bại');
    }
  }
}