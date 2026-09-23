export interface ContainerStatus {
  challengeId: string;
  running: boolean;
  url?: string;
  containerId?: string;
  hostPort?: number;
  internalPort?: number;
  startedAt?: Date;
  expiresAt?: Date;
  challengeTitle?: string;
  challengeVisible?: boolean;
  username?: string;
  imageSize?: number; // MB
}

import { prisma } from '../prisma/client.js';
import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT_RANGE_START = 30000;
const PORT_RANGE_END = 39999;
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2h
const EXTEND_MS = 60 * 60 * 1000; // 1h
const MAX_CONCURRENT = 5;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const IMAGE_ARCHIVE_DIR = path.resolve(PROJECT_ROOT, 'docker-images');

if (!fs.existsSync(IMAGE_ARCHIVE_DIR)) {
  fs.mkdirSync(IMAGE_ARCHIVE_DIR, { recursive: true });
}

function imageArchiveFileName(image: string) {
  return image.replace(/[^a-zA-Z0-9._-]/g, '_') + '.tar';
}

function imageArchivePath(image: string) {
  return path.join(IMAGE_ARCHIVE_DIR, imageArchiveFileName(image));
}

function generateName(userId: string, challengeId: string) {
  return `localtrain-${userId.slice(0, 8)}-${challengeId.slice(0, 8)}-${Date.now().toString(36)}`;
}

class DockerService {
  private docker = new Docker();
  private timers = new Map<string, NodeJS.Timeout>();
  private cleaning = new Set<string>();

  constructor() {
    // Fire and forget restoration; errors are logged and swallowed.
    this.restoreTimers().catch((e) => console.error('Restore timers failed:', e));
  }

  private async restoreTimers() {
    // 恢复全部容器记录：已过期的立即清理（防止服务停机期间漏掉的容器游离），
    // 未过期且存活的重建清理定时器，其余仅删除失效记录。
    const records = await prisma.container.findMany();
    for (const record of records) {
      if (record.expiresAt <= new Date()) {
        await this.cleanup(record.containerId);
        continue;
      }
      const running = await this.isContainerRunning(record.containerId);
      if (!running) {
        await this.deleteContainerRecord(record.containerId);
        continue;
      }
      this.scheduleCleanup(record.containerId, record.expiresAt);
    }
  }

