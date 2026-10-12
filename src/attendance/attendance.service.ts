import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';
import * as jwt from 'jsonwebtoken';
import { CreateAttendanceDto, UpdateAttendanceDto, CheckInRecordDto } from './attendance.dto';

@Injectable()
export class AttendanceService {
  private collectionName = 'Attendance';

  private resolveUserInfo(req: any, fallbackId?: string): { userId: string; role: string; username: string } {
    let userId = fallbackId ? String(fallbackId).trim() : '';
    let role = '';
    let username = '';

    const headerId = req?.headers?.['x-user-id'];
    if (headerId && !userId) userId = String(headerId).trim();

    const authHeader = req?.headers?.['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded: any = jwt.decode(token);
        if (decoded) {
          if (!userId) userId = String(decoded._id || decoded.user_id || decoded.id || '');
          role = String(decoded.role || '');
          username = String(decoded.username || '');
        }
      } catch (e) {}
    }

    return { userId, role, username };
  }

  private buildIdFilter(id: string): any {
    if (ObjectId.isValid(id)) {
      return { _id: new ObjectId(id) };
    }
    return { _id: id };
  }

  async findAll(queryUserId?: string, req?: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId, role, username } = this.resolveUserInfo(req, queryUserId);

      let filter: any = {};

      // Nếu yêu cầu lọc theo user và không phải admin: chỉ lấy phiếu do mình tạo HOẶC được chia sẻ
      if (userId && role !== 'admin' && username !== 'admin') {
        const uId = userId.toLowerCase();
        const uName = username.toLowerCase();

        filter = {
          $or: [
            { created_by: userId },
            { created_by: uId },
            { created_by: { $exists: false } },
            { created_by: '' },
            { 'shared_users.user_id': userId },
            { 'shared_users.user_id': uId },
            { 'shared_users.username': username },
            { 'shared_users.username': uName },
          ],
        };
      }

      return await db
        .collection<any>(this.collectionName)
        .find(filter)
        .sort({ created_at: -1 })
        .toArray();
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi tải danh sách buổi điểm danh');
    }
  }

  async findOne(id: string) {
    try {
      const { db } = await connectToDatabase();
      const targetQuery = this.buildIdFilter(id);

      const session = await db.collection<any>(this.collectionName).findOne(targetQuery);
      if (!session) {
        throw new NotFoundException('Không tìm thấy phiên điểm danh');
      }
      return session;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi khi lấy chi tiết buổi điểm danh');
    }
  }

  async create(dto: CreateAttendanceDto, req: any) {
    try {
      const { db } = await connectToDatabase();
      const { userId } = this.resolveUserInfo(req, dto.created_by);

      const count = await db.collection<any>(this.collectionName).countDocuments();
      const code = `DD-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

      const newSession = {
        title: dto.title,
        code,
        date: dto.date || new Date().toISOString().split('T')[0],
        start_time: dto.start_time || '07:30',
        end_time: dto.end_time || '11:30',
        location: dto.location || 'Văn phòng Đoàn khoa',
        description: dto.description || '',
        target_intakes: dto.target_intakes || [],
        is_locked: Boolean(dto.is_locked),
        records: [],
        created_by: dto.created_by || userId,
        shared_users: dto.shared_users || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await db.collection<any>(this.collectionName).insertOne(newSession);
      return { ...newSession, _id: result.insertedId };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi tạo phiên điểm danh');
    }
  }

  async update(id: string, dto: UpdateAttendanceDto) {
    try {
      const { db } = await connectToDatabase();
      const targetQuery = this.buildIdFilter(id);

      const existing = await db.collection<any>(this.collectionName).findOne(targetQuery);
      if (!existing) {
        throw new NotFoundException('Không tìm thấy phiên điểm danh');
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.date !== undefined) updateData.date = dto.date;
      if (dto.start_time !== undefined) updateData.start_time = dto.start_time;
      if (dto.end_time !== undefined) updateData.end_time = dto.end_time;
      if (dto.location !== undefined) updateData.location = dto.location;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.target_intakes !== undefined) updateData.target_intakes = dto.target_intakes;
      if (dto.is_locked !== undefined) updateData.is_locked = Boolean(dto.is_locked);
      if (dto.records !== undefined) updateData.records = dto.records;
      if (dto.shared_users !== undefined) updateData.shared_users = dto.shared_users;

      await db.collection<any>(this.collectionName).updateOne(targetQuery, { $set: updateData });
      return await db.collection<any>(this.collectionName).findOne(targetQuery);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi khi cập nhật buổi điểm danh');
    }
  }

  async remove(id: string) {
    try {
      const { db } = await connectToDatabase();
      const targetQuery = this.buildIdFilter(id);

      const result = await db.collection<any>(this.collectionName).deleteOne(targetQuery);
      if (result.deletedCount === 0) {
        throw new NotFoundException('Không tìm thấy phiên điểm danh để xóa');
      }
      return { message: 'Xóa phiên điểm danh thành công' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Lỗi khi xóa phiên điểm danh');
    }
  }

  async checkIn(id: string, recordDto: CheckInRecordDto) {
    try {
      const { db } = await connectToDatabase();
      const targetQuery = this.buildIdFilter(id);

      const session = await db.collection<any>(this.collectionName).findOne(targetQuery);
      if (!session) {
        throw new NotFoundException('Không tìm thấy phiên điểm danh');
      }
      if (session.is_locked) {
        throw new BadRequestException('Buổi điểm danh này đã bị khóa!');
      }

      const sid = String(recordDto.student_id).trim();

      let studentName = recordDto.full_name || '';
      let studentClass = recordDto.class_name || '';

      if (!studentName || !studentClass) {
        const personnel = await db.collection<any>('Personnel').findOne({
          $or: [{ student_id: sid }, { mssv: sid }]
        });
        if (personnel) {
          studentName = studentName || personnel.full_name || personnel.name || '';
          studentClass = studentClass || personnel.class || personnel.chi_doan || '';
        } else {
          const user = await db.collection<any>('Users').findOne({ student_id: sid });
          if (user) {
            studentName = studentName || user.full_name || '';
            studentClass = studentClass || user.class || '';
          }
        }
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

      const currentRecords: any[] = Array.isArray(session.records) ? session.records : [];
      const existingIdx = currentRecords.findIndex(r => String(r.student_id).trim() === sid);

      const recordItem = {
        student_id: sid,
        full_name: studentName || 'Chưa cập nhật',
        class_name: studentClass || '',
        status: recordDto.status || 'present',
        checkin_time: timeStr,
        note: recordDto.note || ''
      };

      if (existingIdx !== -1) {
        currentRecords[existingIdx] = { ...currentRecords[existingIdx], ...recordItem };
      } else {
        currentRecords.unshift(recordItem);
      }

      await db.collection<any>(this.collectionName).updateOne(targetQuery, {
        $set: { records: currentRecords, updated_at: now.toISOString() }
      });

      return {
        message: 'Điểm danh thành công',
        record: recordItem,
        total: currentRecords.length
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Lỗi trong quá trình điểm danh');
    }
  }
}