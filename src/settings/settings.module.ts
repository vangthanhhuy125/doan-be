import { Module } from '@nestjs/common';
import { AccountsController } from './settings.controller';
import { AccountsService } from './settings.service';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}