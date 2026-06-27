// canvas 调色板与站点明暗主题同步。
// CSS 侧(chrome:工具栏/按钮/统计条)走 viz.css 的 --ink-rgb 变量自动翻;
// canvas 侧(KDE/折线/脊线)是命令式绘制,读不到 CSS 变量,故这里把同一套明暗值
// 推给 _renderers/draw_utils 的模块级调色板。两侧保持一致(浅色 ink = 23,23,23)。

import { setVizPalette } from './_renderers/draw_utils';

/** 读站点当前主题(html[data-theme] / prefers-color-scheme),设好 canvas 调色板,返回 isDark。 */
export function applyVizPalette(): boolean {
  const dt = document.documentElement.getAttribute('data-theme');
  const dark = dt === 'dark'
    || (dt !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) {
    setVizPalette({ inkRGB: '255, 255, 255', surfaceBg: '#0c0c18', surfaceTip: 'rgba(12, 12, 30, 0.88)' });
  } else {
    setVizPalette({ inkRGB: '23, 23, 23', surfaceBg: '#ffffff', surfaceTip: 'rgba(255, 255, 255, 0.94)' });
  }
  return dark;
}

/** 订阅主题变化(html[data-theme] 属性 + 系统配色),变更即回调(用于重绘 canvas)。返回取消订阅函数。 */
export function watchVizTheme(onChange: () => void): () => void {
  const handler = () => { applyVizPalette(); onChange(); };
  const mo = new MutationObserver(handler);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', handler);
  return () => { mo.disconnect(); mq.removeEventListener('change', handler); };
}
