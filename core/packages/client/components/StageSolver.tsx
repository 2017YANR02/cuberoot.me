'use client';

/**
 * StageSolver — Rust→WASM 逐阶段最优解浏览器(analyzer 主面板 + gen 行内展开共用)。
 *
 * 方法:Standard(cross/xc/xxc/xxxc/xxxxc)+ EO / Pair / Pseudo / Pseudo+Pair / F2LEO /
 * Pseudo F2LEO —— 全部小表 client 端现算「逐视角最优步数 + 具体可执行转动序列 + 多解」。
 *
 * 与旧 RustCrossSection 的关键差异:
 *   1. 7 个方法(新增 F2LEO / Pseudo F2LEO 的解法枚举,引擎 solve_moves 已支持)。
 *   2. 解法列表 + 单个共享 3D 播放器:点任意解法行 → 同一个 TwistyPlayer 换 alg 播放
 *      (修「只有第一条能看动画」;避免 N 个 WebGL 上下文爆显存)。
 *   3. 算完自动选最优视角 → 立刻出解 + 动画,无需先点格子。
 *   4. 池走站内共享单例(getRustCrossPool),gen 多行 / analyzer 复用,27MB 表只拉一次。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Copy, Check, Info, X } from 'lucide-react';
import TwistySection from '@/components/TwistySection';
import { CUBE_FILL, CUBE_ON_FILL, type CubeFace } from '@/lib/cube-colors';
import { FR_NOT_HTR, HTR_NOT_DR, HTR2_NOT_HTR, type MovesTimed, type RustCrossPool, TABLE_BYTES, TABLE_SETS } from '@/lib/rust-cross-client';
import { getRustCrossPool, dropRustCrossPool, poolSizeForDevice, type PoolNeed } from '@/lib/rust-cross-pool';
import { normalizeScramble } from '@/lib/cross-solver';
import { rotateSolutionY, Y_ROT_LABEL } from '@/lib/rotate-solution';
import { variantLabel, stageLabel, VARIANT_STAGES } from '@/lib/scramble-variants';
import { countQtm } from '@cuberoot/shared/scramble-length';
import './StageSolver.css';

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function fmtBytes(b: number): string {
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
  if (b >= 1024) return `${Math.round(b / 1024)} KB`;
  return `${b} B`;
}

// 'htr' 是条件式阶段:输入须已处于该视角 DR 才有 DR→HTR 步数;非 DR 视角引擎返回
// HTR_NOT_DR 哨兵 → 格子显示 '-'(同 native analyzer CSV),且不参与最优(min)统计。
// 'htr2'(HTR phase-2,G3→solved)同理:输入须已处于该视角 HTR,否则引擎返回
// HTR2_NOT_HTR 哨兵 → 同样显示 '-' 且不参与 min。
// 'fr'(Floppy 还原,HTR→FR)同理:输入须已处于该视角 HTR,否则引擎返回 FR_NOT_HTR 哨兵。
export type Method = 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair' | 'f2leo' | 'pseudo_f2leo' | 'block' | 'eoline' | 'dr' | 'htr' | 'htr2' | 'fr';
const VARIANT_ID: Record<'pair' | 'eo' | 'pseudo' | 'pseudo_pair', number> = {
  pair: 0, eo: 1, pseudo: 2, pseudo_pair: 3,
};
// 方法名走全站单一真源 lib/scramble-variants(VARIANT_LABEL),别再本地复制一份。
// 这里只定引擎支持的方法顺序(按 WASM kind 分组),标签 = variantLabel(key, isZh)。
// 块族(原 123/222/223)聚合为一个方法 'block',块形状落在阶段下拉。
export const METHOD_KEYS: Method[] = [
  'std', 'eo', 'pair', 'pseudo', 'pseudo_pair', 'f2leo', 'pseudo_f2leo',
  'block', 'eoline', 'dr', 'htr', 'htr2', 'fr',
];
// 阶段键序 + 显示名同样走 scramble-variants(VARIANT_STAGES / stageLabel),
// WASM 阶段索引 i ↔ VARIANT_STAGES[method][i],与 /scramble/stats 完全同名。
// 自动批算(eager)的最深阶段;更深的留点击按需(单视角搜索重,弱小表启发式)。
const EAGER_MAX: Record<Method, number> = {
  std: 3, eo: 2, pair: 3, pseudo: 3, pseudo_pair: 2, f2leo: 1, pseudo_f2leo: 1, block: 3, eoline: 1, dr: 0, htr: 0, htr2: 0, fr: 0,
};
type Kind = 'std' | 'variant' | 'f2leo' | 'block222' | 'roux223' | 'eodr' | 'htr' | 'htr2' | 'fr';
// block 方法按阶段分流:block222 阶段走专用 Block222SolverWasm,其余走 Roux223SolverWasm
// (其阶段 id 0..4 恰与 VARIANT_STAGES.block 的索引一一对应,无需映射)。
const kindOf = (m: Method, stageKey: string): Kind =>
  m === 'std' ? 'std'
    : m === 'f2leo' || m === 'pseudo_f2leo' ? 'f2leo'
      : m === 'block' ? (stageKey === 'block222' ? 'block222' : 'roux223')
        : m === 'eoline' || m === 'dr' ? 'eodr'
          : m === 'htr' ? 'htr'
            : m === 'htr2' ? 'htr2'
              : m === 'fr' ? 'fr' : 'variant';
// 池按方法选:'block' 全程用 roux223 池(其 worker 表是 block222 的超集,init 时两个
// 求解器都建),方法内切阶段不换池、不重拉表。
const needOf = (m: Method): PoolNeed =>
  m === 'std' ? 'cross'
    : m === 'f2leo' || m === 'pseudo_f2leo' ? 'f2leo'
      : m === 'block' ? 'roux223'
        : m === 'eoline' || m === 'dr' ? 'eodr'
          : m === 'htr' ? 'htr'
            : m === 'htr2' ? 'htr2'
              : m === 'fr' ? 'fr' : 'variant';
// EoDrSolverWasm 的阶段编号:0=EO 1=EOLine 2=DR。
const eoDrStage = (m: Method, stage: number) => (m === 'eoline' ? stage : 2);

// 6 视角:rot ""/z2/z'/z/x'/x → 底面 D/U/L/R/F/B(与 ROTS / solve*Stage 返回序一致)。
// 视角格直接填该底面十字色(取自 lib/cube-colors 全站单一来源),不再写字母。
const FACES: { face: CubeFace; rot: string }[] = [
  { face: 'D', rot: '' },
  { face: 'U', rot: 'z2' },
  { face: 'L', rot: "z'" },
  { face: 'R', rot: 'z' },
  { face: 'F', rot: "x'" },
  { face: 'B', rot: 'x' },
];

// 解法搜索的长度松弛:最多比最优长 2 步(= 旧「含次优 +2」档的搜索深度,不引入新成本)。
// 展示条数(cap)在此深度内按长度升序收集;条数才是用户可调的旋钮。
const SOL_SLACK = 2;
// 「条数」可选项。
const LIMIT_OPTIONS = [5, 10, 25, 50];

// F2L 槽位标签(对齐 solver wasm SLOT_LABELS:BL=0 BR=1 FR=2 FL=3)。
const SLOT_LABELS = ['BL', 'BR', 'FR', 'FL'] as const;
// 某 (方法, 阶段) 需选的 F2L 槽数:cross 族 = stage(stage0=纯十字无槽);基态/伪基态自带一个
// pair 槽 = stage+1;其余(block/eoline/dr/htr/fr)无 F2L 槽 = 0(不显示槽位选择器)。
function slotCount(method: Method, stageIdx: number): number {
  if (method === 'pair' || method === 'pseudo_pair') return stageIdx + 1;
  if (method === 'std' || method === 'eo' || method === 'pseudo' || method === 'f2leo' || method === 'pseudo_f2leo') return stageIdx;
  return 0;
}
// {0,1,2,3} 选 k 的全部组合(规范序,与 solver 的 PAIRS/TRIPS 一致)。
function kCombos(k: number): number[][] {
  const res: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length === k) { res.push(cur.slice()); return; }
    for (let i = start; i < 4; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return res;
}
const comboArity = (c: string): number => (c ? c.split(',').length : 0);
const comboLabel = (c: string): string => c.split(',').map((i) => SLOT_LABELS[Number(i)]).join(' ');

// 步骤前缀可能含 1~2 个旋转 token(eo/f2leo 破 y 对称时如 "x' y")。算实际转动数(HTM)时剥掉。
const moveLen = (sol: string) => sol.replace(/^([xyz][2']?\s+)+/, '').split(/\s+/).filter(Boolean).length;
// QTM(180°=2)走 shared 的 countQtm,单一来源;它本身会跳过 x/y/z 旋转 token。HTM 相同时按它升序排。

// 条件式阶段(htr / htr2 / fr)在非 DR / 非 HTR 视角返回哨兵(三者同值 0xffffffff):
// 该格显示 '-',且不参与 best / min 统计。
const isSentinel = (v: number | null | undefined): boolean => v === HTR_NOT_DR || v === HTR2_NOT_HTR || v === FR_NOT_HTR;

interface Props {
  scramble: string;
  lang: 'zh' | 'en';
  initialMethod?: Method;
  initialStage?: number;
  /** 深链初始视角(0..5 = FACES 索引 D/U/L/R/F/B);首次就绪时锁定该视角并出解,覆盖默认自动选最优。 */
  initialFace?: number;
  /** 选中方法/阶段变化时回调(analyzer 用它把 method/stage 同步进 URL,可分享/可深链)。 */
  onSelectionChange?: (method: Method, stage: number) => void;
  /** 深链初始槽位组合(逗号分隔索引,如 "2" / "0,1");''/缺省 = 自动挑最优。 */
  initialSlot?: string;
  /** 槽位选择变化时回调(analyzer 用它把 slot 同步进 URL,可分享/可深链)。 */
  onSlotChange?: (slot: string) => void;
  /** gen 行内:更紧凑的间距 + 略小播放器。 */
  compact?: boolean;
}

