import { expect, it } from 'vitest';
import { activeChapters, chapters, practiceExampleOrder } from '../app/[lang]/tutorial/lbl/curriculum';

it('orders bottom corners like the tutorial: right, left, up, bottom', () => {
  const chapter = activeChapters.find(chapter => chapter.id === 'corners')!;
  expect(practiceExampleOrder(chapter)).toEqual([0, 2, 3, 1]);
  expect(chapter.lessons.find(lesson => lesson.id === 'case-1')!.practiceIndices).toEqual([1]);
  expect(practiceExampleOrder(chapter).indexOf(1)).toBe(3);
});

it('covers every exercise once and follows lesson order across all chapters', () => {
  for (const chapter of [...chapters, ...activeChapters]) {
    const order = practiceExampleOrder(chapter);
    expect([...order].sort((a, b) => a - b)).toEqual(chapter.examples.map((_, index) => index));
    const taught = chapter.lessons.flatMap(lesson => lesson.practiceIndices ?? []);
    expect(order.slice(0, taught.length)).toEqual(taught);
  }
});

it('keeps grouped daisy and middle-edge exercises in teaching order', () => {
  for (const id of ['daisy', 'middle', 'yellow-face']) {
    const chapter = activeChapters.find(chapter => chapter.id === id)!;
    expect(practiceExampleOrder(chapter)).toEqual(chapter.examples.map((_, index) => index));
  }
});
