import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class AccountsService {
  private collectionName = 'Accounts';

  async login(credentials: any) {
    try {
      const { db } = await connectToDatabase();
      const user = await db.collection(this.collectionName).findOne({
        username: credentials.username,
        password: credentials.password,
      });

      if (!user) return null;

      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      throw new InternalServerErrorException('Lỗi hệ thống khi đăng nhập');
    }
  }

  async findAll() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection(this.collectionName).find({}).toArray();
    } catch (error) {
      console.error('Lỗi findAll Accounts:', error);
      throw new InternalServerErrorException('Lỗi DB');
    }
  }

  async create(data: any) {
    try {
      const { db } = await connectToDatabase();
      const newAccount = {
        user_id: data.user_id ? new ObjectId(data.user_id) : null,
        displayName: data.displayName,
        username: data.username,
        password: data.password,
        createdAt: new Date()
      };
      const result = await db.collection(this.collectionName).insertOne(newAccount);
      return { ...newAccount, _id: result.insertedId };
    } catch (error) {
      console.error('Lỗi create Account:', error);
      throw new InternalServerErrorException('Lỗi tạo tài khoản');
    }
  }

  async update(id: string, data: any) {
    try {
      const { db } = await connectToDatabase();
      const { _id, ...updateData } = data;
      
      if (updateData.user_id) {
        updateData.user_id = new ObjectId(updateData.user_id);
      }

      await db.collection(this.collectionName).updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      return { message: 'OK' };
    } catch (error) {
      console.error('Lỗi update Account:', error);
      throw new InternalServerErrorException('Lỗi cập nhật');
    }
  }

  async remove(id: string) {
    try {
      const { db } = await connectToDatabase();
      await db.collection(this.collectionName).deleteOne({ _id: new ObjectId(id) });
      return { message: 'OK' };
    } catch (error) {
      console.error('Lỗi remove Account:', error);
      throw new InternalServerErrorException('Lỗi xóa');
    }
  }
}