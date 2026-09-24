import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async validateAndGetUserPermissions(user: any): Promise<string[]> {
    if (user.role === 'admin' || user.username === 'admin') {
      return ['*'];
    }

    const groupId = user.group_id || user.groupId || user.permission_id;
    if (!groupId) return [];

    try {
      const { db } = await connectToDatabase();
      const group = await db.collection('Permissions').findOne({
        _id: ObjectId.isValid(groupId) ? new ObjectId(groupId) : groupId,
      });

      return Array.isArray(group?.permissions) ? group.permissions : [];
    } catch {
      return [];
    }
  }

  async login(loginDto: { username: string; password?: string }) {
    const { db } = await connectToDatabase();
    const user = await db.collection('Accounts').findOne({ username: loginDto.username });

    if (!user) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }

    // Lấy đầy đủ mảng quyền từ bảng Permissions
    const permissions = await this.validateAndGetUserPermissions(user);

    const payload = {
      _id: user._id,
      user_id: user.user_id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      group_id: user.group_id || user.groupId,
      permissions,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: payload,
    };
  }

  async getProfile(userId: string) {
    const { db } = await connectToDatabase();
    const user = await db.collection('Accounts').findOne({ _id: new ObjectId(userId) });
    if (!user) throw new UnauthorizedException('Không tìm thấy tài khoản');

    const permissions = await this.validateAndGetUserPermissions(user);
    return {
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      permissions,
    };
  }
}