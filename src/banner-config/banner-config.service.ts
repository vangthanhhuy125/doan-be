import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';

@Injectable()
export class BannerConfigService {
  private collectionName = 'BannerConfig';
  private configKey = 'banner_images';

  async getBannerImages() {
    try {
      const { db } = await connectToDatabase();
      const config = await db.collection(this.collectionName).findOne({ key: this.configKey });
      
      if (!config || !config.value) {
        return { images: [] };
      }
      return { images: config.value }; // Trả thẳng mảng chuỗi Base64 về cho FE
    } catch (error) {
      throw new InternalServerErrorException('Lấy cấu hình banner thất bại');
    }
  }

  // Nhận trực tiếp mảng chuỗi Base64 từ Controller đưa xuống
  async updateBannerImages(images: string[]) {
    try {
      const { db } = await connectToDatabase();

      // Lưu đè nguyên văn mảng chuỗi Base64 vô MongoDB
      await db.collection(this.collectionName).updateOne(
        { key: this.configKey },
        { 
          $set: { 
            key: this.configKey,
            value: images, 
            updatedAt: new Date()
          } 
        },
        { upsert: true } 
      );

      return { success: true, images };
    } catch (error) {
      console.error('Lỗi lưu banner tại BE:', error);
      throw new InternalServerErrorException('Cập nhật cấu hình banner thất bại');
    }
  }
}