/**
 * 打乱生成封装
 * 1:1 翻译自 battle.js loadNewScramble() 和 renderScrambleImage()（行 484~534）
 *
 * NOTE: 底层调用全局 scrMgr（由 scramble_module.js 暴露）
 * 类型声明在 scramble.d.ts
 */

/// <reference path="./scramble.d.ts" />

import { EVENT_TO_CSTIMER } from './constants';

/**
 * NOTE: 使用本地 csTimer scramble module 生成打乱（纯 JS，无 WASM，瞬间完成）
 * csTimer 的 scrMgr.scramblers[type](type, len, state) 同步返回打乱字符串
 */
export function generateScramble(puzzleId: string): string {
  try {
    const mapping = EVENT_TO_CSTIMER[puzzleId] || ['333', 0];
    const [csType, defaultLen] = mapping;
    // NOTE: scrMgr.scramblers[type] 同步返回 HTML 格式字符串，toTxt() 转为纯文本
    const rawScramble = scrMgr.scramblers[csType](csType, defaultLen);
    return scrMgr.toTxt(rawScramble);
  } catch (err) {
    console.error('Scramble generation failed:', err);
    return '⚠️ Scramble error';
  }
}

/**
 * NOTE: 调用 csTimer image.js 的 renderSVG 生成打乱图 SVG data URL
 * 返回 data:image/svg+xml;base64,... 字符串，或 null（不支持图像的项目）
 * 1:1 翻译自 battle.js renderScrambleImage()（行 508~534）
 */
export function generateScrambleImageUrl(puzzleId: string, scramble: string): string | null {
  try {
    const mapping = EVENT_TO_CSTIMER[puzzleId] || ['333', 0];
    const [csType] = mapping;
    // NOTE: image.draw([type, scrambleText, 0]) 返回 $.svg 对象，.render() 得到 SVG 字符串
    const svg = image.draw([csType, scramble, 0]);
    if (!svg) return null; // 不支持图像的项目
    const svgStr = svg.render();
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
  } catch (err) {
    // NOTE: 图像生成失败不影响打乱文字，静默处理
    console.warn('Scramble image failed:', err);
    return null;
  }
}
