import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // NOTE: 部署到根路径 /（React SPA 作为站点主入口）
  base: '/',
  build: {
    // NOTE: 使用 _assets 避免与 Jekyll 的 assets/（stats_ui.css 等）冲突
    assetsDir: '_assets',
  },
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
    host: '127.0.0.1',
    // 开发环境反代后端 API，避免 CORS 问题
    proxy: {
      // NOTE: Hono API 代理到 ECS 线上后端（本地无 recon_db，无法运行 Hono 后端）
      '/api': {
        target: 'https://www.cuberoot.me',
        changeOrigin: true,
        secure: true,
      },
      // NOTE: stats 数据文件（JSON）— 保持在根路径，代理到 Jekyll
      '/stats': {
        target: 'http://localhost:4000',
      },
      // NOTE: legacy 内容统一前缀 — iframe 嵌入的 Solver/Alg Trainer/csTimer 及共享资源
      '/legacy': { target: 'http://localhost:4000' },
    },
  },
})
