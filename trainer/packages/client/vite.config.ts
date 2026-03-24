import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import https from 'node:https'

// NOTE: 自定义 HTTPS agent——绕过远端 TLS 验证，避免 ECONNRESET
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // NOTE: 部署到 /app/ 子路径（CI build → commit 到 app/ 目录）
  base: '/app/',
  resolve: {
    alias: {
      // HACK: sr-puzzlegen-pll 的 package.json main 指向 dist/lib/index.js（只有 .d.ts 没有 .js）
      // 实际运行代码在 dist/bundle/puzzleGen.min.js（UMD 格式）
      'sr-puzzlegen-pll': path.resolve(
        __dirname,
        'node_modules/sr-puzzlegen-pll/dist/bundle/puzzleGen.min.js'
      ),
    },
  },
  server: {
    // 开发环境反代后端 API，避免 CORS 问题
    proxy: {
      '/trainer/api': {
        target: 'http://localhost:3001',
        rewrite: (path) => path.replace(/^\/trainer\/api/, ''),
      },
      // NOTE: calc 模块需要从 Jekyll 站点获取 WR 数据
      '/stats': {
        target: 'http://localhost:4000',
      },
      // NOTE: Recon API 代理到远端 PHP 后端（绕过 CORS）
      '/recon/api': {
        target: 'https://toolkit.cuberoot.me',
        changeOrigin: true,
        secure: false,
        agent: httpsAgent,
        // NOTE: 代理错误处理——防止 ECONNRESET 崩溃 dev server
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.warn('[recon-proxy] error:', err.message);
            if (res && 'writeHead' in res && !res.headersSent) {
              (res as import('http').ServerResponse).writeHead(502, { 'Content-Type': 'application/json' });
              (res as import('http').ServerResponse).end(JSON.stringify({ error: `Proxy error: ${err.message}` }));
            }
          });
        },
      },
    },
  },
})
