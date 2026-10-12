import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { connectToDatabase } from '../../lib/mongodb';

@Injectable()
export class LogsService implements OnModuleInit {
  private readonly logger = new Logger(LogsService.name);

  // 🟢 Tự động tạo Index khi server khởi động (giải quyết triệt để lỗi tràn 32MB RAM khi sort)
  async onModuleInit() {
    try {
      const { db } = await connectToDatabase();
      await db.collection('SystemLogs').createIndex({ timestamp: -1 });
      this.logger.log('Đã khởi tạo index cho collection SystemLogs thành công.');
    } catch (error) {
      this.logger.warn('Không thể tạo index cho SystemLogs:', error);
    }
  }

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

  // 🟢 Lấy danh sách log (Giới hạn bản ghi mới nhất & bật allowDiskUse phòng ngừa)
  async findAll(limit: number = 500) {
    try {
      const { db } = await connectToDatabase();
      return await db
        .collection('SystemLogs')
        .find({}, { allowDiskUse: true })
        .sort({ timestamp: -1 })
        .limit(Number(limit))
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