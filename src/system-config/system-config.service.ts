import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { UpdateSystemConfigDto } from './system-config.dto';

@Injectable()
export class SystemConfigService {
  private collectionName = 'BannerConfig';
  private configKey = 'system_parameters';

  async getConfigData() {
    try {
      const { db } = await connectToDatabase();
      const config = await db.collection(this.collectionName).findOne({ key: this.configKey });
      
      if (!config || !config.value) {
        return {
          years: [],
          academicYears: [],
          semesters: [],
          classBranches: [],
          achievements: [], 
          documents: [],
          contact: {
            address: '', email: '', fanpage: '',
            introduction: '', mission: '', vocation: '', structure: '', softwareIntro: ''
          }
        };
      }
      return config.value;
    } catch (error) {
      throw new InternalServerErrorException('Lấy tham số hệ thống thất bại');
    }
  }

  async updateConfigData(data: UpdateSystemConfigDto) {
    try {
      const { db } = await connectToDatabase();

      await db.collection(this.collectionName).updateOne(
        { key: this.configKey },
        {
          $set: {
            key: this.configKey,
            value: {
              years: data.years || [],
              academicYears: data.academicYears || [],
              semesters: data.semesters || [],
              classBranches: data.classBranches || [],
              achievements: data.achievements || [], 
              documents: data.documents || [],
              contact: {
                address: data.contact?.address || '',
                email: data.contact?.email || '',
                fanpage: data.contact?.fanpage || '',
                introduction: data.contact?.introduction || '',
                mission: data.contact?.mission || '',
                vocation: data.contact?.vocation || '',
                structure: data.contact?.structure || '',
                softwareIntro: data.contact?.softwareIntro || ''
              }
            },
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      return { success: true, message: 'Cập nhật tham số hệ thống thành công' };
    } catch (error) {
      console.error('Lỗi lưu tham số hệ thống:', error);
      throw new InternalServerErrorException('Cập nhật tham số hệ thống thất bại');
    }
  }
}