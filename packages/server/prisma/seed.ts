import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminExists = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: await bcrypt.hash('admin', 10),
        role: 'admin',
      },
    });
    console.log('Created default admin user: admin / admin');
  }

  const userExists = await prisma.user.findUnique({ where: { username: 'user' } });
  if (!userExists) {
    await prisma.user.create({
      data: {
        username: 'user',
        passwordHash: await bcrypt.hash('user', 10),
        role: 'user',
      },
    });
    console.log('Created default user: user / user');
  }

  const exampleChallenge = await prisma.challenge.findFirst({ where: { title: '示例题目' } });
  if (!exampleChallenge) {
    const challenge = await prisma.challenge.create({
      data: {
        title: '示例题目',
        description: '这是一个示例题目，用于演示靶场功能。后续你可以替换为真实 CTF 题目或 CVE 复现环境。',
        category: 'web',
        difficulty: 'easy',
        image: 'nginx:alpine',
        port: 80,
        flags: {
          create: [
            { value: 'flag{welcome_to_localtrain}', index: 0 },
          ],
        },
      },
    });

    await prisma.hint.createMany({
      data: [
        {
          challengeId: challenge.id,
          level: 1,
          label: '初级提示',
          content: '这是一个 welcomes 题目，flag 通常藏在页面源码或简单路径中。',
          scorePenalty: 0,
        },
        {
          challengeId: challenge.id,
          level: 2,
          label: '中级提示',
          content: '尝试访问 /flag 或查看 HTML 注释。',
          scorePenalty: 5,
        },
        {
          challengeId: challenge.id,
          level: 3,
          label: '高级提示',
          content: 'flag 格式为 flag{...}。',
          scorePenalty: 10,
        },
      ],
    });

    console.log('Created example challenge with hints');
  }

  const showMeYourPass = await prisma.challenge.findFirst({ where: { title: 'Show Me Your Pass' } });
  if (!showMeYourPass) {
    await prisma.challenge.create({
      data: {
        title: 'Show Me Your Pass',
        description: '一道 PHP 反序列化 + 字符逃逸 + .htaccess 绕过的 Web 挑战。第一关通过 PHP 反序列化字符逃逸读取 /var/www/hint.txt，第二关伪造 X-Forwarded-For 登录 admin 面板，上传 .htaccess 与一句话木马获取最终 flag。',
        category: 'web',
        difficulty: 'medium',
        image: 'localtrain/show-me-your-pass',
        port: 80,
        flags: {
          create: [
            { value: 'flag{I_c4n_s33_th3_fl4g}', index: 0 },
          ],
        },
      },
    });
    console.log('Created challenge: Show Me Your Pass');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
