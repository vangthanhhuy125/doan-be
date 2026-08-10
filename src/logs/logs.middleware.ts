import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LogsService } from './logs.service';

@Injectable()
export class LogsMiddleware implements NestMiddleware {
  constructor(private readonly logsService: LogsService) {}

  // Hàm tự giải mã JWT Payload từ Token
  private decodeJwtToken(authHeader: string | undefined): any {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    try {
      const token = authHeader.split(' ')[1];
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    // 🟢 1. Đọc token từ Header Authorization
    const authHeader = req.headers['authorization'];
    const decodedToken = this.decodeJwtToken(authHeader);

    // 🟢 2. Lấy Tên và ID tài khoản thực hiện
    let userId =
      (req.headers['x-user-id'] as string) ||
      decodedToken?.sub ||
      decodedToken?.userId ||
      decodedToken?._id ||
      decodedToken?.id ||
      'system';

    let userName =
      (req.headers['x-user-name'] as string) ||
      (req.headers['x-user-email'] as string) ||
      decodedToken?.username ||
      decodedToken?.email ||
      decodedToken?.full_name ||
      decodedToken?.name ||
      userId;

    // 🟢 3. Chỉ ghi log khi thực hiện các thao tác thay đổi dữ liệu (POST, PUT, DELETE, PATCH)
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const action = `${req.method} ${req.originalUrl}`;
      const url = req.originalUrl.toLowerCase();

      // Phân loại tài nguyên tự động
      let resource = 'HỆ THỐNG';
      if (
        url.includes('party') ||
        url.includes('doan-vien') ||
        url.includes('dang-vien') ||
        url.includes('party-members')
      ) {
        resource = 'CÔNG TÁC ĐOÀN - ĐẢNG';
      } else if (url.includes('surveys')) {
        resource = 'KHẢO SÁT';
      } else if (url.includes('programs')) {
        resource = 'CHƯƠNG TRÌNH';
      } else if (
        url.includes('users') ||
        url.includes('roles') ||
        url.includes('system-config')
      ) {
        resource = 'TÀI KHOẢN';
      } else if (url.includes('registration')) {
        resource = 'PHIẾU ĐĂNG KÝ';
      }

      const details = {
        ip: req.ip || req.socket.remoteAddress,
        body: req.body,
        userName,
      };

      this.logsService
        .createLog(userId, action, resource, details, userName)
        .catch((err) => console.error('Lỗi khi lưu system log:', err));
    }

    next();
  }
}