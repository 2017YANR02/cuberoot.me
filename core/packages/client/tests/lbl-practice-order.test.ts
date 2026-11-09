import { expect, it } from 'vitest';
import { activeChapters, chapters, practiceExampleOrder, practiceReviewLocation } from '../app/[lang]/tutorial/lbl/curriculum';

it('orders bottom corners like the tutorial: right, left, up, bottom', () => {
  const chapter = activeChapters.find(chapter => chapter.id === 'corners')!;
  expect(practiceExampleOrder(chapter)).toEqual([0, 2, 3, 1]);
  expect(chapter.lessons.find(lesson => lesson.id === 'case-1')!.practiceIndices).toEqual([1]);
  expect(practiceExampleOrder(chapter).indexOf(1)).toBe(3);
});

it('returns every exercise to its own tutorial section after reordering or grouping', () => {
  for (const chapter of activeChapters.filter(chapter => chapter.examples.length && chapter.id !== 'structure')) {
    practiceExampleOrder(chapter).forEach((exampleIndex, position) => {
      const review = practiceReviewLocation(chapter, String(position + 1));
      expect(chapter.lessons[review.section].practiceIndices).toContain(exampleIndex);
      expect(review.daisyLiftIndex).toBe(chapter.id === 'daisy' && exampleIndex === 1 ? 1 : 0);
    });
  }
  const cross = activeChapters.find(chapter => chapter.id === 'cross')!;
  expect(cross.lessons[practiceReviewLocation(cross, 'white-edge').section].id).toBe('white-edge');
  const middle = activeChapters.find(chapter => chapter.id === 'middle')!;
  expect(middle.lessons[practiceReviewLocation(middle, '1').section].id).toBe('case-0');
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
