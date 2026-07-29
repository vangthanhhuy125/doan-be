import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AnnouncementsService {

async findAll(userId?: string, isManage: boolean = false) {
    try {
      const { db } = await connectToDatabase();
      const allAnnouncements = await db.collection('Announcements').find().sort({ posted_at: -1 }).toArray();

      // 1. Màn hình Quản lý / Tạo thông báo: TRẢ VỀ TOÀN BỘ (Không lọc)
      if (isManage) {
        return allAnnouncements;
      }

      // 2. Không có userId: Chỉ hiện các thông báo ALL
      if (!userId || userId === 'undefined') {
        return allAnnouncements.filter((item: any) => !item.emailTarget || item.emailTarget === 'ALL');
      }

      const cleanUserId = String(userId).trim();
      const userObjectId = new ObjectId(cleanUserId);

      // 3. Màn hình Profile cá nhân: Lọc theo người nhận
      const filteredAnnouncements = allAnnouncements.filter((item: any) => {
        if (!item.emailTarget || item.emailTarget === 'ALL') {
          return true;
        }

        if (item.emailTarget === 'SPECIFIC') {
          let receiverIds = item.receiverIds;

          if (typeof receiverIds === 'string') {
            try {
              receiverIds = JSON.parse(receiverIds);
            } catch (e) {
              receiverIds = [receiverIds];
            }
          }

          if (Array.isArray(receiverIds) && receiverIds.length > 0) {
            return receiverIds.some((id: any) => {
              const idStr = String(id).trim();
              return idStr === cleanUserId || idStr === userObjectId.toString();
            });
          }
        }

        return false;
      });

      return filteredAnnouncements;
    } catch (error) {
      throw new InternalServerErrorException('Lỗi lấy danh sách thông báo');
    }
  }

  async create(payload: any, file?: any) {
    try {
      const { db } = await connectToDatabase();
      const shouldSendEmail = payload.sendEmail === 'true';

      // Chuẩn hóa receiverIds về đúng Mảng trước khi lưu
      let parsedReceiverIds = payload.receiverIds || [];
      if (typeof parsedReceiverIds === 'string') {
        try {
          parsedReceiverIds = JSON.parse(parsedReceiverIds);
        } catch (e) {
          parsedReceiverIds = [parsedReceiverIds];
        }
      }

      const newNotice: any = {
        title: payload.title,
        content: payload.content,
        posted_at: payload.posted_at || new Date().toISOString(),
        emailTarget: payload.emailTarget || 'ALL', 
        receiverIds: parsedReceiverIds,
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

      let parsedReceiverIds = payload.receiverIds;
      if (typeof parsedReceiverIds === 'string') {
        try {
          parsedReceiverIds = JSON.parse(parsedReceiverIds);
        } catch (e) {
          parsedReceiverIds = [parsedReceiverIds];
        }
      }

      const updateData: any = {
        title: payload.title,
        content: payload.content,
        posted_at: payload.posted_at,
        emailTarget: payload.emailTarget,
        receiverIds: parsedReceiverIds,
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
      const mailUser = process.env.MAIL_USER;
      const mailPass = process.env.MAIL_PASS;

      if (!mailUser || !mailPass) {
        console.error('Lỗi: Thiếu cấu hình MAIL_USER hoặc MAIL_PASS trong biến môi trường');
        return;
      }

      const { db } = await connectToDatabase();
      let query = {};

      if (payload.emailTarget === 'SPECIFIC' && payload.receiverIds) {
        const parsedIds = typeof payload.receiverIds === 'string' ? JSON.parse(payload.receiverIds) : payload.receiverIds;
        if (Array.isArray(parsedIds) && parsedIds.length > 0) {
          const objectIds = parsedIds.map((id: string) => new ObjectId(id));
          query = { _id: { $in: objectIds } };
        }
      }

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

      console.log(`Bắt đầu gửi mail thật tới ${emailList.length} địa chỉ qua Gmail SMTP...`);

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: mailUser,
          pass: mailPass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      const attachments = file ? [{
        filename: file.originalname,
        content: Buffer.from(file.buffer, 'base64'),
      }] : [];

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
          <div style="background-color: #0054a5; padding: 24px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">Đoàn TNCS Hồ Chí Minh khoa Công nghệ Phần mềm</h2>
          </div>
          <div style="padding: 32px; background-color: #ffffff;">
            <p style="margin-top: 0; font-weight: bold;">Xin chào các đồng chí cán bộ Đoàn,</p>
            <p>Ban Chấp hành Đoàn khoa vừa triển khai nội dung thông báo mới chi tiết dưới đây:</p>
            <div style="background-color: #f8fafc; padding: 20px; border-left: 4px solid #1d92ff; border-radius: 8px; margin: 24px 0;">
              <h3 style="margin-top: 0; color: #0054a5; font-size: 16px;">${title}</h3>
              <p style="white-space: pre-wrap; margin-bottom: 0; font-size: 14px; color: #475569;">${content}</p>
            </div>
            ${file ? `<p style="font-size: 13px; color: #1d92ff; font-weight: bold;">📎 Có tệp tin đính kèm gửi kèm email này.</p>` : ''}
          </div>
          <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
            Đây là email tự động từ Hệ thống Nghiệp vụ công tác Đoàn - Hội khoa Công nghệ Phần mềm.
          </div>
        </div>
      `;

      const mailOptions = {
        from: `"Đoàn khoa Công nghệ Phần mềm (ĐH CNTT - ĐHQG-TPHCM)" <${mailUser}>`,
        to: emailList.join(','),
        subject: `[THÔNG BÁO] ${title}`,
        html: htmlContent,
        attachments: attachments
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Tiến trình gửi mail thật hoàn tất. MessageId:', info.messageId);

    } catch (error) {
      console.error('Lỗi hệ thống khi gửi Gmail thật:', error);
    }
  }
}