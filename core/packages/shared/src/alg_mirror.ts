/**
 * 单槽 case 的镜像重写(issue #40 T5)—— **纯文本层,不碰 cubing.js**。
 *
 * ## 三种重写,落到哪儿是定死的
 *
 * 槽统一归到 FR 之后,一个 case 有四个视角:`0=FR 1=FL 2=BL 3=BR`(库里 `algs` 数组的
 * 顺序,`oriNames` 就是这四个)。三种重写各自是四个视角上的一个对合,合起来是克莱因四元群:
 *
 * ```
 *   左右镜 lr(M 平面) → 伙伴 case,FR↔FL、BL↔BR    R↔L 反向,F 仍是 F,**不冒出 B**
 *   前后镜 fb(S 平面) → 伙伴 case,FR↔BR、FL↔BL    F↔B 反向,含 F 的公式会**变出 B**
 *   y²    (纯旋转)    → **本 case**,FR↔BL、FL↔BR   不是镜像,只是换个朝向做同一件事
 * ```
 *
 * 这不是推的,是库里的数据本来就长这样:f2l `A+` 第 0 视角首条 `U R U' R'`,而 `A-` 的
 * 第 1 视角(FL)首条正是 `U' L' U L` = 它的左右镜、第 3 视角(BR)首条正是 `U' R' U R`
 * = 它的前后镜,`A+` 自己第 2 视角(BL)首条正是 `U L U' L'` = 它的 y²。三处逐字对上。
 *
 * ## 为什么不复用 `lib/cube3.ts` 的那两个
 *
 * 那两个走 cubing.js 解析,server 端不该为了重写一串字母去拉整个 cubing。**规则表只有一份**
 * (`./alg_notation` 的 `MIRROR_SWAP` / `MIRROR_EXEMPT` / `ROTATE_Y`),这里和 cube3 只是两个
 * 解析器套同一张表;两条路的一致性由 `tests/alg_mirror_rewrite.test.ts` 逐条对撞守住。
 *
 * 落在镜面**法线轴**上的 `M`/`m`/`x` 在左右镜下**不取反** —— 理由写在 `MIRROR_EXEMPT` 的注释里,
 * 那个错已经犯过两次。别在这儿重推一遍。
 */
import {
  flattenAlg,
  mirrorFamily,
  mirrorKeepsAmount,
  relabelYMoveString,
  renderMove,
  tokenizeMoves,
  type MirrorAxis,
  type ParsedMove,
} from './alg_notation';
import type { AlgEntry } from './alg';

export type { AlgEntry };
export { relabelYMoveString };

/**
 * 吃镜像系统(issue #40 T5)的 set —— **`puzzle/set` 全名**,client 与 server 共用这一份。
 *
 * 门槛:每个 case 有且仅有一个 F2L 槽、槽已归一到 FR、镜像伙伴**就在同一个 set 里**。
 * 八个候选逐一核过(`scripts/mirror-link-plan.mts`,结果见 docs/issue-40-alg-mirror-plan.md §5.7),
 * 只有这三个够格:
 *
 *   f2l   41 案:38 配对 + 3 自镜像,一个不缺;± 命名与状态判据 38/38 全对
 *   zbls  305 案:296 配对 + 9 自镜像,一个不缺(但 ± 命名只有 32/284 对得上 —— 别信名字)
 *   cls   97 案:93 配对 + 3 自镜像 + 1 缺(那 1 个槽在 BL,归一后补上)
 *
 * 这三个只是**有镜像伙伴**;能不能把生成的公式写回库是另一档,见 {@link MIRROR_ALG_SYNC_SETS}。
 *
 * 落选的原因各不相同,想加回来先看 §5.7:
 *   wv / sv / vls —— 各自只覆盖**一种** F2L 构型(全 A+ / 全 B+ / 全 A+),镜像伙伴那一族
 *                    库里压根没收录,开了就等于凭空造 243 个 case;
 *   adv-f2l       —— 54 个 case **每个破两个槽**,按设计就不是单槽 set;
 *   sbls          —— Roux 二块,补 y² 之后 σ 仍成立,但 65 个伙伴全不在库,
 *                    且 40/65 的 setup 带 x 转体,颜色框架都不统一。
 */
export const MIRROR_SETS: ReadonlySet<string> = new Set(['3x3/f2l', '3x3/zbls', '3x3/cls']);

