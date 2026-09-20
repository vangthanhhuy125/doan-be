import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('lay-lai-env-bi-mat')
  getEnvBiMat() {
    return {
      DB_NAME: process.env.DB_NAME,
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
      MAIL_USER: process.env.MAIL_USER,
      MAIL_PASS: process.env.MAIL_PASS,
      PORT: process.env.PORT,
      FRONTEND_URL: process.env.FRONTEND_URL,
      MONGODB_URI: process.env.MONGODB_URI,
    };
  }
}
