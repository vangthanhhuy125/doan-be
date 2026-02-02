import { Module } from '@nestjs/common';
import { PartyMembersController } from './dang.controller';
import { PartyMembersService } from './dang.service';

@Module({
  controllers: [PartyMembersController],
  providers: [PartyMembersService],
})
export class PartyMembersModule {}