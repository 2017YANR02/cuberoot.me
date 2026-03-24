/**
 * BattlePage — 对战计时器主页面骨架
 * NOTE: 子任务 1 阶段仅搭建基础结构和路由注册
 * 后续子任务将逐步填充完整的 UI 组件和逻辑
 */

import { useEffect } from 'react';

import './battle.css';

// NOTE: 加载 scramble_module.js 全局脚本（打乱引擎）
function useScrambleScript() {
  useEffect(() => {
    // NOTE: 检查是否已加载
    if (typeof window.scrMgr !== 'undefined') return;

    const script = document.createElement('script');
    script.src = '/app/scramble_module.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // NOTE: 不移除 script — scramble_module.js 加载后全局持久化
    };
  }, []);
}

export default function BattlePage() {
  useScrambleScript();

  return (
    <div className="battle-container">
      {/* NOTE: 子任务 2 将填充完整的 Timer 区域 */}
      <div className="battle-placeholder">
        <h1>⏱️ Battle Timer</h1>
        <p>模块加载中...</p>
      </div>
    </div>
  );
}
