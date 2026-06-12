import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class ProgramsService {
  private collectionName = 'Programs';

  async findAll() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection(this.collectionName)
        .find({})
        .sort({ year: -1, month: -1 })
        .toArray();
    } catch (error) {
      throw new InternalServerErrorException('Không thể lấy danh sách chương trình');
    }
  }

  async create(data: any) {
    try {
      const { db } = await connectToDatabase();
      const result = await db.collection(this.collectionName).insertOne({
        ...data,
        createdAt: new Date(),
      });
      return result;
    } catch (error) {
      throw new InternalServerErrorException('Thêm chương trình thất bại');
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

      if (result.matchedCount === 0) throw new NotFoundException('Không tìm thấy chương trình');
      return result;
    } catch (error) {
      throw new InternalServerErrorException('Cập nhật chương trình thất bại');
    }
  }

  async remove(id: string) {
    try {
      const { db } = await connectToDatabase();
      const result = await db.collection(this.collectionName).deleteOne({
        _id: new ObjectId(id),
      });

      if (result.deletedCount === 0) throw new NotFoundException('Không tìm thấy chương trình để xóa');
      return { success: true };
    } catch (error) {
      throw new InternalServerErrorException('Xóa chương trình thất bại');
    }
  }
}