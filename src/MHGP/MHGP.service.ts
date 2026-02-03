import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class SolutionModelsService {
  private collectionName = 'SolutionModels';

  async findAll() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection(this.collectionName)
        .find({})
        .sort({ academic_year: -1 })
        .toArray();
    } catch (error) {
      throw new InternalServerErrorException('Không thể lấy danh sách mô hình giải pháp');
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
      throw new InternalServerErrorException('Thêm mô hình giải pháp thất bại');
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

      if (result.matchedCount === 0) throw new NotFoundException('Không tìm thấy mô hình');
      return result;
    } catch (error) {
      throw new InternalServerErrorException('Cập nhật mô hình thất bại');
    }
  }

  async remove(id: string) {
    try {
      const { db } = await connectToDatabase();
      const result = await db.collection(this.collectionName).deleteOne({
        _id: new ObjectId(id),
      });

      if (result.deletedCount === 0) throw new NotFoundException('Không tìm thấy mô hình để xóa');
      return { success: true };
    } catch (error) {
      throw new InternalServerErrorException('Xóa mô hình thất bại');
    }
  }
}