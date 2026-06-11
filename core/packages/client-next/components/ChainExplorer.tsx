'use client';

/**
 * ChainExplorer — mallard 式 FMC 分步还原链浏览器(analyzer 底部挂载)。
 *
 * EO → DR → HTR → [FR] → Finish 链式求解(Rust→WASM ChainSolverWasm,零表下载,
 * 距离表 worker 内现场建)。逐阶段可调:轴(UD/FB/LR)、枚举窗口 extra(最优+N)、
 * 可选步数上限、候选数 cap;FR 默认关(首次启用建表 ~10s)。每步可「排除」——把该步
 * 的累计 HOME 帧序列加进该阶段 excluded 黑名单(引擎按累计序列精确匹配,只回喂引擎
 * 自己产出的串)并自动重算。所有链共用一个 3D 播放器(点链/点步加载),不开 N 个 WebGL。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Ban, X, Play } from 'lucide-react';
import TwistySection from '@/components/TwistySection';
import type { ChainResult, RustCrossPool } from '@/lib/rust-cross-client';
import { getRustCrossPool, poolSizeForDevice } from '@/lib/rust-cross-pool';
import { normalizeScramble } from '@/lib/cross-solver';
import './ChainExplorer.css';

type StageKey = 'eo' | 'dr' | 'htr' | 'fr' | 'fin';
type Axis = 'ud' | 'fb' | 'lr';

interface StageUI {
  axes: Axis[];
  /** 枚举窗口:该轴最优 + extra(引擎语义:min 超过最优+extra 必空,故不暴露 min)。 */
  extra: number;
  /** 可选步数上限;null = 不限。 */
  max: number | null;
  /** 本阶段跨轴合并后保留候选数(≤10,更深组合爆炸)。 */
  cap: number;
}

const AXES: Axis[] = ['ud', 'fb', 'lr'];
const AXIS_LABEL: Record<Axis, string> = { ud: 'UD', fb: 'FB', lr: 'LR' };
const EXTRA_OPTIONS = [0, 1, 2, 3, 4];
const CAP_OPTIONS = [1, 3, 5, 10];
const MAX_CHAINS_OPTIONS = [5, 10, 20];

// 引擎默认(solver/src/chain_solver.rs ChainConfig::default):eo extra1 cap5 /
// dr extra0 cap5 / htr extra1 cap3 / fr extra0;fin 固定 extra0 cap1 不可调。
const STAGE_DEFAULTS: Record<'eo' | 'dr' | 'htr' | 'fr', StageUI> = {
  eo: { axes: AXES, extra: 1, max: null, cap: 5 },
  dr: { axes: AXES, extra: 0, max: null, cap: 5 },
  htr: { axes: AXES, extra: 1, max: null, cap: 3 },
  fr: { axes: AXES, extra: 0, max: null, cap: 3 },
};

const STAGE_ROWS: { key: 'eo' | 'dr' | 'htr' | 'fr'; label: string }[] = [
  { key: 'eo', label: 'EO' },
  { key: 'dr', label: 'DR' },
  { key: 'htr', label: 'HTR' },
  { key: 'fr', label: 'FR' },
];

