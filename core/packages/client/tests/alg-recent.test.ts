// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { useRecentAlgCases } from '@/lib/alg-recent';

const state = () => useRecentAlgCases.getState();
const item = (n: number) => ({ puzzle: '3x3', set: 'pll', name: `Case ${n}`, href: `/alg/3x3/pll/case-${n}` });
beforeEach(() => { localStorage.clear(); state().hydrate(); });
it('hydrates bounded recent cases and moves revisits to the front without duplication', () => {
  for (let n = 0; n < 30; n++) state().remember(item(n));
  state().remember(item(12)); state().hydrate();
  expect(state().items).toHaveLength(24);
  expect(state().items[0]).toEqual(item(12));
  expect(state().items.filter(x => x.href === item(12).href)).toHaveLength(1);
});
it('rejects external links, queries and malformed stored values', () => {
  state().remember({ ...item(1), href: 'https://example.com/' });
  state().remember({ ...item(1), href: item(1).href + '?token=secret' });
  expect(state().items).toEqual([]);
  localStorage.setItem('alg:recent:v1', JSON.stringify([null, {}, item(2), item(2)]));
  state().hydrate(); expect(state().items).toEqual([item(2)]);
  localStorage.setItem('alg:recent:v1', '{'); state().hydrate(); expect(state().items).toEqual([]);
});
it('clears only the current puzzle', () => {
  state().remember(item(1));
  const other = { puzzle: '2x2', set: 'cll', name: 'U1', href: '/alg/2x2/cll/u1' };
  state().remember(other); state().clear('3x3'); state().hydrate();
  expect(state().items).toEqual([other]);
});

it('keeps canonical PLL slugs containing plus signs', () => {
  const plus = { ...item(1), name: 'A+', href: '/alg/3x3/pll/a+' };
  state().remember(plus); state().hydrate();
  expect(state().items).toEqual([plus]);
});
