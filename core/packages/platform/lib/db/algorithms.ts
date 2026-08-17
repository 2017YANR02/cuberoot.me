import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, like, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Algorithm, AlgorithmInsert } from "@/db/schema";

export type { Algorithm };

function newAlgId(): string {
  return "alg_" + randomBytes(9).toString("base64url");
}

/* ─────────────────────────── 起始数据集(表空时种入) ───────────────────────────
 * 标准三阶 notation。21 个 PLL(WCA 名)+ 常见 OLL + 常见 F2L。
 * category 用 PLL / OLL / F2L,puzzle=333,caseGroup 按形态大类归并,便于筛选浏览。
 * sortOrder 在各 category 内递增。 */
type SeedAlg = Omit<AlgorithmInsert, "id" | "createdAt">;

const PLL_SEED: SeedAlg[] = [
  { category: "PLL", name: "Aa Perm", notation: "x L2 D2 L' U' L D2 L' U L'", puzzle: "333", caseGroup: "角块三循环", description: "三个角顺时针循环,棱块不动。", hint: "起手转 x,先压两层再换角。", sortOrder: 1 },
  { category: "PLL", name: "Ab Perm", notation: "x' L2 D2 L U L' D2 L U' L", puzzle: "333", caseGroup: "角块三循环", description: "Aa 的镜像,三角逆时针循环。", hint: "与 Aa 对称,方向相反。", sortOrder: 2 },
  { category: "PLL", name: "E Perm", notation: "x' L' U L D' L' U' L D L' U' L D' L' U L D", puzzle: "333", caseGroup: "角块对换", description: "两组对角对换,棱块不动。", hint: "左右各一组角交换,节奏对称。", sortOrder: 3 },
  { category: "PLL", name: "F Perm", notation: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R", puzzle: "333", caseGroup: "邻角邻棱", description: "相邻角对换 + 三棱循环。", hint: "前段 sledgehammer 收角,后段处理棱。", sortOrder: 4 },
  { category: "PLL", name: "Ga Perm", notation: "R2 U R' U R' U' R U' R2 U' D R' U R D'", puzzle: "333", caseGroup: "G 类", description: "一组角三循环 + 一组棱三循环。", hint: "含一次 D 层换手,注意还原朝向。", sortOrder: 5 },
  { category: "PLL", name: "Gb Perm", notation: "R' U' R U D' R2 U R' U R U' R U' R2 D", puzzle: "333", caseGroup: "G 类", description: "Ga 的逆向 G 型。", hint: "起手 R' U' R 勾住,再走 D 层。", sortOrder: 6 },
  { category: "PLL", name: "Gc Perm", notation: "R2 U' R U' R U R' U R2 U D' R U' R' D", puzzle: "333", caseGroup: "G 类", description: "另一对角向 G 型。", hint: "与 Ga 镜像,循环方向相反。", sortOrder: 7 },
  { category: "PLL", name: "Gd Perm", notation: "R U R' U' D R2 U' R U' R' U R' U R2 D'", puzzle: "333", caseGroup: "G 类", description: "Gb 的镜像 G 型。", hint: "起手 R U R' U' 勾角后走 D 层。", sortOrder: 8 },
  { category: "PLL", name: "H Perm", notation: "M2 U M2 U2 M2 U M2", puzzle: "333", caseGroup: "纯棱块", description: "四棱两两对换,角块不动。", hint: "全程 M 切片,口诀 M2 U M2 U2 M2 U M2。", sortOrder: 9 },
  { category: "PLL", name: "Ja Perm", notation: "x R2 F R F' R U2 R' U R U2 R'", puzzle: "333", caseGroup: "邻角邻棱", description: "相邻一对角 + 相邻一对棱对换。", hint: "起手 x,先 R2 F 块,再常规收尾。", sortOrder: 10 },
  { category: "PLL", name: "Jb Perm", notation: "R U R' F' R U R' U' R' F R2 U' R' U'", puzzle: "333", caseGroup: "邻角邻棱", description: "Ja 的镜像,右后侧一对角棱对换。", hint: "常见高频,与 T Perm 起手相近。", sortOrder: 11 },
  { category: "PLL", name: "Na Perm", notation: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'", puzzle: "333", caseGroup: "对角对换", description: "两组对角对换 + 两组对棱对换(N 型对称)。", hint: "较长,分两段记:前半收一侧,后半收另一侧。", sortOrder: 12 },
  { category: "PLL", name: "Nb Perm", notation: "R' U R U' R' F' U' F R U R' F R' F' R U' R", puzzle: "333", caseGroup: "对角对换", description: "Na 的镜像 N 型。", hint: "与 Na 对称,左右手势相反。", sortOrder: 13 },
  { category: "PLL", name: "Ra Perm", notation: "R U' R' U' R U R D R' U' R D' R' U2 R'", puzzle: "333", caseGroup: "R 类", description: "一对邻角 + 一对邻棱对换(R 型)。", hint: "含一次 D 层插入,留意还原。", sortOrder: 14 },
  { category: "PLL", name: "Rb Perm", notation: "R2 F R U R U' R' F' R U2 R' U2 R", puzzle: "333", caseGroup: "R 类", description: "Ra 的镜像 R 型。", hint: "起手 R2 F 建块,后段双 U2。", sortOrder: 15 },
  { category: "PLL", name: "T Perm", notation: "R U R' U' R' F R2 U' R' U' R U R' F'", puzzle: "333", caseGroup: "邻角邻棱", description: "右后一对角对换 + 一对棱对换,最常用 PLL 之一。", hint: "新手第一条必背:R U R' U' R' F R2…", sortOrder: 16 },
  { category: "PLL", name: "Ua Perm", notation: "R U' R U R U R U' R' U' R2", puzzle: "333", caseGroup: "纯棱块", description: "三棱顺时针循环,角块不动。", hint: "与 Ub 镜像,记顺时针那条。", sortOrder: 17 },
  { category: "PLL", name: "Ub Perm", notation: "R2 U R U R' U' R' U' R' U R'", puzzle: "333", caseGroup: "纯棱块", description: "三棱逆时针循环,角块不动。", hint: "Ua 的反向,高频出现。", sortOrder: 18 },
  { category: "PLL", name: "V Perm", notation: "R' U R' U' y R' F' R2 U' R' U R' F R F", puzzle: "333", caseGroup: "对角对换", description: "一对对角 + 一对邻棱对换。", hint: "含一次 y 转体,注意视角切换。", sortOrder: 19 },
  { category: "PLL", name: "Y Perm", notation: "F R U' R' U' R U R' F' R U R' U' R' F R F'", puzzle: "333", caseGroup: "对角对换", description: "一对对角 + 一对邻棱对换(Y 型)。", hint: "两段 F 夹一组 sexy move,好记。", sortOrder: 20 },
  { category: "PLL", name: "Z Perm", notation: "M2 U M2 U M' U2 M2 U2 M' U2", puzzle: "333", caseGroup: "纯棱块", description: "两组对棱对换,角块不动。", hint: "全 M 切片,与 H 同族但换两组。", sortOrder: 21 },
];

const OLL_SEED: SeedAlg[] = [
  { category: "OLL", name: "OLL 21 (H)", notation: "R U2 R' U' R U R' U' R U' R'", puzzle: "333", caseGroup: "全翻角", description: "顶面十字已成,四角全朝上待翻(H 型)。", hint: "对称 double sexy,正反各一组。", sortOrder: 1 },
  { category: "OLL", name: "OLL 22 (Pi)", notation: "R U2 R2 U' R2 U' R2 U2 R", puzzle: "333", caseGroup: "全翻角", description: "Pi 型,十字已成的四角朝向。", hint: "纯 R U2 块,口诀顺。", sortOrder: 2 },
  { category: "OLL", name: "OLL 23 (U)", notation: "R2 D' R U2 R' D R U2 R", puzzle: "333", caseGroup: "全翻角", description: "U 型,十字已成两角已好。", hint: "含一次 D 层,头尾对称。", sortOrder: 3 },
  { category: "OLL", name: "OLL 24 (T)", notation: "r U R' U' r' F R F'", puzzle: "333", caseGroup: "全翻角", description: "T 型,短小高频。", hint: "宽 r 起手 + sledge 收尾。", sortOrder: 4 },
  { category: "OLL", name: "OLL 25 (L)", notation: "F' r U R' U' r' F R", puzzle: "333", caseGroup: "全翻角", description: "L / 鱼型变体,十字已成。", hint: "F' 起手,与 OLL 24 互为伴侣。", sortOrder: 5 },
  { category: "OLL", name: "OLL 26 (反鱼)", notation: "R U2 R' U' R U' R'", puzzle: "333", caseGroup: "鱼型", description: "Anti-Sune,三角待翻。", hint: "Sune 的逆向,极常用。", sortOrder: 6 },
  { category: "OLL", name: "OLL 27 (鱼/Sune)", notation: "R U R' U R U2 R'", puzzle: "333", caseGroup: "鱼型", description: "Sune,最经典 OLL,三角朝向。", hint: "R U R' U R U2 R',第一条必背。", sortOrder: 7 },
  { category: "OLL", name: "OLL 28", notation: "r U R' U' r' R U R U' R'", puzzle: "333", caseGroup: "点 / 块", description: "顶面已有小块待整。", hint: "宽 r 调块 + sexy 收尾。", sortOrder: 8 },
  { category: "OLL", name: "OLL 33", notation: "R U R' U' R' F R F'", puzzle: "333", caseGroup: "T / 十字", description: "顶面 T 型,新手第一条 OLL。", hint: "R U R' U' 接 R' F R F',两段都是熟手势。", sortOrder: 9 },
  { category: "OLL", name: "OLL 37", notation: "F R' F' R U R U' R'", puzzle: "333", caseGroup: "T / 十字", description: "十字已成的角朝向变体。", hint: "F 段建块,后接 sune 尾。", sortOrder: 10 },
  { category: "OLL", name: "OLL 45 (T 十字)", notation: "F R U R' U' F'", puzzle: "333", caseGroup: "T / 十字", description: "顶面 T 字,极短。", hint: "F (sexy) F',六步速成。", sortOrder: 11 },
  { category: "OLL", name: "OLL 44 (P 十字)", notation: "F U R U' R' F'", puzzle: "333", caseGroup: "T / 十字", description: "P 型,与 OLL 45 同族。", hint: "F U (sexy 尾) F'。", sortOrder: 12 },
  { category: "OLL", name: "OLL 57", notation: "R U R' U' M' U R U' r'", puzzle: "333", caseGroup: "全翻角", description: "十字与角全朝上、仅需调朝向。", hint: "含 M' 切片,顺手过渡。", sortOrder: 13 },
];

const F2L_SEED: SeedAlg[] = [
  { category: "F2L", name: "F2L 基础对插", notation: "U R U' R'", puzzle: "333", caseGroup: "顶层配对", description: "角棱已成对、插入对应槽位的基本式。", hint: "最基础的一插,理解它就懂 F2L。", sortOrder: 1 },
  { category: "F2L", name: "F2L 左手对插", notation: "U' L' U L", puzzle: "333", caseGroup: "顶层配对", description: "基础对插的左手镜像。", hint: "右手 U R U' R' 的左侧版。", sortOrder: 2 },
  { category: "F2L", name: "F2L 角朝上配对", notation: "U' R U R' U R U' R'", puzzle: "333", caseGroup: "先配后插", description: "角块白面朝上时先配对再插入。", hint: "先用 U' 把棱送到位再 R U R'。", sortOrder: 3 },
  { category: "F2L", name: "F2L 角棱已分离", notation: "R U' R' U R U' R'", puzzle: "333", caseGroup: "先配后插", description: "角棱分处两侧,先取出再配对插入。", hint: "把角拿出来再合,避免破坏其它槽。", sortOrder: 4 },
  { category: "F2L", name: "F2L 反向插入", notation: "F' U' F", puzzle: "333", caseGroup: "顶层配对", description: "用前层把配好的对子送进左前槽。", hint: "短式,处理左前槽很顺手。", sortOrder: 5 },
];

const ALGORITHM_SEED: SeedAlg[] = [...PLL_SEED, ...OLL_SEED, ...F2L_SEED];

/** 表为空时种入起始集。幂等:已有数据则跳过。列表查询入口调用。 */
function ensureAlgorithmsSeeded(): void {
  const row = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.algorithms)
    .get();
  if ((row?.n ?? 0) > 0) return;

  const now = Math.floor(Date.now() / 1000);
  const values: AlgorithmInsert[] = ALGORITHM_SEED.map((a) => ({
    ...a,
    id: newAlgId(),
    createdAt: now,
  }));
  db.insert(schema.algorithms).values(values).run();
}

/* ─────────────────────────── 查询 ─────────────────────────── */

export type AlgorithmListOpts = {
  category?: string;
  q?: string;
};

/** 列表:类目筛选 + 关键词(LIKE name / notation / caseGroup,不走 FTS5)。入口先 ensure 种子。 */
export async function listAlgorithms({
  category,
  q,
}: AlgorithmListOpts = {}): Promise<Algorithm[]> {
  ensureAlgorithmsSeeded();

  const cat = category?.trim();
  const query = q?.trim() ?? "";
  const conds = [];
  if (cat) conds.push(eq(schema.algorithms.category, cat));
  if (query) {
    const pat = `%${query}%`;
    conds.push(
      or(
        like(schema.algorithms.name, pat),
        like(schema.algorithms.notation, pat),
        like(schema.algorithms.caseGroup, pat),
      ),
    );
  }
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select()
    .from(schema.algorithms)
    .where(where)
    .orderBy(asc(schema.algorithms.category), asc(schema.algorithms.sortOrder))
    .all();
}

/** 全部类目(distinct),按出现的 category 排序,供筛选 Tab。 */
export async function algorithmCategories(): Promise<string[]> {
  ensureAlgorithmsSeeded();
  const rows = db
    .selectDistinct({ category: schema.algorithms.category })
    .from(schema.algorithms)
    .orderBy(asc(schema.algorithms.category))
    .all();
  return rows.map((r) => r.category);
}

export async function getAlgorithmById(id: string): Promise<Algorithm | undefined> {
  if (!id) return undefined;
  return db
    .select()
    .from(schema.algorithms)
    .where(eq(schema.algorithms.id, id))
    .get();
}

/** 相关公式:同 category 其它条目,按 sortOrder,默认取 6 条。 */
export async function relatedAlgorithms(
  alg: Pick<Algorithm, "id" | "category">,
  limit = 6,
): Promise<Algorithm[]> {
  return db
    .select()
    .from(schema.algorithms)
    .where(
      and(
        eq(schema.algorithms.category, alg.category),
        ne(schema.algorithms.id, alg.id),
      ),
    )
    .orderBy(asc(schema.algorithms.sortOrder))
    .limit(limit)
    .all();
}

/* ─────────────────────────── admin 写入 ─────────────────────────── */

export type AlgorithmInput = {
  id?: string;
  category: string;
  name: string;
  notation: string;
  puzzle?: string;
  caseGroup?: string | null;
  description?: string | null;
  hint?: string | null;
  sortOrder?: number;
};

export async function createAlgorithm(input: AlgorithmInput): Promise<string> {
  const id = input.id?.trim() || newAlgId();
  db.insert(schema.algorithms)
    .values({
      id,
      category: input.category.trim(),
      name: input.name.trim(),
      notation: input.notation.trim(),
      puzzle: input.puzzle?.trim() || "333",
      caseGroup: input.caseGroup?.trim() || null,
      description: input.description?.trim() || null,
      hint: input.hint?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      createdAt: Math.floor(Date.now() / 1000),
    })
    .run();
  return id;
}

export async function updateAlgorithm(
  id: string,
  input: AlgorithmInput,
): Promise<void> {
  db.update(schema.algorithms)
    .set({
      category: input.category.trim(),
      name: input.name.trim(),
      notation: input.notation.trim(),
      puzzle: input.puzzle?.trim() || "333",
      caseGroup: input.caseGroup?.trim() || null,
      description: input.description?.trim() || null,
      hint: input.hint?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
    })
    .where(eq(schema.algorithms.id, id))
    .run();
}

export async function deleteAlgorithm(id: string): Promise<void> {
  if (!id) return;
  db.delete(schema.algorithms).where(eq(schema.algorithms.id, id)).run();
}

/** 调序:交换两条公式的 sortOrder(admin 上 / 下移,通常同 category 相邻两条)。 */
export async function swapAlgorithmOrder(idA: string, idB: string): Promise<void> {
  if (!idA || !idB || idA === idB) return;
  const a = await getAlgorithmById(idA);
  const b = await getAlgorithmById(idB);
  if (!a || !b) return;
  db.update(schema.algorithms)
    .set({ sortOrder: b.sortOrder })
    .where(eq(schema.algorithms.id, a.id))
    .run();
  db.update(schema.algorithms)
    .set({ sortOrder: a.sortOrder })
    .where(eq(schema.algorithms.id, b.id))
    .run();
}

/** admin 列表:全部公式,按 category + sortOrder。 */
export async function listAllAlgorithms(): Promise<Algorithm[]> {
  ensureAlgorithmsSeeded();
  return db
    .select()
    .from(schema.algorithms)
    .orderBy(asc(schema.algorithms.category), asc(schema.algorithms.sortOrder))
    .all();
}
