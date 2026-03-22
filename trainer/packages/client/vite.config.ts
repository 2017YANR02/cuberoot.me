import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // NOTE: 部署到 /trainer/ 子路径，所有静态资源引用都基于此前缀
  base: '/trainer/',
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
