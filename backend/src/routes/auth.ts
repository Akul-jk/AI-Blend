import { Router } from 'express';
import { getDb } from '../db';
import { hashPassword, comparePassword, generateToken, authenticateToken } from '../auth';
import { createHash, randomInt, timingSafeEqual } from 'crypto';

const router = Router();

const sendSuccess = (res: any, data: any, message = 'Success', status = 200) => {
  res.status(status).json({ success: true, message, data });
};
const sendError = (res: any, message: string, error: any = {}, status = 500) => {
  res.status(status).json({ success: false, message, error });
};

const recoveryTokens = new Map<string, { digest: string; expiresAt: number; attempts: number }>();
const recoveryRequests = new Map<string, number>();

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return sendError(res, 'Missing required fields', {}, 400);
  }
  if (typeof password !== 'string' || password.length < 10) {
    return sendError(res, 'Password must contain at least 10 characters', {}, 400);
  }
  try {
    const db = getDb();
    const hashedPassword = await hashPassword(password);
    const result = await db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, 'user']
    );
    const user = { id: result.lastID!, username, email, role: 'user' };
    const token = generateToken(user);
    sendSuccess(res, { token, user }, 'Registration successful', 201);
  } catch (error: any) {
    if (error.message.includes('UNIQUE')) {
      return sendError(res, 'Username or email already exists', {}, 400);
    }
    sendError(res, 'Server error');
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return sendError(res, 'Missing username or password', {}, 400);
  }
  try {
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return sendError(res, 'Invalid credentials', {}, 400);
    }
    const isMatch = await comparePassword(password, user.password);
    const isKnownLegacyDefault = user.role === 'admin' && await comparePassword('admin123', user.password);
    if (!isMatch || isKnownLegacyDefault) {
      return sendError(res, 'Invalid credentials', {}, 400);
    }
    const payload = { id: user.id, username: user.username, email: user.email, role: user.role };
    const token = generateToken(payload);
    sendSuccess(res, { token, user: payload }, 'Login successful');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return sendError(res, 'Missing email', {}, 400);
  }
  try {
    const db = getDb();
    for (const [key, recovery] of recoveryTokens) {
      if (recovery.expiresAt < Date.now()) recoveryTokens.delete(key);
    }
    for (const [key, requestedAt] of recoveryRequests) {
      if (Date.now() - requestedAt > 60 * 60_000) recoveryRequests.delete(key);
    }
    const deliveryUrl = process.env.PASSWORD_RESET_WEBHOOK_URL;
    if (!deliveryUrl) return sendError(res, 'Password recovery delivery is not configured.', {}, 503);
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    const now = Date.now();
    const normalizedEmail = String(email).trim().toLowerCase();
    const lastRequest = recoveryRequests.get(normalizedEmail) || 0;
    if (now - lastRequest < 60_000) {
      return sendError(res, 'Please wait before requesting another recovery code.', {}, 429);
    }
    recoveryRequests.set(normalizedEmail, now);
    if (!user) return sendSuccess(res, {}, 'If the account exists, recovery instructions will be sent.');

    // Do not create or expose a code unless an explicitly configured delivery service accepts it.
    const token = String(randomInt(100000, 1000000));
    const response = await fetch(deliveryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, username: user.username, code: token })
    });
    if (!response.ok) return sendError(res, 'Password recovery delivery failed.', {}, 502);
    recoveryTokens.set(user.username.toLowerCase(), {
      digest: createHash('sha256').update(token).digest('hex'),
      expiresAt: now + 10 * 60_000,
      attempts: 0
    });
    sendSuccess(res, {}, 'If the account exists, recovery instructions will be sent.');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.post('/reset-password', async (req, res) => {
  const { username, token, password } = req.body;
  if (!username || !token || !password) {
    return sendError(res, 'Missing required fields', {}, 400);
  }
  if (typeof password !== 'string' || password.length < 10) {
    return sendError(res, 'Password must contain at least 10 characters', {}, 400);
  }
  try {
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return sendError(res, 'User not found', {}, 400);
    }
    const key = username.toLowerCase();
    const recovery = recoveryTokens.get(key);
    if (!recovery || recovery.expiresAt < Date.now() || recovery.attempts >= 5) {
      recoveryTokens.delete(key);
      return sendError(res, 'Invalid or expired verification code', {}, 400);
    }
    recovery.attempts += 1;
    const submittedDigest = createHash('sha256').update(String(token)).digest();
    const expectedDigest = Buffer.from(recovery.digest, 'hex');
    if (submittedDigest.length !== expectedDigest.length || !timingSafeEqual(submittedDigest, expectedDigest)) {
      if (recovery.attempts >= 5) recoveryTokens.delete(key);
      return sendError(res, 'Invalid or expired verification code', {}, 400);
    }
    const hashedPassword = await hashPassword(password);
    await db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
    recoveryTokens.delete(key);
    sendSuccess(res, {}, 'Password reset successfully');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.post('/refresh', authenticateToken, (req: any, res) => {
  const token = generateToken(req.user);
  sendSuccess(res, { token }, 'Token refreshed');
});

router.post('/logout', authenticateToken, (req, res) => {
  sendSuccess(res, {}, 'Logged out successfully');
});

export default router;
