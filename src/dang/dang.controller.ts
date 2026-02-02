import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { PartyMembersService } from './dang.service';

@Controller('party-members')
export class PartyMembersController {
  constructor(private readonly partyMembersService: PartyMembersService) {}

  @Get()
  async getAll() {
    return await this.partyMembersService.findAll();
  }

  @Post()
  async create(@Body() body: any) {
    return await this.partyMembersService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return await this.partyMembersService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.partyMembersService.remove(id);
  }
}