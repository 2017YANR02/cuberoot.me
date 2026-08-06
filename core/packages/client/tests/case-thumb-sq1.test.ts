import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CaseThumb } from '@/components/CaseThumb';

describe('CaseThumb — Square-1 renderer', () => {
  it('renders the lightweight flat SVG inline instead of an image or the /sim engine', () => {
    const html = renderToStaticMarkup(createElement(CaseThumb, {
      puzzle: 'sq1',
      set: 'shape',
      sticker: { kind: 'raw', tag: 'sq1', attrs: {} },
      alg: '(1,0) / (-1,0)',
      size: 96,
    }));

    expect(html).toContain('<div');
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 122.3958761790857 244.7917523581714"');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('/v1/visualcube.svg');
  });

  it('automatically applies the formula-set stage mask', () => {
    const html = renderToStaticMarkup(createElement(CaseThumb, {
      puzzle: 'sq1',
      set: 'eo',
      sticker: { kind: 'raw', tag: 'sq1', attrs: {} },
      alg: '',
      size: 96,
    }));

    expect(html.match(/<path /g)).toHaveLength(16);
    expect(html).not.toContain('fill="none"');
    expect(html).toContain('fill="#000000"');
    expect(html).not.toContain('#FFFF00');
    expect(html).toContain('#FFFFFF');
    for (const color of ['#FF0000', '#00FF00', '#FF8000', '#0000FF']) {
      expect(html).not.toContain(color);
    }
    expect(html).not.toContain('<rect');
  });

  it('renders every cubeshape sticker in one theme-aware gray and hides the equator', () => {
    const props = {
      puzzle: 'sq1',
      set: 'cs',
      sticker: { kind: 'raw', tag: 'sq1', attrs: {} },
      alg: '',
      size: 96,
      sq1BlackTop: false,
    } as const;
    const html = renderToStaticMarkup(createElement(CaseThumb, props));
    const blackTop = renderToStaticMarkup(createElement(CaseThumb, { ...props, sq1BlackTop: true }));

    expect(html).not.toContain('<rect');
    expect(html.match(/fill="var\(--muted-foreground\)"/g)).toHaveLength(40);
    for (const color of ['#FFFF00', '#FFFFFF', '#FF0000', '#00FF00', '#FF8000', '#0000FF', '#000000']) {
      expect(html).not.toContain(`fill="${color}"`);
    }
    expect(blackTop).toBe(html);
    expect(html).toContain('viewBox="0 -2 122.3958761790857 248.7917523581714"');
  });

  it('hides the equator for parity cases', () => {
    const html = renderToStaticMarkup(createElement(CaseThumb, {
      puzzle: 'sq1',
      set: 'parity',
      sticker: { kind: 'raw', tag: 'sq1', attrs: {} },
      alg: '',
      size: 96,
    }));

    expect(html).not.toContain('<rect');
    expect(html).toContain('viewBox="0 12.799999999999997 122.3958761790857 219.1917523581714"');
    const centers = [...new Set(
      [...html.matchAll(/translate\([^,]+,([^)]+)\) rotate/g)].map(match => Number(match[1])),
    )].sort((a, b) => a - b);
    expect(centers[1] - centers[0]).toBeGreaterThan(92);
    expect(centers[1] - centers[0]).toBeLessThan(100);
  });

  it('keeps a safe gap between both faces for a non-cubic shape', () => {
    const html = renderToStaticMarkup(createElement(CaseThumb, {
      puzzle: 'sq1',
      set: 'cs',
      sticker: { kind: 'raw', tag: 'sq1', attrs: {} },
      alg: '(1,0) / (-1,0)',
      size: 96,
    }));
    const centers = [...new Set(
      [...html.matchAll(/translate\([^,]+,([^)]+)\) rotate/g)].map(match => Number(match[1])),
    )].sort((a, b) => a - b);

    expect(centers).toHaveLength(2);
    expect(centers[1] - centers[0]).toBeGreaterThan(124.4);
  });

  it('uses a black top by default and allows opting back into yellow', () => {
    const props = {
      puzzle: 'sq1' as const,
      set: 'shape',
      sticker: { kind: 'raw' as const, tag: 'sq1', attrs: {} },
      alg: '',
      size: 96,
    };
    const black = renderToStaticMarkup(createElement(CaseThumb, props));
    const yellow = renderToStaticMarkup(createElement(CaseThumb, { ...props, sq1BlackTop: false }));

    expect(black).toContain('fill="#000000"');
    expect(black).not.toContain('#FFFF00');
    expect(yellow).toContain('#FFFF00');
  });
});
