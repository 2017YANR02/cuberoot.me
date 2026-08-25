/**
 * 「删这条会连带删掉哪些」的预览(`shared/src/alg_mirror.ts` 的 mirrorCascadeOnEdit /
 * mirrorCascadeOnDelete)。UI 拿它做二次确认清单。
 *
 * 这份清单唯一的价值是**准**:少列一条就等于静默删,多列一条就等于吓唬人。所以这里钉的
 * 全是「到底哪几条、落在谁的哪个视角」,而不是数量对不对。
 *
 * 重写规则本身在 `alg_mirror_rewrite.test.ts`,入库同步由 API 测试集覆盖,
 * 这里不重复那两层。
 */
import { describe, it, expect } from 'vitest';
import type { AlgEntry } from '@cuberoot/shared';
import {
  mirrorCascadeOnDelete,
  mirrorCascadeOnEdit,
  regenerateMirrorAlgs,
  type MirrorPairCase,
} from '@cuberoot/shared/alg-mirror';

/** 四个视角的空壳,第 0 个(FR)填人写的公式 —— 库里的形状就是这样。 */
const caseOf = (id: number, fr: string[]): MirrorPairCase => ({
  id,
  algs: [fr.map(alg => ({ alg })), [], [], []],
});

/** 先按当前规则生成一遍,得到「库里此刻真实的样子」(含生成条),再拿它当输入。 */
function synced(a: MirrorPairCase, b: MirrorPairCase | null): [MirrorPairCase, MirrorPairCase | null] {
  const { algsById } = regenerateMirrorAlgs(a, b);
  const put = (c: MirrorPairCase): MirrorPairCase => ({ id: c.id, algs: algsById.get(c.id) ?? c.algs });
  return [put(a), b ? (b.id === a.id ? put(a) : put(b)) : null];
}

/** 删掉第 0 视角第 i 条之后的 algs。 */
const without = (c: MirrorPairCase, i: number): AlgEntry[][] =>
  c.algs.map((view, vi) => (vi === 0 ? view.filter((_, j) => j !== i) : view));

const brief = (list: ReturnType<typeof mirrorCascadeOnEdit>) =>
  list.map(e => `${e.caseId}/${e.view}/${e.gen} ${e.alg}`).sort();

