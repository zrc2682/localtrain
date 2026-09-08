import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../prisma/client.js';
import { authMiddleware, requireAdmin, signToken, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const registerSchema = z.object({
  username: z.string().min(2).max(32),
  password: z.string().min(4),
});

router.post('/register', async (req, res) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: '参数错误', details: result.error.format() });
    return;
  }

  const { username, password } = result.data;
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    res.status(409).json({ error: '用户名已存在' });
    return;
  }

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'user',
    },
  });

  const token = signToken({ id: user.id, username: user.username, role: user.role as 'admin' | 'user' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

router.post('/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: '参数错误' });
    return;
  }

  const { username, password } = result.data;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const token = signToken({ id: user.id, username: user.username, role: user.role as 'admin' | 'user' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, username: true, role: true, createdAt: true },
  });
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json(user);
});

// 一键切换角色（本地使用）
router.post('/switch-role', authMiddleware, async (req: AuthRequest, res) => {
  const newRole = req.user!.role === 'admin' ? 'user' : 'admin';
  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: { role: newRole },
    select: { id: true, username: true, role: true, createdAt: true },
  });
  const token = signToken({ id: updated.id, username: updated.username, role: updated.role as 'admin' | 'user' });
  res.json({ token, user: updated, role: newRole });
});

export default router;
