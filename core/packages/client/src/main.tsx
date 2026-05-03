/**
 * @module main
 * React 入口 — 挂载 App 到 #root，引入全局 CSS + i18n 初始化。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'

// Service Worker — 拦截 /api/visualcube.svg 本地生成 SVG，零网络请求
// 见 src/sw.ts；构建走 scripts/build_sw.mjs → public/sw.js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
