import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

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
      // NOTE: Hono API 代理到 ECS 线上后端（本地无 recon_db，无法运行 Hono 后端）
      '/trainer/api': {
        target: 'https://toolkit.cuberoot.me',
        changeOrigin: true,
        secure: true,
      },
      // NOTE: calc 模块需要从 Jekyll 站点获取 WR 数据
      '/stats': {
        target: 'http://localhost:4000',
      },
      // NOTE: iframe 用 — Solver/Alg Trainer/csTimer 及其共享依赖代理到 Jekyll
      '/solver': { target: 'http://localhost:4000' },
      '/alg_trainers': { target: 'http://localhost:4000' },
      '/cstimer': { target: 'http://localhost:4000' },
      // NOTE: 以下是这些模块引用的共享资源路径
      '/i18n': { target: 'http://localhost:4000' },
      '/assets': { target: 'http://localhost:4000' },
      '/src': { target: 'http://localhost:4000' },
      '/shared': { target: 'http://localhost:4000' },
      '/custom_icons': { target: 'http://localhost:4000' },
      '/url_params_compressor_simple.js': { target: 'http://localhost:4000' },
      '/sw-register.js': { target: 'http://localhost:4000' },
      '/callback.html': { target: 'http://localhost:4000' },
      '/wca_auth.js': { target: 'http://localhost:4000' },
    },
  },
})
