import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { prisma } from '../prisma/client.js';
import { authMiddleware, requireAdmin, type AuthRequest } from '../middleware/auth.js';
import { dockerService } from '../services/docker.js';

const router = Router();

const SCORE_MAP: Record<string, number> = { easy: 100, medium: 200, hard: 300, expert: 400 };

function decodeFilename(name: string): string {
  // multipart 中的文件名通常被 Node HTTP 解析器以 latin1 解码，
  // 这里还原为 UTF-8，避免中文文件名乱码。
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return decoded || name;
  } catch {
    return name;
  }
}

function param(req: AuthRequest, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

async function assertChallengeVisible(req: AuthRequest, challengeId: string): Promise<boolean> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { id: true, visible: true },
  });
  if (!challenge) return false;
  const isAdmin = req.user!.role === 'admin';
  return isAdmin || challenge.visible;
}

const challengeSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default('misc'),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']).default('easy'),
  contest: z.string().default(''),
  image: z.string().default(''),
  port: z.coerce.number().int().min(1).max(65535).default(80),
  visible: z.preprocess(
    (val) => {
      if (typeof val === 'boolean') return val;
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    },
    z.boolean().default(true)
  ),
  note: z.string().default(''),
  flags: z.union([z.string().min(1), z.array(z.string().min(1)).min(1, '至少需要一个 flag')]).transform((v) => (Array.isArray(v) ? v : [v])),
});

const hintSchema = z.object({
  level: z.number().int().min(1),
  label: z.string().min(1),
  content: z.string().min(1),
  scorePenalty: z.number().int().min(0).default(0),
});

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// 当前用户容器列表（必须放在 /:id 之前，否则会被当成 challenge id）
router.get('/containers', authMiddleware, async (req: AuthRequest, res) => {
  const isAdmin = req.user!.role === 'admin';
  const statuses = await dockerService.listUserContainers(req.user!.id);
  const filtered = isAdmin ? statuses : statuses.filter((s) => s.challengeVisible !== false);
  res.json(filtered);
});

// 管理员查看所有容器
router.get('/containers/all', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  const statuses = await dockerService.listAllContainers();
  res.json(statuses);
});

// 普通用户 / 管理员 均可查看题目列表
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const isAdmin = req.user!.role === 'admin';
  const challenges = await prisma.challenge.findMany({
    where: isAdmin ? undefined : { visible: true },
    include: {
      hints: { orderBy: { level: 'asc' } },
      flags: { orderBy: { index: 'asc' } },
      attachments: { orderBy: { createdAt: 'asc' } },
      submissions: { where: { userId: req.user!.id } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = challenges.map((c) => ({
    ...c,
    note: isAdmin || c.note ? c.note : undefined,
    flags: isAdmin ? c.flags : undefined,
    flagCount: c.flags.length,
    attachments: isAdmin ? c.attachments : undefined,
    attachmentCount: isAdmin ? c.attachments.length : c.attachments.filter((a) => a.visibleToUser).length,
    solved: c.submissions.some((s) => s.isCorrect),
    submissions: undefined,
  }));

  res.json(result);
});

// 创建题目（管理员）
router.post('/', authMiddleware, requireAdmin, upload.array('attachments', 10), async (req: AuthRequest, res) => {
  const result = challengeSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: '参数错误', details: result.error.format() });
    return;
  }

  const { flags, ...data } = result.data;
  const files = (req.files || []) as Express.Multer.File[];

  const challenge = await prisma.challenge.create({
    data: {
      ...data,
      flags: { create: flags.map((value, index) => ({ value, index })) },
      attachments: {
        create: files.map((f) => ({
          filename: f.filename,
          originalName: decodeFilename(f.originalname),
          path: f.path,
          size: f.size,
          mimeType: f.mimetype,
        })),
      },
    },
    include: { flags: true, attachments: true },
  });

  res.json(challenge);
});

