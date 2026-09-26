import { Controller, Get, Put, Body, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as jwt from 'jsonwebtoken';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Req() req: any) {
    const userId = req.headers['x-user-id'] || req.user?.user_id || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Thiếu thông tin xác thực');
    }
    return this.usersService.getProfile(userId);
  }

  @Put('profile')
  async updateProfile(
    @Req() req: any,
    @Body() body: {
      full_name?: string;
      student_id?: string;
      email?: string;
      personal_email?: string;
      class?: string;
      phone?: string;
      birthday?: string;
      image_url?: string;
    }
  ) {
    const userId = req.headers['x-user-id'] || req.user?.user_id || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Thiếu thông tin xác thực');
    }
    return this.usersService.updateProfile(userId, body);
  }

  @Put('change-password')
  async changePassword(
    @Req() req: any,
    @Body() dto: ChangePasswordDto & { username?: string; userId?: string }
  ) {
    // 🟢 1. Lấy userId từ header hoặc body
    let userId = req.headers['x-user-id'] || req.user?._id || req.user?.user_id || req.user?.id || dto?.userId || dto?.username;

    // 🟢 2. Nếu có JWT Bearer token, giải mã lấy username hoặc _id chuẩn xác của account
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded: any = jwt.decode(token);
        if (decoded) {
          userId = userId || decoded._id || decoded.username || decoded.user_id || decoded.sub;
        }
      } catch (e) {}
    }

    if (!userId) {
      throw new UnauthorizedException('Thiếu thông tin xác thực');
    }

    return this.usersService.changePassword(userId, dto, req);
  }
}