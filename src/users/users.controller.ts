import { Controller, Get, Put, Body, Req, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';

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
}