// 更新题目（管理员）
router.put('/:id', authMiddleware, requireAdmin, upload.array('attachments', 10), async (req: AuthRequest, res) => {
  const result = challengeSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: '参数错误' });
    return;
  }

  const { flags, ...data } = result.data;
  const files = (req.files || []) as Express.Multer.File[];

  try {
    const existing = await prisma.challenge.findUnique({
      where: { id: param(req, 'id') },
      include: { flags: true },
    });
    if (!existing) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    // 替换 flags：删除旧的，创建新的
    if (flags && flags.length > 0) {
      await prisma.flag.deleteMany({ where: { challengeId: existing.id } });
      await prisma.flag.createMany({
        data: flags.map((value, index) => ({ challengeId: existing.id, value, index })),
      });
    }

    if (files.length > 0) {
      await prisma.attachment.createMany({
        data: files.map((f) => ({
          challengeId: existing.id,
          filename: f.filename,
          originalName: decodeFilename(f.originalname),
          path: f.path,
          size: f.size,
          mimeType: f.mimetype,
        })),
      });
    }

    const challenge = await prisma.challenge.update({
      where: { id: existing.id },
      data,
      include: { flags: true, attachments: true },
    });

    res.json(challenge);
  } catch {
    res.status(404).json({ error: '题目不存在' });
  }
});

async function deleteChallengeById(challengeId: string): Promise<boolean> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: { attachments: true },
  });
  if (!challenge) return false;

  // 删除附件文件
  for (const att of challenge.attachments) {
    try {
      fs.unlinkSync(att.path);
    } catch {
      // ignore
    }
  }

  // 删除所有用户与该题目相关的解题记录
  await prisma.submission.deleteMany({ where: { challengeId: challenge.id } });

  // 停止该题目下所有运行中的容器（DB 记录会随题目级联删除，这里先触发 Docker 清理）
  const activeContainers = await prisma.container.findMany({
    where: { challengeId: challenge.id },
  });
  for (const c of activeContainers) {
    try {
      await dockerService.stopChallenge(c.userId, challenge.id);
    } catch {
      // ignore
    }
  }

  await prisma.challenge.delete({ where: { id: challenge.id } });
  return true;
}

// 删除题目（管理员）
router.delete('/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const ok = await deleteChallengeById(param(req, 'id'));
    if (!ok) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: '题目不存在' });
  }
});

// 批量修改可见性（管理员）
router.post('/batch-visible', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  const parsed = z.object({ ids: z.array(z.string()), visible: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数错误' });
    return;
  }
  try {
    await prisma.challenge.updateMany({
      where: { id: { in: parsed.data.ids } },
      data: { visible: parsed.data.visible },
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || '批量更新失败' });
  }
});

// 批量删除题目（管理员）
router.post('/batch-delete', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  const parsed = z.object({ ids: z.array(z.string()) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数错误' });
    return;
  }
  try {
    let deleted = 0;
    for (const id of parsed.data.ids) {
      if (await deleteChallengeById(id)) deleted++;
    }
    res.json({ success: true, deleted });
  } catch (e: any) {
    res.status(500).json({ error: e.message || '批量删除失败' });
  }
});

// 管理员延长指定容器 1h
router.post('/containers/:containerId/extend', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const status = await dockerService.extendContainerById(param(req, 'containerId'));
    if (!status) {
      res.status(404).json({ error: '容器不存在或已停止' });
      return;
    }
    res.json(status);
  } catch (e: any) {
    res.status(400).json({ error: e.message || '延长失败' });
  }
});

