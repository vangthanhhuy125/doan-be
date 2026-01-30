import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NhanSuModule } from './nhan-su/nhan-su.module';
import { AccountsModule } from './cai-dat/cai-dat.module';
import { YouthUnionModule } from './bch-doan/bch-doan.module';
import { OrganizationsModule } from './tap-the/tap-the.module';
import { DocumentsModule } from './tai-lieu/tai-lieu.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    NhanSuModule,
    AccountsModule,
    YouthUnionModule,
    OrganizationsModule,
    DocumentsModule,
  ],
})
export class AppModule {}