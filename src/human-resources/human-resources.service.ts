import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { generateEmail } from '../../lib/utils';
import { ObjectId } from 'mongodb';

@Injectable()
export class NhanSuService {
  private collectionName = 'Users';

  async findAll() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection(this.collectionName).find({}).toArray();
    } catch (error) {
      console.error('Lỗi findAll:', error);
      throw new InternalServerErrorException('Lỗi kết nối cơ sở dữ liệu');
    }
  }

  async findOne(id: string) {
    try {
      const { db } = await connectToDatabase();
      const user = await db.collection(this.collectionName).findOne({ _id: new ObjectId(id) });
      if (!user) throw new NotFoundException('Không tìm thấy nhân sự');
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ID không hợp lệ hoặc lỗi DB');
    }
  }

  async create(data: any) {
    try {
      const { db } = await connectToDatabase();
      const newUser = {
        image_url: data.image_url || "",
        full_name: data.name,
        student_id: data.mssv,
        class: data.class || "",
        phone: data.phone || "",
        birthday: data.birthday || "",
        email: generateEmail(data.mssv),
        createdAt: new Date()
      };
      const result = await db.collection(this.collectionName).insertOne(newUser);
      return { ...newUser, _id: result.insertedId };
    } catch (error) {
      console.error('Lỗi create:', error);
      throw new InternalServerErrorException('Không thể thêm nhân sự');
    }
  }

  async update(id: string, data: any) {
    try {
      const { db } = await connectToDatabase();
      const mappedData = {
        full_name: data.name,
        student_id: data.mssv,
        class: data.class,
        phone: data.phone,
        birthday: data.birthday,
        image_url: data.image_url,
        email: generateEmail(data.mssv)
      };

      const result = await db.collection(this.collectionName).updateOne(
        { _id: new ObjectId(id) },
        { $set: mappedData }
      );
      
      if (result.matchedCount === 0) throw new NotFoundException('Không tìm thấy nhân sự để cập nhật');
      return { message: 'Cập nhật thành công' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi cập nhật dữ liệu');
    }
  }

  async remove(id: string) {
    try {
      const { db } = await connectToDatabase();
      const result = await db.collection(this.collectionName).deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) throw new NotFoundException('Không tìm thấy nhân sự để xóa');
      return { message: 'Xóa nhân sự thành công' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi khi xóa dữ liệu');
    }
  }
}