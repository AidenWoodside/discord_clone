import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const BCRYPT_COST_FACTOR = 12;

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
if (!JWT_ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET environment variable is required');
}

export interface JwtPayload {
  userId: string;
  role: string;
  iat: number;
  exp: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST_FACTOR);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: { userId: string; role: string }): string {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
  if (typeof decoded === 'string' || !decoded.userId || !decoded.role) {
    throw new Error('Invalid token payload structure');
  }
  return decoded as JwtPayload;
}
