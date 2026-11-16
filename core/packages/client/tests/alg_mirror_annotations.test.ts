import { describe, expect, it } from 'vitest';
import { lrMirrorAlgHtml, lrMirrorEntry, planExistingLrAnnotationRepairs, regenerateMirrorAlgs, syncCaseOrientationAnnotations, syncExistingLrAnnotations, type AlgEntry, type MirrorPairCase } from '@cuberoot/shared/alg-mirror';
import { algHtmlMatchesText, algHtmlRuns, algHtmlText } from '@cuberoot/shared/alg-html';
import type { AlgFile } from '@cuberoot/shared/alg';

describe('annotations across the same case orientations', () => {
  const algorithms = ["=y2 U L F U' F' L'", "=y2 U B L U' L' B'", "=y2 U R B U' B' R'", "=y2 U F R U' R' F'"];
  const expected = ["=y2 U L <u>F</u> <u>U'</u> F' L'", "=y2 U B <u>L</u> <u>U'</u> L' B'", "=y2 U R <u>B</u> <u>U'</u> B' R'", "=y2 U F <u>R</u> <u>U'</u> R' F'"];
  it('fills VP markings by corresponding moves, preserving the actual text and other metadata', () => {
    const views: AlgEntry[][] = algorithms.map((alg, i) => [{ alg, altId: `vp-${i}` }]);
    views[0][0].algHtml = "=y2 U L <u>F U'</u> F' L'";
    views[1].unshift({ alg: 'R U' });
    expect(syncCaseOrientationAnnotations(views)).toEqual([]);
    expect(views[1][0]).toEqual({ alg: 'R U' });
    for (let i = 1; i < 4; i++) expect(views[i].at(-1)).toEqual({ alg: algorithms[i], altId: `vp-${i}`, algHtml: expected[i] });
    const before = structuredClone(views);
    expect(syncCaseOrientationAnnotations(views)).toEqual([]);
    expect(views).toEqual(before);
  });
  it.each([0, 1, 2, 3])('propagates edits and explicit clears from orientation %i through the save path', from => {
    const before: AlgEntry[][] = algorithms.map((alg, i) => [{ alg, algHtml: expected[i] }]);
    const edited = structuredClone(before);
    edited[from][0].algHtml = expected[from].replaceAll('<u>', '<s>').replaceAll('</u>', '</s>');
    const result = regenerateMirrorAlgs({ id: 1, algs: edited }, null, before).algsById.get(1)!;
    for (let i = 0; i < 4; i++) expect(result[i][0].algHtml).toBe(expected[i].replaceAll('<u>', '<s>').replaceAll('</u>', '</s>'));
    const cleared = structuredClone(result);
    delete cleared[from][0].algHtml;
    const after = regenerateMirrorAlgs({ id: 1, algs: cleared }, null, result).algsById.get(1)!;
    expect(after.flat().every(e => e.algHtml === undefined)).toBe(true);
  });
});

