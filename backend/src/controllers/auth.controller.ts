import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sequelize } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { insertQuery, selectQuery } from '../utils/dbHelpers';

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password, role, phone, address } = req.body;

  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'Ad, email, şifre ve rol zorunludur' });
    return;
  }

  const validRoles = ['hayvanci', 'sucukcu', 'market'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: 'Geçersiz rol. hayvanci, sucukcu veya market olmalı.' });
    return;
  }

  try {
    const existing = await selectQuery<{ id: number }>(
      sequelize,
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      res.status(409).json({ error: 'Bu email zaten kayıtlı' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userId = await insertQuery(
      sequelize,
      'INSERT INTO users (name, email, password, role, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, phone || null, address || null]
    );
    const token = generateToken(userId, email, role);

    res.status(201).json({
      message: 'Kayıt başarılı',
      token,
      user: { id: userId, name, email, role },
    });
  } catch (error) {
    res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email ve şifre zorunludur' });
    return;
  }

  try {
    const users = await selectQuery<{ id: number; name: string; email: string; password: string; role: string }>(
      sequelize,
      'SELECT id, name, email, password, role FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    if (users.length === 0) {
      res.status(401).json({ error: 'Email veya şifre hatalı' });
      return;
    }

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      res.status(401).json({ error: 'Email veya şifre hatalı' });
      return;
    }

    const token = generateToken(user.id, user.email, user.role);

    res.json({
      message: 'Giriş başarılı',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ error: 'Giriş sırasında hata oluştu' });
  }
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const users = await selectQuery(
      sequelize,
      'SELECT id, name, email, role, phone, address, created_at FROM users WHERE id = ?',
      [req.user!.id]
    );

    if (users.length === 0) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }

    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: 'Kullanıcı bilgisi alınamadı' });
  }
}

function generateToken(id: number, email: string, role: string): string {
  return jwt.sign(
    { id, email, role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
}