// 获取单题详情（含提示解锁状态）
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const challenge = await prisma.challenge.findUnique({
    where: { id: param(req, 'id') },
    include: {
      hints: { orderBy: { level: 'asc' } },
      flags: { orderBy: { index: 'asc' } },
      attachments: { orderBy: { createdAt: 'asc' } },
      submissions: { where: { userId: req.user!.id } },
    },
  });

  if (!challenge || !(await assertChallengeVisible(req, challenge.id))) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }

  const usedHintIds = new Set(
    (
      await prisma.usedHint.findMany({
        where: { userId: req.user!.id, hintId: { in: challenge.hints.map((h) => h.id) } },
        select: { hintId: true },
      })
    ).map((u) => u.hintId)
  );

  const status = await dockerService.getStatus(req.user!.id, challenge.id);

  const submission = challenge.submissions[0];
  const solvedFlagIndices = (submission?.solvedFlagIndices as number[] | undefined) || [];
  const isAdmin = req.user!.role === 'admin';

  res.json({
    ...challenge,
    note: isAdmin || challenge.note ? challenge.note : undefined,
    hints: challenge.hints.map((h) => ({
      ...h,
      unlocked: usedHintIds.has(h.id),
    })),
    attachments: isAdmin ? challenge.attachments : challenge.attachments.filter((a) => a.visibleToUser),
    flags: isAdmin ? challenge.flags : undefined,
    flagCount: challenge.flags.length,
    solved: submission?.isCorrect || false,
    solvedFlagIndices,
    status,
    submissions: undefined,
  });
});

// 获取题目所有提示（管理员）
router.get('/:id/hints', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  const hints = await prisma.hint.findMany({
    where: { challengeId: param(req, 'id') },
    orderBy: { level: 'asc' },
  });
  res.json(hints);
});

// 添加提示（管理员）
router.post('/:id/hints', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  const result = hintSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: '参数错误' });
    return;
  }

  try {
    const hint = await prisma.hint.create({
      data: { ...result.data, challengeId: param(req, 'id') },
    });
    res.json(hint);
  } catch {
    res.status(404).json({ error: '题目不存在或级别重复' });
  }
});

// 更新提示（管理员）
router.put('/:id/hints/:hintId', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  const result = hintSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: '参数错误' });
    return;
  }

  try {
    const existing = await prisma.hint.findFirst({
      where: { id: param(req, 'hintId'), challengeId: param(req, 'id') },
    });
    if (!existing) {
      res.status(404).json({ error: '提示不存在' });
      return;
    }
    const hint = await prisma.hint.update({
      where: { id: param(req, 'hintId') },
      data: result.data,
    });
    res.json(hint);
  } catch {
    res.status(404).json({ error: '提示不存在' });
  }
});

// 删除提示（管理员）
router.delete('/:id/hints/:hintId', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.hint.findFirst({
      where: { id: param(req, 'hintId'), challengeId: param(req, 'id') },
    });
    if (!existing) {
      res.status(404).json({ error: '提示不存在' });
      return;
    }
    await prisma.hint.delete({ where: { id: param(req, 'hintId') } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: '提示不存在' });
  }
});

// 解锁提示
router.post('/:id/hints/:hintId/unlock', authMiddleware, async (req: AuthRequest, res) => {
  const hint = await prisma.hint.findFirst({
    where: { id: param(req, 'hintId'), challengeId: param(req, 'id') },
  });
  if (!hint || !(await assertChallengeVisible(req, hint.challengeId))) {
    res.status(404).json({ error: '提示不存在' });
    return;
  }
  try {
    await prisma.usedHint.create({
      data: { userId: req.user!.id, hintId: param(req, 'hintId') },
    });
    res.json({ success: true, hint });
  } catch {
    res.status(400).json({ error: '已解锁或提示不存在' });
  }
});

// 启动环境
router.post('/:id/start', authMiddleware, async (req: AuthRequest, res) => {
  const challenge = await prisma.challenge.findUnique({ where: { id: param(req, 'id') } });
  if (!challenge || !(await assertChallengeVisible(req, challenge.id))) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }

  try {
    const status = await dockerService.startChallenge(req.user!.id, challenge.id, challenge.image, challenge.port);
    res.json(status);
  } catch (e: any) {
    res.status(400).json({ error: e.message || '启动失败' });
  }
});

