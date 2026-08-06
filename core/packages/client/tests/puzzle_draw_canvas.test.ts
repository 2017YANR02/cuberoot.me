import { describe, expect, it } from 'vitest';
import { cleanFilenameBase, renderDrawSvg } from '@/components/puzzle-draw/DrawCanvas';

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
});
