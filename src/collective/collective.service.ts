import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class OrganizationsService {
  private collectionName = 'Organizations';

  async findAll() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection(this.collectionName).find({}).toArray();
    } catch (error) {
      throw new InternalServerErrorException('Lấy danh sách thất bại');
    }
  }

  async create(data: any) {
    try {
      const { db } = await connectToDatabase();
      const result = await db.collection(this.collectionName).insertOne(data);
      return result;
    } catch (error) {
      throw new InternalServerErrorException('Thêm đơn vị thất bại');
    }
  }

  async update(id: string, data: any) {
    try {
      const { db } = await connectToDatabase();
      const { _id, ...updateData } = data;
      const result = await db.collection(this.collectionName).updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      if (result.matchedCount === 0) throw new NotFoundException('Không tìm thấy đơn vị');
      return result;
    } catch (error) {
      throw new InternalServerErrorException('Cập nhật thất bại');
    }
  }

  async remove(id: string) {
    try {
      const { db } = await connectToDatabase();
      const result = await db.collection(this.collectionName).deleteOne({
        _id: new ObjectId(id),
      });
      if (result.deletedCount === 0) throw new NotFoundException('Không tìm thấy đơn vị');
      return { success: true };
    } catch (error) {
      throw new InternalServerErrorException('Xóa thất bại');
    }
  }
}