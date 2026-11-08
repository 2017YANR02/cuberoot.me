import { expect, it } from 'vitest';
import { LBL_STEPS } from '../app/[lang]/tutorial/lbl/content';
import { daisyPracticeExample, DAISY_PRACTICE_TARGET } from '../app/[lang]/tutorial/lbl/daisy-practice';
import { practiceState, practiceTargetStates } from '../app/[lang]/tutorial/lbl/practice-state';

const colors = Array<string>(54).fill('gray');
colors[4] = 'yellow';
for (const i of [28, 30, 32, 34]) colors[i] = 'white';
const state = (alg: string): string[] => (JSON.parse(practiceState(colors, alg)) as string[][]).flat();
const targets = practiceTargetStates(colors, DAISY_PRACTICE_TARGET);
const examples = LBL_STEPS.find(step => step.id === 'daisy')!.examples;

it('all daisy exercises finish with four white petals around the yellow center', () => {
  const completed = state(DAISY_PRACTICE_TARGET);
  expect([1, 3, 5, 7].map(i => completed[i])).toEqual(Array(4).fill('white'));
  examples.forEach((example, index) => {
    const practice = daisyPracticeExample(example, index);
    expect(targets.has(practiceState(colors, practice.setup!))).toBe(false);
    expect(targets.has(practiceState(colors, `${practice.setup} ${practice.alg}`))).toBe(true);
  });
});

it.each([
  { index: 3, slot: 19, partial: 'F', blocked: 'F R' },
  { index: 4, slot: 25, partial: 'F', blocked: "F L'" },
  { index: 5, slot: 28, partial: "y'", blocked: "y' R2" },
])('starts case $index with three petals and requires finishing the fourth', ({ index, slot, partial, blocked }) => {
  const practice = daisyPracticeExample(examples[index], index);
  const initial = state(practice.setup!);
  expect([1, 3, 5, 7].filter(i => initial[i] === 'white')).toHaveLength(3);
  expect(initial[slot]).toBe('white');
  expect(initial.filter(color => color === 'white')).toHaveLength(4);
  expect(targets.has(practiceState(colors, `${practice.setup} ${partial}`))).toBe(false);
  expect(targets.has(practiceState(colors, `${practice.setup} ${blocked}`))).toBe(false);
});