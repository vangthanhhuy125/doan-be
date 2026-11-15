import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { generateEmail } from '../../lib/utils';
import { ObjectId } from 'mongodb';

@Injectable()
export class NhanSuService {
  private collectionName = 'Users';

  private normalizePositions(data: any): string[] {
    if (Array.isArray(data?.positions)) {
      return data.positions.map((p: any) => String(p).trim()).filter(Boolean);
    }
    const raw = data?.position || data?.chuc_vu || data?.role;
    if (Array.isArray(raw)) {
      return raw.map((p: any) => String(p).trim()).filter(Boolean);
    }
    if (typeof raw === 'string' && raw.trim()) {
      return raw.split(',').map((p) => p.trim()).filter(Boolean);
    }
    return [];
  }

  async findAll() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection(this.collectionName).find({}).toArray();
    } catch (error) {
      console.error('Lỗi findAll:', error);
      throw new InternalServerErrorException('Lỗi lấy danh sách nhân sự');
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
      const positions = this.normalizePositions(data);
      const joinedPositions = positions.join(', ');

      const newUser = {
        image_url: data.image_url || '',
        full_name: data.name || data.full_name || '',
        student_id: data.mssv || data.student_id || '',
        class: data.class || '',
        positions,
        position: joinedPositions,
        chuc_vu: joinedPositions,
        phone: data.phone || '',
        birthday: data.birthday || '',
        personal_email: data.personal_email || '',
        email: generateEmail(data.mssv || data.student_id),
        createdAt: new Date(),
      };

      const result = await db.collection(this.collectionName).insertOne(newUser);
      return { ...newUser, _id: result.insertedId };
    } catch (error) {
      console.error('Lỗi create:', error);
      throw new InternalServerErrorException('Không thể thêm nhân sự mới');
    }
  }

  async update(id: string, data: any) {
    try {
      const { db } = await connectToDatabase();
      const positions = this.normalizePositions(data);
      const joinedPositions = positions.join(', ');

      const mappedData = {
        full_name: data.name || data.full_name || '',
        student_id: data.mssv || data.student_id || '',
        class: data.class || '',
        positions,
        position: joinedPositions,
        chuc_vu: joinedPositions,
        phone: data.phone || '',
        birthday: data.birthday || '',
        personal_email: data.personal_email || '',
        image_url: data.image_url || '',
        email: generateEmail(data.mssv || data.student_id),
        updatedAt: new Date(),
      };

      const result = await db.collection(this.collectionName).updateOne(
        { _id: new ObjectId(id) },
        { $set: mappedData },
      );

      if (result.matchedCount === 0) throw new NotFoundException('Không tìm thấy nhân sự để cập nhật');
      return { message: 'Cập nhật nhân sự thành công' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi cập nhật dữ liệu nhân sự');
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
