'use client';

/**
 * Rust → WASM cross-step 求解区(并入 analyzer 页)。
 *
 * cross / xcross / xxcross / xxxcross / xxxxcross(F2L)逐视角最优步数 + 多解步骤。
 * 小表可采纳启发式,后台 worker。产物自包含在 /tools/solver/rust-cross/,
 * 27MB 表只在本区首次展开时才拉(懒加载,不拖累 analyzer 首屏)。
 *
 * 对齐 or18 F2L solver 的能力(步骤 + 多解 + xxxxcross),用 Rust 等价替换。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Copy, Check } from 'lucide-react';
import TwistySection from '@/components/TwistySection';
import { createRustCrossPool, type RustCrossPool, type MovesTimed } from './rust-cross-client';

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

const VARIANT_LABELS = ['Cross', 'XCross', 'XXCross', 'XXXCross', 'XXXXCross (F2L)'];
// 6 视角:rot ""/z2/z'/z/x'/x → 底面 D/U/L/R/F/B(app.html 同口径)
const FACES: { face: string; rot: string }[] = [
  { face: 'D', rot: '' },
  { face: 'U', rot: 'z2' },
  { face: 'L', rot: "z'" },
  { face: 'R', rot: 'z' },
  { face: 'F', rot: "x'" },
  { face: 'B', rot: 'x' },
];

interface Props {
  scramble: string;
  lang: 'zh' | 'en';
}

export default function RustCrossSection({ scramble, lang }: Props) {
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [variant, setVariant] = useState(0);
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

  const csRef = useRef<RustCrossPool | null>(null);
  const scrambleRef = useRef(scramble);
  scrambleRef.current = scramble;
  const computeReq = useRef(0);
  const movesReq = useRef(0);

  // worker 池大小:手机 2、桌面 4(各 ~70MB 表),按需懒生成,既能并行又不 OOM。
  const poolSize = useMemo(() => {
    if (typeof navigator === 'undefined') return 2;
    const hc = navigator.hardwareConcurrency || 4;
    const mobile = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 768px)').matches;
    return Math.max(1, Math.min(mobile ? 2 : 4, hc - 1));
  }, []);

  // 懒初始化:首次展开才起池(首个 worker 拉表)
  useEffect(() => {
    if (!open || csRef.current) return;
    setStatus('loading');
    const cs = createRustCrossPool(poolSize);
    csRef.current = cs;
    const timeout = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(t('加载超时(>60s),请重试或检查网络', 'load timeout (>60s) — retry or check network'))), 60000),
    );
    Promise.race([cs.ready, timeout])
      .then(() => setStatus('ready'))
      .catch((e) => { setStatus('error'); setErrMsg(e?.message || String(e)); });
  }, [open, poolSize]);
  useEffect(() => () => { csRef.current?.terminate(); }, []);

  // xxxxcross(变体 4)逐视角搜索昂贵(最坏单面数秒),不预算 6 个 —— 点格子才按需求解
  // (对齐 or18:一次只解一个视角)。cross/xc/xxc/xxxc 便宜,并行预算出概览。
  const eager = variant <= 3;

  // 并行算指定视角集合(跨 worker 池);回填 counts + times,报告总墙钟。
  const computeFaces = useCallback(async (faces: number[]) => {
    const cs = csRef.current;
    if (!cs) return;
    const my = ++computeReq.current;
    const scr = scrambleRef.current.trim();
    if (!scr) return;
    setComputing(true);
    setTotalMs(null);
    const wall = performance.now();
    await Promise.all(faces.map(async (f) => {
      try {
        const r = await cs.solveFace(scr, variant, f);
        if (computeReq.current !== my) return;
        setCounts((prev) => { const n = prev.slice(); n[f] = r.value; return n; });
        setTimes((prev) => { const n = prev.slice(); n[f] = r.ms; return n; });
      } catch { /* skip face */ }
    }));
    if (computeReq.current === my) {
      setTotalMs(performance.now() - wall);
      setComputing(false);
    }
  }, [variant]);

  const compute = useCallback(async () => {
    ++computeReq.current; // supersede in-flight
    setSelFace(null);
    setMoves(null);
    setCounts([null, null, null, null, null, null]);
    setTimes([null, null, null, null, null, null]);
    setTotalMs(null);
    if (!eager) { setComputing(false); return; } // 懒变体:不预算,等点击
    await computeFaces([0, 1, 2, 3, 4, 5]);
  }, [eager, computeFaces]);

  // ready / 变体 / 手动触发 时重算(打乱改动不自动触发,走「计算」按钮)
  useEffect(() => {
    if (status === 'ready') void compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, variant, runToken]);

  const fetchMoves = useCallback(async (f: number) => {
    const cs = csRef.current;
    if (!cs) return;
    const my = ++movesReq.current;
    setMovesLoading(true);
    setMoves(null);
    try {
      const res = await cs.solveMoves(scrambleRef.current.trim(), variant, f, { extra, cap: 60 });
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
  }, [variant, extra]);

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

  // 解法逐条流式出现(对齐用户期望:依次输出而非一次性糊上)。总时长封顶 ~1s,
  // 条数多时按比例加大步长,既保留逐条节奏又不拖沓。
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
          {t('逐视角最优步数 + 多解步骤', 'per-orientation optimal length + multi-solution moves')}
        </span>
      </button>

      {open && (
        <div className="rcx-body">
          {status === 'loading' && (
            <div className="rcx-status">
              <Loader2 size={14} className="rcx-spin" />
              {t('加载求解器与数据表 (~27MB,仅首次)…', 'Loading solver + tables (~27MB, first time only)…')}
            </div>
          )}
          {status === 'error' && (
            <div className="rcx-status rcx-err">{t('初始化失败', 'Init failed')}: {errMsg}</div>
          )}

          {status === 'ready' && (
            <>
              <div className="rcx-controls">
                <label className="rcx-control">
                  <span>{t('变体', 'Variant')}</span>
                  <select value={variant} onChange={(e) => setVariant(Number(e.target.value))}>
                    {VARIANT_LABELS.map((l, i) => (
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
                    onClick={() => void computeFaces([0, 1, 2, 3, 4, 5])}
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
                    'XXXXCross 单视角搜索较重,点任一视角格子按需求解(最坏数秒)。',
                    'XXXXCross is heavy per orientation — click a face cell to solve it on demand (a few seconds worst case).',
                  )}
                </div>
              )}

              {selFace !== null && (
                <div className="rcx-sols">
                  <div className="rcx-sols-head">
                    <strong>{VARIANT_LABELS[variant]}</strong>
                    <span className="rcx-sols-face">
                      {FACES[selFace].face}{FACES[selFace].rot ? ` · ${FACES[selFace].rot}` : ''}
                    </span>
                    {moves && variant > 0 && moves.combo !== 'cross' && (
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
                              <span className="rcx-sol-len">{sol.replace(/^[xyz][2']?\s+/, '').split(/\s+/).filter(Boolean).length}</span>
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
