import { Module } from '@nestjs/common';
import { RegistrationFormsController } from './registration-forms.controller';
import { RegistrationFormsService } from './registration-forms.service';

@Module({
  controllers: [RegistrationFormsController],
  providers: [RegistrationFormsService],
  exports: [RegistrationFormsService]
})
export class RegistrationFormsModule {}