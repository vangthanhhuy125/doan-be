import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly mailerService: MailerService) {}

  async findAll() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection('Announcements').find().sort({ posted_at: -1 }).toArray();
    } catch (error) {
      throw new InternalServerErrorException('Lỗi lấy danh sách thông báo');
    }
  }

  async create(payload: any, file?: any) {
    try {
      const { db } = await connectToDatabase();
      const shouldSendEmail = payload.sendEmail === 'true';

      const newNotice: any = {
        title: payload.title,
        content: payload.content,
        posted_at: payload.posted_at || new Date().toISOString(),
      };

      if (file) {
        newNotice.file = {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer.toString('base64')
        };
      }
      
      const result = await db.collection('Announcements').insertOne(newNotice);
      
      if (shouldSendEmail) {
        // Đã thêm await để tiến trình gửi mail không bị ngắt rớt
        await this.sendNotificationEmails(payload.title, payload.content, payload, file);
      }
      
      return { _id: result.insertedId, ...newNotice };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi lưu thông báo');
    }
  }

  async update(id: string, payload: any, file?: any) {
    try {
      const { db } = await connectToDatabase();
      const shouldSendEmail = payload.sendEmail === 'true';

      const updateData: any = {
        title: payload.title,
        content: payload.content,
        posted_at: payload.posted_at,
      };

      if (file) {
        updateData.file = {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer.toString('base64')
        };
      }

      const result = await db.collection('Announcements').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new NotFoundException('Không tìm thấy thông báo để cập nhật');
      }

      if (shouldSendEmail) {
        await this.sendNotificationEmails(payload.title, payload.content, payload, file);
      }

      return result;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi khi cập nhật thông báo');
    }
  }

  async delete(id: string) {
    try {
      const { db } = await connectToDatabase();
      const result = await db.collection('Announcements').deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) {
        throw new NotFoundException('Không tìm thấy thông báo để xóa');
      }
      return;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi khi xóa thông báo');
    }
  }

  private async sendNotificationEmails(title: string, content: string, payload: any, file?: any) {
    try {
      const { db } = await connectToDatabase();
      let query = {};

      if (payload.emailTarget === 'SPECIFIC' && payload.receiverIds) {
        const parsedIds = typeof payload.receiverIds === 'string' ? JSON.parse(payload.receiverIds) : payload.receiverIds;
        if (Array.isArray(parsedIds) && parsedIds.length > 0) {
          const objectIds = parsedIds.map((id: string) => new ObjectId(id));
          query = { _id: { $in: objectIds } };
        }
      }

      // Đổi sang quét collection Users và lấy luôn trường email có sẵn
      const users = await db.collection('Users').find(query, { projection: { email: 1, student_id: 1 } }).toArray();
      
      const emailList = users
        .map(u => {
          if (u.email) return u.email;
          return u.student_id ? `${u.student_id}@gm.uit.edu.vn` : null;
        })
        .filter((email): email is string => !!email);

      if (emailList.length === 0) {
        console.log('Không có email nào thỏa mãn để gửi.');
        return;
      }

      console.log(`Bắt đầu gửi mail tới ${emailList.length} địa chỉ: `, emailList);

      const attachments = file ? [{
        filename: file.originalname,
        content: file.buffer,
        contentType: file.mimetype
      }] : [];

      const info = await this.mailerService.sendMail({
        to: emailList,
        subject: `[THÔNG BÁO] ${title}`,
        attachments: attachments,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
            <div style="background-color: #0054a5; padding: 24px; text-align: center; color: white;">
              <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">Đoàn TNCS Hồ Chí Minh - Khoa CNPM</h2>
            </div>
            <div style="padding: 32px; background-color: #ffffff;">
              <p style="margin-top: 0; font-weight: bold;">Xin chào các đồng chí cán bộ Đoàn,</p>
              <p>Ban Chấp hành Đoàn khoa vừa triển khai nội dung thông báo mới chi tiết dưới đây:</p>
              <div style="background-color: #f8fafc; padding: 20px; border-left: 4px solid #1d92ff; border-radius: 8px; margin: 24px 0;">
                <h3 style="margin-top: 0; color: #0054a5; font-size: 16px;">${title}</h3>
                <p style="white-space: pre-wrap; margin-bottom: 0; font-size: 14px; color: #475569;">${content}</p>
              </div>
              ${file ? `<p style="font-size: 13px; color: #1d92ff; font-weight: bold;">📎 Có tệp tin đính kèm gửi kèm email này.</p>` : ''}
              <p>Vui lòng đăng nhập hệ thống nghiệp vụ để theo dõi và cập nhật chi tiết công tác nghiệp vụ.</p>
            </div>
            <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
              Đây là email tự động từ Hệ thống Nghiệp vụ công tác Đoàn khoa CNPM SE-UIT-VNUHCM.
            </div>
          </div>
        `,
      });

      console.log('Tiến trình gửi mail hoàn tất:', info.messageId);
    } catch (error) {
      console.error('Lỗi tiến trình gửi mail:', error);
    }
  }
}