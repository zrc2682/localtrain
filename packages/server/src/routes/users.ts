import { Router } from 'express';
import { prisma } from '../prisma/client.js';
import { authMiddleware, requireAdmin, type AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, requireAdmin, async (_req: AuthRequest, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  const scoreMap = new Map(
    (
      await prisma.submission.groupBy({
        by: ['userId'],
        where: { solveCount: { gt: 0 }, score: { gt: 0 } },
        _sum: { score: true },
      })
    ).map((s) => [s.userId, s._sum.score || 0]),
  );
  res.json(
    users.map((u) => ({
      ...u,
      totalScore: scoreMap.get(u.id) || 0,
    })),
  );
});

// 当前用户个人主页数据
router.get('/profile', authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, username: true, role: true, createdAt: true },
  });
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  const isAdmin = req.user!.role === 'admin';

  const solvedSubmissions = await prisma.submission.findMany({
    where: { userId: user.id, solveCount: { gt: 0 } },
    include: {
      challenge: {
        select: { id: true, title: true, category: true, difficulty: true, visible: true },
      },
    },
    orderBy: { solvedAt: 'desc' },
  });

  const visibleSubmissions = isAdmin ? solvedSubmissions : solvedSubmissions.filter((s) => s.challenge.visible);

  res.json({
    user,
    solvedCount: visibleSubmissions.reduce((sum, s) => sum + s.solveCount, 0),
    totalScore: visibleSubmissions.reduce((sum, s) => sum + s.score, 0),
    challenges: visibleSubmissions.map((s) => ({
      challenge: s.challenge,
      solveCount: s.solveCount,
      score: s.score,
      solvedAt: s.solvedAt,
    })),
  });
});

// 管理员查看指定用户的解题记录
router.get('/:id/submissions', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  const userId = req.params.id as string;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true, createdAt: true },
  });
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  const solvedSubmissions = await prisma.submission.findMany({
    where: { userId: user.id, solveCount: { gt: 0 } },
    include: {
      challenge: {
        select: { id: true, title: true, category: true, difficulty: true, visible: true },
      },
    },
    orderBy: { solvedAt: 'desc' },
  });

  res.json({
    user,
    solvedCount: solvedSubmissions.reduce((sum, s) => sum + s.solveCount, 0),
    totalScore: solvedSubmissions.reduce((sum, s) => sum + s.score, 0),
    challenges: solvedSubmissions.map((s) => ({
      challenge: s.challenge,
      solveCount: s.solveCount,
      score: s.score,
      solvedAt: s.solvedAt,
    })),
  });
});

// 排行榜折线图数据：从今天起往前推 6 天（共 7 天），统计每个用户每日累计积分
router.get('/leaderboard', authMiddleware, async (_req: AuthRequest, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: { score: { gt: 0 }, solvedAt: { not: null } },
      select: { userId: true, score: true, solvedAt: true },
    });

    const users = await prisma.user.findMany({
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const formatLocalDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const parseLocalDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    const dates: string[] = [];
    for (let i = -6; i <= 0; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(formatLocalDate(d));
    }

    const endOfDay = (dateStr: string) => {
      const d = parseLocalDate(dateStr);
      d.setHours(23, 59, 59, 999);
      return d;
    };

    const userScores = users.map((user) => {
      const userSubs = submissions.filter((s) => s.userId === user.id);
      const scores = dates.map((dateStr) => {
        const eod = endOfDay(dateStr).getTime();
        return userSubs
          .filter((s) => s.solvedAt && new Date(s.solvedAt).getTime() <= eod)
          .reduce((sum, s) => sum + s.score, 0);
      });
      const lastUpdated = userSubs.length
        ? formatLocalDate(new Date(Math.max(...userSubs.map((s) => new Date(s.solvedAt!).getTime()))))
        : null;
      return {
        id: user.id,
        username: user.username,
        scores,
        lastUpdated,
        totalScore: scores[scores.length - 1] || 0,
      };
    });

    res.json({ dates, users: userScores });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '排行榜数据加载失败' });
  }
});

export default router;
