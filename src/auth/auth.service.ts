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
      
      const accounts = await db.collection(this.collectionName).aggregate([
        {
          $match: {
            username: credentials.username,
          }
        },
        {
          $addFields: {
            user_id_obj: {
              $convert: {
                input: "$user_id",
                to: "objectId",
                onError: null,
                onNull: null
              }
            }
          }
        },
        {
          $lookup: {
            from: 'Users',
            localField: 'user_id_obj',
            foreignField: '_id',
            as: 'user_info'
          }
        },
        {
          $unwind: {
            path: '$user_info',
            preserveNullAndEmptyArrays: true
          }
        }
      ]).toArray();

      if (!accounts || accounts.length === 0) return null;

      const user = accounts[0];
      const dbPassword = user.password || '';
      let isMatch = false;

      if (dbPassword.startsWith('$2b$') || dbPassword.startsWith('$2a$')) {
        isMatch = await bcrypt.compare(credentials.password, dbPassword);
      } else {
        isMatch = dbPassword === credentials.password;
      }

      if (!isMatch) return null;

      delete user.password;
      delete user.user_id_obj;

      const token = signToken({
        id: user._id.toString(),
        username: user.username,
      });

      return {
        ...user,
        full_name: user.user_info?.full_name || user.full_name || user.username,
        image_url: user.user_info?.image_url || user.image_url || '',
        token,
      };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi hệ thống khi đăng nhập');
    }
  }
}