import * as jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'doankhoa.cnpm.uit';
const EXPIRES = process.env.JWT_EXPIRES_IN || '1d';

export const signToken = (payload: object) => {
  // Thêm "as any" để ép kiểu, giúp TypeScript hết báo lỗi "No overload matches this call"
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES as any });
};

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, SECRET);
  } catch (error) {
    return null;
  }
};