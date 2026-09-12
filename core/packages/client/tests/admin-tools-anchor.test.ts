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

it('reserves the expanded footprint before hover rather than moving the anchor during expansion', () => {
  const clamp = source.slice(source.indexOf('const clamp = () =>'), source.indexOf('const preview ='));
  expect(clamp).toContain('actions.left - 5');
  expect(clamp).toContain('actions.right + 5');
  expect(clamp).not.toContain('expanded');
});
