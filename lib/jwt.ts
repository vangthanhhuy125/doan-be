import * as jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'doankhoa.cnpm.uit';
const EXPIRES = process.env.JWT_EXPIRES_IN || '1d';

export const signToken = (payload: object) => {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
};

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, SECRET);
  } catch (error) {
    return null;
  }
};