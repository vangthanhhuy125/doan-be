import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NhanSuModule } from './human-resources/human-resources.module';
import { AccountsModule } from './settings/settings.module';
import { YouthUnionModule } from './faculty-yec/faculty-yec.module';
import { OrganizationsModule } from './collective/collective.module';
import { DocumentsModule } from './document/document.module';
import { ProgramsModule } from './annual-programs/programs.module';
import { AnnouncementsModule } from './notification/notification.module';
import { PartyMembersModule } from './party-work/party-work.module';
import { PerformanceModule } from './scorecards/scorecards.module';
import { SolutionModelsModule } from './solution-model/solution-model.module';
import { YouthProjectsModule } from './youth-project/youth-project.module';
import { BannerConfigModule } from './banner-config/banner-config.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { LoginModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RegistrationFormsModule } from './registration-forms/registration-forms.module';
import { PermissionsModule } from './permissions/permissions.module';
import { SurveysModule } from './surveys/surveys.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoginModule,
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
    BannerConfigModule,
    SystemConfigModule,
    UsersModule,
    RegistrationFormsModule,
    PermissionsModule,
    SurveysModule,
  ],
})
export class AppModule {}