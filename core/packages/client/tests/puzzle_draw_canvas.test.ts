import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cleanFilenameBase, renderDrawSvg } from '@/components/puzzle-draw/DrawCanvas';

const drawCanvasSource = readFileSync(
  new URL('../components/puzzle-draw/DrawCanvas.tsx', import.meta.url),
  'utf8',
);
const drawCanvasCss = readFileSync(
  new URL('../components/puzzle-draw/draw-canvas.css', import.meta.url),
  'utf8',
);

describe('renderDrawSvg', () => {
  it('emits the same paint document used by preview and export', () => {
    const svg = renderDrawSvg({
      viewBox: '0 0 20 10',
      width: 200,
      height: 100,
      strokeWidth: 4,
      elements: [
        { key: 'left', type: 'polygon', points: '0,0 10,0 10,10', defaultFill: '#777777' },
        { key: 'right', type: 'path', d: 'M10 0H20V10Z', transformStr: 'translate(1 0)' },
        { key: 'guide', type: 'line', line: { x1: 0, y1: 5, x2: 20, y2: 5 }, disableDrawing: true },
      ],
      colors: { left: '#ff0000', right: '#00000000' },
    });

    expect(svg).toContain('width="200" height="100" viewBox="0 0 20 10"');
    expect(svg).toContain('data-draw-cell="left"');
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('fill="#00000000"');
    expect(svg).toContain('transform="translate(1 0)"');
    expect(svg).toContain('stroke-width="4"');
    expect(svg).toContain('data-draw-key="guide"');
    expect(svg).not.toContain('data-draw-cell="guide"');
  });

  it('normalizes custom download names without keeping an image extension', () => {
    expect(cleanFilenameBase('  my/drawing.svg  ')).toBe('my-drawing');
    expect(cleanFilenameBase('sq1:*?<>|.png')).toBe('sq1-');
    expect(cleanFilenameBase('...')).toBe('');
  });

  it('keeps desktop previews at their configured width while allowing narrow screens to shrink', () => {
    expect(drawCanvasSource).toContain("'--draw-canvas-preview-width': `${width}px`");
    expect(drawCanvasCss).toContain(
      'grid-template-columns: minmax(0, var(--draw-canvas-preview-width, 512px)) minmax(220px, 280px);',
    );
    expect(drawCanvasCss).toContain('max-width: var(--draw-canvas-preview-width, 512px);');
    expect(drawCanvasCss).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
    );
  });
});
