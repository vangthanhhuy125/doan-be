import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { AnnouncementsController } from './notification.controller';
import { AnnouncementsService } from './notification.service';
import * as dotenv from 'dotenv';

dotenv.config(); 

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: 'smtp.gmail.com',
        port: 587,           
        secure: false, 
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      },
      defaults: {
        from: '"Đoàn Khoa CNPM" <no-reply@gm.uit.edu.vn>',
      },
    }),
  ],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}