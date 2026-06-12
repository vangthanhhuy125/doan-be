import { Module } from '@nestjs/common';
import { PartyMembersController } from './party-work.controller';
import { PartyMembersService } from './party-work.service';

@Module({
  controllers: [PartyMembersController],
  providers: [PartyMembersService],
})
export class PartyMembersModule {}