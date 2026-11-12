import { describe, expect, it } from 'vitest';
import { lrMirrorAlgHtml, regenerateMirrorAlgs, type MirrorPairCase } from '@cuberoot/shared/alg-mirror';

describe('LR annotation mapping', () => {
  it('mirrors corresponding moves and preserves target groups, signed half turns and hidden y', () => {
    expect(lrMirrorAlgHtml({ alg: "(F U2' F')", algHtml: '(F <u class="wavy"><s><em>U2\'</em></s></u> F\')' }, "(F' U2 F) y"))
      .toBe('(F\' <u class="wavy"><s><em>U2</em></s></u> F) y');
  });
  it('rejects unmatched markup and explicit grip notation instead of guessing hand semantics', () => {
    expect(lrMirrorAlgHtml({ alg: 'F U', algHtml: '<s>F D</s>' }, "F' U'")).toBeNull();
    expect(lrMirrorAlgHtml({ alg: 'F U ↑', algHtml: 'F <s>U</s> ↑' }, "F' U'")).toBeNull();
  });
  it('does not mutate input or copy videos and single-hand labels to generated rows', () => {
    const self: MirrorPairCase = { id: 1, algs: [[{ alg: "F U F'", algHtml: "F <s>U</s> F'", ytId: 'video', tags: ['oh'] }], [], [], []] };
    const snapshot = structuredClone(self);
    const made = regenerateMirrorAlgs(self, { id: 2, algs: [[], [], [], []] }).algsById.get(2)![1][0];
    expect(made.algHtml).toBe("F' <s>U'</s> F");
    expect(made.ytId).toBeUndefined();
    expect(made.tags).toBeUndefined();
    expect(self).toEqual(snapshot);
  });
});
