import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.js';
import { progressRoutes } from './routes/progress.js';
import { healthRoutes } from './routes/health.js';
import { reconRoutes } from './routes/recon.js';

const server = Fastify({ logger: true });

// CORS 配置——允许前端 dev server 跨域请求
await server.register(cors, {
  origin: [
    'http://localhost:5173',       // Vite dev server
    'https://toolkit.cuberoot.me', // 生产环境
  ],
});

// 注册路由
await server.register(authRoutes);
await server.register(progressRoutes);
await server.register(healthRoutes);
await server.register(reconRoutes);

const PORT = Number(process.env.PORT) || 3001;

try {
  await server.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Trainer API running on port ${PORT}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
