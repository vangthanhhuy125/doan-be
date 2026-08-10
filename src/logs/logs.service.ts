import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { connectToDatabase } from '../../lib/mongodb';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  // 🟢 Ghi log mới (Hỗ trợ lưu đầy đủ userName)
  async createLog(
    userId: string,
    action: string,
    resource: string,
    details: any,
    userName?: string,
  ) {
    try {
      const { db } = await connectToDatabase();
      await db.collection('SystemLogs').insertOne({
        userId,
        userName: userName || userId,
        action,
        resource,
        details,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Không thể tạo log hệ thống:', error);
    }
  }

  // 🟢 Lấy danh sách toàn bộ log (Mới nhất xếp trước)
  async findAll() {
    try {
      const { db } = await connectToDatabase();
      return await db
        .collection('SystemLogs')
        .find()
        .sort({ timestamp: -1 })
        .toArray();
    } catch (error) {
      this.logger.error('Lỗi lấy danh sách log:', error);
      return [];
    }
  }

  // 🟢 TỰ ĐỘNG XÓA LOG SAU 60 NGÀY (Chạy tự động mỗi ngày lúc 00:00)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    try {
      const { db } = await connectToDatabase();
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const result = await db.collection('SystemLogs').deleteMany({
        timestamp: { $lt: sixtyDaysAgo },
      });
      this.logger.log(`Đã tự động dọn dẹp ${result.deletedCount} log cũ hơn 60 ngày.`);
    } catch (error) {
      this.logger.error('Lỗi khi thực thi Cron Job dọn dẹp log:', error);
    }
  }
}