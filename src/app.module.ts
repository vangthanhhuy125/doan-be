import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NhanSuModule } from './nhan-su/nhan-su.module';
import { AccountsModule } from './cai-dat/cai-dat.module';
import { YouthUnionModule } from './bch-doan/bch-doan.module';
import { OrganizationsModule } from './tap-the/tap-the.module';
import { DocumentsModule } from './tai-lieu/tai-lieu.module';
import { ProgramsModule } from './chuong-trinh/chuong-trinh.module';
import { AnnouncementsModule } from './thong-bao/thong-bao.module';
import { PartyMembersModule } from './dang/dang.module';
import { PerformanceModule } from './bang-diem/bang-diem.module';
import { SolutionModelsModule } from './MHGP/MHGP.module';
import { YouthProjectsModule } from './CTTN/CTTN.module';

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
    ProgramsModule,
    AnnouncementsModule,
    PartyMembersModule,
    PerformanceModule,
    SolutionModelsModule,
    YouthProjectsModule,
  ],
})
export class AppModule {}