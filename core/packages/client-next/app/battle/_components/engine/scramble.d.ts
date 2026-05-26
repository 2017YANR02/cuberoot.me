/**
 * csTimer scramble_module.js 的 TypeScript 类型声明
 * NOTE: scramble_module.js 是 300KB 压缩代码，无法转 TS
 * 通过 <script> 标签加载后暴露全局 scrMgr 和 image 对象
 */

// NOTE: scrMgr.scramblers[type](type, len, state?) → 返回 HTML 格式打乱字符串
// scrMgr.toTxt(htmlScramble) → 纯文本格式
interface ScramblerManager {
  scramblers: Record<string, (type: string, len: number, state?: number) => string>;
  toTxt: (htmlScramble: string) => string;
}

// NOTE: image.draw([type, scrambleText, 0]) → 返回含 render() 方法的 SVG 对象
interface ScrambleImage {
  draw: (args: [string, string, number]) => { render: () => string } | null;
}

declare global {
  // NOTE: 由 scramble_module.js 暴露的全局对象
  // eslint-disable-next-line no-var
  var scrMgr: ScramblerManager;
  // eslint-disable-next-line no-var
  var image: ScrambleImage;
}

export {};
