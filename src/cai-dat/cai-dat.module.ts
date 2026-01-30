import { Module } from '@nestjs/common';
import { AccountsController } from './cai-dat.controller';
import { AccountsService } from './cai-dat.service';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}