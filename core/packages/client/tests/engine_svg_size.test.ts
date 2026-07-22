// sizeEngineSvg:图片尺寸(PX)控件对引擎矢量镜像的落点。锁住 root <svg> 宽高被钉成
// size×size(退役对照表 §2b「图片尺寸」;显示 / studio 预览 / SVG 下载三处共用)。
import { describe, it, expect } from 'vitest';
import { sizeEngineSvg } from '@/lib/puzzle-image/engine-svg';

// 示意导出器 exportSimSvgSchematic 的真实输出形状:紧凑非方 viewBox + 像素 width/height。
const EXPORTER_SHAPE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="404" height="440" viewBox="108.69 73.71 404.56 440.47">'
  + '<path d="M0 0" fill="#0f0"/></svg>';

describe('sizeEngineSvg', () => {
  it('pins root svg width/height to size×size, viewBox untouched', () => {
    const out = sizeEngineSvg(EXPORTER_SHAPE, 256);
    expect(out).toContain('width="256" height="256"');
    expect(out).not.toContain('width="404"');
    expect(out).not.toContain('height="440"');
    // viewBox 保留 → preserveAspectRatio 默认 meet 等比缩放,不拉伸变形。
    expect(out).toContain('viewBox="108.69 73.71 404.56 440.47"');
  });

  it('only rewrites the root <svg>, not inner geometry', () => {
    const out = sizeEngineSvg(EXPORTER_SHAPE, 128);
    expect(out).toContain('<path d="M0 0" fill="#0f0"/>'); // 内容原样
  });

  it('leaves a string without svg width/height attrs unchanged', () => {
    const noWH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>';
    expect(sizeEngineSvg(noWH, 300)).toBe(noWH);
  });
});
