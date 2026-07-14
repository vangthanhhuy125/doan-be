import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken } from '../lib/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Quyền truy cập bị từ chối. Không tìm thấy mã xác thực.');
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      throw new UnauthorizedException('Mã xác thực không hợp lệ hoặc đã hết hạn.');
    }

    request.user = decoded;
    return true;
  }
}