function initStages(): Record<'eo' | 'dr' | 'htr' | 'fr', StageUI> {
  return {
    eo: { ...STAGE_DEFAULTS.eo, axes: [...STAGE_DEFAULTS.eo.axes] },
    dr: { ...STAGE_DEFAULTS.dr, axes: [...STAGE_DEFAULTS.dr.axes] },
    htr: { ...STAGE_DEFAULTS.htr, axes: [...STAGE_DEFAULTS.htr.axes] },
    fr: { ...STAGE_DEFAULTS.fr, axes: [...STAGE_DEFAULTS.fr.axes] },
  };
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

interface Props {
  scramble: string;
  lang: 'zh' | 'en';
}

export default function ChainExplorer({ scramble, lang }: Props) {
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [stages, setStages] = useState(initStages);
  const [frEnabled, setFrEnabled] = useState(false); // 默认关:首次启用建 FR 表 ~10s
  const [excluded, setExcluded] = useState<Record<StageKey, string[]>>({
    eo: [], dr: [], htr: [], fr: [], fin: [],
  });
  const [maxChains, setMaxChains] = useState(10);
  const [chains, setChains] = useState<ChainResult[] | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [computing, setComputing] = useState(false);
  const [warming, setWarming] = useState(false); // 池首次加载(WASM 拉取/实例化)
  const [errMsg, setErrMsg] = useState('');
  const [sel, setSel] = useState<{ chain: number; step: number | null } | null>(null);

  const poolRef = useRef<RustCrossPool | null>(null);
  const playerRef = useRef<{ jumpToStart?: (o?: { flash?: boolean }) => void; play?: () => void } | null>(null);
  const reqRef = useRef(0);
  const ranRef = useRef(false); // 是否已手动算过一次(打乱变化才自动重算)

  const normScramble = useMemo(() => normalizeScramble(scramble) ?? scramble, [scramble]);
  const scrambleRef = useRef(normScramble);
  scrambleRef.current = normScramble;

  // 配置走 ref:compute 永远读最新 state,自身保持依赖稳定。
  const cfgRef = useRef({ stages, frEnabled, excluded, maxChains });
  cfgRef.current = { stages, frEnabled, excluded, maxChains };

  const buildConfig = useCallback((): string => {
    const { stages: st, frEnabled: fr, excluded: ex, maxChains: mc } = cfgRef.current;
    const stageJson = (k: 'eo' | 'dr' | 'htr' | 'fr') => {
      const s = st[k];
      const o: Record<string, unknown> = { extra: s.extra, cap: s.cap, excluded: ex[k] };
      if (k !== 'htr') o.axes = s.axes; // HTR 轴继承 DR(引擎语义),不下发
      if (s.max != null) o.max = s.max;
      return o;
    };
    return JSON.stringify({
      maxChains: mc,
      eo: stageJson('eo'),
      dr: stageJson('dr'),
      htr: stageJson('htr'),
      fr: { enabled: fr, ...stageJson('fr') },
      fin: { excluded: ex.fin },
    });
  }, []);

  const compute = useCallback(async () => {
    const scr = scrambleRef.current.trim();
    if (!scr) return;
    const my = ++reqRef.current;
    ranRef.current = true;
    setComputing(true);
    setErrMsg('');
    try {
      // 共享单活跃池:首次(或被其他方法换走后)取链式池,等首个 worker 就绪。
      const pool = getRustCrossPool('chain', poolSizeForDevice());
      if (pool !== poolRef.current) {
        poolRef.current = pool;
        setWarming(true);
      }
      await pool.ready;
      if (reqRef.current !== my) return;
      setWarming(false);
      const res = await pool.solveChain(scr, buildConfig());
      if (reqRef.current !== my) return;
      setChains(res.chains);
      setMs(res.ms);
      setSel(null);
    } catch (e) {
      if (reqRef.current === my) {
        setWarming(false);
        setErrMsg(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (reqRef.current === my) setComputing(false);
    }
  }, [buildConfig]);

  // 打乱变化 → 防抖自动重算(仅在已算过之后;跳过首挂)。
  const firstScramble = useRef(true);
  useEffect(() => {
    if (firstScramble.current) { firstScramble.current = false; return; }
    if (!ranRef.current) return;
    const id = setTimeout(() => { void compute(); }, 500);
    return () => clearTimeout(id);
  }, [normScramble, compute]);

  // 排除列表变化(增/删)→ 自动重算。
  const firstExcluded = useRef(true);
  useEffect(() => {
    if (firstExcluded.current) { firstExcluded.current = false; return; }
    if (ranRef.current) void compute();
  }, [excluded, compute]);

  const setStage = useCallback((k: 'eo' | 'dr' | 'htr' | 'fr', patch: Partial<StageUI>) => {
    setStages((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));
  }, []);

  const toggleAxis = useCallback((k: 'eo' | 'dr' | 'fr', a: Axis) => {
    setStages((prev) => {
      const cur = prev[k].axes;
      const next = cur.includes(a)
        ? cur.filter((x) => x !== a)
        : AXES.filter((x) => x === a || cur.includes(x)); // 保持 UD/FB/LR 规范序
      if (next.length === 0) return prev; // 至少保留一轴
      return { ...prev, [k]: { ...prev[k], axes: next } };
    });
  }, []);

  // 排除某链第 stepIdx 步:加该步的「累计 HOME 帧序列」(steps[0..=i].m 拼接,与引擎
  // is_excluded 的 cum+step 精确匹配语义一致)进该阶段黑名单。只回喂引擎产出的串。
  const excludeStep = useCallback((chain: ChainResult, stepIdx: number) => {
    const step = chain.steps[stepIdx];
    const cum = chain.steps.slice(0, stepIdx + 1).map((s) => s.m).filter(Boolean).join(' ');
    setExcluded((prev) => (
      prev[step.kind].includes(cum) ? prev : { ...prev, [step.kind]: [...prev[step.kind], cum] }
    ));
  }, []);

  const removeExcluded = useCallback((k: StageKey, i: number) => {
    setExcluded((prev) => ({ ...prev, [k]: prev[k].filter((_, j) => j !== i) }));
  }, []);

  // 选中链(step=null)或链内某步:共享播放器载入打乱 + 截至该步的合并序列。
  const select = useCallback((chain: number, step: number | null, play = false) => {
    setSel({ chain, step });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const p = playerRef.current;
      try { p?.jumpToStart?.({ flash: false }); } catch { /* */ }
      if (play) { try { p?.play?.(); } catch { /* */ } }
    }));
  }, []);

  const selAlg = useMemo(() => {
    if (!sel || !chains) return null;
    const c = chains[sel.chain];
    if (!c) return null;
    const upto = sel.step == null ? c.steps.length : sel.step + 1;
    return c.steps.slice(0, upto).map((s) => s.m).filter(Boolean).join(' ');
  }, [sel, chains]);

  const stageName = (k: StageKey) =>
    k === 'fr' ? t('Floppy 还原 (FR)', 'Floppy Reduction (FR)')
      : k === 'fin' ? t('收尾 (Finish)', 'Finish')
        : k.toUpperCase();

  const busy = computing || warming;

  return (
    <section className="chx">
      {/* 逐阶段配置:EO/DR/HTR 恒启用,FR 可开关(默认关),Finish 固定 */}
      <div className="chx-stages">
        {STAGE_ROWS.map(({ key }) => {
          const s = stages[key];
          const isFr = key === 'fr';
          const disabled = isFr && !frEnabled;
          return (
            <div key={key} className={`chx-stage${disabled ? ' is-off' : ''}`}>
              <span className="chx-stage-name">
                {isFr ? (
                  <label className="chx-fr-toggle">
                    <input
                      type="checkbox"
                      checked={frEnabled}
                      onChange={(e) => setFrEnabled(e.target.checked)}
                    />
                    {stageName('fr')}
                  </label>
                ) : stageName(key)}
              </span>
              {key === 'htr' ? (
                <span className="chx-axes-note">{t('轴随 DR', 'axes follow DR')}</span>
              ) : (
                <span className="chx-axes">
                  {AXES.map((a) => (
                    <label key={a} className="chx-axis">
                      <input
                        type="checkbox"
                        checked={s.axes.includes(a)}
                        disabled={disabled}
                        onChange={() => toggleAxis(key as 'eo' | 'dr' | 'fr', a)}
                      />
                      {AXIS_LABEL[a]}
                    </label>
                  ))}
                </span>
              )}
              <label className="chx-field">
                <span>{t('额外步数', 'Extra')}</span>
                <select
                  value={s.extra}
                  disabled={disabled}
                  onChange={(e) => setStage(key, { extra: Number(e.target.value) })}
                >
                  {EXTRA_OPTIONS.map((n) => <option key={n} value={n}>+{n}</option>)}
                </select>
              </label>
              <label className="chx-field">
                <span>{t('步数上限', 'Max len')}</span>
                <input
                  className="chx-num"
                  type="number"
                  min={0}
                  max={99}
                  value={s.max ?? ''}
                  placeholder={t('不限', 'any')}
                  disabled={disabled}
                  onChange={(e) => setStage(key, {
                    max: e.target.value === '' ? null : Math.max(0, Math.min(99, Number(e.target.value))),
                  })}
                />
              </label>
              <label className="chx-field">
                <span>{t('候选数', 'Cap')}</span>
                <select
                  value={s.cap}
                  disabled={disabled}
                  onChange={(e) => setStage(key, { cap: Number(e.target.value) })}
                >
                  {CAP_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              {isFr && !frEnabled && (
                <span className="chx-fr-hint">{t('首次启用需建表约 10 秒', 'first enable builds tables ~10s')}</span>
              )}
              {excluded[key].length > 0 && (
                <div className="chx-excl">
                  <span className="chx-excl-label">{t('已排除', 'Excluded')}</span>
                  {excluded[key].map((x, i) => (
                    <span key={`${x}-${i}`} className="chx-excl-row">
                      <code>{x || t('(0 步)', '(0 moves)')}</code>
                      <button
                        className="chx-excl-x"
                        onClick={() => removeExcluded(key, i)}
                        aria-label={t('移除排除项', 'Remove exclusion')}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="chx-stage chx-stage-fin">
          <span className="chx-stage-name">{stageName('fin')}</span>
          <span className="chx-axes-note">{t('固定启用:从 HTR/FR 直接还原,取单条最优', 'always on: solves out from HTR/FR, single optimal')}</span>
          {excluded.fin.length > 0 && (
            <div className="chx-excl">
              <span className="chx-excl-label">{t('已排除', 'Excluded')}</span>
              {excluded.fin.map((x, i) => (
                <span key={`${x}-${i}`} className="chx-excl-row">
                  <code>{x || t('(0 步)', '(0 moves)')}</code>
                  <button
                    className="chx-excl-x"
                    onClick={() => removeExcluded('fin', i)}
                    aria-label={t('移除排除项', 'Remove exclusion')}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 计算行:全局条数 + 计算按钮 + 状态 */}
      <div className="chx-run">
        <label className="chx-field">
          <span>{t('显示条数', 'Show')}</span>
          <select value={maxChains} onChange={(e) => setMaxChains(Number(e.target.value))}>
            {MAX_CHAINS_OPTIONS.map((n) => (
              <option key={n} value={n}>{t(`最多 ${n} 条`, `Up to ${n}`)}</option>
            ))}
          </select>
        </label>
        <button className="chx-compute" onClick={() => void compute()} disabled={busy}>
          {busy ? <Loader2 size={14} className="chx-spin" /> : null}
          {t('计算', 'Compute')}
        </button>
        {warming && (
          <span className="chx-status">{t('正在加载求解器…(仅首次)', 'Loading solver… (first time only)')}</span>
        )}
        {computing && !warming && (
          <span className="chx-status">{t('求解中…(首次需建距离表,数秒)', 'Solving… (first run builds tables, a few seconds)')}</span>
        )}
        {!busy && ms != null && <span className="chx-status">{fmtMs(ms)}</span>}
      </div>

      {errMsg && <div className="chx-err">{t('求解失败', 'Solve failed')}: {errMsg}</div>}

      {chains && !busy && chains.length === 0 && (
        <div className="chx-empty">{t('未找到满足当前条件的链,试着放宽窗口或移除排除项。', 'No chain satisfies the current constraints — widen a window or remove an exclusion.')}</div>
      )}

      {chains && chains.length > 0 && (
        <div className="chx-result">
          <ol className="chx-chains">
            {chains.map((c, i) => (
              <li key={i} className={`chx-chain${sel?.chain === i ? ' is-active' : ''}`}>
                <div
                  className="chx-chain-head"
                  onClick={() => select(i, null)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i, null); } }}
                >
                  <button
                    className="chx-chain-play"
                    aria-label={t('播放', 'Play')}
                    onClick={(e) => { e.stopPropagation(); select(i, null, true); }}
                  >
                    <Play size={11} />
                  </button>
                  <span className="chx-chain-n">#{i + 1}</span>
                  <span className="chx-chain-total">{c.total} HTM</span>
                </div>
                <div className="chx-steps">
                  {c.steps.length === 0 ? (
                    <div className="chx-step-empty">{t('已是还原态(0 步)', 'Already solved (0 moves)')}</div>
                  ) : c.steps.map((s, j) => (
                    <div
                      key={j}
                      className={`chx-step${sel?.chain === i && sel?.step === j ? ' is-active' : ''}`}
                      onClick={() => select(i, j)}
                    >
                      <code>{s.m || '—'}</code>
                      <span className="chx-step-meta">{`// ${s.variant} (${s.len}/${s.cum})`}</span>
                      <button
                        className="chx-step-ban"
                        title={t('排除该步(按累计序列)并重算', 'Exclude this step (by cumulative sequence) and re-solve')}
                        aria-label={t('排除该步', 'Exclude this step')}
                        onClick={(e) => { e.stopPropagation(); excludeStep(c, j); }}
                      >
                        <Ban size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          {/* 单个共享 3D 播放器:跟随选中链 / 步 */}
          {selAlg ? (
            <div className="chx-player">
              <TwistySection puzzle="3x3x3" scramble={normScramble} alg={selAlg} playerRef={playerRef} />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
