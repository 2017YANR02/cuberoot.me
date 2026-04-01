/**
 * @module main
 * React 入口 — 挂载 App 到 #root，引入全局 CSS + i18n 初始化。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
