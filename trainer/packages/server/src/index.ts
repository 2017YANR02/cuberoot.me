import Fastify from 'fastify';
import cors from '@fastify/cors';

const server = Fastify({ logger: true });

// CORS 配置——允许前端 dev server 跨域请求
await server.register(cors, {
  origin: [
    'http://localhost:5173',       // Vite dev server
    'https://toolkit.cuberoot.me', // 生产环境
  ],
});

// 健康检查
server.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

// TODO: 后续添加路由
// - /api/auth（WCA OAuth + JWT）
// - /api/progress（训练进度 CRUD）

const PORT = Number(process.env.PORT) || 3001;

try {
  await server.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Trainer API running on port ${PORT}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
