import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class DocumentsService {
  private collectionName = 'Documents';

  async findAll() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection(this.collectionName)
        .find({})
        .sort({ academic_year: -1, semester: -1 })
        .toArray();
    } catch (error) {
      throw new InternalServerErrorException('Không thể lấy danh sách tài liệu');
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
      throw new InternalServerErrorException('Thêm tài liệu thất bại');
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

      if (result.matchedCount === 0) throw new NotFoundException('Không tìm thấy tài liệu');
      return result;
    } catch (error) {
      throw new InternalServerErrorException('Cập nhật tài liệu thất bại');
    }
  }

  async remove(id: string) {
    try {
      const { db } = await connectToDatabase();
      const result = await db.collection(this.collectionName).deleteOne({
        _id: new ObjectId(id),
      });

      if (result.deletedCount === 0) throw new NotFoundException('Không tìm thấy tài liệu để xóa');
      return { success: true };
    } catch (error) {
      throw new InternalServerErrorException('Xóa tài liệu thất bại');
    }
  }
}