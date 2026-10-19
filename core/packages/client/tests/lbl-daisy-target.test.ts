import { expect, it } from 'vitest';
import { LBL_STEPS } from '@/app/[lang]/tutorial/lbl/content';
import { practiceState } from '@/app/[lang]/tutorial/lbl/practice-state';
const ids = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(f => Array.from({ length: 9 }, (_, i) => f + i));
for (const [i, example] of LBL_STEPS.find(s => s.id === 'daisy')!.examples.entries()) {
  it('tracks the target white sticker into the petal: ' + example.title.en, () => {
    const end = JSON.parse(practiceState(ids, example.setup + ' ' + example.alg));
    expect(end[0][[5, 5, 3, 5, 3, 5][i]]).toBe(i === 2 ? 'D3' : 'D5');
  });
}