/**
 * 还能把生成的镜像公式**写回库**的 set —— 比 {@link MIRROR_SETS} 少一个 cls。
 *
 * 差别不在数学上,在数据形状上:镜像公式落到的是**别的视角**(左右镜落伙伴的 FL、前后镜落
 * 伙伴的 BR、y² 落自己的 BL,见上面那张表),而 f2l / zbls 的每个 case 都存了四个视角的
 * 公式数组,cls 只存一个(FR)。cls 没有 FL / BL / BR 那三个数组,生成的公式**没有格子可放**。
 *
 * 所以 cls 拿得到伙伴链和 case 页上现算的三份镜像,拿不到入库同步。要让它也同步,得先给
 * cls 补四视角数据(独立一件事,不在 T5 里)。
 */
export const MIRROR_ALG_SYNC_SETS: ReadonlySet<string> = new Set(['3x3/f2l', '3x3/zbls']);

/** 三种重写。`lr` / `fb` 是真镜像(换手性),`y2` 只是掉头。 */
export type MirrorGen = 'lr' | 'fb' | 'y2';

export const MIRROR_GENS: readonly MirrorGen[] = ['lr', 'fb', 'y2'];

/** 视角下标 —— 与 `AlgCase.algs` / `oriNames` 同序。 */
export const VIEWS = ['FR', 'FL', 'BL', 'BR'] as const;

/** 每种重写把第 v 个视角送到哪个视角。三张表都是对合,两两复合得第三张。 */
export const MIRROR_VIEW: Record<MirrorGen, readonly number[]> = {
  lr: [1, 0, 3, 2],
  fb: [3, 2, 1, 0],
  y2: [2, 3, 0, 1],
};

/** 重写后的公式落在伙伴 case 还是本 case 上。 */
export const MIRROR_TARGET: Record<MirrorGen, 'partner' | 'self'> = {
  lr: 'partner',
  fb: 'partner',
  y2: 'self',
};

function rewrite(alg: string, f: (m: ParsedMove) => { family: string; amount: number }): string {
  const { moves, junk } = tokenizeMoves(flattenAlg(alg));
  if (junk.length) throw new Error(`认不出来的记号:${junk.join(' ')}`);
  return moves.map(m => {
    const next = f(m);
    // 半圈没有方向。镜像把源里的 `U2` 一律翻成 `U2'`,那是记法噪音不是动作差别 ——
    // 抹平它,免得生成的公式满屏 `U2'`。只动 ±2,别的量照写(`R4` 之类在 SQTM 下有意义)。
    // 这条只对四阶轴成立,而镜像表本来就只有立方体记号,前提天然满足。
    if (next.amount === -2) next.amount = 2;
    return renderMove({ layer: m.layer, ...next });
  }).join(' ');
}

/** 镜像一条公式。`axis` 是镜面:`M` = 左右、`S` = 前后、`E` = 上下。 */
export function mirrorMoveString(alg: string, axis: MirrorAxis): string {
  return rewrite(alg, m => ({
    family: mirrorFamily(m.family, axis),
    amount: mirrorKeepsAmount(m.family, axis) ? m.amount : -m.amount,
  }));
}

/** 按 {@link MirrorGen} 重写一条公式。 */
export function applyMirrorGen(alg: string, gen: MirrorGen): string {
  if (gen === 'lr') return mirrorMoveString(alg, 'M');
  if (gen === 'fb') return mirrorMoveString(alg, 'S');
  return relabelYMoveString(alg, 2);
}

/** F 族 / B 族 —— `Fw` 与 `f` 是同一件事的两种写法,都要认。 */
const B_FAMILIES = new Set(['B', 'b', 'Bw']);

/**
 * 这条公式该生成哪几份(方案 §5.2)。
 *
 * 判据只有一条:**生成出来的那条里不许有 B 族**(`B` / `b` / `Bw`)。B 面在魔友手里是背面,
 * 盲拧才转它 —— 自动塞给人一条要转背面的公式,不如不给。
 *
 * 所以直接把三份都算出来,谁带 B 谁出局。曾经是按**源公式**的族来判(「含 F 不含 B → 只补
 * 左右镜;本来就含 B → 三份都给」),那条规则漏了一格:左右镜保 B 不变,源里带 B 时它原样
 * 带过去,照样生成出要转背面的公式(实测 zbls A+/VP 就中了)。按结果判既堵上这格,也不必再
 * 论证「哪个族经哪次镜像会变成什么」——
 *   `S` / `z` 的轴与前后镜的镜面法向平行,轴自己那次翻转和手性那次抵消(`S → S`),冒不出 B;
 *   `f` = `F` + `S`,会变 `b`。
 * 这些以前都得写在注释里提醒,现在算一遍就知道了。
 */
export function mirrorGensFor(alg: string): MirrorGen[] {
  return MIRROR_GENS.filter(gen => {
    let out: string;
    try { out = applyMirrorGen(alg, gen); } catch { return false; }
    return !tokenizeMoves(out).moves.some(m => B_FAMILIES.has(m.family));
  });
}

