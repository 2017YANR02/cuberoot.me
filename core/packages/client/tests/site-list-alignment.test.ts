import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../app/[lang]/site/sites.css', import.meta.url), 'utf8');

function mediaBlock(source: string, query: string): string {
  const start = source.indexOf(`@media ${query}`);
  if (start < 0) return '';
  const open = source.indexOf('{', start);
  let depth = 1;
  for (let index = open + 1; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  return '';
}

function withoutMedia(source: string, query: string): string {
  let output = '';
  let cursor = 0;
  while (true) {
    const start = source.indexOf(`@media ${query}`, cursor);
    if (start < 0) return output + source.slice(cursor);
    output += source.slice(cursor, start);
    const open = source.indexOf('{', start);
    let depth = 1;
    let index = open + 1;
    for (; index < source.length && depth > 0; index += 1) {
      if (source[index] === '{') depth += 1;
      if (source[index] === '}') depth -= 1;
    }
    cursor = index;
  }
}

describe('/site list alignment', () => {
  it('keeps desktop grid tracks fixed when a row has external or admin actions', () => {
    const desktopCss = withoutMedia(css, '(max-width: 720px)');

    expect(desktopCss).not.toMatch(
      /\.site-row(?:\.[\w-]+)+\s+\.site-row-main\s*\{[^}]*padding-right:/,
    );
    expect(desktopCss).toMatch(
      /\.site-row-desc\s*\{[^}]*padding-right:\s*var\(--site-row-action-space, 0\);/,
    );
  });

  it('preserves action clearance in the stacked mobile row layout', () => {
    const mobileCss = mediaBlock(css, '(max-width: 720px)');

    expect(mobileCss).toContain('.site-row.has-external-links .site-row-main { padding-right: 62px; }');
    expect(mobileCss).toContain('.site-row.has-multiple-external-links .site-row-main { padding-right: 88px; }');
    expect(mobileCss).toContain('.site-row.is-admin .site-row-main { padding-right: 130px; }');
  });
});