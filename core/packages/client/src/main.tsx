/**
 * @module main
 * React 入口 — 挂载 App 到 #root，引入全局 CSS + i18n 初始化。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'

// Service Worker — (1) 拦截 /v1/visualcube.svg 本地生成 SVG;
// (2) 给同源响应注入 COOP/COEP 让 SharedArrayBuffer 可用(cubeopt 用)。
// 见 src/sw.ts;构建走 scripts/build_sw.mjs → public/sw.js
//
// SAB 需要 document 本身就带 COOP/COEP。SW 头一次注册时 document 还没经过 SW,
// 所以 crossOriginIsolated=false。等 SW activate 后 reload 一次,document 就经
// 过 SW 拿到注入的 headers,SAB 就可用了。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(() => {
      if (!window.crossOriginIsolated && navigator.serviceWorker.controller == null) {
        // 第一次注册,reload 一次让 document 走 SW。
        window.location.reload();
      }
    }).catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
