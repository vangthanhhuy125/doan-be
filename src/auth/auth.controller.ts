import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { LoginService } from './auth.service';
import { Public } from '../public.decorator';

@Controller('auth')
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

  @Public()
  @Post('login')
  async login(@Body() body: any) {
    const user = await this.loginService.login(body);
    if (!user) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }
    return user;
  }
}