describe('LR annotation mapping', () => {
  it('preserves formatting on group punctuation and repeated exponents in newly written counterparts', () => {
    const source = { alg: "U2 F (U R U' R')2 F'", algHtml: "U2 <em><strong>F</strong></em><strong> (U R U' R')2 F'</strong>", ytId: 'original-video', tags: ['beginner'] as const };
    const made = lrMirrorEntry({ ...source, tags: ['beginner'] })!;
    expect(made.alg).toBe("U2 F' (U' L' U L)2 F");
    expect(algHtmlMatchesText(made.alg, made.algHtml)).toBe(true);
    const runs = algHtmlRuns(made.algHtml!);
    const text = algHtmlText(made.algHtml!);
    for (const index of [text.indexOf('('), text.indexOf(')') + 1]) {
      expect(runs.find(r => r.start <= index && r.end > index)?.tags).toContain('<strong>');
    }
    expect(runs.filter(r => r.tags.includes('<em>')).map(r => r.text).join('')).toBe("F'");
    expect(made.ytId).toBeUndefined();
    expect(made.tags).toBeUndefined();
  });
  it('exchanges the confirmed down-grip hand without dropping marks, and rejects unknown grip semantics', () => {
    const source = { alg: "S (R' U' R U) (↓R U R U' R') S'", algHtml: "<strong>S (R' U' R <u>U</u>) (↓R U R U' R') <u>S'</u></strong>" };
    expect(lrMirrorEntry(source)).toBeNull();
    const made = lrMirrorEntry(source, { mirrorDownGrip: true })!;
    expect(made.alg).toBe("S' (L U L' U') (↓ L' U' L' U L) S");
    expect(algHtmlMatchesText(made.alg, made.algHtml)).toBe(true);
    expect(algHtmlRuns(made.algHtml!).filter(r => r.tags.includes('<u>')).map(r => r.text)).toEqual(["U'", 'S']);
    expect(lrMirrorEntry(made, { mirrorDownGrip: true })!.alg).toBe(source.alg);
    expect(lrMirrorEntry({ alg: '↓↓R U', algHtml: '↓↓R <u>U</u>' }, { mirrorDownGrip: true })).toBeNull();
  });
  it('retains OLL repeated groups and their finger annotations', () => {
    const source = { alg: "U2 f (U R U' R')2 f'", algHtml: "U2 <u>f</u> (U <s>R</s> U' R')2 f'" };
    expect(lrMirrorAlgHtml(source, "U2 f' (U' L' U L)2 f"))
      .toBe("U2 <u>f'</u> (U' <s>L'</s> U L)2 f");
    expect(lrMirrorAlgHtml(source, "U2 f' (U' L' U L)3 f")).toBeNull();
    expect(lrMirrorAlgHtml(source, "U2 f' (U' L' U L)2' f")).toBeNull();
    expect(lrMirrorAlgHtml({ ...source, algHtml: source.algHtml.replace(')2', ')3') }, "U2 f' (U' L' U L)2 f")).toBeNull();
    const target = { alg: "U2 f' (U' L' U L)2 f" } as AlgEntry;
    expect(syncExistingLrAnnotations([source], [target])).toEqual([]);
    expect(target.algHtml).toBe("U2 <u>f'</u> (U' <s>L'</s> U L)2 f");
  });
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

describe('existing single-view LR counterparts', () => {
  it('fills OLL 43/44 counterparts with different AUF while leaving those moves and marks intact', () => {
    const source = { alg: "F (U R U' R') F'", algHtml: "<em>F</em> (U R U' R') <em>F'</em>" };
    const targets: AlgEntry[] = [{ alg: "U F' (U' L' U L) F", algHtml: "<s>U</s> F' (U' L' U L) F" }, { alg: "U2 F' U' L' U L F U2" }];
    expect(syncExistingLrAnnotations([source], targets)).toEqual([]);
    expect(targets.map(e => e.algHtml)).toEqual(["<s>U</s> <em>F'</em> (U' L' U L) <em>F</em>", "U2 <em>F'</em> U' L' U L <em>F</em> U2"]);
    const before = structuredClone(targets);
    expect(syncExistingLrAnnotations([source], targets)).toEqual([]);
    expect(targets).toEqual(before);
    syncExistingLrAnnotations([{ alg: source.alg }], targets, [source]);
    expect(targets[0].algHtml).toBe("<s>U</s> F' (U' L' U L) F");
    expect(targets[1].algHtml).toBeUndefined();
  });
  it('does not infer finger marks on a different AUF or on a mismatched body', () => {
    const source = { alg: 'U R F', algHtml: '<u>U</u> R <s>F</s>' };
    const targets: AlgEntry[] = [{ alg: "U2 L' F'" }, { alg: "U2 L' D'" }];
    syncExistingLrAnnotations([source], targets);
    expect(targets[0].algHtml).toBe("U2 L' <s>F'</s>");
    expect(targets[1].algHtml).toBeUndefined();
  });
  it('does not treat an unconfirmed double-arrow grip as an unmarked copy of the same execution', () => {
    const targets: AlgEntry[] = [{ alg: "U ↑↑L' F'" }, { alg: "U L' F'" }];
    expect(syncExistingLrAnnotations([{ alg: "U' R F", algHtml: "U' R <s>F</s>" }], targets)).toEqual([]);
    expect(targets[0].algHtml).toBeUndefined();
    expect(targets[1].algHtml).toBe("U L' <s>F'</s>");
  });
  const gc: AlgEntry = {
    alg: "(R2' u' R U') (R U R' u ) (R2 f R' f')",
    algHtml: "(R2' <s>u'</s> R U') (R U R' <s><u>u</u></s> ) (R2 <em>f</em> R' f')",
  };
  const ga: AlgEntry = { alg: "(L2 u L' U) (L' U' L u') (L2' f' L f)", source: 'cuberoot', ytId: 'video', tags: ['beginner'] };
  it('repairs historical Ga/Gc marks bidirectionally and idempotently, retaining target fields', () => {
    const target = structuredClone(ga);
    expect(syncExistingLrAnnotations([gc], [target])).toEqual([]);
    expect(target).toEqual({ ...ga, algHtml: "(L2 <s>u</s> L' U) (L' U' L <s><u>u'</u></s>) (L2' <em>f'</em> L f)" });
    const reverse: AlgEntry = { alg: gc.alg };
    expect(syncExistingLrAnnotations([target], [reverse])).toEqual([]);
    expect(reverse.algHtml).toBe(gc.algHtml);
    expect(syncExistingLrAnnotations([gc], [target])).toEqual([]);
  });
  it.each(['<s>', '<u>', '<u class="wavy">', '<em>'])(
    'updates and removes %s from either side without resurrecting it', open => {
      const close = `</${open.match(/^<([a-z]+)/)![1]}>`;
      const source = { alg: "F U F'", algHtml: `F ${open}U${close} F'` };
      const target: AlgEntry = { alg: "F' U' F" };
      expect(syncExistingLrAnnotations([source], [target], [{ alg: source.alg }])).toEqual([]);
      expect(target.algHtml).toBe(`F' ${open}U'${close} F`);
      const previous = structuredClone(target);
      delete target.algHtml;
      expect(syncExistingLrAnnotations([target], [source], [previous])).toEqual([]);
      expect(source.algHtml).toBeUndefined();
      expect(syncExistingLrAnnotations([source], [target])).toEqual([]);
      expect(target.algHtml).toBeUndefined();
    });
  it('preserves conflicting annotations and never creates a missing formula', () => {
    const target = { alg: "F' U' F", algHtml: "F' <em>U'</em> F" };
    const source = { alg: "F U F'", algHtml: "F <s>U</s> F'" };
    expect(syncExistingLrAnnotations([source], [target])).toHaveLength(1);
    expect(target.algHtml).toBe("F' <em>U'</em> F");
    const empty: AlgEntry[] = [];
    syncExistingLrAnnotations([source], empty);
    expect(empty).toEqual([]);
    const blank = { alg: "F' U' F" };
    expect(syncExistingLrAnnotations([source, { alg: source.alg, algHtml: "F <em>U</em> F'" }], [blank])).toHaveLength(1);
    expect(blank).toEqual({ alg: "F' U' F" });
  });
  it('prefers actual finger marks over plain typography and preserves the target formatting', () => {
    const source = { alg: "F U F'", algHtml: "F <s>U</s> F'" };
    const target = { alg: "F' U' F", algHtml: "<strong>F' U' F</strong>" };
    expect(syncExistingLrAnnotations([source], [target])).toEqual([]);
    expect(target.algHtml).toBe("<strong>F' <s>U'</s> F</strong>");
    expect(syncExistingLrAnnotations([target], [source])).toEqual([]);
    expect(source.algHtml).toBe("F <s>U</s> F'");
    expect(syncExistingLrAnnotations([{ alg: source.alg, algHtml: `<strong>${source.alg}</strong>` }], [target], [{ alg: source.alg }])).toEqual([]);
    expect(target.algHtml).toBe("<strong>F' <s>U'</s> F</strong>");
  });
  it('fills only the unmarked corresponding move when both algorithms have some finger marks', () => {
    const source = { alg: 'F U', algHtml: '<em>F</em> <s>U</s>' };
    const target = { alg: "F' U'", algHtml: "<em>F'</em> U'" };
    expect(syncExistingLrAnnotations([source], [target])).toEqual([]);
    expect(target.algHtml).toBe("<em>F'</em> <s>U'</s>");
  });
  it('audits stored slot and table-number relations without changing the input snapshot', () => {
    const file = { puzzle: '3x3', set: 'f2l', cases: [
      { id: 1, name: 'B+', mirrorCaseId: 2, algs: [[], [{ alg: "F U F'", algHtml: "F <s>U</s> F'" }], [], []] },
      { id: 2, name: 'B-', mirrorCaseId: 1, algs: [[{ alg: "F' U' F" }], [], [], []] },
    ] } as unknown as AlgFile;
    const snapshot = structuredClone(file);
    const result = planExistingLrAnnotationRepairs(file);
    expect(result.cases[1].algs[0][0].algHtml).toBe("F' <s>U'</s> F");
    expect(result.coverage).toMatchObject({ marked: 1, linkedMarked: 1, unmatchedMarked: 0 });
    expect(result.notes).toEqual([]);
    expect(file).toEqual(snapshot);
    const single = { puzzle: '3x3', set: 'oll', cases: [
      { id: 90, name: 'a', meta: { no: 1, mirror: 2 }, algs: [[{ alg: "F U F'", algHtml: "F <s>U</s> F'" }]] },
      { id: 91, name: 'b', meta: { no: 2, mirror: 1 }, algs: [[{ alg: "F' U' F" }]] },
    ] } as unknown as AlgFile;
    expect(planExistingLrAnnotationRepairs(single).cases[1].algs[0][0].algHtml).toBe("F' <s>U'</s> F");
    expect(planExistingLrAnnotationRepairs({ ...single, puzzle: 'sq1' }).cases).toEqual(single.cases);
  });
});
