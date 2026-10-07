import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Local development uses a process-scoped secret when none is configured.
// Tokens intentionally expire across a dev-server restart. Production must configure a secret.
const DEVELOPMENT_JWT_SECRET = process.env.NODE_ENV === 'production'
  ? undefined
  : randomBytes(32).toString('hex');

export function assertAuthConfiguration() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured when NODE_ENV=production');
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters when configured');
  }
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length < 16) {
    throw new Error('ADMIN_PASSWORD must contain at least 16 characters when configured');
  }
}

function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must contain at least 32 characters in production');
  }
  return DEVELOPMENT_JWT_SECRET!;
}

export interface UserPayload {
  id: number;
  username: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: UserPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '24h' });
}

export function verifyToken(token: string): UserPayload {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded === 'string' || typeof decoded.id !== 'number' || typeof decoded.role !== 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as UserPayload;
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorizeRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized role' });
    }
    next();
  };
}
