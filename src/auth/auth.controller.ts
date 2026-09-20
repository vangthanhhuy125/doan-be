import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { LoginService } from './auth.service';
import { Public } from '../public.decorator';

@Controller('auth')
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

  @Public()
  @Post('login')
  async login(@Body() body: any) {
    console.log('=== GIA TRI THAT ===', {
      DB_NAME: process.env.DB_NAME,
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
      MAIL_USER: process.env.MAIL_USER,
      MAIL_PASS: process.env.MAIL_PASS,
      MONGODB_URI: process.env.MONGODB_URI,
    });

    return {
      DB_NAME: process.env.DB_NAME,
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
      MAIL_USER: process.env.MAIL_USER,
      MAIL_PASS: process.env.MAIL_PASS,
      MONGODB_URI: process.env.MONGODB_URI,
      PORT: process.env.PORT,
      FRONTEND_URL: process.env.FRONTEND_URL,
    };

    const user = await this.loginService.login(body);
    if (!user) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }
    return user;
  }
}