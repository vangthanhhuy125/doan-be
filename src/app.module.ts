import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NhanSuModule } from './nhan-su/nhan-su.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    NhanSuModule,
  ],
})
export class AppModule {}