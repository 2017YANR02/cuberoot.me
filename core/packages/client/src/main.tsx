/**
 * @module main
 * React 入口 — 挂载 App 到 #root，引入全局 CSS + i18n 初始化。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'

// Service Worker — 见 src/sw.ts;构建走 scripts/build_sw.mjs → public/sw.js
//   (1) 拦截 /v1/visualcube.svg 本地生成 SVG
//   (2) 给同源响应注入 COOP/COEP 让 SharedArrayBuffer 可用(cubeopt 用)
//   (3) Safari 用 require-corp + 跨源 CORP 改写,因为 Safari 不支持 credentialless
//
// SAB 需要 document 本身带 COOP/COEP。SW 头一次注册时 document 还没经过 SW,
// 所以 crossOriginIsolated=false。SW activate 后 reload 让 document 走 SW headers。
// Safari 用户老 sw.js 升级时也走这条路径(controllerchange / 普通 update)。
// sessionStorage 防 reload 循环 — 一个 session 最多 reload 一次。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if (!window.crossOriginIsolated) {
        if (sessionStorage.getItem('coi-reloaded') !== '1') {
          sessionStorage.setItem('coi-reloaded', '1');
          window.location.reload();
        }
      } else {
        sessionStorage.removeItem('coi-reloaded');
      }
    } catch { /* ignore */ }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
