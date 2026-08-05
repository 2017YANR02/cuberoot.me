/**
 * Best 2x2 Algs 的版式解析:CSV 二维表 → (分组, 格位, 公式候选[])。
 *
 * 全表 17 张公式页共用一种版式(实测,见 docs/best-2x2-algs-port.md §2):
 *
 *     A            B      C      D      E      F      G
 *   ┌────────────┬──────┬──────┬──────┬──────┬──────┬──────┐
 *   │ CLL        │      │      │      │      │      │      │  ← 页标题(下面没有公式行,丢)
 *   │ Sune       │      │      │      │      │      │      │  ← 分组表头:A 有字、其余全空
 *   │            │ alg  │ alg  │ alg  │ alg  │ alg  │ alg  │  ← 公式行:A 空、B..G 是同一格的
 *   │            │ alg  │      │ alg  │      │ alg  │      │     6 个格位,同列多行 = 备选
 *   └────────────┴──────┴──────┴──────┴──────┴──────┴──────┘
 *
 * 「格位」= 该分组下的第 n 列,n 固定 6 个(PBL 页 3 个)。格位的**几何含义**不在版式里,
 * 由公式自己反推(见 derive.mts)—— 版式层只管把字取干净,不猜语义。
 *
 * 被这套规则天然滤掉的:页标题行、列注记行(`Top` / `At an angle`)、页首署名、
 * H 列的零星空白与 `3.0` 这类残留 —— 它们要么在首个分组表头之前,要么所在行 A 列有字。
 */

/** 一格 = 一个 case 位;algs 按表里从上到下的顺序,首条是表主推的那条。 */
export interface SheetSlot {
  group: string;
  /** 该分组下的列序,0 = B 列。 */
  col: number;
  /** 每条公式的原文 + 它在表里的行号(报错时能指回表)。 */
  algs: { raw: string; row: number }[];
}

export interface SheetParse {
  sheet: string;
  slots: SheetSlot[];
  /** 分组出现顺序(= 表里从上到下)。 */
  groups: string[];
  /** 落在公式列之外、又不是表头的字 —— 报出来人工看一眼,不静默吞。 */
  strays: { row: number; col: number; text: string }[];
}

/** 公式列的最大列数(B..G)。PBL 页实际只用 B..D,少的列自然为空。 */
const MAX_ALG_COLS = 6;

const trim = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * @param isAlgLike 「这串是不是一条公式」。版式层自己不认记号 —— 判据由调用方注入
 *   (导入管道传站内 tokenizer)。缺了它,LS 各页第 2 行那排列注记(`Top` /
 *   `At an angle` / `Top (example case)`)会被当成公式行,把页标题撑成一个假分组。
 */
export function parseAlgSheet(
  sheet: string,
  rows: string[][],
  isAlgLike: (text: string) => boolean = () => true,
): SheetParse {
  const slotByKey = new Map<string, SheetSlot>();
  const groups: string[] = [];
  const strays: SheetParse['strays'] = [];

  let current: string | null = null;
  let currentHasAlgs = false;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r].map(trim);
    const head = row[0] ?? '';
    const rest = row.slice(1);
    const restFilled = rest.some((c) => c !== '');

    if (head !== '' && !restFilled) {
      // 分组表头。上一个分组若一条公式都没收到(页标题就是这种),从名单里撤掉。
      if (current !== null && !currentHasAlgs) groups.pop();
      current = head;
      groups.push(head);
      currentHasAlgs = false;
      continue;
    }

    if (head !== '') continue;        // A 列有字又不是表头 = 表内说明行(如 PBL 的轴标题行)
    if (!restFilled || current === null) continue;

    for (let c = 0; c < rest.length; c++) {
      const text = rest[c];
      if (text === '') continue;
      if (c >= MAX_ALG_COLS || !isAlgLike(text)) { strays.push({ row: r + 1, col: c + 1, text }); continue; }
      const key = `${current}\u0000${c}`;
      let slot = slotByKey.get(key);
      if (!slot) { slot = { group: current, col: c, algs: [] }; slotByKey.set(key, slot); }
      slot.algs.push({ raw: text, row: r + 1 });
      currentHasAlgs = true;
    }
  }
  if (current !== null && !currentHasAlgs) groups.pop();

  // 只留活下来的分组(页标题那种空组已从 groups 里撤掉)。
  const alive = new Set(groups);
  const slots = [...slotByKey.values()]
    .filter((s) => alive.has(s.group))
    .sort((a, b) => (groups.indexOf(a.group) - groups.indexOf(b.group)) || (a.col - b.col));

  return { sheet, slots, groups, strays };
}
