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
      },
    },
  },
})
