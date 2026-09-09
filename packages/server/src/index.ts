import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import challengeRoutes from './routes/challenges.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/challenges', challengeRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const HOST = process.env.HOST || '127.0.0.1';
const server = app.listen(PORT, HOST, () => {
  console.log(`localtrain server listening on http://${HOST}:${PORT}`);
});

// 允许大附件上传在慢网络/大文件时不被切断
server.timeout = 10 * 60 * 1000;
server.keepAliveTimeout = 10 * 60 * 1000;
server.headersTimeout = 11 * 60 * 1000;