// 停止环境
router.post('/:id/stop', authMiddleware, async (req: AuthRequest, res) => {
  if (!(await assertChallengeVisible(req, param(req, 'id')))) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }
  try {
    const status = await dockerService.stopChallenge(req.user!.id, param(req, 'id'));
    res.json(status ?? { running: false });
  } catch (e: any) {
    res.status(400).json({ error: e.message || '关闭失败' });
  }
});

// 延长 1h
router.post('/:id/extend', authMiddleware, async (req: AuthRequest, res) => {
  if (!(await assertChallengeVisible(req, param(req, 'id')))) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }
  try {
    const status = await dockerService.extendExpiry(req.user!.id, param(req, 'id'));
    if (!status) {
      res.status(404).json({ error: '环境未启动' });
      return;
    }
    res.json(status);
  } catch (e: any) {
    res.status(400).json({ error: e.message || '延长失败' });
  }
});

// 重置题目进度（用于解出后重新做题）
router.post('/:id/reset', authMiddleware, async (req: AuthRequest, res) => {
  const challenge = await prisma.challenge.findUnique({
    where: { id: param(req, 'id') },
    include: { hints: { select: { id: true } } },
  });
  if (!challenge || !(await assertChallengeVisible(req, challenge.id))) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }

  const userId = req.user!.id;
  const hintIds = challenge.hints.map((h) => h.id);

  await prisma.$transaction([
    prisma.submission.upsert({
      where: { userId_challengeId: { userId, challengeId: challenge.id } },
      update: { isCorrect: false, solvedFlagIndices: [], flag: '' },
      create: { userId, challengeId: challenge.id, isCorrect: false, solvedFlagIndices: [], flag: '', solveCount: 0, score: 0 },
    }),
    prisma.usedHint.deleteMany({ where: { userId, hintId: { in: hintIds } } }),
  ]);

  await dockerService.stopChallenge(userId, challenge.id);

  res.json({ success: true, message: '题目已重置' });
});

// 提交 flag（按 index 匹配对应 flag）
router.post('/:id/submit', authMiddleware, async (req: AuthRequest, res) => {
  const parsed = z.object({ index: z.number().int().min(0), flag: z.string() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数错误' });
    return;
  }
  const { index, flag } = parsed.data;
  const challenge = await prisma.challenge.findUnique({
    where: { id: param(req, 'id') },
    include: { flags: { orderBy: { index: 'asc' } } },
  });
  if (!challenge || !(await assertChallengeVisible(req, challenge.id))) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }

  if (index >= challenge.flags.length) {
    res.status(400).json({ error: 'flag 序号超出范围' });
    return;
  }

  const targetFlag = challenge.flags[index];
  const isCorrect = flag.trim() === targetFlag.value;

  if (!isCorrect) {
    res.json({ correct: false, solvedAll: false, message: 'flag 错误' });
    return;
  }

  const existing = await prisma.submission.findUnique({
    where: { userId_challengeId: { userId: req.user!.id, challengeId: challenge.id } },
  });

  const solvedFlagIndices = new Set((existing?.solvedFlagIndices as number[] | undefined) || []);
  solvedFlagIndices.add(index);

  const allIndices = Array.from({ length: challenge.flags.length }, (_, i) => i);
  const solvedAll = allIndices.every((i) => solvedFlagIndices.has(i));

  const now = new Date();
  const isFirstSolve = !existing || existing.solveCount === 0;
  const score = solvedAll && isFirstSolve ? (SCORE_MAP[challenge.difficulty] || 0) : (existing?.score ?? 0);

  await prisma.submission.upsert({
    where: { userId_challengeId: { userId: req.user!.id, challengeId: challenge.id } },
    update: {
      flag: flag.trim(),
      solvedFlagIndices: Array.from(solvedFlagIndices),
      isCorrect: solvedAll,
      ...(solvedAll ? { solveCount: { increment: 1 }, solvedAt: now, ...(isFirstSolve ? { score } : {}) } : {}),
    },
    create: {
      userId: req.user!.id,
      challengeId: challenge.id,
      flag: flag.trim(),
      solvedFlagIndices: Array.from(solvedFlagIndices),
      isCorrect: solvedAll,
      solveCount: solvedAll ? 1 : 0,
      solvedAt: solvedAll ? now : null,
      score: solvedAll ? score : 0,
    },
  });

  res.json({
    correct: true,
    solvedAll,
    score,
    message: solvedAll ? 'flag 正确，题目已完整解出' : 'flag 正确，还有未提交的 flag',
  });
});

