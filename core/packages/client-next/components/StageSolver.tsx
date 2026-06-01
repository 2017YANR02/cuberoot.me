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
import { Loader2, Copy, Check, Play } from 'lucide-react';
import TwistySection from '@/components/TwistySection';
import { CUBE_FILL, CUBE_ON_FILL, type CubeFace } from '@/lib/cube-colors';
import { type MovesTimed, type RustCrossPool } from '@/lib/rust-cross-client';
import { getRustCrossPool, poolSizeForDevice, type PoolNeed } from '@/lib/rust-cross-pool';
import { normalizeScramble } from '@/lib/cross-solver';
import './StageSolver.css';

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

export type Method = 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair' | 'f2leo' | 'pseudo_f2leo';
const VARIANT_ID: Record<'pair' | 'eo' | 'pseudo' | 'pseudo_pair', number> = {
  pair: 0, eo: 1, pseudo: 2, pseudo_pair: 3,
};
const METHODS: { key: Method; label: string }[] = [
  { key: 'std', label: 'Standard' },
  { key: 'eo', label: 'EO' },
  { key: 'pair', label: 'Pair' },
  { key: 'pseudo', label: 'Pseudo' },
  { key: 'pseudo_pair', label: 'Pseudo + Pair' },
  { key: 'f2leo', label: 'F2LEO' },
  { key: 'pseudo_f2leo', label: 'Pseudo F2LEO' },
];
const STAGE_LABELS: Record<Method, string[]> = {
  std: ['Cross', 'XC', 'XXC', 'XXXC', 'XXXXC (F2L)'],
  eo: ['EO Cross', 'EO XC', 'EO XXC', 'EO XXXC', 'EO XXXXC'],
  pair: ['Cross + Pair', 'XC + Pair', 'XXC + Pair', 'XXXC + Pair'],
  pseudo: ['Pseudo Cross', 'Pseudo XC', 'Pseudo XXC', 'Pseudo XXXC'],
  pseudo_pair: ['P-Cross + Pair', 'P-XC + Pair', 'P-XXC + Pair', 'P-XXXC + Pair'],
  f2leo: ['F2LEO Cross', 'F2LEO XC', 'F2LEO XXC', 'F2LEO XXXC'],
  pseudo_f2leo: ['P-F2LEO Cross', 'P-F2LEO XC', 'P-F2LEO XXC', 'P-F2LEO XXXC'],
};
// 自动批算(eager)的最深阶段;更深的留点击按需(单视角搜索重,弱小表启发式)。
const EAGER_MAX: Record<Method, number> = {
  std: 3, eo: 2, pair: 3, pseudo: 3, pseudo_pair: 2, f2leo: 1, pseudo_f2leo: 1,
};
type Kind = 'std' | 'variant' | 'f2leo';
const kindOf = (m: Method): Kind =>
  m === 'std' ? 'std' : m === 'f2leo' || m === 'pseudo_f2leo' ? 'f2leo' : 'variant';
const needOf = (m: Method): PoolNeed => {
  const k = kindOf(m);
  return k === 'std' ? 'cross' : k === 'f2leo' ? 'f2leo' : 'variant';
};

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

