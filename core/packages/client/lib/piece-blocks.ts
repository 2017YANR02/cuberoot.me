/**
 * piece-blocks —— 从「招式的贴纸置换」自动推出「哪几张贴纸长在同一块上」。
 *
 * 画状态求解器需要知道块的划分:一个角块的 3 张贴纸不能同色、不能出现对面色,涂的时候就该拦
 * 住(三阶/二阶画板的 `STICKER_SIBLINGS` 就是干这个的)。但块划分是**几何**信息,而我们手上只有
 * tnoodle 那份贴纸置换表 —— 手抄一份「哪三个格是一个角」很容易错一位且不报错(斜转 / 金字塔的
 * 展开图各面朝向不同,肉眼数极易翻)。
 *
 * 好在块划分是被置换群唯一确定的:块是**群不变的划分**(a、b 同块 ⇒ 招式后 p(a)、p(b) 仍同块)。
 * 「假设 x 与 y 同块」在全部生成元下取闭包,就得到含该对的**最小**群不变划分。
 *
 * 但**一对贴纸一般生成不出整张划分**:贴纸在群作用下往往分成多个轨道,一次闭包只能约束到 x 所在的
 * 那个轨道。斜转就是活例 —— 4 个「轴角」(WCA 那 4 个把手)只自转、永不换位,于是 24 张角贴纸分成
 * 4 个大小 3 的轨道 + 1 个大小 12 的轨道;拿单对去闭包只会得到「四个 3 块 + 12 个单点」这种半成品。
 * 所以这里**增量**推:反复找「还没凑够 blockSize 的第一个 slot x」,枚举与谁同块,只留下让**所有**类
 * 都 ≤ blockSize 的候选(错的配对会把两个块粘成 >blockSize,自动淘汰),去重后必须唯一,否则抛。
 *
 * 生成元集合必须**含逆**(或本身是对合),否则闭包可能不完整。
 */

/** 并查集 —— 只在建表时跑一次,不必抠常数。 */
class UnionFind {
  private parent: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }

  find(x: number): number {
    let r = x;
    while (this.parent[r] !== r) r = this.parent[r];
    // 路径压缩
    let c = x;
    while (this.parent[c] !== c) { const next = this.parent[c]; this.parent[c] = r; c = next; }
    return r;
  }

  /** 合并;返回 true 表示这次真的合并了两个不同的类。 */
  union(a: number, b: number): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    this.parent[rb] = ra;
    return true;
  }
}

/** 把并查集的类按「首个成员的下标」排序后吐出(结果稳定,可直接比较 / 当 baseline)。 */
function groupsOf(uf: UnionFind, slots: readonly number[]): number[][] {
  const byRoot = new Map<number, number[]>();
  for (const s of slots) {
    const r = uf.find(s);
    const g = byRoot.get(r);
    if (g) g.push(s); else byRoot.set(r, [s]);
  }
  const out = [...byRoot.values()];
  for (const g of out) g.sort((a, b) => a - b);
  out.sort((a, b) => a[0] - b[0]);
  return out;
}

/**
 * 含全部给定「同块」约束的最小群不变划分。`perms[m][slot]` = 招式 m 之后该 slot 上的内容来自哪个
 * slot(方向无关紧要:只要生成元集合含逆,同一个不变划分两边都成立)。
 */
function closure(
  perms: ReadonlyArray<ArrayLike<number>>, nSlots: number, pairs: ReadonlyArray<readonly [number, number]>,
): UnionFind {
  const uf = new UnionFind(nSlots);
  const work: Array<[number, number]> = pairs.map(([a, b]) => [a, b]);
  while (work.length) {
    const [a, b] = work.pop()!;
    if (!uf.union(a, b)) continue;
    // a~b ⇒ 每个招式下 p(a)~p(b);传递闭包由并查集自己兜住。
    for (const p of perms) work.push([p[a] as number, p[b] as number]);
  }
  return uf;
}

export interface DeriveBlocksOptions {
  /** 参与划分的 slot 下标(如斜转的 24 张角贴纸,把 6 张中心排除在外)。 */
  slots: readonly number[];
  /** 每块几张贴纸(角 3、棱 2)。 */
  blockSize: number;
  /**
   * 一块凑满时判它物理上可不可能(如「3 色互不相同且无对面色」)。每轮都用它筛候选 —— 光靠
   * 「别超过 blockSize」不够:错配可能产出一堆小类,大小上过关但块内同面同色,得靠这条淘汰。
   */
  acceptBlock?: (block: readonly number[]) => boolean;
}

/**
 * 推出唯一的块划分。`perms[m]` 是长度 = 贴纸总数的置换表(见 `closure` 的说明)。
 * @throws 候选不唯一(0 个或多个)时抛 —— 说明生成元集合或 `accept` 谓词给得不对。
 */
export function derivePieceBlocks(
  perms: ReadonlyArray<ArrayLike<number>>,
  nSlots: number,
  opts: DeriveBlocksOptions,
): number[][] {
  const { slots, blockSize, acceptBlock } = opts;
  const ok = (blocks: number[][]) => !acceptBlock
    || blocks.every((b) => b.length !== blockSize || acceptBlock(b));
  const pairs: Array<readonly [number, number]> = [];

  // 每轮补一个约束,直到所有类都凑满 blockSize。轮数 ≤ slots.length,不会转不停。
  for (let guard = 0; guard <= slots.length; guard++) {
    const blocks = groupsOf(closure(perms, nSlots, pairs), slots);
    const short = blocks.find((b) => b.length < blockSize);
    if (!short) {
      if (blocks.some((b) => b.length !== blockSize)) {
        throw new Error(`derivePieceBlocks: 出现超大块(blockSize=${blockSize})`);
      }
      if (!ok(blocks)) throw new Error('derivePieceBlocks: 划分不满足 acceptBlock 谓词');
      return blocks;
    }

    // x 的「相容伙伴」= 与它同块不会撑爆任何类、也不会造出物理上不可能的块的那些 slot。
    // 一次把它们全并成一块(别一对一对来:有些块的贴纸彼此都是不动点 —— 斜转那 4 个轴恰好
    // 整个不动一个角 —— 合并一对不会因闭包自动补齐第三张,逐对推进就会卡死或误判歧义)。
    const x = short[0];
    const partners: number[] = [];
    for (const y of slots) {
      if (short.includes(y)) continue;
      const cand = groupsOf(closure(perms, nSlots, [...pairs, [x, y]]), slots);
      if (cand.some((b) => b.length > blockSize)) continue;
      if (!ok(cand)) continue;
      partners.push(y);
    }
    const block = new Set([...short, ...partners]);
    if (block.size !== blockSize) {
      throw new Error(
        `derivePieceBlocks: slot ${x} 凑不出一块(相容伙伴 ${partners.length} 个 → 块大小 ${block.size},期望 ${blockSize})`,
      );
    }
    for (const y of partners) pairs.push([x, y]);
  }

  throw new Error('derivePieceBlocks: 迭代未收敛');
}