  private async isContainerRunning(containerId: string): Promise<boolean> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      return info.State?.Running === true;
    } catch {
      return false;
    }
  }

  private async findFreePort(): Promise<number> {
    const usedPorts = new Set<number>();

    const dbContainers = await prisma.container.findMany({
      where: { expiresAt: { gt: new Date() } },
      select: { hostPort: true },
    });
    for (const c of dbContainers) {
      usedPorts.add(c.hostPort);
    }

    const dockerContainers = await this.docker.listContainers({ all: true });
    for (const c of dockerContainers) {
      if (!c.Labels || c.Labels['localtrain.project'] !== 'localtrain') continue;
      for (const p of c.Ports || []) {
        if (p.PublicPort) usedPorts.add(p.PublicPort);
      }
    }

    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
      if (!usedPorts.has(port)) return port;
    }
    throw new Error('没有可用端口');
  }

  private scheduleCleanup(containerId: string, expiresAt: Date) {
    this.clearTimer(containerId);
    const delay = expiresAt.getTime() - Date.now();
    if (delay <= 0) {
      this.cleanup(containerId).catch((e) => console.error('Immediate cleanup failed:', e));
      return;
    }
    const timer = setTimeout(() => {
      this.cleanup(containerId).catch((e) => console.error('Scheduled cleanup failed:', e));
    }, delay);
    this.timers.set(containerId, timer);
  }

  private clearTimer(containerId: string) {
    const timer = this.timers.get(containerId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(containerId);
    }
  }

  private async cleanup(containerId: string) {
    if (this.cleaning.has(containerId)) return;
    this.cleaning.add(containerId);
    this.clearTimer(containerId);
    try {
      const container = this.docker.getContainer(containerId);
      try {
        await container.stop({ t: 5 });
      } catch (e: any) {
        if (e.statusCode !== 304) throw e;
      }
      await container.remove({ force: true });
    } catch (e: any) {
      if (e.statusCode !== 404 && e.statusCode !== 409) {
        console.error('Cleanup container error:', e.message);
      }
    } finally {
      this.cleaning.delete(containerId);
    }
    await this.deleteContainerRecord(containerId);
  }

  private async deleteContainerRecord(containerId: string) {
    try {
      await prisma.container.deleteMany({ where: { containerId } });
    } catch (e) {
      console.error('Delete container record error:', e);
    }
  }

  private async dockerImageExists(image: string): Promise<boolean> {
    try {
      const dockerImage = this.docker.getImage(image);
      await dockerImage.inspect();
      return true;
    } catch {
      return false;
    }
  }

  private async imageSizeMB(image: string): Promise<number | undefined> {
    try {
      const dockerImage = this.docker.getImage(image);
      const info = await dockerImage.inspect();
      const size = (info as any).Size || 0;
      return size ? Math.round(size / 1024 / 1024) : undefined;
    } catch {
      return undefined;
    }
  }

  private async ensureImageLoaded(image: string) {
    if (await this.dockerImageExists(image)) {
      return;
    }

    const archivePath = imageArchivePath(image);
    if (!fs.existsSync(archivePath)) {
      throw new Error(
        `本地不存在镜像 "${image}"，也未找到镜像归档：${archivePath}。请先执行 docker build 或使用 docker save 导出镜像到此路径。`
      );
    }

    console.log(`[DockerService] 正在从归档加载镜像: ${archivePath}`);
    try {
      const stream = fs.createReadStream(archivePath);
      await this.docker.loadImage(stream);
      if (await this.dockerImageExists(image)) {
        console.log(`[DockerService] 镜像加载成功: ${image}`);
        return;
      }
      throw new Error('镜像归档加载后仍未找到对应镜像');
    } catch (e: any) {
      throw new Error(`加载镜像归档失败: ${e.message}`);
    }
  }

  async startChallenge(
    userId: string,
    challengeId: string,
    image: string,
    internalPort: number
  ): Promise<ContainerStatus> {
    const existing = await prisma.container.findUnique({
      where: { userId_challengeId: { userId, challengeId } },
    });

    if (existing) {
      const running = await this.isContainerRunning(existing.containerId);
      // 已过期或已停止的旧容器不复用，清理后重新创建
      if (running && existing.expiresAt > new Date()) {
        return this.toStatus(existing);
      }
      await this.cleanup(existing.containerId);
    }

    const activeCount = await prisma.container.count({
      where: { userId, expiresAt: { gt: new Date() } },
    });
    if (activeCount >= MAX_CONCURRENT) {
      throw new Error(`每个用户最多同时运行 ${MAX_CONCURRENT} 个容器`);
    }

    if (!image) {
      throw new Error('题目未配置 Docker 镜像');
    }

    await this.ensureImageLoaded(image);

    const hostPort = await this.findFreePort();
    const name = generateName(userId, challengeId);
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);

    const created = await this.docker.createContainer({
      Image: image,
      name,
      Labels: {
        'localtrain.project': 'localtrain',
        'localtrain.user': userId,
        'localtrain.challenge': challengeId,
      },
      ExposedPorts: {
        [`${internalPort}/tcp`]: {},
      },
      HostConfig: {
        PortBindings: {
          [`${internalPort}/tcp`]: [{ HostPort: String(hostPort) }],
        },
        AutoRemove: false,
      },
    });

    await created.start();
    const info = await created.inspect();
    const containerId = info.Id;

    const record = await prisma.container.create({
      data: {
        userId,
        challengeId,
        containerId,
        image,
        hostPort,
        internalPort,
        startedAt: new Date(),
        expiresAt,
      },
    });

    this.scheduleCleanup(containerId, expiresAt);
    return this.toStatus(record);
  }

  async stopChallenge(userId: string, challengeId: string): Promise<ContainerStatus | null> {
    const record = await prisma.container.findUnique({
      where: { userId_challengeId: { userId, challengeId } },
    });
    if (!record) return null;

    await this.cleanup(record.containerId);
    return null;
  }

  async extendExpiry(userId: string, challengeId: string): Promise<ContainerStatus | null> {
    const record = await prisma.container.findUnique({
      where: { userId_challengeId: { userId, challengeId } },
    });
    if (!record) return null;

    const running = await this.isContainerRunning(record.containerId);
    if (!running) {
      await this.cleanup(record.containerId);
      return null;
    }

    const expiresAt = new Date(record.expiresAt.getTime() + EXTEND_MS);
    await prisma.container.update({
      where: { id: record.id },
      data: { expiresAt },
    });

    this.scheduleCleanup(record.containerId, expiresAt);
    return this.toStatus({ ...record, expiresAt });
  }

  async getStatus(userId: string, challengeId: string): Promise<ContainerStatus | null> {
    const record = await prisma.container.findUnique({
      where: { userId_challengeId: { userId, challengeId } },
    });
    if (!record) return null;

    if (record.expiresAt <= new Date()) {
      await this.cleanup(record.containerId);
      return null;
    }

    const running = await this.isContainerRunning(record.containerId);
    if (!running) {
      await this.cleanup(record.containerId);
      return null;
    }

    return this.toStatus(record);
  }

  async listUserContainers(userId: string): Promise<ContainerStatus[]> {
    const records = await prisma.container.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { challenge: { select: { title: true, visible: true } } },
    });
    const result: ContainerStatus[] = [];
    for (const record of records) {
      if (record.expiresAt <= new Date()) {
        await this.cleanup(record.containerId);
        continue;
      }
      const running = await this.isContainerRunning(record.containerId);
      if (!running) {
        await this.cleanup(record.containerId);
        continue;
      }
      result.push(this.toStatus(record));
    }
    return result;
  }

  async listAllContainers(): Promise<ContainerStatus[]> {
    const records = await prisma.container.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        challenge: { select: { title: true, visible: true } },
        user: { select: { username: true } },
      },
    });
    const result: ContainerStatus[] = [];
    for (const record of records) {
      if (record.expiresAt <= new Date()) {
        await this.cleanup(record.containerId);
        continue;
      }
      const running = await this.isContainerRunning(record.containerId);
      if (!running) {
        await this.cleanup(record.containerId);
        continue;
      }
      const imageSize = await this.imageSizeMB(record.image);
      result.push(this.toStatus(record, imageSize));
    }
    return result;
  }

  async extendContainerById(containerId: string): Promise<ContainerStatus | null> {
    const record = await prisma.container.findFirst({
      where: { containerId },
    });
    if (!record) return null;

    const running = await this.isContainerRunning(record.containerId);
    if (!running) {
      await this.cleanup(record.containerId);
      return null;
    }

    const expiresAt = new Date(record.expiresAt.getTime() + EXTEND_MS);
    await prisma.container.update({
      where: { id: record.id },
      data: { expiresAt },
    });

    this.scheduleCleanup(record.containerId, expiresAt);
    return this.toStatus({ ...record, expiresAt });
  }

  private toStatus(record: any, imageSize?: number): ContainerStatus {
    return {
      challengeId: record.challengeId,
      running: true,
      url: `http://localhost:${record.hostPort}`,
      containerId: record.containerId,
      hostPort: record.hostPort,
      internalPort: record.internalPort,
      startedAt: record.startedAt,
      expiresAt: record.expiresAt,
      challengeTitle: record.challenge?.title,
      challengeVisible: record.challenge?.visible,
      username: record.user?.username,
      imageSize,
    };
  }
}

export const dockerService = new DockerService();
