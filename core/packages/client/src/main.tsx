/**
 * @module main
 * React 入口 — 挂载 App 到 #root，引入全局 CSS + i18n 初始化。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
import './i18n'
import App from './App.tsx'
import { installLangNormalize } from './utils/url_lang_normalize'
import { bootstrapTheme } from './utils/theme'
import { loadFlagData } from './utils/country_flags'

installLangNormalize()
bootstrapTheme()
// 启动即预热 person_countries / comp_countries / comp_names_zh + /v1/cn-comp-names 兜底。
// 让"点开比赛详情页"渲染时中文比赛名已 ready,不会"先英文后中文"闪烁。
void loadFlagData()

// Service Worker — 见 src/sw.ts;构建走 scripts/build_sw.mjs → public/sw.js
//   (1) 拦截 /v1/visualcube.svg 本地生成 SVG
//   (2) 给同源响应注入 COOP/COEP 让 SharedArrayBuffer 可用(cubeopt 用)
//   (3) Safari 用 require-corp + 跨源 CORP 改写,因为 Safari 不支持 credentialless
//
// SAB 需要 document 本身带 COOP/COEP。SW 头一次注册时 document 还没经过 SW,
// 所以 crossOriginIsolated=false。SW activate 后 reload 让 document 走 SW headers。
// Safari 用户老 sw.js 升级时也走这条路径(controllerchange / 普通 update)。
// sessionStorage 防 reload 循环 — 一个 session 最多 reload 一次。
//
// DEV 跳过:vite server.headers 已发 COOP/COEP,SW 多余;且 Safari 上 SW 重 wrap
// vite 动态 module 响应会让 ES module import 失败(整个 React 崩成白屏)。
// 同时主动注销老 sw,清掉手机端残留(手机经 Funnel 接进来时尤其重要)。
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
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
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    }).catch(() => { /* ignore */ });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
