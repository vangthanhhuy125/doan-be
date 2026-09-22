import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import * as ExcelJS from 'exceljs';

@Injectable()
export class YouthUnionService {
  private unionCollection = 'YouthUnion';
  private lchCollection = 'FacultyLCH';

  async getBCHData() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection(this.unionCollection).aggregate([
        {
          $addFields: {
            user_id_obj: {
              $convert: {
                input: "$user_id",
                to: "objectId",
                onError: null,
                onNull: null
              }
            }
          }
        },
        {
          $lookup: {
            from: 'Users',
            localField: 'user_id_obj',
            foreignField: '_id',
            as: 'user_info'
          }
        },
        {
          $unwind: {
            path: '$user_info',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
            role: 1,
            isBanThuongVu: 1,
            order: 1,
            user_id: 1,
            full_name: { $ifNull: ['$user_info.full_name', '$full_name'] },
            avatar: { $ifNull: ['$user_info.image_url', '$avatar'] }
          }
        },
        { $sort: { order: 1 } }
      ]).toArray();
    } catch (error) {
      throw new InternalServerErrorException('Không thể lấy dữ liệu Ban Chấp hành Đoàn khoa');
    }
  }

  async updateBCH(data: any[]) {
    try {
      const { db } = await connectToDatabase();
      const currentData = await db.collection(this.unionCollection).find({}).toArray();

      const payload = data.map(item => ({
        user_id: item.user_id || null,
        role: item.role,
        isBanThuongVu: item.isBanThuongVu ?? false,
        full_name: item.name || item.full_name || '',
        avatar: item.avatar || null,
        order: item.order
      }));

      const isSame = JSON.stringify(currentData.map(({ _id, ...rest }) => rest)) === JSON.stringify(payload);
      if (isSame) return { message: 'Dữ liệu không thay đổi' };

      await db.collection(this.unionCollection).deleteMany({});
      if (payload.length === 0) return { message: 'Đã xóa danh sách' };

      return await db.collection(this.unionCollection).insertMany(payload);
    } catch (error) {
      throw new InternalServerErrorException('Cập nhật nhân sự Đoàn khoa thất bại');
    }
  }

  async getLCHData() {
    try {
      const { db } = await connectToDatabase();
      return await db.collection(this.lchCollection).aggregate([
        {
          $addFields: {
            user_id_obj: {
              $convert: {
                input: "$user_id",
                to: "objectId",
                onError: null,
                onNull: null
              }
            }
          }
        },
        {
          $lookup: {
            from: 'Users',
            localField: 'user_id_obj',
            foreignField: '_id',
            as: 'user_info'
          }
        },
        {
          $unwind: {
            path: '$user_info',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
            role: 1,
            isThuongTruc: 1,
            order: 1,
            user_id: 1,
            full_name: { $ifNull: ['$user_info.full_name', '$full_name'] },
            avatar: { $ifNull: ['$user_info.image_url', '$avatar'] }
          }
        },
        { $sort: { order: 1 } }
      ]).toArray();
    } catch (error) {
      throw new InternalServerErrorException('Không thể lấy dữ liệu BCH Liên Chi hội');
    }
  }

  async updateLCH(data: any[]) {
    try {
      const { db } = await connectToDatabase();
      const currentData = await db.collection(this.lchCollection).find({}).toArray();

      const payload = data.map(item => ({
        user_id: item.user_id || null,
        role: item.role,
        isThuongTruc: item.isThuongTruc ?? false,
        full_name: item.name || item.full_name || '',
        avatar: item.avatar || null,
        order: item.order
      }));

      const isSame = JSON.stringify(currentData.map(({ _id, ...rest }) => rest)) === JSON.stringify(payload);
      if (isSame) return { message: 'Dữ liệu không thay đổi' };

      await db.collection(this.lchCollection).deleteMany({});
      if (payload.length === 0) return { message: 'Đã xóa danh sách' };

      return await db.collection(this.lchCollection).insertMany(payload);
    } catch (error) {
      throw new InternalServerErrorException('Cập nhật nhân sự Liên Chi hội thất bại');
    }
  }

  async generateExcel(scope: string = 'DOAN'): Promise<Buffer> {
    const { db } = await connectToDatabase();
    const isDoan = scope.toUpperCase() === 'DOAN';

    const allUsers = await db.collection('Users').find({}).toArray();
    const userByName = new Map<string, any>();
    const userById = new Map<string, any>();

    allUsers.forEach((u: any) => {
      if (u._id) userById.set(u._id.toString(), u);
      if (u.full_name) userByName.set(u.full_name.trim().toLowerCase(), u);
    });

    const bchCollection = isDoan ? this.unionCollection : this.lchCollection;
    const bchRaw = await db.collection(bchCollection).find({}).sort({ order: 1 }).toArray();

    const orgFilter = isDoan
      ? { $or: [{ scope: 'DOAN' }, { scope: { $exists: false }, chiHoiTruong: {$exists: false } }] }
      : { scope: 'HOI' };
    const orgsRaw = await db.collection('Organizations').find(orgFilter).toArray();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(isDoan ? 'Đoàn Khoa' : 'Liên Chi hội', {
      views: [{ showGridLines: true }],
    });

    worksheet.columns = [
      { width: 9 },
      { width: 14 },
      { width: 34 },
      { width: 24 },
      { width: 18 },
      { width: 18 },
      { width: 32 },
    ];

    const formatDate = (val: any): string => {
      if (!val) return '';
      if (typeof val === 'string') {
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)) return val;
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }
        return val;
      }
      if (val instanceof Date && !isNaN(val.getTime())) {
        return `${String(val.getDate()).padStart(2, '0')}/${String(val.getMonth() + 1).padStart(2, '0')}/${val.getFullYear()}`;
      }
      return String(val);
    };

    const formatPhone = (val: any): string => {
      if (!val) return '';
      let str = String(val).trim();
      if (str.length === 9 && !str.startsWith('0')) str = '0' + str;
      return str;
    };

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };

    const dataFillColor = isDoan ? 'FFD9D9D9' : 'FFFFF2CC';

    let currentRow = 2;

    const renderTable = (title: string, memberList: any[]) => {
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      const titleCell = worksheet.getCell(`A${currentRow}`);
      titleCell.value = title;
      titleCell.font = { name: 'Cambria', size: 14, bold: true };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB6D7A8' } };
      for (let c = 1; c <= 7; c++) {
        worksheet.getCell(currentRow, c).border = thinBorder;
      }
      worksheet.getRow(currentRow).height = 24;
      currentRow++;

      const headers = ['STT', 'MSSV', 'Họ và tên', 'Chức vụ', 'Số điện thoại', 'Ngày sinh', 'Gmail'];
      const headerRow = worksheet.getRow(currentRow);
      headers.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Cambria', size: 14, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC9DAF8' } };
        cell.border = thinBorder;
      });
      headerRow.height = 22;
      currentRow++;

      memberList.forEach((m, idx) => {
        const row = worksheet.getRow(currentRow);
        const stt = idx + 1;
        const vals = [stt, m.mssv || '', m.fullName || '', m.role || '', m.phone || '', m.birthday || '', m.email || ''];

        vals.forEach((v, cIdx) => {
          const cell = row.getCell(cIdx + 1);
          cell.value = v;
          cell.font = { name: 'Cambria', size: 13, bold: idx === 0 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dataFillColor } };
          cell.border = thinBorder;
          if (cIdx === 0 || cIdx === 1 || cIdx === 4 || cIdx === 5 || cIdx === 6) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });
        row.height = 20;
        currentRow++;
      });

      currentRow += 2;
    };

    const bchList = bchRaw.map((item: any) => {
      let u = item.user_id ? userById.get(item.user_id.toString()) : null;
      if (!u && item.full_name) u = userByName.get(item.full_name.trim().toLowerCase());
      return {
        mssv: u?.student_id || '',
        fullName: item.full_name || u?.full_name || '',
        role: item.role || '',
        phone: formatPhone(u?.phone),
        birthday: formatDate(u?.birthday),
        email: u?.email || '',
      };
    });

    const bchTitle = isDoan
      ? 'BCH ĐOÀN KHOA CÔNG NGHỆ PHẦN MỀM'
      : 'BCH LIÊN CHI HỘI CÔNG NGHỆ PHẦN MỀM';
    renderTable(bchTitle, bchList);

    orgsRaw.forEach((unit: any) => {
      const unitName = unit.ten || unit.group_name || 'Đơn vị trực thuộc';
      const isCLB = unit.unitType === 'TAPTHE' || unitName.toUpperCase().includes('CLB');
      const unitMembers: any[] = [];

      if (isCLB) {
        (unit.member || []).forEach((m: any) => {
          if (!m.name) return;
          const u = userByName.get(m.name.trim().toLowerCase());
          unitMembers.push({
            mssv: u?.student_id || '',
            fullName: m.name,
            role: m.role || 'Thành viên',
            phone: formatPhone(u?.phone),
            birthday: formatDate(u?.birthday),
            email: u?.email || '',
          });
        });
      } else {
        if (isDoan) {
          if (unit.biThu) {
            const u = userByName.get(unit.biThu.trim().toLowerCase());
            unitMembers.push({
              mssv: u?.student_id || '',
              fullName: unit.biThu,
              role: 'Bí thư',
              phone: formatPhone(u?.phone),
              birthday: formatDate(u?.birthday),
              email: u?.email || '',
            });
          }
          if (unit.phoBiThu) {
            const u = userByName.get(unit.phoBiThu.trim().toLowerCase());
            unitMembers.push({
              mssv: u?.student_id || '',
              fullName: unit.phoBiThu,
              role: 'Phó Bí thư',
              phone: formatPhone(u?.phone),
              birthday: formatDate(u?.birthday),
              email: u?.email || '',
            });
          }
        } else {
          if (unit.chiHoiTruong) {
            const u = userByName.get(unit.chiHoiTruong.trim().toLowerCase());
            unitMembers.push({
              mssv: u?.student_id || '',
              fullName: unit.chiHoiTruong,
              role: 'Chi hội trưởng',
              phone: formatPhone(u?.phone),
              birthday: formatDate(u?.birthday),
              email: u?.email || '',
            });
          }
          if (unit.chiHoiPho) {
            const u = userByName.get(unit.chiHoiPho.trim().toLowerCase());
            unitMembers.push({
              mssv: u?.student_id || '',
              fullName: unit.chiHoiPho,
              role: 'Chi hội phó',
              phone: formatPhone(u?.phone),
              birthday: formatDate(u?.birthday),
              email: u?.email || '',
            });
          }
        }

        (unit.uvbch || []).forEach((uvName: string) => {
          if (!uvName) return;
          const u = userByName.get(uvName.trim().toLowerCase());
          unitMembers.push({
            mssv: u?.student_id || '',
            fullName: uvName,
            role: isDoan ? 'UV BCH' : 'Ủy viên',
            phone: formatPhone(u?.phone),
            birthday: formatDate(u?.birthday),
            email: u?.email || '',
          });
        });
      }

      if (unitMembers.length > 0) {
        renderTable(unitName, unitMembers);
      }
    });

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }
}