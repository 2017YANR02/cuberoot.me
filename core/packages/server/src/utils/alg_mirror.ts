/**
 * 镜像公式的入库同步(issue #40 T5,方案 §5.4 / §5.5)。
 *
 * 一个 case 的公式改了,它的镜像伙伴那边对应视角的自动生成公式就要跟着改。规则(哪份落到
 * 谁的哪个视角、含 F 的公式为什么只补左右镜)全在 `@cuberoot/shared/alg-mirror`,这里只管
 * 「读两行、算一遍、写回去」。
 *
 * ## 三条约定,踩之前先读
 *
 * 1. **整体重算,不做增量。** 生成条不是状态,是当前原创条的函数 —— 所以编辑 / 删除 / 拖动
 *    排序都走同一条路,不会留孤儿。理由写在 `regenerateMirrorAlgs` 的注释里。
 * 2. **没建链就什么都不做**(除了把残留的生成条剥掉)。`mirror_case_id` 现在全库还是 NULL,
 *    所以这套逻辑上线后是**静默的**,等建链脚本跑完才开始产生效果。
 * 3. **只对 `MIRROR_ALG_SYNC_SETS` 生效**(3x3 f2l / zbls)。cls 有伙伴但只存一个视角,
 *    生成的公式没有格子可放,见那个常量的注释。
 *
 * 不做校验:server 对**人写的**公式都不跑 `validateAlgCase`(那是 AdminCaseEditor 保存前的事),
 * 对机器按固定表重写出来的公式反而更严一档说不通。镜像表本身的正确性由
 * `tests/alg_mirror_rewrite.test.ts`(全库对撞 + 逐条过站上同一份 `reachesGoal`)守。
 */
import {
  MIRROR_ALG_SYNC_SETS,
  regenerateMirrorAlgs,
  type AlgEntry,
  type MirrorPairCase,
} from '@cuberoot/shared/alg-mirror';
import { query } from '../db/connection.js';

interface MirrorRow {
  id: number | string;
  algs: unknown;
  mirror_case_id: number | string | null;
}

export interface MirrorSyncReport {
  /** 真正被改写的 case id */
  updated: number[];
  /** 没能生成 / 数据形状不对的说明。非空就该进日志。 */
  notes: string[];
}

const EMPTY: MirrorSyncReport = { updated: [], notes: [] };

export const mirrorAlgSyncEnabled = (puzzle: string, set: string) =>
  MIRROR_ALG_SYNC_SETS.has(`${puzzle}/${set}`);

/**
 * 比「有没有变」用的规范形。
 *
 * 不能直接 `JSON.stringify` 比:jsonb 存进去会按(键长, 字节序)重排键,读回来的
 * `{alg, gen, src, altId}` 与我们现构的 `{alg, altId, gen, src}` 逐字不等 —— 于是每次保存
 * 都判成「变了」,把两行白写一遍。排序后再比才是真的比内容。
 */
const canon = (v: unknown): string => JSON.stringify(v, (_k, val) =>
  val && typeof val === 'object' && !Array.isArray(val)
    ? Object.fromEntries(Object.keys(val as Record<string, unknown>).sort()
        .map(k => [k, (val as Record<string, unknown>)[k]]))
    : val);

const toPairCase = (r: MirrorRow): MirrorPairCase => ({
  id: Number(r.id),
  algs: (Array.isArray(r.algs) ? r.algs : []) as AlgEntry[][],
});

async function loadCase(puzzle: string, set: string, id: number): Promise<MirrorRow | null> {
  const rows = await query<MirrorRow>(
    'SELECT id, algs, mirror_case_id FROM alg_cases WHERE id = ? AND puzzle = ? AND set_slug = ?',
    [id, puzzle, set],
  );
  return rows[0] ?? null;
}

/**
 * 重算 `caseId` 这一对的镜像公式并落库。
 *
 * 编辑 / 新增之后调它;**删除之后调的是被删者的前伙伴**(`ON DELETE SET NULL` 已经把那边的
 * 链置空,所以它会走「剥掉生成条」那条路,正好清掉指向死 case 的孤儿)。
 *
 * 失败不抛 —— 镜像同步是编辑动作的副产物,不该让一次正常保存 500。调用方把 notes 打进日志。
 */
export async function syncMirrorForCase(
  puzzle: string,
  set: string,
  caseId: number,
): Promise<MirrorSyncReport> {
  if (!mirrorAlgSyncEnabled(puzzle, set)) return EMPTY;

  const selfRow = await loadCase(puzzle, set, caseId);
  if (!selfRow) return EMPTY;

  const notes: string[] = [];
  const linkedId = selfRow.mirror_case_id == null ? null : Number(selfRow.mirror_case_id);

  let partnerRow: MirrorRow | null = null;
  if (linkedId === caseId) {
    partnerRow = selfRow;                       // 自镜像:三份都落回自己
  } else if (linkedId != null) {
    partnerRow = await loadCase(puzzle, set, linkedId);
    if (!partnerRow) {
      // 链指到别的 set / 不存在的 id。当没建链处理(剥掉生成条),但要留话 —— 这是数据错。
      notes.push(`case ${caseId} 的 mirror_case_id=${linkedId} 在 ${puzzle}/${set} 里找不到`);
    }
  }

  const self = toPairCase(selfRow);
  const partner = partnerRow
    ? (partnerRow === selfRow ? self : toPairCase(partnerRow))
    : null;

  const result = regenerateMirrorAlgs(self, partner);
  notes.push(...result.notes);

  const before = new Map<number, string>([[self.id, canon(self.algs)]]);
  if (partner && partner.id !== self.id) before.set(partner.id, canon(partner.algs));

  const updated: number[] = [];
  for (const [id, algs] of result.algsById) {
    if (canon(algs) === before.get(id)) continue;
    // postgres@3 自己会 stringify jsonb 参数 —— 别再手动 JSON.stringify(会落成字符串字面量)
    await query('UPDATE alg_cases SET algs = ?::jsonb WHERE id = ?', [algs, id]);
    updated.push(id);
  }
  return { updated, notes };
}

/** 同步一遍并把结果打进日志。路由里用这个,免得每处都写一遍 try/catch。 */
export async function syncMirrorAndLog(puzzle: string, set: string, caseId: number): Promise<void> {
  try {
    const { updated, notes } = await syncMirrorForCase(puzzle, set, caseId);
    if (updated.length) console.log(`[alg-mirror] ${puzzle}/${set} case ${caseId} → 改写 ${updated.join(', ')}`);
    for (const n of notes) console.warn(`[alg-mirror] ${n}`);
  } catch (e) {
    console.error(`[alg-mirror] ${puzzle}/${set} case ${caseId} 同步失败:`, e);
  }
}
