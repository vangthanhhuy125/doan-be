import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'secretKey_SE_UIT';

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
    const { username, password } = loginDto;

    // 1. Kiểm tra đầu vào bắt buộc
    if (!username || !password) {
      throw new BadRequestException('Vui lòng nhập đầy đủ tài khoản và mật khẩu!');
    }

    const { db } = await connectToDatabase();
    const user = await db.collection('Accounts').findOne({ username: username.trim() });

    // 2. Không tìm thấy user
    if (!user) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác!');
    }

    // 3. KIỂM TRA MẬT KHẨU (Khắc phục lỗ hổng)
    let isPasswordValid = false;
    const dbPassword = user.password || '';

    if (dbPassword.startsWith('$2a$') || dbPassword.startsWith('$2b$')) {
      // Trường hợp mật khẩu trong DB đã được mã hóa bằng bcrypt
      isPasswordValid = await bcrypt.compare(password, dbPassword);
    } else {
      // Trường hợp tài khoản cũ lưu mật khẩu thô (plain-text)
      isPasswordValid = password === dbPassword;
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác!');
    }

    // 4. Mật khẩu đúng -> Tạo Token và trả dữ liệu
    const permissions = await this.validateAndGetUserPermissions(user);
    const payload = {
      _id: user._id,
      user_id: user.user_id,
      username: user.username,
      displayName: user.displayName || user.full_name || user.username,
      role: user.role,
      group_id: user.group_id || user.groupId,
      permissions,
    };

    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });

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