import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // NOTE: 部署到 /trainer/ 子路径，所有静态资源引用都基于此前缀
  base: '/trainer/',
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
    },
  },
})