/**
 * 去重用的规范形:折 mod 4 + 丢掉净转量为 0 的步 + 统一空格。
 *
 * **只对每根轴都是四阶的魔方(NxN)成立** —— 金字塔 / 五魔的轴不是四阶,别拿它去比。
 * 镜像系统本来就只跑 3x3,这里显式写死这个前提。
 */
export function canonicalNnnAlg(alg: string): string {
  const { moves, junk } = tokenizeMoves(flattenAlg(alg));
  if (junk.length) return alg.trim();
  const out: string[] = [];
  for (const m of moves) {
    const wrapped = ((m.amount % 4) + 4) % 4;
    if (wrapped === 0) continue;
    out.push(renderMove({ layer: m.layer, family: m.family, amount: wrapped === 3 ? -1 : wrapped }));
  }
  return out.join(' ');
}

// ---------------------------------------------------------------- 成对重算

export interface MirrorPairCase {
  id: number;
  /** 四个视角的公式数组,**原样传进来**(生成条也留着,这里自己剥) */
  algs: AlgEntry[][];
}

export interface MirrorRegenResult {
  /** case id → 重算后的四视角数组。传进来几个 case 就有几个,调用方自己 diff 再落库。 */
  algsById: Map<number, AlgEntry[][]>;
  /** 没能生成的条目 —— 记号认不出来之类。空 = 一条不落全生成了。 */
  notes: string[];
}

/**
 * 把一对(或一个自镜像的)case 的镜像公式**整体重算**。
 *
 * ## 为什么是「整体重算」而不是「增量同步」
 *
 * 增量要回答「这条生成公式的源头还在不在」,于是得给每条原创公式发一个 lineage id 并跟着
 * 编辑/重排/删除维护 —— 三条路径任一漏一次就留下孤儿。整体重算把这个问题消掉:**生成条永远
 * 不是状态,只是当前原创条的函数**。改一条、删一条、拖动排序,都只是重新算一遍。
 *
 * §5.5 要的「排序传播」也就自动有了 —— 源那边换了顺序,生成的左右镜份跟着换,因为它们本来
 * 就是按源顺序排的。不需要单独的 reorder 端点。
 *
 * ## 只拿第 0 视角(FR)当源
 *
 * FR 是这套库的规范视角,另外三个视角本来就是「同一个 case 换个槽的说法」。四个视角都当源,
 * 每个视角都会被另外三个灌进来,一个 case 的公式数会翻两番;只认 FR 当源,则每个目标视角
 * 恰好有唯一一个来源,**FR 那栏永远是纯人写的**。方案 §5.0 / §5.7 的所有计数也都是按这个口径。
 *
 * @param self    被编辑的那个 case
 * @param partner 镜像伙伴。`null` = 还没建链或链断了 —— 这时只**剥掉**生成条,不生成新的
 *                (case 被删掉后 `ON DELETE SET NULL` 会把伙伴的链置空,孤儿就是这么清掉的);
 *                传 `self` 自己 = 自镜像 case,三份都落回自己身上。
 */
export function regenerateMirrorAlgs(
  self: MirrorPairCase,
  partner: MirrorPairCase | null,
): MirrorRegenResult {
  const notes: string[] = [];
  const algsById = new Map<number, AlgEntry[][]>();
  const distinct = partner && partner.id !== self.id ? [self, partner] : [self];

  for (const c of distinct) {
    if (c.algs.length !== VIEWS.length) {
      notes.push(`case ${c.id} 有 ${c.algs.length} 个视角,镜像同步要 ${VIEWS.length} 个 —— 整对跳过`);
      return { algsById: new Map(), notes };
    }
    algsById.set(c.id, c.algs.map(view => view.filter(e => !e.gen)));
  }
  // 链断了:剥干净就收工,别拿自己当伙伴生成一堆错东西
  if (!partner) return { algsById, notes };

  const pairs: Array<[MirrorPairCase, MirrorPairCase]> = distinct.length === 1
    ? [[self, self]]
    : [[self, partner], [partner, self]];

  for (const [src, srcPartner] of pairs) {
    (src.algs[0] ?? []).forEach((entry, i) => {
      // 生成条不当源头 —— 否则镜像的镜像会一轮轮长出来
      if (entry.gen) return;
      for (const gen of mirrorGensFor(entry.alg)) {
        let alg: string;
        try {
          alg = applyMirrorGen(entry.alg, gen);
        } catch (e) {
          notes.push(`case ${src.id} 第 ${i} 条的 ${gen} 重写失败:${(e as Error).message}`);
          continue;
        }
        const dst = MIRROR_TARGET[gen] === 'self' ? src : srcPartner;
        const list = algsById.get(dst.id)?.[MIRROR_VIEW[gen][0]];
        if (!list) continue;
        const key = canonicalNnnAlg(alg);
        // 字面重合就跳过 —— 库里本来就人工收了不少镜像份(f2l `A-` 的 FL 首条就是 `A+` 的
        // 左右镜),自镜像 case 更是常常镜回自己身上一模一样的东西。
        if (!key || list.some(e => canonicalNnnAlg(e.alg) === key)) continue;
        const made: AlgEntry = { alg, gen, src: { id: src.id, ori: 0, i } };
        // 步数镜像后不变;出处跟着源走(作者还是写源那条的人)。
        // algHtml / ytId / tags 一律不带:指法标注、教学视频、单手标签讲的都是**那只手**的事。
        if (entry.stm != null) made.stm = entry.stm;
        if (entry.sqtm != null) made.sqtm = entry.sqtm;
        if (entry.source) made.source = entry.source;
        list.push(made);
      }
    });
  }
  return { algsById, notes };
}

