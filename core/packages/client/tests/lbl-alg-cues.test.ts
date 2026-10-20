import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { getLblAlgGroups } from '@/app/[lang]/tutorial/lbl/alg-cues';
import { LBL_STEPS } from '@/app/[lang]/tutorial/lbl/content';

describe('LBL bilingual move cues', () => {
  it('labels the corner-position alignment turns separately from the taught algorithm', () => {
    const examples = LBL_STEPS.find(step => step.id === 'corner-position')!.examples;
    expect(getLblAlgGroups('corner-position', examples[0].alg).map(group => group.length)).toEqual([1, 4, 4, 5, 1]);
    expect(getLblAlgGroups('corner-position', examples[0].alg)[0][0].cue.zh).toBe('眼放左');
    expect(getLblAlgGroups('corner-position', examples[1].alg).map(group => group.length)).toEqual([4, 4, 5]);
  });
  it('labels the wall placement and final alignment without repeating the edge algorithms', () => {
    const examples = LBL_STEPS.find(step => step.id === 'edge-position')!.examples;
    expect(getLblAlgGroups('edge-position', examples[2].alg).map(group => group.length)).toEqual([7, 1, 7, 1]);
    for (const example of examples.slice(0, 2)) {
      const groups = getLblAlgGroups('edge-position', example.alg);
      expect(groups.map(group => group.length)).toEqual([1, 7, 1, 7, 1]);
      expect(groups[0][0].cue.zh).toBe('墙放后');
      expect(groups.at(-1)![0].cue.zh).toBe('顶层对齐');
    }
  });
  for (const step of LBL_STEPS) for (const example of step.examples) {
    it(`${step.id}: ${example.title.en} preserves every playback move, including final alignment`, () => {
      const moves = getLblAlgGroups(step.id, example.alg).flat();
      const expected = new Alg(example.alg).expand().toString().split(/\s+/);
      expect(moves.map(move => move.notation)).toEqual(expected);
      expect(moves.map(move => move.index)).toEqual(expected.map((_, i) => i));
      for (const move of moves) {
        expect(move.cue.zh).toMatch(/[\u4e00-\u9fff]/);
        expect(move.cue.en).not.toBe(move.notation);
      }
    });
  }

  it('keeps both four-move triggers intact and puts the divider after the cube rotation', () => {
    const examples = LBL_STEPS.find(step => step.id === 'middle')!.examples;
    expect(getLblAlgGroups('middle', examples[0].alg).map(group => group.map(move => [move.cue.zh, move.notation]))).toEqual([
      [['转顶层', 'U']],
      [['对齐', 'd']],
      [['左', 'U']],
      [['上', 'R'], ['勾', 'U'], ['下', "R'"], ['回', "U'"]],
      [['左转体', 'y']],
      [['上', "L'"], ['勾', "U'"], ['下', 'L'], ['回', 'U']],
    ]);
    expect(getLblAlgGroups('middle', examples[1].alg).map(group => group.map(move => move.cue.zh).join('')))
      .toEqual(['转顶层', '对齐', '右', '上勾下回', '右转体', '上勾下回']);
  });

  it('uses the fish mnemonic for both hands instead of labeling every U as hook', () => {
    for (const example of LBL_STEPS.find(step => step.id === 'yellow-face')!.examples) {
      expect(getLblAlgGroups('yellow-face', example.alg).map(group => group.map(move => move.cue.zh)))
        .toEqual([['转顶层'], ['上', '勾', '下', '勾', '上', '连拨', '下']]);
    }
  });
});
