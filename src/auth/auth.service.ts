import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { signToken } from '../../lib/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class LoginService {
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

      const token = signToken({
        id: user._id.toString(),
        username: user.username,
      });

      return {
        ...userWithoutPassword,
        token,
      };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi hệ thống khi đăng nhập');
    }
  }
}