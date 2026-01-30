import { Controller, Get, Post, Put, Delete, Body, Param, UnauthorizedException } from '@nestjs/common';
import { AccountsService } from './cai-dat.service';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  async getAll() {
    return await this.accountsService.findAll();
  }

  @Post('login')
  async login(@Body() body: any) {
    const user = await this.accountsService.login(body);
    if (!user) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }
    return user;
  }

  @Post()
  async create(@Body() body: any) {
    return await this.accountsService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return await this.accountsService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.accountsService.remove(id);
  }
}