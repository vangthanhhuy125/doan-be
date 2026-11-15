import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AnnouncementsService {

  private parseArrayField(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
      } catch {
        return val.split(',').map(v => v.trim()).filter(Boolean);
      }
    }
    return [];
  }

  private extractIntake(u: any): string {
    const classStr = u?.class_name || u?.class || u?.chi_doan || '';
    const match = String(classStr).match(/(?:19|20)\d{2}/);
    if (match) return `K${match[0]}`;
    const sid = String(u?.student_id || u?.mssv || '').trim();
    if (sid.length >= 2) {
      const prefix = parseInt(sid.substring(0, 2), 10);
      if (!isNaN(prefix) && prefix >= 15 && prefix <= 35) {
        return `K20${prefix}`;
      }
    }
    return 'Khác';
  }

  private extractBranch(u: any): string {
    return String(u?.class_name || u?.class || u?.chi_doan || u?.unitBranch || u?.unit || '').trim();
  }

  async findAll(userId?: string, isManage: boolean = false) {
    try {
      const { db } = await connectToDatabase();
      const allAnnouncements = await db.collection('Announcements').find().sort({ posted_at: -1 }).toArray();

      if (isManage) {
        return allAnnouncements.map(item => ({
          ...item,
          _id: item._id.toString(),
          read_by: item.read_by || []
        }));
      }

      if (!userId || userId === 'undefined') {
        return allAnnouncements
          .filter((item: any) => !item.emailTarget || item.emailTarget === 'ALL')
          .map(item => ({
            ...item,
            _id: item._id.toString(),
            read_by: item.read_by || []
          }));
      }

      const cleanUserId = String(userId).trim();
      let userObjectId: ObjectId | null = null;
      try {
        userObjectId = new ObjectId(cleanUserId);
      } catch (e) {}

      // Lấy thông tin user hiện tại để đối chiếu Khóa / Chi đoàn / MSSV
      const userQuery = userObjectId ? { $or: [{ _id: userObjectId }, { _id: cleanUserId as any }] } : { _id: cleanUserId as any };
      const currentUser: any = await db.collection('Users').findOne(userQuery);
      let personnelRecord: any = null;
      if (currentUser?.student_id) {
        personnelRecord = await db.collection('Personnel').findOne({
          $or: [{ student_id: currentUser.student_id }, { mssv: currentUser.student_id }]
        });
      }

      const userProfile = { ...personnelRecord, ...currentUser };
      const userIntake = this.extractIntake(userProfile);
      const userBranch = this.extractBranch(userProfile).toLowerCase();
      const personnelIdStr = personnelRecord?._id ? personnelRecord._id.toString() : '';

      const filteredAnnouncements = allAnnouncements.filter((item: any) => {
        if (!item.emailTarget || item.emailTarget === 'ALL') {
          return true;
        }

        if (item.emailTarget === 'BY_INTAKE') {
          const intakes = this.parseArrayField(item.targetIntakes);
          return intakes.includes(userIntake);
        }

        if (item.emailTarget === 'BY_BRANCH') {
          const branches = this.parseArrayField(item.targetBranches).map(b => b.toLowerCase());
          return Boolean(userBranch) && branches.includes(userBranch);
        }

        if (item.emailTarget === 'SPECIFIC') {
          const receiverIds = this.parseArrayField(item.receiverIds);
          if (receiverIds.length > 0) {
            return receiverIds.some((idStr: string) => {
              return (
                idStr === cleanUserId ||
                (userObjectId && idStr === userObjectId.toString()) ||
                (personnelIdStr && idStr === personnelIdStr)
              );
            });
          }
        }

        return false;
      });

      return filteredAnnouncements.map(item => ({
        ...item,
        _id: item._id.toString(),
        read_by: item.read_by || []
      }));
    } catch (error) {
      throw new InternalServerErrorException('Lỗi lấy danh sách thông báo');
    }
  }

  async markAsRead(id: string, userId: string) {
    try {
      if (!userId || userId === 'undefined') {
        return { success: false, message: 'Thiếu thông tin người dùng' };
      }

      const { db } = await connectToDatabase();
      let queryId: any;
      try {
        queryId = new ObjectId(id);
      } catch {
        queryId = id;
      }

      const cleanUserId = String(userId).trim();

      await db.collection('Announcements').updateOne(
        { $or: [{ _id: queryId }, { _id: id as any }] },
        { $addToSet: { read_by: cleanUserId } }
      );

      return { success: true, message: 'Đã đánh dấu thông báo đã đọc' };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi đánh dấu đã đọc thông báo');
    }
  }

  async create(payload: any, file?: any) {
    try {
      const { db } = await connectToDatabase();
      const shouldSendEmail = payload.sendEmail === 'true' || payload.sendEmail === true;

      const parsedReceiverIds = this.parseArrayField(payload.receiverIds);
      const parsedTargetIntakes = this.parseArrayField(payload.targetIntakes);
      const parsedTargetBranches = this.parseArrayField(payload.targetBranches);

      const newNotice: any = {
        title: payload.title,
        content: payload.content,
        posted_at: payload.posted_at || new Date().toISOString(),
        emailTarget: payload.emailTarget || 'ALL',
        targetIntakes: parsedTargetIntakes,
        targetBranches: parsedTargetBranches,
        receiverIds: parsedReceiverIds,
        read_by: []
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

      return { _id: result.insertedId.toString(), ...newNotice };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi lưu thông báo');
    }
  }

  async update(id: string, payload: any, file?: any) {
    try {
      const { db } = await connectToDatabase();
      const shouldSendEmail = payload.sendEmail === 'true' || payload.sendEmail === true;

      const parsedReceiverIds = this.parseArrayField(payload.receiverIds);
      const parsedTargetIntakes = this.parseArrayField(payload.targetIntakes);
      const parsedTargetBranches = this.parseArrayField(payload.targetBranches);

      let queryId: any;
      try { queryId = new ObjectId(id); } catch { queryId = id; }

      const updateData: any = {
        title: payload.title,
        content: payload.content,
        posted_at: payload.posted_at,
        emailTarget: payload.emailTarget || 'ALL',
        targetIntakes: parsedTargetIntakes,
        targetBranches: parsedTargetBranches,
        receiverIds: parsedReceiverIds,
      };

      if (file) {
        updateData.file = {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer.toString('base64')
        };
      } else if (payload.removeExistingFile === 'true') {
        updateData.file = null;
      }

      const result = await db.collection('Announcements').findOneAndUpdate(
        { $or: [{ _id: queryId }, { _id: id as any }] },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      const updatedDoc = (result as any)?.value || result;

      if (!updatedDoc) {
        throw new NotFoundException('Không tìm thấy thông báo để cập nhật');
      }

      if (shouldSendEmail) {
        await this.sendNotificationEmails(payload.title, payload.content, payload, file);
      }

      return {
        ...updatedDoc,
        _id: updatedDoc._id.toString()
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi khi cập nhật thông báo');
    }
  }

  async delete(id: string) {
    try {
      const { db } = await connectToDatabase();
      let queryId: any;
      try { queryId = new ObjectId(id); } catch { queryId = id; }

      const result = await db.collection('Announcements').deleteOne({
        $or: [{ _id: queryId }, { _id: id as any }]
      });

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
      const targetMode = payload.emailTarget || 'ALL';
      const emailSet = new Set<string>();

      if (targetMode === 'ALL') {
        // Lấy toàn bộ từ cả Personnel và Users
        const [personnelList, usersList] = await Promise.all([
          db.collection('Personnel').find({}, { projection: { email: 1, student_id: 1, mssv: 1 } }).toArray(),
          db.collection('Users').find({}, { projection: { email: 1, student_id: 1 } }).toArray(),
        ]);

        [...personnelList, ...usersList].forEach((u: any) => {
          const email = u.email || (u.student_id || u.mssv ? `${u.student_id || u.mssv}@gm.uit.edu.vn` : null);
          if (email && String(email).includes('@')) {
            emailSet.add(String(email).trim().toLowerCase());
          }
        });
      } else {
        // Phạm vi cụ thể: BY_INTAKE, BY_BRANCH, SPECIFIC
        // 1. Ưu tiên lấy danh sách receiverEmails do FE đã lọc chính xác
        const directEmails = this.parseArrayField(payload.receiverEmails);
        directEmails.forEach(e => {
          if (e.includes('@')) emailSet.add(e.toLowerCase());
        });

        // 2. Truy vấn bổ sung theo receiverIds từ cả 2 collection Personnel và Users (đề phòng thiếu trường email trên FE)
        const receiverIds = this.parseArrayField(payload.receiverIds);
        if (receiverIds.length > 0) {
          const idFilters: any[] = [];
          receiverIds.forEach(id => {
            idFilters.push(id);
            if (ObjectId.isValid(id)) {
              idFilters.push(new ObjectId(id));
            }
          });

          const [matchedPersonnel, matchedUsers] = await Promise.all([
            db.collection('Personnel').find({
              $or: [{ _id: { $in: idFilters } }, { student_id: { $in: receiverIds } }, { mssv: { $in: receiverIds } }]
            }).toArray(),
            db.collection('Users').find({
              $or: [{ _id: { $in: idFilters } }, { student_id: { $in: receiverIds } }]
            }).toArray(),
          ]);

          [...matchedPersonnel, ...matchedUsers].forEach((u: any) => {
            const email = u.email || (u.student_id || u.mssv ? `${u.student_id || u.mssv}@gm.uit.edu.vn` : null);
            if (email && String(email).includes('@')) {
              emailSet.add(String(email).trim().toLowerCase());
            }
          });
        }

        // 3. Nếu vẫn trống (trường hợp gọi API trực tiếp không truyền receiverIds), tự lọc theo targetIntakes / targetBranches
        if (emailSet.size === 0 && (targetMode === 'BY_INTAKE' || targetMode === 'BY_BRANCH')) {
          const allPersonnel = await db.collection('Personnel').find().toArray();
          const targetIntakes = this.parseArrayField(payload.targetIntakes);
          const targetBranches = this.parseArrayField(payload.targetBranches).map(b => b.toLowerCase());

          allPersonnel.forEach((u: any) => {
            const isMatch =
              (targetMode === 'BY_INTAKE' && targetIntakes.includes(this.extractIntake(u))) ||
              (targetMode === 'BY_BRANCH' && targetBranches.includes(this.extractBranch(u).toLowerCase()));

            if (isMatch) {
              const email = u.email || (u.student_id || u.mssv ? `${u.student_id || u.mssv}@gm.uit.edu.vn` : null);
              if (email && String(email).includes('@')) {
                emailSet.add(String(email).trim().toLowerCase());
              }
            }
          });
        }
      }

      const emailList = Array.from(emailSet);

      if (emailList.length === 0) {
        console.log(`Không có email nào thỏa mãn phạm vi [${targetMode}] để gửi.`);
        return;
      }

      console.log(`Bắt đầu gửi mail phạm vi [${targetMode}] tới ${emailList.length} địa chỉ...`);

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
        content: file.buffer,
      }] : [];

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
          <div style="background-color: #0054a5; padding: 24px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">Đoàn TNCS Hồ Chí Minh khoa Công nghệ Phần mềm</h2>
          </div>
          <div style="padding: 32px; background-color: #ffffff;">
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

      // Dùng bcc khi gửi nhiều người để bảo mật danh sách email của đoàn viên/sinh viên
      const mailOptions = {
        from: `"Đoàn khoa Công nghệ Phần mềm (ĐH CNTT - ĐHQG-TPHCM)" <${mailUser}>`,
        to: emailList.length === 1 ? emailList[0] : mailUser,
        bcc: emailList.length > 1 ? emailList.join(',') : undefined,
        subject: `[THÔNG BÁO] ${title}`,
        html: htmlContent,
        attachments: attachments
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Tiến trình gửi mail hoàn tất. MessageId:', info.messageId);

    } catch (error) {
      console.error('Lỗi hệ thống khi gửi Gmail:', error);
    }
  }
}