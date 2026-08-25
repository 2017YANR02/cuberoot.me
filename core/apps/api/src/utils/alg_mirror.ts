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
 * 自动生成条还要按目标 case 的 setup 做一次状态对齐。镜像几何能保证公式手性正确，却不能
 * 保证自镜像 case 在目标槽位仍是同一个 AUF；少数对称 case 需要在公式开头补 U / U2 / U'。
 * 这里尝试四种起手 AUF 并只改生成条，人写的公式仍由 AdminCaseEditor 的完整校验负责。
 */
import {
  MIRROR_ALG_SYNC_SETS,
  regenerateMirrorAlgs,
  type AlgEntry,
  type MirrorPairCase,
} from '@cuberoot/shared/alg-mirror';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { puzzles } from 'cubing/puzzles';
import { query } from '../db/connection.js';

interface MirrorRow {
  id: number | string;
  algs: unknown;
  setup: string | null;
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

const AUF_PREFIXES = ['', 'U', 'U2', "U'"] as const;
const VIEW_PRE = ['', "y'", 'y2', 'y'] as const;
const VIEW_POST = ['', 'y', 'y2', "y'"] as const;
const CUBE_ORIENTATIONS = ['', 'y', 'y2', "y'", 'x', 'x y', 'x y2', "x y'", 'x2', 'x2 y', 'x2 y2', "x2 y'", "x'", "x' y", "x' y2", "x' y'", 'z', 'z y', 'z y2', "z y'", "z'", "z' y", "z' y2", "z' y'"] as const;
const U_TURNS: Record<string, number> = { U: 1, U2: 2, "U2'": 2, "U'": 3 };
const TURN_U = ['', 'U', 'U2', "U'"] as const;
const LEADING_U = /^U(2'?|')?(?:\s+|$)/;
const D_CORNERS = [4, 5, 6, 7];
const U_EDGES = [0, 1, 2, 3];
const F2L_EDGES = [4, 5, 6, 7, 8, 9, 10, 11];

type Orbit = { pieces: number[]; orientation: number[] };
const orbit = (pattern: KPattern, name: string) => pattern.patternData[name] as unknown as Orbit;
const solvedAt = (o: Orbit, slots: number[]) => slots.every(i => o.pieces[i] === i && (o.orientation[i] ?? 0) === 0);
const orientedAt = (o: Orbit, slots: number[]) => slots.every(i => (o.orientation[i] ?? 0) === 0);

let cube3Promise: Promise<KPuzzle> | null = null;
const cube3 = () => (cube3Promise ??= puzzles['3x3x3'].kpuzzle());

/** f2l / zbls 自动镜像条真正需要达成的目标；只在这两个同步 set 内调用。 */
function reachesMirrorGoal(pattern: KPattern, set: string): boolean {
  const c = orbit(pattern, 'CORNERS');
  const e = orbit(pattern, 'EDGES');
  const f2l = solvedAt(c, D_CORNERS) && solvedAt(e, F2L_EDGES);
  return f2l && (set !== 'zbls' || orientedAt(e, U_EDGES));
}

function reachesMirrorGoalInAnyOrientation(pattern: KPattern, set: string): boolean {
  return CUBE_ORIENTATIONS.some(rotation => {
    try {
      const candidate = rotation ? pattern.applyAlg(rotation) : pattern;
      return reachesMirrorGoal(candidate, set);
    } catch {
      return false;
    }
  });
}

/** 前缀与公式原有的第一个 U 合并，避免修成 `U U' ...` 这种虽对但难读的形式。 */
function prependAuf(alg: string, prefix: Exclude<(typeof AUF_PREFIXES)[number], ''>): string {
  const trimmed = alg.trimStart();
  const match = trimmed.match(LEADING_U);
  const leading = match?.[0]?.trim();
  if (!match || !leading) return `${prefix} ${trimmed}`;
  const rest = trimmed.slice(match[0].length);
  const turns = (U_TURNS[prefix] + (U_TURNS[leading] ?? 0)) % 4;
  return [TURN_U[turns], rest].filter(Boolean).join(' ');
}

function setupForView(setup: string, view: number): string {
  const i = ((view % 4) + 4) % 4;
  if (i === 0) return setup;
  return `${VIEW_PRE[i]} ${setup} ${VIEW_POST[i]}`;
}

async function alignGeneratedAuf(
  set: string,
  setup: string,
  view: number,
  alg: string,
): Promise<string | null> {
  const kp = await cube3();
  const orientedSetup = setupForView(setup, view);
  for (const prefix of AUF_PREFIXES) {
    const candidate = prefix ? prependAuf(alg, prefix) : alg;
    try {
      const pattern = kp.defaultPattern().applyAlg(`${orientedSetup} ${candidate}`);
      if (reachesMirrorGoalInAnyOrientation(pattern, set)) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

/** 校正本轮新算出的生成条；原创条和没有 setup 的旧数据都保持原样。 */
async function alignGeneratedAlgs(
  set: string,
  rows: MirrorRow[],
  algsById: Map<number, AlgEntry[][]>,
  notes: string[],
): Promise<void> {
  const rowById = new Map(rows.map(row => [Number(row.id), row]));
  for (const [id, views] of algsById) {
    const setup = rowById.get(id)?.setup?.trim();
    if (!setup) continue;
    for (let view = 0; view < views.length; view++) {
      for (const entry of views[view]) {
        if (!entry.gen) continue;
        const aligned = await alignGeneratedAuf(set, setup, view, entry.alg);
        if (aligned == null) {
          notes.push(`case ${id} 第 ${view} 视角的 ${entry.gen} 生成公式无法对齐目标 case`);
        } else {
          entry.alg = aligned;
        }
      }
    }
  }
}

async function loadCase(puzzle: string, set: string, id: number): Promise<MirrorRow | null> {
  const rows = await query<MirrorRow>(
    'SELECT id, algs, setup, mirror_case_id FROM alg_cases WHERE id = ? AND puzzle = ? AND set_slug = ?',
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
  await alignGeneratedAlgs(set, partnerRow && partnerRow !== selfRow ? [selfRow, partnerRow] : [selfRow], result.algsById, notes);

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
