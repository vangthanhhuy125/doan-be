import { Controller, Post, Get, Body, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: any) {
    return await this.authService.login(loginDto);
  }

  @Get('profile')
  async getProfile(@Request() req: any) {
    const userId = req.user?._id || req.headers['x-user-id'];
    return await this.authService.getProfile(userId);
  }
}