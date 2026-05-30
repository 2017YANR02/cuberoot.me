'use client';

/**
 * Rust → WASM cross-step 求解区(并入 analyzer 页)。
 *
 * Standard:cross / xcross / xxcross / xxxcross / xxxxcross(F2L)逐视角最优步数 + 多解步骤。
 * 变体:EO / Pair / Pseudo / Pseudo+Pair —— 小表 client 端逐视角最优步数 + 具体转动步骤
 * (与桌面端大表只算步数不同,这里能算出真实可执行的转动序列)。
 *
 * 小表可采纳启发式,后台 worker。产物自包含在 /tools/solver/rust-cross/,表只在本区首次
 * 展开时才拉(懒加载,不拖累 analyzer 首屏)。std 与变体用不同表集,切换时按需重建 worker 池。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Copy, Check } from 'lucide-react';
import TwistySection from '@/components/TwistySection';
import { createRustCrossPool, type RustCrossPool, type MovesTimed } from '@/lib/rust-cross-client';

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

// 方法:std(标准 cross 阶段,need='cross' 池)+ 4 个 comp 变体(need='variant' 池)。
type Method = 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair';
const VARIANT_ID: Record<Exclude<Method, 'std'>, number> = { pair: 0, eo: 1, pseudo: 2, pseudo_pair: 3 };
const METHODS: { key: Method; label: string }[] = [
  { key: 'std', label: 'Standard' },
  { key: 'eo', label: 'EO' },
  { key: 'pair', label: 'Pair' },
  { key: 'pseudo', label: 'Pseudo' },
  { key: 'pseudo_pair', label: 'Pseudo + Pair' },
];
// 每个方法的阶段标签(stage index → label)。pair/pseudo/pseudo_pair 4 阶段,std/eo 5 阶段。
const STAGE_LABELS: Record<Method, string[]> = {
  std: ['Cross', 'XCross', 'XXCross', 'XXXCross', 'XXXXCross (F2L)'],
  eo: ['EO Cross', 'EO XCross', 'EO XXCross', 'EO XXXCross', 'EO XXXXCross'],
  pair: ['Cross + Pair', 'XCross + Pair', 'XXCross + Pair', 'XXXCross + Pair'],
  pseudo: ['Pseudo Cross', 'Pseudo XCross', 'Pseudo XXCross', 'Pseudo XXXCross'],
  pseudo_pair: ['P-Cross + Pair', 'P-XCross + Pair', 'P-XXCross + Pair', 'P-XXXCross + Pair'],
};
// 自动批算(eager)的最深阶段;更深的留给点击按需(单视角搜索重,弱小表启发式)。
const EAGER_MAX: Record<Method, number> = { std: 3, eo: 2, pair: 3, pseudo: 3, pseudo_pair: 2 };

// 6 视角:rot ""/z2/z'/z/x'/x → 底面 D/U/L/R/F/B(与 ROTS / solveVariantStage 返回序一致)
const FACES: { face: string; rot: string }[] = [
  { face: 'D', rot: '' },
  { face: 'U', rot: 'z2' },
  { face: 'L', rot: "z'" },
  { face: 'R', rot: 'z' },
  { face: 'F', rot: "x'" },
  { face: 'B', rot: 'x' },
];

// 步骤前缀可能含 1~2 个旋转 token(eo 破 y 对称时可能 "x' y")。算实际转动数时全部剥掉。
const moveLen = (sol: string) => sol.replace(/^([xyz][2']?\s+)+/, '').split(/\s+/).filter(Boolean).length;

interface Props {
  scramble: string;
  lang: 'zh' | 'en';
}

export default function RustCrossSection({ scramble, lang }: Props) {
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [method, setMethod] = useState<Method>('std');
  const [stage, setStage] = useState(0);
  const [extra, setExtra] = useState(0); // 0=仅最优长度全部解;>0=含次优(+N)
  const [counts, setCounts] = useState<(number | null)[]>([null, null, null, null, null, null]);
  const [times, setTimes] = useState<(number | null)[]>([null, null, null, null, null, null]);
  const [computing, setComputing] = useState(false);
  const [selFace, setSelFace] = useState<number | null>(null);
  const [moves, setMoves] = useState<MovesTimed | null>(null);
  const [movesLoading, setMovesLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [runToken, setRunToken] = useState(0);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [shown, setShown] = useState(0); // 解法逐条流式 reveal 的可见条数

  // 单池,need(cross / variant)变化(std↔变体)时重建 —— 两者装不同表集。
  const poolRef = useRef<{ pool: RustCrossPool; need: 'cross' | 'variant' } | null>(null);
  const scrambleRef = useRef(scramble);
  scrambleRef.current = scramble;
  const computeReq = useRef(0);
  const movesReq = useRef(0);

  const need: 'cross' | 'variant' = method === 'std' ? 'cross' : 'variant';
  const stages = STAGE_LABELS[method];
  const eager = stage <= EAGER_MAX[method];

  // worker 池大小:手机 2、桌面 4,按需懒生成,既能并行又不 OOM。
  const poolSize = useMemo(() => {
    if (typeof navigator === 'undefined') return 2;
    const hc = navigator.hardwareConcurrency || 4;
    const mobile = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 768px)').matches;
    return Math.max(1, Math.min(mobile ? 2 : 4, hc - 1));
  }, []);

  // 懒初始化 + need 变化时重建池(首个 worker 拉表)。
  useEffect(() => {
    if (!open) return;
    if (poolRef.current && poolRef.current.need === need) return;
    poolRef.current?.pool.terminate();
    setStatus('loading');
    setErrMsg('');
    const pool = createRustCrossPool(poolSize, need);
    poolRef.current = { pool, need };
    const timeout = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(t('加载超时(>60s),请重试或检查网络', 'load timeout (>60s) — retry or check network'))), 60000),
    );
    Promise.race([pool.ready, timeout])
      .then(() => { if (poolRef.current?.pool === pool) setStatus('ready'); })
      .catch((e) => { if (poolRef.current?.pool === pool) { setStatus('error'); setErrMsg(e?.message || String(e)); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, need, poolSize]);
  useEffect(() => () => { poolRef.current?.pool.terminate(); }, []);

  // 方法切换后把 stage 收进该方法的合法范围。
  useEffect(() => {
    if (stage >= stages.length) setStage(stages.length - 1);
  }, [stages.length, stage]);

  // 算 6 视角步数:std 走 solveFace 并行;变体走 solveVariantStage(一次返 6 值)。
  const computeAll = useCallback(async () => {
    const cur = poolRef.current;
    if (!cur) return;
    const my = ++computeReq.current;
    const scr = scrambleRef.current.trim();
    if (!scr) return;
    setComputing(true);
    setTotalMs(null);
    const wall = performance.now();
    try {
      if (method === 'std') {
        await Promise.all(FACES.map(async (_f, f) => {
          try {
            const r = await cur.pool.solveFace(scr, stage, f);
            if (computeReq.current !== my) return;
            setCounts((prev) => { const n = prev.slice(); n[f] = r.value; return n; });
            setTimes((prev) => { const n = prev.slice(); n[f] = r.ms; return n; });
          } catch { /* skip face */ }
        }));
      } else {
        const vals = await cur.pool.solveVariantStage(scr, VARIANT_ID[method], stage);
        if (computeReq.current === my) {
          setCounts([0, 1, 2, 3, 4, 5].map((i) => vals[i] ?? null));
          setTimes([null, null, null, null, null, null]);
        }
      }
    } finally {
      if (computeReq.current === my) {
        setTotalMs(performance.now() - wall);
        setComputing(false);
      }
    }
  }, [method, stage]);

  const compute = useCallback(async () => {
    ++computeReq.current; // supersede in-flight
    setSelFace(null);
    setMoves(null);
    setCounts([null, null, null, null, null, null]);
    setTimes([null, null, null, null, null, null]);
    setTotalMs(null);
    if (!eager) { setComputing(false); return; } // 重阶段:不预算,等点击
    await computeAll();
  }, [eager, computeAll]);

  // ready / 方法 / 阶段 / 手动触发 时重算(打乱改动不自动触发,走「计算」按钮)。
  useEffect(() => {
    if (status === 'ready') void compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, method, stage, runToken]);

  const fetchMoves = useCallback(async (f: number) => {
    const cur = poolRef.current;
    if (!cur) return;
    const my = ++movesReq.current;
    setMovesLoading(true);
    setMoves(null);
    try {
      const res = method === 'std'
        ? await cur.pool.solveMoves(scrambleRef.current.trim(), stage, f, { extra, cap: 60 })
        : await cur.pool.solveVariantMoves(scrambleRef.current.trim(), VARIANT_ID[method], f, stage, { extra, cap: 30 });
      if (movesReq.current === my) {
        setMoves(res);
        // 点击后回填该格步数 + 计算耗时
        setCounts((prev) => { const next = prev.slice(); next[f] = res.len; return next; });
        setTimes((prev) => { const next = prev.slice(); next[f] = res.ms; return next; });
      }
    } catch (e) {
      if (movesReq.current === my) setErrMsg(String(e));
    } finally {
      if (movesReq.current === my) setMovesLoading(false);
    }
  }, [method, stage, extra]);

  const clickFace = useCallback((f: number) => {
    if (selFace === f) { setSelFace(null); setMoves(null); return; }
    setSelFace(f);
    void fetchMoves(f);
  }, [selFace, fetchMoves]);

  // 多解档位变了且有选中格 → 重取
  useEffect(() => {
    if (selFace !== null) void fetchMoves(selFace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extra]);

  // 解法逐条流式出现。总时长封顶 ~1s,条数多时按比例加大步长。
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

  return (
    <section className="rcx">
      <button className="rcx-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span>{t('Cross 阶段最优解 (Rust WASM)', 'Optimal Cross-Step Solver (Rust WASM)')}</span>
        <span className="rcx-toggle-sub">
          {t('逐视角最优步数 + 具体转动步骤', 'per-orientation optimal length + actual move sequences')}
        </span>
      </button>

      {open && (
        <div className="rcx-body">
          {status === 'loading' && (
            <div className="rcx-status">
              <Loader2 size={14} className="rcx-spin" />
              {t('加载求解器与数据表(仅首次)…', 'Loading solver + tables (first time only)…')}
            </div>
          )}
          {status === 'error' && (
            <div className="rcx-status rcx-err">{t('初始化失败', 'Init failed')}: {errMsg}</div>
          )}

          {status === 'ready' && (
            <>
              <div className="rcx-controls">
                <label className="rcx-control">
                  <span>{t('方法', 'Method')}</span>
                  <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                    {METHODS.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label className="rcx-control">
                  <span>{t('阶段', 'Stage')}</span>
                  <select value={stage} onChange={(e) => setStage(Number(e.target.value))}>
                    {stages.map((l, i) => (
                      <option key={i} value={i}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="rcx-control">
                  <span>{t('多解', 'Solutions')}</span>
                  <select value={extra} onChange={(e) => setExtra(Number(e.target.value))}>
                    <option value={0}>{t('仅最优长度全部解', 'All optimal-length')}</option>
                    <option value={1}>{t('含次优 +1', 'Incl. +1')}</option>
                    <option value={2}>{t('含次优 +2', 'Incl. +2')}</option>
                  </select>
                </label>
                <button className="rcx-compute" onClick={() => setRunToken((x) => x + 1)} disabled={computing}>
                  {computing ? <Loader2 size={14} className="rcx-spin" /> : null}
                  {t('计算', 'Compute')}
                </button>
                {!eager && (
                  <button
                    className="rcx-compute rcx-compute-all"
                    onClick={() => void computeAll()}
                    disabled={computing}
                    title={t(`${poolSize} 路并行`, `${poolSize}-way parallel`)}
                  >
                    {computing ? <Loader2 size={14} className="rcx-spin" /> : null}
                    {t('全部 6 视角', 'All 6 faces')}
                  </button>
                )}
              </div>
              <div className="rcx-meta">
                {t(`${poolSize} 路并行`, `${poolSize}-way parallel`)}
                {totalMs != null && <span> · {t('总耗时', 'total')} {fmtMs(totalMs)}</span>}
              </div>

              <table className="rcx-table">
                <thead>
                  <tr>
                    {FACES.map((f) => (
                      <th key={f.face}>
                        {f.face}
                        {f.rot && <span className="rcx-rot">{f.rot}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {FACES.map((f, i) => {
                      const loading = (eager && computing) || (selFace === i && movesLoading);
                      return (
                        <td
                          key={f.face}
                          className={`rcx-cell${selFace === i ? ' is-sel' : ''}`}
                          onClick={() => clickFace(i)}
                          data-empty={counts[i] == null}
                          title={t('点击求解该视角', 'Click to solve this orientation')}
                        >
                          {counts[i] != null ? (
                            <>
                              <span className="rcx-cell-n">{counts[i]}</span>
                              {times[i] != null && <span className="rcx-cell-ms">{fmtMs(times[i]!)}</span>}
                            </>
                          ) : loading ? (
                            <Loader2 size={12} className="rcx-spin" />
                          ) : (
                            <span className="rcx-dot">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
              {!eager && (
                <div className="rcx-hint">
                  {t(
                    '该阶段单视角搜索较重,点任一视角格子按需求解(最坏数十秒)。',
                    'This stage is heavy per orientation — click a face cell to solve it on demand (tens of seconds worst case).',
                  )}
                </div>
              )}

              {selFace !== null && (
                <div className="rcx-sols">
                  <div className="rcx-sols-head">
                    <strong>{stages[stage]}</strong>
                    <span className="rcx-sols-face">
                      {FACES[selFace].face}{FACES[selFace].rot ? ` · ${FACES[selFace].rot}` : ''}
                    </span>
                    {moves && moves.combo && moves.combo !== 'cross' && (
                      <span className="rcx-combo">{t('槽位', 'slots')}: {moves.combo}</span>
                    )}
                    {moves && <span className="rcx-len">{moves.len} HTM</span>}
                  </div>

                  {movesLoading && (
                    <div className="rcx-status"><Loader2 size={14} className="rcx-spin" />{t('枚举解法…', 'Enumerating…')}</div>
                  )}

                  {moves && !movesLoading && (
                    <>
                      <div className="rcx-sols-count">
                        {shown < moves.sols.length
                          ? t(`${shown} / ${moves.sols.length} 条解法`, `${shown} / ${moves.sols.length} solutions`)
                          : t(`${moves.sols.length} 条解法`, `${moves.sols.length} solutions`)}
                        <span className="rcx-sols-ms"> · {t('耗时', 'solved in')} {fmtMs(moves.ms)}</span>
                      </div>
                      <ol className="rcx-sols-list">
                        {moves.sols.slice(0, shown).map((sol, i) => (
                          <li key={i}>
                            <div className="rcx-sol-row">
                              <code>{sol}</code>
                              <span className="rcx-sol-len">{moveLen(sol)}</span>
                              <button
                                className="rcx-sol-copy"
                                onClick={() => copySol(i, sol)}
                                aria-label={t('复制', 'Copy')}
                              >
                                {copiedIdx === i ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                            {i === 0 && (
                              <TwistySection puzzle="3x3x3" scramble={scrambleRef.current.trim()} alg={sol} />
                            )}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