// 附件列表
router.get('/:id/attachments', authMiddleware, async (req: AuthRequest, res) => {
  const challenge = await prisma.challenge.findUnique({
    where: { id: param(req, 'id') },
    include: { attachments: { orderBy: { createdAt: 'asc' } } },
  });
  if (!challenge || !(await assertChallengeVisible(req, challenge.id))) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }
  const isAdmin = req.user!.role === 'admin';
  res.json(challenge.attachments.filter((a) => isAdmin || a.visibleToUser));
});

// 附件下载
router.get('/:id/attachments/:attachmentId/download', authMiddleware, async (req: AuthRequest, res) => {
  const isAdmin = req.user!.role === 'admin';
  const attachment = await prisma.attachment.findFirst({
    where: { id: param(req, 'attachmentId'), challengeId: param(req, 'id') },
    include: { challenge: { select: { visible: true } } },
  });
  if (
    !attachment ||
    !(isAdmin || attachment.visibleToUser) ||
    !(await assertChallengeVisible(req, attachment.challengeId))
  ) {
    res.status(404).json({ error: '附件不存在' });
    return;
  }

  if (!fs.existsSync(attachment.path)) {
    res.status(404).json({ error: '附件文件不存在' });
    return;
  }

  const encoded = encodeURIComponent(attachment.originalName);
  res.setHeader('Content-Disposition', `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
  res.setHeader('Content-Type', attachment.mimeType);
  res.sendFile(attachment.path);
});

// 删除附件（管理员）
router.delete('/:id/attachments/:attachmentId', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  const attachment = await prisma.attachment.findFirst({
    where: { id: param(req, 'attachmentId'), challengeId: param(req, 'id') },
  });
  if (!attachment) {
    res.status(404).json({ error: '附件不存在' });
    return;
  }

  try {
    fs.unlinkSync(attachment.path);
  } catch {
    // ignore
  }

  await prisma.attachment.delete({ where: { id: attachment.id } });
  res.json({ success: true });
});

// 重命名附件（管理员）
router.put('/:id/attachments/:attachmentId', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  const parsed = z.object({ originalName: z.string().min(1, '附件名不能为空') }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数错误', details: parsed.error.format() });
    return;
  }

  const attachment = await prisma.attachment.findFirst({
    where: { id: param(req, 'attachmentId'), challengeId: param(req, 'id') },
  });
  if (!attachment) {
    res.status(404).json({ error: '附件不存在' });
    return;
  }

  const updated = await prisma.attachment.update({
    where: { id: attachment.id },
    data: { originalName: decodeFilename(parsed.data.originalName) },
  });
  res.json(updated);
});

// 切换附件对普通用户可见性（管理员）
router.put('/:id/attachments/:attachmentId/visible', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  const parsed = z.object({ visibleToUser: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数错误', details: parsed.error.format() });
    return;
  }

  const attachment = await prisma.attachment.findFirst({
    where: { id: param(req, 'attachmentId'), challengeId: param(req, 'id') },
  });
  if (!attachment) {
    res.status(404).json({ error: '附件不存在' });
    return;
  }

  const updated = await prisma.attachment.update({
    where: { id: attachment.id },
    data: { visibleToUser: parsed.data.visibleToUser },
  });
  res.json(updated);
});

export default router;
