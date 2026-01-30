import { Module } from '@nestjs/common';
import { OrganizationsController } from './tap-the.controller';
import { OrganizationsService } from './tap-the.service';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}