describe('mirrorCascadeOnEdit —— 删一条,连带哪几条', () => {
  it('不含 F 不含 B 的公式:三份全生成,删源三份全没', () => {
    // `U R U' R'` 的三份都不带 B → lr 落伙伴 FL、fb 落伙伴 BR、y² 落自己 BL
    const [self, partner] = synced(caseOf(1, ["U R U' R'"]), caseOf(2, []));
    const gone = mirrorCascadeOnEdit(self, partner, without(self, 0));
    expect(brief(gone)).toEqual([
      "1/2/y2 U L U' L'",
      "2/1/lr U' L' U L",
      "2/3/fb U' R' U R",
    ]);
  });

  it('生成结果带 B 的那几份本来就没生成,自然不在连带里', () => {
    // 含 F 不含 B → 只有左右镜出得来(§5.2 按结果判)
    const [self, partner] = synced(caseOf(1, ["U R U' F' U F"]), caseOf(2, []));
    const gone = mirrorCascadeOnEdit(self, partner, without(self, 0));
    expect(gone.map(e => e.gen)).toEqual(['lr']);
    expect(gone[0]).toMatchObject({ caseId: 2, view: 1 });
  });

  it('伙伴那边人工早就收了同一条:那条不是生成的,删源不动它', () => {
    // 伙伴 FL 手写了 `U' L' U L` —— 正是源的左右镜。生成时字面重合会跳过(不重复塞),
    // 所以库里那条是人写的,源没了它照样在。
    const self = caseOf(1, ["U R U' R'"]);
    const partner: MirrorPairCase = { id: 2, algs: [[], [{ alg: "U' L' U L" }], [], []] };
    const [s, p] = synced(self, partner);
    const gone = mirrorCascadeOnEdit(s, p, without(s, 0));
    expect(brief(gone)).toEqual([
      "1/2/y2 U L U' L'",
      "2/3/fb U' R' U R",
    ]);
  });

  it('只连带被删那条的,旁边那条的生成份一条不动', () => {
    // 多源时最容易写错的一档:按下标算而不是按内容算,删掉第 0 条会把第 1 条的份也带走。
    const [self, partner] = synced(caseOf(1, ["U R U' R'", "R U R' U'"]), caseOf(2, []));
    const gone = mirrorCascadeOnEdit(self, partner, without(self, 0));
    expect(brief(gone)).toEqual([
      "1/2/y2 U L U' L'",
      "2/1/lr U' L' U L",
      "2/3/fb U' R' U R",
    ]);
    // 第 1 条 `R U R' U'` 的三份仍在:换成删第 1 条,连带的正好是另外那三条
    expect(brief(mirrorCascadeOnEdit(self, partner, without(self, 1)))).toEqual([
      "1/2/y2 L U L' U'",
      "2/1/lr L' U' L U",
      "2/3/fb R' U' R U",
    ]);
  });

  it('自镜像 case:三份都落回自己身上', () => {
    const [self] = synced(caseOf(7, ["U R U' R'"]), caseOf(7, []));
    const gone = mirrorCascadeOnEdit(self, self, without(self, 0));
    expect(gone.every(e => e.caseId === 7)).toBe(true);
    expect(brief(gone)).toEqual([
      "7/1/lr U' L' U L",
      "7/2/y2 U L U' L'",
      "7/3/fb U' R' U R",
    ]);
  });

  it('没建链就一条都不生成 —— 连带恒空,不是「算不出来」', () => {
    const self = caseOf(1, ["U R U' R'"]);
    expect(mirrorCascadeOnEdit(self, null, without(self, 0))).toEqual([]);
  });

  it('删生成条本身不算连带 —— 它会按源重新长回来,不是「没了」', () => {
    const [self, partner] = synced(caseOf(1, ["U R U' R'"]), caseOf(2, []));
    // 伙伴 FL 那条生成的删掉:源还在,重算又生成同一条
    const nextPartner = partner!.algs.map((v, i) => (i === 1 ? [] : v));
    expect(mirrorCascadeOnEdit(partner!, self, nextPartner)).toEqual([]);
  });
});

describe('mirrorCascadeOnDelete —— 删整张 case', () => {
  it('伙伴那边源自本 case 的生成条全没', () => {
    const [self, partner] = synced(caseOf(1, ["U R U' R'"]), caseOf(2, []));
    const gone = mirrorCascadeOnDelete(self, partner);
    expect(brief(gone)).toEqual([
      "2/1/lr U' L' U L",
      "2/3/fb U' R' U R",
    ]);
  });

  it('链一断伙伴整批不再生成 —— 连它**自己的 y²** 也一起没(反直觉,所以要摊开)', () => {
    const [self, partner] = synced(caseOf(1, []), caseOf(2, ["U R U' R'"]));
    const gone = mirrorCascadeOnDelete(self, partner);
    expect(brief(gone)).toEqual(["2/2/y2 U L U' L'"]);
  });

  it('本 case 自己那些公式不算连带(它们是主角,调用方单独列)', () => {
    const [self, partner] = synced(caseOf(1, ["U R U' R'"]), caseOf(2, []));
    expect(mirrorCascadeOnDelete(self, partner).every(e => e.caseId === 2)).toBe(true);
  });

  it('自镜像 / 没建链:没有别的 case 受牵连', () => {
    const [self] = synced(caseOf(7, ["U R U' R'"]), caseOf(7, []));
    expect(mirrorCascadeOnDelete(self, self)).toEqual([]);
    expect(mirrorCascadeOnDelete(self, null)).toEqual([]);
  });
});
