import { Module } from '@nestjs/common';
import { OrganizationsController } from './collective.controller';
import { OrganizationsService } from './collective.service';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}