import { expect, it } from 'vitest';
import { orderChecklistItems } from '@cuberoot/shared/workspace-planning';

it('moves completed items to the bottom without changing the original restore order', () => {
  const items = [{ id: 'a', text: 'A', done: true }, { id: 'b', text: 'B', done: false }, { id: 'c', text: 'C', done: true }];
  expect(orderChecklistItems(items).map(item => item.id)).toEqual(['b', 'a', 'c']);
  expect(orderChecklistItems(items.map(item => ({ ...item, done: false }))).map(item => item.id)).toEqual(['a', 'b', 'c']);
  expect(items.map(item => item.id)).toEqual(['a', 'b', 'c']);
});