// ---------------------------------------------------------------- 连带删除预览

/** 一条会被牵连抹掉的**自动生成**公式。 */
export interface MirrorCascadeEntry {
  /** 它落在哪张 case 上(可能不是正在编辑的这张) */
  caseId: number;
  /** 落在第几个视角,下标同 {@link VIEWS} */
  view: number;
  gen: MirrorGen;
  alg: string;
}

/**
 * `before` 里有、`after` 里没了的**生成条**。
 *
 * 人写的条不看 —— 「连带」按定义只连带得到生成条,人写的那条(用户自己点删的那条)是主角
 * 不是连带,混进来只会让清单看不出重点。
 */
function droppedGenerated(
  before: Map<number, AlgEntry[][]>,
  after: Map<number, AlgEntry[][]>,
): MirrorCascadeEntry[] {
  const out: MirrorCascadeEntry[] = [];
  for (const [caseId, views] of before) {
    views.forEach((list, view) => {
      const kept = new Set((after.get(caseId)?.[view] ?? []).map(e => canonicalNnnAlg(e.alg)));
      for (const e of list) {
        if (!e.gen || kept.has(canonicalNnnAlg(e.alg))) continue;
        out.push({ caseId, view, gen: e.gen, alg: e.alg });
      }
    });
  }
  return out;
}

/**
 * 把 `self` 的公式换成 `nextAlgs`(通常是「删掉其中一条」)之后,**哪些生成公式会跟着没**。
 *
 * 前后各跑一遍 {@link regenerateMirrorAlgs} 再做差 —— 判据只有那一份,这里不重写一遍规则,
 * 所以列出来的就是保存后 server 真会抹掉的那些,不是另算的近似。
 *
 * 为什么删一条要问一句:生成条是源的函数,而它**落在别的 case 上**(左右镜落伙伴的 FL、
 * 前后镜落伙伴的 BR),站在眼前这张 case 上根本看不见 —— 不摊开就是静默删。
 *
 * `partner` 为 null(没建链)时恒空:没链就一条都不生成,自然也没有连带。
 */
export function mirrorCascadeOnEdit(
  self: MirrorPairCase,
  partner: MirrorPairCase | null,
  nextAlgs: AlgEntry[][],
): MirrorCascadeEntry[] {
  if (!partner) return [];
  return droppedGenerated(
    regenerateMirrorAlgs(self, partner).algsById,
    regenerateMirrorAlgs({ id: self.id, algs: nextAlgs }, partner).algsById,
  );
}

/**
 * 删掉整张 `self` 之后,**伙伴那边**会被剥掉的生成公式。
 *
 * case 一删,`ON DELETE SET NULL` 把伙伴的 `mirror_case_id` 置空,伙伴下一次重算走的是
 * 「只剥不生成」那条路 —— 所以剥掉的不止源自 `self` 的那几条,**伙伴自己的 y² 那份也一起没**。
 * 这条反直觉,正是二次确认该摊开给人看的东西。
 */
export function mirrorCascadeOnDelete(
  self: MirrorPairCase,
  partner: MirrorPairCase | null,
): MirrorCascadeEntry[] {
  if (!partner || partner.id === self.id) return [];
  const before = regenerateMirrorAlgs(partner, self).algsById;
  // self 整张都要没了,它自己那些公式是「主角」,由调用方单独列,不算连带
  before.delete(self.id);
  return droppedGenerated(before, regenerateMirrorAlgs(partner, null).algsById);
}
