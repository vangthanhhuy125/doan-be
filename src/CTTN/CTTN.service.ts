import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class YouthProjectsService {
  private collectionName = 'YouthProject';

  async findAll() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection(this.collectionName)
        .find({})
        .sort({ academic_year: -1 })
        .toArray();
    } catch (error) {
      throw new InternalServerErrorException('Không thể lấy danh sách công trình thanh niên');
    }
  }

  async create(data: any) {
    try {
      const { db } = await connectToDatabase();
      const payload = {
        ...data,
        createdAt: new Date(),
      };
      return await db.collection(this.collectionName).insertOne(payload);
    } catch (error) {
      throw new InternalServerErrorException('Thêm công trình thanh niên thất bại');
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

      if (result.matchedCount === 0) throw new NotFoundException('Không tìm thấy công trình');
      return result;
    } catch (error) {
      throw new InternalServerErrorException('Cập nhật công trình thất bại');
    }
  }

  async remove(id: string) {
    try {
      const { db } = await connectToDatabase();
      const result = await db.collection(this.collectionName).deleteOne({
        _id: new ObjectId(id),
      });

      if (result.deletedCount === 0) throw new NotFoundException('Không tìm thấy công trình để xóa');
      return { success: true };
    } catch (error) {
      throw new InternalServerErrorException('Xóa công trình thất bại');
    }
  }
}