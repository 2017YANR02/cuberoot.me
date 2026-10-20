import { expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { LBL_STEPS } from '@/app/[lang]/tutorial/lbl/content';
import { getLblAlgGroups } from '@/app/[lang]/tutorial/lbl/alg-cues';
import { INSTRUCTION_PHASES, splitInstruction } from '@/app/[lang]/tutorial/lbl/instruction-phases';

for (const step of LBL_STEPS.filter(step => step.id !== 'structure')) {
  for (const [index, example] of step.examples.entries()) {
    for (const lang of ['zh', 'en'] as const) {
      it(`${step.id}/${index}/${lang}: covers every move once and preserves the complete instruction`, () => {
        const instruction = (step.id === 'cross' ? step.paragraphs[0] : example.hint)[lang];
        const count = new Alg(example.alg).expand().toString().split(/\s+/).length;
        if (step.id === 'middle' && index !== 2) {
          expect(instruction.split(' → ').length).toBe(getLblAlgGroups(step.id, example.alg).length);
          return;
        }
        const phases = INSTRUCTION_PHASES[step.id][index];
        const parts = splitInstruction(instruction, phases, text => text[lang]);
        expect(parts.map(part => part.text).join('')).toBe(instruction);
        expect(parts.filter(part => part.moves).length).toBe(phases.length);
        const moves = parts.flatMap(part => part.moves ?? []).sort((a, b) => a - b);
        expect(moves).toEqual(Array.from({ length: count }, (_, i) => i + 1));
      });
    }
  }
}

it('keeps next-case guidance out of the active phase', () => {
  const hint = LBL_STEPS.find(step => step.id === 'yellow-cross')!.examples[2].hint.zh;
  const parts = splitInstruction(hint, INSTRUCTION_PHASES['yellow-cross'][2], text => text.zh);
  expect(parts.at(-1)?.moves).toBeUndefined();
  expect(parts.at(-1)?.text).toContain('再选择“横线”继续');
  const daisy = LBL_STEPS.find(step => step.id === 'daisy')!.examples[5].hint.zh;
  expect(splitInstruction(daisy, INSTRUCTION_PHASES.daisy[5], text => text.zh)[0]).toEqual({ text: '把这条白棱放到右层', moves: [1] });
});
