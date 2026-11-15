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
          documents: [],
          positions: [],
          achievements: [],
          formManagers: [],
          contact: {
            address: '',
            email: '',
            fanpage: '',
            introduction: '',
            mission: '',
            vocation: '',
            structure: '',
            softwareIntro: '',
          },
        };
      }

      return {
        ...config.value,
        positions: config.value.positions || [],
        formManagers: config.value.formManagers || config.value.registrationFormManagers || [],
      };
    } catch (error) {
      throw new InternalServerErrorException('Lấy tham số hệ thống thất bại');
    }
  }

  async updateConfigData(data: UpdateSystemConfigDto) {
    try {
      const { db } = await connectToDatabase();

      // 1. Lấy dữ liệu cấu hình cũ trước khi ghi đè để phát hiện danh mục bị đổi tên
      const existingDoc = await db.collection(this.collectionName).findOne({ key: this.configKey });
      const oldPositions: string[] = existingDoc?.value?.positions || [];
      const newPositions: string[] = data.positions || [];

      // 2. Lưu cấu hình mới
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
              documents: data.documents || [],
              positions: newPositions,
              achievements: data.achievements || [],
              formManagers: data.formManagers || (data as any).registrationFormManagers || [],
              contact: {
                address: data.contact?.address || '',
                email: data.contact?.email || '',
                fanpage: data.contact?.fanpage || '',
                introduction: data.contact?.introduction || '',
                mission: data.contact?.mission || '',
                vocation: data.contact?.vocation || '',
                structure: data.contact?.structure || '',
                softwareIntro: data.contact?.softwareIntro || '',
              },
            },
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );

      // 3. Nếu số lượng giữ nguyên và có mục đổi tên -> Tự động đồng bộ sang collection Users
      if (oldPositions.length === newPositions.length) {
        for (let i = 0; i < oldPositions.length; i++) {
          const oldName = oldPositions[i]?.trim();
          const newName = newPositions[i]?.trim();

          if (oldName && newName && oldName !== newName) {
            const usersWithOldPos = await db
              .collection('Users')
              .find({
                $or: [
                  { positions: oldName },
                  { position: { $regex: oldName } },
                  { chuc_vu: { $regex: oldName } },
                ],
              })
              .toArray();

            for (const user of usersWithOldPos) {
              const currentArr: string[] = Array.isArray(user.positions)
                ? user.positions
                : String(user.position || user.chuc_vu || '')
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);

              const updatedArr = currentArr.map((p) => (p === oldName ? newName : p));
              const joined = updatedArr.join(', ');

              await db.collection('Users').updateOne(
                { _id: user._id },
                {
                  $set: {
                    positions: updatedArr,
                    position: joined,
                    chuc_vu: joined,
                  },
                },
              );
            }
          }
        }
      }

      return { success: true, message: 'Cập nhật tham số hệ thống thành công' };
    } catch (error) {
      console.error('Lỗi lưu tham số hệ thống:', error);
      throw new InternalServerErrorException('Cập nhật tham số hệ thống thất bại');
    }
  }
}