export default function StageSolver({ scramble, lang, initialMethod = 'std', initialStage = 0, initialFace, onSelectionChange, initialSlot = '', onSlotChange, compact = false }: Props) {
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  // 视角格 / 解法头的目标描述(块类方法按 method+stage 给语义,其余 = 该面十字)。
  const faceDesc = (face: string) =>
    method === 'block' ? (stage === 0
      ? t(`${face} 底 1x2x2 方块`, `${face}-bottom 1x2x2 square`)
      : stage === 1
        ? t(`${face} 底 1x2x3 块`, `${face}-bottom 1x2x3 block`)
        : stage === 2
          ? t(`${face} 底 2x2x2 块`, `${face}-bottom 2x2x2 block`)
          : stage === 3
            ? t(`${face} 底 2x2x3 块`, `${face}-bottom 2x2x3 block`)
            : t(`${face} 底双 1x2x3 块(F2B)`, `${face}-bottom first 2 blocks (F2B)`))
      : method === 'eoline' ? (stage === 0
        ? t(`${face} 底 EO(整棱定向)`, `${face}-bottom EO (all edges oriented)`)
        : t(`${face} 底 EOLine`, `${face}-bottom EOLine`))
      : method === 'dr' ? t(`${face} 轴 DR`, `${face}-axis DR`)
        : method === 'htr' ? t(`${face} 轴 HTR(需已处于该轴 DR)`, `${face}-axis HTR (requires DR on this axis)`)
          : method === 'htr2' ? t(`${face} 轴 HTR 收尾(需已处于该轴 HTR)`, `${face}-axis HTR-finish (requires HTR on this axis)`)
            : method === 'fr' ? t(`${face} 轴 Floppy 还原(需已处于该轴 HTR)`, `${face}-axis Floppy Reduction (requires HTR on this axis)`)
              : t(`${face} 面十字`, `${face}-face cross`);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [method, setMethod] = useState<Method>(initialMethod);
  const [stage, setStage] = useState(initialStage);
  const [limit, setLimit] = useState(10); // 展示条数(最短优先);搜索深度恒定 = 最优+SLACK
  const [counts, setCounts] = useState<(number | null)[]>([null, null, null, null, null, null]);
  const [computing, setComputing] = useState(false);
  const [selFace, setSelFace] = useState<number | null>(null);
  const [moves, setMoves] = useState<MovesTimed | null>(null);
  const [movesLoading, setMovesLoading] = useState(false);
  const [selSol, setSelSol] = useState(0); // 选中解法行(驱动共享播放器)
  const [selSlot, setSelSlot] = useState(initialSlot); // 用户指定槽位组合(逗号分隔索引,''=自动挑最优)
  const selSlotRef = useRef(selSlot);
  selSlotRef.current = selSlot;
  const [rowRot, setRowRot] = useState<Record<number, number>>({}); // 每行 y 预转体次数 0..3
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false); // 求解器信息弹窗
  const [shown, setShown] = useState(0);

  const poolRef = useRef<RustCrossPool | null>(null);
  // 共享 3D 播放器实例(TwistySection 回填),供解法行 ▷ 跳到开头并播放。
  const playerRef = useRef<{ jumpToStart?: (o?: { flash?: boolean }) => void; play?: () => void } | null>(null);
  const normScramble = useMemo(() => normalizeScramble(scramble) ?? scramble, [scramble]);
  const scrambleRef = useRef(normScramble);
  scrambleRef.current = normScramble;
  const computeReq = useRef(0);
  const movesReq = useRef(0);
  const wantAuto = useRef(false); // 算完是否自动选最优视角
  const statusRef = useRef(status);
  statusRef.current = status;
  const firstScrambleRun = useRef(true);

  // 选中 method/stage 变化时上报(经 ref 取最新回调,只在 method/stage 真变时触发,不被回调身份变化牵连)。
  const onSelRef = useRef(onSelectionChange);
  onSelRef.current = onSelectionChange;
  useEffect(() => { onSelRef.current?.(method, stage); }, [method, stage]);

  const stages = VARIANT_STAGES[method];
  const need = needOf(method);
  const eager = stage <= EAGER_MAX[method];
  // 设备并行度只在客户端可知;Node 21+ SSR 也有全局 navigator(hardwareConcurrency=构建机核数)
  // 会渲染出 4,移动端客户端是 2 → hydration mismatch。挂载后再取,水合期两端都渲染占位值。
  const [poolSize, setPoolSize] = useState<number | null>(null);
  useEffect(() => { setPoolSize(poolSizeForDevice()); }, []);
  // 当前 need 首次要加载的表(按内存降序)+ 合计,用于 loading 提示。
  const tableInfo = useMemo(() => {
    const rows = TABLE_SETS[need]
      .map((name) => ({ name, bytes: TABLE_BYTES[name] ?? 0 }))
      .sort((a, b) => b.bytes - a.bytes);
    return { rows, total: rows.reduce((s, r) => s + r.bytes, 0) };
  }, [need]);

  // 共享池:need(cross/variant/f2leo)变化时取/建对应池,等首个 worker 就绪。
  // poolSize 挂载后才可知(null=未挂载),到位前不建池(只 null→值 一次,不会重建)。
  // 加载不设硬超时(慢网下 60s 假报错比慢更糟):真实失败由 pool.ready reject 进 error,
  // 拖太久由 elapsed 计时驱动「网络较慢 + 重试」提示,重试 = 弃池重建。
  const [retryTick, setRetryTick] = useState(0);
  useEffect(() => {
    if (poolSize == null) return;
    let cancelled = false;
    setStatus('loading');
    setErrMsg('');
    const pool = getRustCrossPool(need, poolSize);
    poolRef.current = pool;
    pool.ready
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch((e) => { if (!cancelled) { setStatus('error'); setErrMsg(e?.message || String(e)); } });
    return () => { cancelled = true; };
  }, [need, poolSize, retryTick]);
  const retryLoad = useCallback(() => {
    dropRustCrossPool();
    setRetryTick((n) => n + 1);
  }, []);
  // loading 经过秒数(给用户进度感;≥15s 提示网络较慢并出重试按钮)。
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (status !== 'loading') return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status, need, retryTick]);

  // 方法切换后把 stage 收进合法范围。
  useEffect(() => {
    if (stage >= stages.length) setStage(stages.length - 1);
  }, [stages.length, stage]);

  // 算 6 视角步数;返回结果数组供自动选最优。std 逐 face 并行,变体/f2leo 一次返 6 值。
  const computeAll = useCallback(async (): Promise<(number | null)[]> => {
    const pool = poolRef.current;
    const result: (number | null)[] = [null, null, null, null, null, null];
    if (!pool) return result;
    const my = ++computeReq.current;
    const scr = scrambleRef.current.trim();
    if (!scr) return result;
    setComputing(true);
    setTotalMs(null);
    const wall = performance.now();
    const kind = kindOf(method, stages[stage] ?? '');
    try {
      if (kind === 'std') {
        await Promise.all(FACES.map(async (_f, f) => {
          try {
            const r = await pool.solveFace(scr, stage, f);
            if (computeReq.current !== my) return;
            result[f] = r.value;
            setCounts((prev) => { const n = prev.slice(); n[f] = r.value; return n; });
          } catch { /* skip face */ }
        }));
      } else {
        const vals = kind === 'f2leo'
          ? await pool.solveF2leoStage(scr, method === 'pseudo_f2leo', stage)
          : kind === 'block222'
            ? await pool.solveBlock222Stage(scr)
            : kind === 'roux223'
              ? await pool.solveRoux223Stage(scr, stage)
              : kind === 'eodr'
                ? await pool.solveEoDrStage(scr, eoDrStage(method, stage))
                : kind === 'htr'
                  ? await pool.solveHtrStage(scr)
                  : kind === 'htr2'
                    ? await pool.solveHtr2Stage(scr)
                    : kind === 'fr'
                      ? await pool.solveFrStage(scr)
                      : await pool.solveVariantStage(scr, VARIANT_ID[method as 'pair' | 'eo' | 'pseudo' | 'pseudo_pair'], stage);
        if (computeReq.current === my) {
          for (let i = 0; i < 6; i++) result[i] = vals[i] ?? null;
          setCounts(result.slice());
        }
      }
    } finally {
      if (computeReq.current === my) {
        setTotalMs(performance.now() - wall);
        setComputing(false);
      }
    }
    return result;
  }, [method, stage]);

  const compute = useCallback(async () => {
    ++computeReq.current; // supersede in-flight
    ++movesReq.current;
    setSelFace(null);
    setMoves(null);
    setCounts([null, null, null, null, null, null]);
    setTotalMs(null);
    if (!eager) { setComputing(false); wantAuto.current = false; return; }
    wantAuto.current = true; // 算完自动选最优视角
    await computeAll();
  }, [eager, computeAll]);

  // ready / 方法 / 阶段 变化时:eager 阶段自动批算 6 面;重阶段只清空待用户点「计算」。
  useEffect(() => {
    if (status === 'ready') void compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, method, stage]);

  // 打乱变化(WCA 选取 / 粘贴 / 编辑)→ 防抖后自动重算当前阶段。跳过首挂(上面已算)。
  useEffect(() => {
    if (firstScrambleRun.current) { firstScrambleRun.current = false; return; }
    if (statusRef.current !== 'ready') return;
    const id = setTimeout(() => { void compute(); }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normScramble]);

  const fetchMoves = useCallback(async (f: number) => {
    const pool = poolRef.current;
    if (!pool) return;
    const my = ++movesReq.current;
    setMovesLoading(true);
    setMoves(null);
    setSelSol(0);
    try {
      const scr = scrambleRef.current.trim();
      const kind = kindOf(method, stages[stage] ?? '');
      // 用户指定槽位:仅当其槽数与当前阶段一致时生效(切阶段后旧选择失配 → 回退自动)。
      const sc = slotCount(method, stage);
      const combo = sc >= 1 && comboArity(selSlotRef.current) === sc ? selSlotRef.current : '';
      // 搜索深度恒定 = 最优+SLACK(=旧「+2」档,不引入新的性能成本);cap=用户选的展示条数,
      // 引擎按长度升序收集、够数即停。条数填不满时(短解不够)如实返回更少。
      const res = kind === 'std'
        ? await pool.solveMoves(scr, stage, f, { extra: SOL_SLACK, cap: limit, combo })
        : kind === 'f2leo'
          ? await pool.solveF2leoMoves(scr, method === 'pseudo_f2leo', f, stage, { extra: SOL_SLACK, cap: limit, combo })
          : kind === 'block222'
            ? await pool.solveBlock222Moves(scr, f, { extra: SOL_SLACK, cap: limit })
            : kind === 'roux223'
              ? await pool.solveRoux223Moves(scr, stage, f, { extra: SOL_SLACK, cap: limit })
              : kind === 'eodr'
                ? await pool.solveEoDrMoves(scr, eoDrStage(method, stage), f, { extra: SOL_SLACK, cap: limit })
                : kind === 'htr'
                  ? await pool.solveHtrMoves(scr, f, { extra: SOL_SLACK, cap: limit })
                  : kind === 'htr2'
                    ? await pool.solveHtr2Moves(scr, f, { extra: SOL_SLACK, cap: limit })
                    : kind === 'fr'
                      ? await pool.solveFrMoves(scr, f, { extra: SOL_SLACK, cap: limit })
                      : await pool.solveVariantMoves(scr, VARIANT_ID[method as 'pair' | 'eo' | 'pseudo' | 'pseudo_pair'], f, stage, { extra: SOL_SLACK, cap: limit, combo });
      if (movesReq.current === my) {
        // 引擎按 HTM 升序收集;同 HTM 再按 QTM 升序(180°=2),Array.sort 稳定 → 原 DFS 序兜底。
        const sols = [...res.sols].sort((a, b) => (moveLen(a.m) - moveLen(b.m)) || (countQtm(a.m) - countQtm(b.m)));
        setMoves({ ...res, sols });
        setSelSol(0);
        setCounts((prev) => { const next = prev.slice(); next[f] = res.len; return next; });
        // 新算出的解法载入后,把动画重置到开头(否则可能停在上一条的进度)。
        requestAnimationFrame(() => requestAnimationFrame(() => {
          try { playerRef.current?.jumpToStart?.({ flash: false }); } catch { /* */ }
        }));
      }
    } catch (e) {
      if (movesReq.current === my) setErrMsg(String(e));
    } finally {
      if (movesReq.current === my) setMovesLoading(false);
    }
  }, [method, stage, limit]);

  const clickFace = useCallback((f: number) => {
    wantAuto.current = false;
    if (selFace === f) { setSelFace(null); setMoves(null); return; }
    setSelFace(f);
    void fetchMoves(f);
  }, [selFace, fetchMoves]);

  // 切换槽位:同步 ref(fetchMoves 立即读到新值)+ 上报(进 URL 深链)后重算当前视角。
  const changeSlot = useCallback((v: string) => {
    selSlotRef.current = v;
    setSelSlot(v);
    onSlotChange?.(v);
    if (selFace !== null) void fetchMoves(selFace);
  }, [selFace, fetchMoves, onSlotChange]);

  // 切方法/阶段/打乱 → 槽位回「自动」(旧选择对新阶段的槽数多半失配)。跳过首挂,
  // 否则会立刻清掉深链带进来的 initialSlot。
  const firstSlotReset = useRef(true);
  useEffect(() => {
    if (firstSlotReset.current) { firstSlotReset.current = false; return; }
    selSlotRef.current = '';
    setSelSlot('');
    onSlotChange?.('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, stage, normScramble]);

  // 算完(computing→false)且要求自动选 → 选最优(min count)视角并出解。
  useEffect(() => {
    if (computing || !wantAuto.current) return;
    if (selFace !== null) { wantAuto.current = false; return; }
    let best = -1, bestV = Infinity;
    counts.forEach((v, i) => { if (v != null && !isSentinel(v) && v < bestV) { bestV = v; best = i; } });
    if (best >= 0) { wantAuto.current = false; setSelFace(best); void fetchMoves(best); }
  }, [computing, counts, selFace, fetchMoves]);

  // 深链初始视角:首次就绪时锁定 initialFace 并直接出解(覆盖自动选最优),只跑一次。
  // 重阶段(非 eager,如 block/f2b)也能用——单视角按需求解正是点击视角的路径。
  const wantInitFace = useRef<number | null>(
    initialFace != null && Number.isInteger(initialFace) && initialFace >= 0 && initialFace <= 5 ? initialFace : null,
  );
  useEffect(() => {
    if (status !== 'ready' || wantInitFace.current == null) return;
    const f = wantInitFace.current;
    wantInitFace.current = null;
    wantAuto.current = false;
    setSelFace(f);
    void fetchMoves(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // 条数变了且有选中格 → 重取。
  useEffect(() => {
    if (selFace !== null) void fetchMoves(selFace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  // 信息弹窗:Esc 关。
  useEffect(() => {
    if (!infoOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setInfoOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [infoOpen]);

  // 解法逐条流式出现。
  useEffect(() => {
    if (!moves || movesLoading) { setShown(0); return; }
    const total = moves.sols.length;
    if (total === 0) { setShown(0); return; }
    setShown(0);
    const step = Math.max(1, Math.ceil(total / 32));
    let n = 0;
    const id = setInterval(() => {
      n = Math.min(total, n + step);
      setShown(n);
      if (n >= total) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [moves, movesLoading]);

  // 新一批解法载入时清空各行的 y 预转体。
  useEffect(() => { setRowRot({}); }, [moves]);

  // 循环某行的 y 预转体(0→y→y2→y'→0),并把它设为选中行 + 把动画重置到开头。
  const cycleRot = useCallback((i: number) => {
    setRowRot((prev) => ({ ...prev, [i]: (((prev[i] ?? 0) + 1) % 4) }));
    setSelSol(i);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try { playerRef.current?.jumpToStart?.({ flash: false }); } catch { /* */ }
    }));
  }, []);

  const copySol = useCallback((i: number, sol: string) => {
    navigator.clipboard?.writeText(sol).then(() => {
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 1200);
    }).catch(() => { /* clipboard blocked */ });
  }, []);

  // 选中解法:都把动画重置到开头(切换解法不该停在上一条的进度);play=true 再从头播放。
  // 双 rAF 等 alg 流到共享播放器生效后再 jumpToStart(同 sim PlayerControls 的写法)。
  const selectSol = useCallback((i: number, play: boolean) => {
    setSelSol(i);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const p = playerRef.current;
      try { p?.jumpToStart?.({ flash: false }); } catch { /* */ }
      if (play) { try { p?.play?.(); } catch { /* */ } }
    }));
  }, []);

  // 最优步数(min),用于「best」标记 —— 所有并列最少的视角都算最优;htr/htr2 哨兵不参与。
  const bestVal = useMemo(() => {
    let v = Infinity;
    counts.forEach((c) => { if (c != null && !isSentinel(c) && c < v) v = c; });
    return Number.isFinite(v) ? v : null;
  }, [counts]);

  // 当前 (方法, 阶段) 可选的槽位组合;.length<2 时(纯十字 k=0 / 满 F2L k=4)不显示选择器。
  const slotCombos = useMemo(() => kCombos(slotCount(method, stage)), [method, stage]);

  const selSolAlg = moves && moves.sols.length > 0
    ? rotateSolutionY(moves.sols[Math.min(selSol, moves.sols.length - 1)].m, rowRot[Math.min(selSol, moves.sols.length - 1)] ?? 0)
    : null;

  return (
    <section className={`stsv${compact ? ' stsv-compact' : ''}`}>
      {/* 控件常驻:求解器加载期间也能切方法/阶段/条数(切方法即换池),UI 不被 loading 替换。 */}
      <div className="stsv-controls">
        <label className="stsv-control">
          <span>{t('方法', 'Method')}</span>
          <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
            {METHOD_KEYS.map((k) => <option key={k} value={k}>{variantLabel(k, lang === 'zh')}</option>)}
          </select>
        </label>
        <label className="stsv-control">
          <span>{t('阶段', 'Stage')}</span>
          <select value={stage} onChange={(e) => setStage(Number(e.target.value))}>
            {stages.map((k, i) => <option key={k} value={i}>{stageLabel(k, lang === 'zh')}</option>)}
          </select>
        </label>
        {/* 槽位选择器仅在「有得选」时显示:k=4(满 F2L,唯一组合 BL BR FR FL,等于自动)
            和 k=0(纯十字无槽)都只有 ≤1 个组合,不显示。 */}
        {slotCombos.length >= 2 && (
          <label className="stsv-control">
            <span>{t('槽位', 'Slot')}</span>
            <select value={selSlot} onChange={(e) => changeSlot(e.target.value)}>
              <option value="">{t('自动(最优)', 'Auto (best)')}</option>
              {slotCombos.map((c) => {
                const v = c.join(',');
                return <option key={v} value={v}>{comboLabel(v)}</option>;
              })}
            </select>
          </label>
        )}
        <label className="stsv-control">
          <span>{t('显示条数', 'Show')}</span>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>{t(`最多 ${n} 条`, `Up to ${n}`)}</option>
            ))}
          </select>
        </label>
        <button
          className="stsv-compute"
          onClick={() => { wantAuto.current = true; void computeAll(); }}
          disabled={computing || status !== 'ready'}
        >
          {computing ? <Loader2 size={14} className="stsv-spin" /> : null}
          {t('计算', 'Compute')}
        </button>
        <button
          type="button"
          className="stsv-diag"
          onClick={() => setInfoOpen(true)}
          title={t('求解器信息', 'Solver info')}
          aria-label={t('求解器信息', 'Solver info')}
        >
          <Info size={15} />
        </button>
      </div>

      {status === 'loading' && (
        <div className="stsv-loading">
          <div className="stsv-status">
            <Loader2 size={14} className="stsv-spin" />
            {t('加载求解器与数据表(仅首次)…', 'Loading solver + tables (first time only)…')}
            {elapsed >= 3 && <span className="stsv-elapsed">{elapsed}s</span>}
          </div>
          <ul className="stsv-tables">
            {tableInfo.rows.map((r) => (
              <li key={r.name}>
                <code>{r.name}</code>
                <span>{fmtBytes(r.bytes)}</span>
              </li>
            ))}
          </ul>
          <div className="stsv-tables-total">
            {poolSize == null
              ? t(
                `共 ${tableInfo.rows.length} 张表 ≈ ${fmtBytes(tableInfo.total)}`,
                `${tableInfo.rows.length} tables ≈ ${fmtBytes(tableInfo.total)}`,
              )
              : t(
                `共 ${tableInfo.rows.length} 张表 ≈ ${fmtBytes(tableInfo.total)} · ${poolSize} 路并行各一份`,
                `${tableInfo.rows.length} tables ≈ ${fmtBytes(tableInfo.total)} · one copy per worker × ${poolSize}`,
              )}
          </div>
          {elapsed >= 15 && (
            <div className="stsv-slow">
              {t('网络较慢,仍在下载…', 'Slow network — still downloading…')}
              <button type="button" className="stsv-retry" onClick={retryLoad}>{t('重试', 'Retry')}</button>
            </div>
          )}
        </div>
      )}
      {status === 'error' && (
        <div className="stsv-status stsv-err">
          {t('初始化失败', 'Init failed')}: {errMsg}
          <button type="button" className="stsv-retry" onClick={retryLoad}>{t('重试', 'Retry')}</button>
        </div>
      )}

      {status === 'ready' && (
        <>
          {/* 6 视角对比:点格选视角;最优(min)视角带 best 标记 */}
          <div className="stsv-angles">
            {FACES.map((f, i) => {
              const loading = (eager && computing) || (selFace === i && movesLoading);
              const isBest = counts[i] != null && counts[i] === bestVal;
              return (
                <button
                  key={f.face}
                  className={`stsv-angle${selFace === i ? ' is-sel' : ''}${isBest ? ' is-best' : ''}`}
                  onClick={() => clickFace(i)}
                  data-empty={counts[i] == null}
                  style={{ '--face-bg': CUBE_FILL[f.face], '--face-fg': CUBE_ON_FILL[f.face] } as CSSProperties}
                  title={`${faceDesc(f.face)}${t(' · 点击求解', ' · click to solve')}`}
                >
                  {counts[i] != null ? (
                    <span className="stsv-angle-n">{isSentinel(counts[i]) ? '-' : counts[i]}</span>
                  ) : loading ? (
                    <Loader2 size={12} className="stsv-spin" />
                  ) : (
                    <span className="stsv-angle-dot">·</span>
                  )}
                  {isBest && <span className="stsv-angle-best">{t('最优', 'best')}</span>}
                </button>
              );
            })}
          </div>
          {method === 'htr' && (
            <div className="stsv-hint">
              {t(
                'HTR 为条件式阶段:仅当该视角已处于 DR 时给出 DR→HTR 最优步数,否则显示 -。',
                'HTR is conditional: a view shows its optimal DR→HTR move count only when it is already in DR; otherwise it shows -.',
              )}
            </div>
          )}
          {method === 'htr2' && (
            <div className="stsv-hint">
              {t(
                'HTR 收尾为条件式阶段:仅当该视角已处于 HTR 时给出 HTR→还原最优步数,否则显示 -。',
                'HTR-finish is conditional: a view shows its optimal HTR→solved move count only when it is already in HTR; otherwise it shows -.',
              )}
            </div>
          )}
          {method === 'fr' && (
            <div className="stsv-hint">
              {t(
                'Floppy 还原为条件式阶段:仅当该视角已处于 HTR 时给出 HTR→FR 最优步数,否则显示 -。',
                'Floppy Reduction is conditional: a view shows its optimal HTR→FR move count only when it is already in HTR; otherwise it shows -.',
              )}
            </div>
          )}
          {!eager && (
            <div className="stsv-hint">
              {t(
                '该阶段搜索较重,不自动算:点「计算」算全部 6 面,或点单个视角只算它(最坏数十秒)。',
                'This stage is heavy, so it does not auto-run: click Compute for all 6 faces, or click one face to solve just it (up to tens of seconds).',
              )}
            </div>
          )}

          {selFace !== null && (
            <div className="stsv-result">
              <div className="stsv-sols">
                <div className="stsv-sols-head">
                  <strong>{stageLabel(stages[stage], lang === 'zh')}</strong>
                  <span
                    className="stsv-sols-face"
                    title={faceDesc(FACES[selFace].face)}
                  >
                    <i className="stsv-sols-swatch" style={{ background: CUBE_FILL[FACES[selFace].face] }} />
                  </span>
                  {moves && !isSentinel(moves.len) && <span className="stsv-len">{moves.len} HTM</span>}
                </div>

                {movesLoading && (
                  <div className="stsv-status"><Loader2 size={14} className="stsv-spin" />{t('枚举解法…', 'Enumerating…')}</div>
                )}

                {moves && !movesLoading && moves.sols.length === 0 && (
                  <div className="stsv-empty">
                    {isSentinel(moves.len)
                      ? (method === 'htr2'
                        ? t('该视角未处于 HTR,HTR 收尾不适用', 'This view is not in HTR, so HTR-finish does not apply')
                        : method === 'fr'
                          ? t('该视角未处于 HTR,Floppy 还原不适用', 'This view is not in HTR, so Floppy Reduction does not apply')
                          : t('该视角未处于 DR,HTR 不适用', 'This view is not in DR, so HTR does not apply'))
                      : t('该视角已解(0 步)', 'Already solved (0 moves)')}
                  </div>
                )}

                {moves && !movesLoading && moves.sols.length > 0 && (
                  <>
                    <div className="stsv-sols-count">
                      {shown < moves.sols.length
                        ? t(`${shown} / ${moves.sols.length} 条解法`, `${shown} / ${moves.sols.length} solutions`)
                        : t(`${moves.sols.length} 条解法`, `${moves.sols.length} solutions`)}
                      {moves.sols.length >= limit && (
                        <span className="stsv-sols-more">{t(' · 已达上限,可能更多', ' · capped, may be more')}</span>
                      )}
                    </div>
                    <ol className="stsv-sols-list">
                      {moves.sols.slice(0, shown).map((sol, i) => {
                        const rot = rowRot[i] ?? 0;
                        const dispAlg = rotateSolutionY(sol.m, rot);
                        return (
                        <li
                          key={i}
                          className={`stsv-sol-row${selSol === i ? ' is-active' : ''}`}
                          onClick={() => selectSol(i, true)}
                        >
                          <span className="stsv-sol-len">{moveLen(dispAlg)}</span>
                          <button
                            type="button"
                            className={`stsv-sol-rot${rot ? ' is-on' : ''}`}
                            onClick={(e) => { e.stopPropagation(); cycleRot(i); }}
                            title={t('加预转体:循环 y → y2 → y′ → 无(换个朝向做同一套公式)', 'Pre-rotation: cycle y → y2 → y′ → none (same solve, different orientation)')}
                            aria-label={t('加 y 预转体', 'Add y pre-rotation')}
                          >
                            {Y_ROT_LABEL[rot]}
                          </button>
                          <button
                            className="stsv-sol-copy"
                            onClick={(e) => { e.stopPropagation(); copySol(i, dispAlg); }}
                            aria-label={t('复制', 'Copy')}
                          >
                            {copiedIdx === i ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                          {sol.c && <span className="stsv-sol-slot">{sol.c}</span>}
                          <code>{dispAlg}</code>
                        </li>
                      );
                      })}
                    </ol>
                  </>
                )}
              </div>

              {/* 单个共享 3D 播放器:跟随选中解法行 */}
              {selSolAlg && (
                <div className="stsv-player">
                  <TwistySection puzzle="3x3x3" scramble={normScramble} alg={selSolAlg} playerRef={playerRef} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {infoOpen && createPortal(
        <div className="stsv-modal-backdrop" onClick={() => setInfoOpen(false)}>
          <div className="stsv-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="stsv-modal-head">
              <strong>{t('求解器信息', 'Solver info')}</strong>
              <button className="stsv-modal-x" onClick={() => setInfoOpen(false)} aria-label={t('关闭', 'Close')}>
                <X size={16} />
              </button>
            </div>
            <dl className="stsv-modal-kv">
              <div>
                <dt>{t('引擎', 'Engine')}</dt>
                <dd>Rust → WASM · {t(`${poolSize ?? '…'} 路并行`, `${poolSize ?? '…'}-way`)}</dd>
              </div>
              {totalMs != null && (
                <div>
                  <dt>{t('6 视角总耗时', '6-face total')}</dt>
                  <dd>{fmtMs(totalMs)}</dd>
                </div>
              )}
              {moves && (
                <div>
                  <dt>{t('当前解法枚举', 'This enumeration')}</dt>
                  <dd>{fmtMs(moves.ms)}</dd>
                </div>
              )}
            </dl>
            <div className="stsv-modal-tablehead">
              {t(`剪枝表 ${tableInfo.rows.length} 张 ≈ ${fmtBytes(tableInfo.total)}`,
                `Pruning tables: ${tableInfo.rows.length} ≈ ${fmtBytes(tableInfo.total)}`)}
              <span>{t('每路 worker 各装一份', 'one copy per worker')}</span>
            </div>
            <ul className="stsv-modal-tables">
              {tableInfo.rows.map((r) => (
                <li key={r.name}>
                  <code>{r.name}</code>
                  <span>{fmtBytes(r.bytes)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
