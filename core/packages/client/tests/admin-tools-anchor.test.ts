import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const source = readFileSync('components/AuthTokenRefresher.tsx', 'utf8');

it('keeps the environment anchor fixed and animates only a separate surface', () => {
  const anchor = source.slice(source.indexOf('return <aside'), source.indexOf('<style>'));
  expect(anchor).toContain("transform: 'translateX(-21px)'");
  expect(anchor).toContain('width: 42');
  expect(anchor).not.toContain('expanded ?');
  expect(source).toContain('className="admin-tools-surface"');
  expect(source).toContain('left: expanded ? -toggleLeft : 0');
  expect(source).toContain('width: expanded ? actionsWidth + 10 : 42');
  const toggle = source.slice(source.indexOf('<a ref={toggleRef}'), source.indexOf('</a>', source.indexOf('<a ref={toggleRef}')));
  expect(toggle).not.toContain('transform');
  expect(source).not.toContain('toggleOffset');
});

it('limits the toolbar width without moving the horizontal anchor during expansion', () => {
  const clamp = source.slice(source.indexOf('const clamp = () =>'), source.indexOf('const preview ='));
  expect(clamp).toContain('toolbar.style.maxWidth = `${viewportWidth - 32}px`');
  expect(clamp).toContain('moveTo(rect.top + dy)');
  expect(clamp).not.toContain('actions.left');
  expect(clamp).not.toContain('actions.right');
  expect(clamp).not.toContain('expanded');
});

it('applies homepage glass and hover clipping to the surface, not the fixed anchor', () => {
  const css = readFileSync('app/[lang]/home-background.css', 'utf8');
  expect(css).not.toMatch(/\.admin-tools\)(?::hover)?/);
  expect(css).not.toContain('.admin-tools::before');
  expect(css).toContain('.admin-tools-surface)::before');
  expect(css).toContain('.admin-tools-surface:hover { position: absolute; }');
});