// 步骤前缀可能含 1~2 个旋转 token(eo/f2leo 破 y 对称时如 "x' y")。算实际转动数时剥掉。
const moveLen = (sol: string) => sol.replace(/^([xyz][2']?\s+)+/, '').split(/\s+/).filter(Boolean).length;

interface Props {
  scramble: string;
  lang: 'zh' | 'en';
  initialMethod?: Method;
  initialStage?: number;
  /** gen 行内:更紧凑的间距 + 略小播放器。 */
  compact?: boolean;
}

export default function StageSolver({ scramble, lang, initialMethod = 'std', initialStage = 0, compact = false }: Props) {
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

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
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [runToken, setRunToken] = useState(0);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [shown, setShown] = useState(0);

  const poolRef = useRef<RustCrossPool | null>(null);
  const normScramble = useMemo(() => normalizeScramble(scramble) ?? scramble, [scramble]);
  const scrambleRef = useRef(normScramble);
  scrambleRef.current = normScramble;
  const computeReq = useRef(0);
  const movesReq = useRef(0);
  const wantAuto = useRef(false); // 算完是否自动选最优视角
  const statusRef = useRef(status);
  statusRef.current = status;
  const firstScrambleRun = useRef(true);

  const need = needOf(method);
  const stages = STAGE_LABELS[method];
  const eager = stage <= EAGER_MAX[method];
  const poolSize = useMemo(() => poolSizeForDevice(), []);

  // 共享池:need(cross/variant/f2leo)变化时取/建对应池,等首个 worker 就绪。
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrMsg('');
    const pool = getRustCrossPool(need, poolSize);
    poolRef.current = pool;
    const timeout = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(t('加载超时(>60s),请重试或检查网络', 'load timeout (>60s) — retry or check network'))), 60000),
    );
    Promise.race([pool.ready, timeout])
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch((e) => { if (!cancelled) { setStatus('error'); setErrMsg(e?.message || String(e)); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [need, poolSize]);

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
    const kind = kindOf(method);
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

  // ready / 方法 / 阶段 / 手动触发 时重算。
  useEffect(() => {
    if (status === 'ready') void compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, method, stage, runToken]);

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
      const kind = kindOf(method);
      // 搜索深度恒定 = 最优+SLACK(=旧「+2」档,不引入新的性能成本);cap=用户选的展示条数,
      // 引擎按长度升序收集、够数即停。条数填不满时(短解不够)如实返回更少。
      const res = kind === 'std'
        ? await pool.solveMoves(scr, stage, f, { extra: SOL_SLACK, cap: limit })
        : kind === 'f2leo'
          ? await pool.solveF2leoMoves(scr, method === 'pseudo_f2leo', f, stage, { extra: SOL_SLACK, cap: limit })
          : await pool.solveVariantMoves(scr, VARIANT_ID[method as 'pair' | 'eo' | 'pseudo' | 'pseudo_pair'], f, stage, { extra: SOL_SLACK, cap: limit });
      if (movesReq.current === my) {
        setMoves(res);
        setSelSol(0);
        setCounts((prev) => { const next = prev.slice(); next[f] = res.len; return next; });
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

  // 算完(computing→false)且要求自动选 → 选最优(min count)视角并出解。
  useEffect(() => {
    if (computing || !wantAuto.current) return;
    if (selFace !== null) { wantAuto.current = false; return; }
    let best = -1, bestV = Infinity;
    counts.forEach((v, i) => { if (v != null && v < bestV) { bestV = v; best = i; } });
    if (best >= 0) { wantAuto.current = false; setSelFace(best); void fetchMoves(best); }
  }, [computing, counts, selFace, fetchMoves]);

  // 条数变了且有选中格 → 重取。
  useEffect(() => {
    if (selFace !== null) void fetchMoves(selFace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

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

  const copySol = useCallback((i: number, sol: string) => {
    navigator.clipboard?.writeText(sol).then(() => {
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 1200);
    }).catch(() => { /* clipboard blocked */ });
  }, []);

  // 最优(min)视角索引,用于「best」标记。
  const bestFace = useMemo(() => {
    let best = -1, bestV = Infinity;
    counts.forEach((v, i) => { if (v != null && v < bestV) { bestV = v; best = i; } });
    return best;
  }, [counts]);

  const selSolAlg = moves && moves.sols.length > 0 ? moves.sols[Math.min(selSol, moves.sols.length - 1)] : null;

  return (
    <section className={`stsv${compact ? ' stsv-compact' : ''}`}>
      {status === 'loading' && (
        <div className="stsv-status">
          <Loader2 size={14} className="stsv-spin" />
          {t('加载求解器与数据表(仅首次)…', 'Loading solver + tables (first time only)…')}
        </div>
      )}
      {status === 'error' && (
        <div className="stsv-status stsv-err">{t('初始化失败', 'Init failed')}: {errMsg}</div>
      )}

      {status === 'ready' && (
        <>
          <div className="stsv-controls">
            <label className="stsv-control">
              <span>{t('方法', 'Method')}</span>
              <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                {METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>
            <label className="stsv-control">
              <span>{t('阶段', 'Stage')}</span>
              <select value={stage} onChange={(e) => setStage(Number(e.target.value))}>
                {stages.map((l, i) => <option key={i} value={i}>{l}</option>)}
              </select>
            </label>
            <label className="stsv-control">
              <span>{t('显示条数', 'Show')}</span>
              <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                {LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>{t(`最多 ${n} 条`, `Up to ${n}`)}</option>
                ))}
              </select>
            </label>
            <button className="stsv-compute" onClick={() => setRunToken((x) => x + 1)} disabled={computing}>
              {computing ? <Loader2 size={14} className="stsv-spin" /> : null}
              {t('计算', 'Compute')}
            </button>
            {!eager && (
              <button
                className="stsv-compute stsv-compute-all"
                onClick={() => { wantAuto.current = true; void computeAll(); }}
                disabled={computing}
              >
                {computing ? <Loader2 size={14} className="stsv-spin" /> : null}
                {t('全部 6 视角', 'All 6 faces')}
              </button>
            )}
          </div>
          <div className="stsv-meta">
            {t(`${poolSize} 路并行`, `${poolSize}-way parallel`)}
            {totalMs != null && <span> · {t('总耗时', 'total')} {fmtMs(totalMs)}</span>}
          </div>

          {/* 6 视角对比:点格选视角;最优(min)视角带 best 标记 */}
          <div className="stsv-angles">
            {FACES.map((f, i) => {
              const loading = (eager && computing) || (selFace === i && movesLoading);
              const isBest = i === bestFace && counts[i] != null;
              return (
                <button
                  key={f.face}
                  className={`stsv-angle${selFace === i ? ' is-sel' : ''}${isBest ? ' is-best' : ''}`}
                  onClick={() => clickFace(i)}
                  data-empty={counts[i] == null}
                  style={{ '--face-bg': CUBE_FILL[f.face], '--face-fg': CUBE_ON_FILL[f.face] } as CSSProperties}
                  title={t(`${f.face} 面十字 · 点击求解`, `${f.face}-face cross · click to solve`)}
                >
                  {counts[i] != null ? (
                    <span className="stsv-angle-n">{counts[i]}</span>
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
          {!eager && (
            <div className="stsv-hint">
              {t(
                '该阶段单视角搜索较重,点任一视角按需求解(最坏数十秒)。',
                'This stage is heavy per orientation — click a face to solve it on demand.',
              )}
            </div>
          )}

          {selFace !== null && (
            <div className="stsv-result">
              <div className="stsv-sols">
                <div className="stsv-sols-head">
                  <strong>{stages[stage]}</strong>
                  <span
                    className="stsv-sols-face"
                    title={t(`${FACES[selFace].face} 面十字`, `${FACES[selFace].face}-face cross`)}
                  >
                    <i className="stsv-sols-swatch" style={{ background: CUBE_FILL[FACES[selFace].face] }} />
                  </span>
                  {moves && moves.combo && moves.combo !== 'cross' && (
                    <span className="stsv-combo">{t('槽位', 'slots')}: {moves.combo}</span>
                  )}
                  {moves && <span className="stsv-len">{moves.len} HTM</span>}
                </div>

                {movesLoading && (
                  <div className="stsv-status"><Loader2 size={14} className="stsv-spin" />{t('枚举解法…', 'Enumerating…')}</div>
                )}

                {moves && !movesLoading && moves.sols.length === 0 && (
                  <div className="stsv-empty">{t('该视角已解(0 步)', 'Already solved (0 moves)')}</div>
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
                      <span className="stsv-sols-ms"> · {fmtMs(moves.ms)}</span>
                    </div>
                    <ol className="stsv-sols-list">
                      {moves.sols.slice(0, shown).map((sol, i) => (
                        <li
                          key={i}
                          className={`stsv-sol-row${selSol === i ? ' is-active' : ''}`}
                          onClick={() => setSelSol(i)}
                        >
                          <button className="stsv-sol-play" aria-label={t('播放', 'Play')} onClick={(e) => { e.stopPropagation(); setSelSol(i); }}>
                            <Play size={11} />
                          </button>
                          <code>{sol}</code>
                          <span className="stsv-sol-len">{moveLen(sol)}</span>
                          <button
                            className="stsv-sol-copy"
                            onClick={(e) => { e.stopPropagation(); copySol(i, sol); }}
                            aria-label={t('复制', 'Copy')}
                          >
                            {copiedIdx === i ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>

              {/* 单个共享 3D 播放器:跟随选中解法行 */}
              {selSolAlg && (
                <div className="stsv-player">
                  <TwistySection puzzle="3x3x3" scramble={normScramble} alg={selSolAlg} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
