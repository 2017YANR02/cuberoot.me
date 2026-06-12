'use client';

/**
 * ChainExplorer — mallard 式 FMC 分步还原链(analyzer 底部挂载)。
 *
 * 引擎 = 自有服务器跑的 cubelib(joba.me/mallard 同款,经作者授权 vendoring 进
 * `fmc/`),走 HTTP `GET /v1/fmc/solve?scramble=…&steps=…&count=…`(dev 经 next
 * rewrite 反代本地 :8099,prod 经 nginx 反代到 systemd cubelib-server)。所以 NISS
 * 段前/段内、RZP 行、HTR 子集 `[4a1 4e]`、insertions 等全部与 mallard 逐位一致。
 *
 * 布局复刻 mallard:Steps 标签(EO/DR/HTR/FR/Finish)+ 每步卡片(Step length 双
 * 滑块 → cubelib min-abs/max-abs、Variations 轴 → substeps、NISS 双开关 before/
 * during → never/before/always)→ Solution 等宽面板(逐步 `normal (inverse) //
 * variant [comment] (len/cum)` + `Solution (N): …`)→ Exclude Solutions 标签(禁用
 * 某步解 → excl 参数,重算)。共用一个 3D 播放器。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Ban, X, Play, ChevronDown, Plus } from 'lucide-react';
import TwistySection from '@/components/TwistySection';
import PillToggle from '@/components/PillToggle/PillToggle';
import { apiUrl } from '@/lib/api-base';
import { normalizeScramble } from '@/lib/cross-solver';
import './ChainExplorer.css';

type StageKey = 'eo' | 'dr' | 'htr' | 'fr' | 'fin';
type ConfStage = 'eo' | 'dr' | 'htr' | 'fr';
type Axis = 'ud' | 'fb' | 'lr';

interface StageUI {
  axes: Axis[];
  min: number;
  max: number;
  nissBefore: boolean;
  nissDuring: boolean;
}

interface FmcStep {
  kind: string;
  variant: string;
  normal: string;
  inverse: string;
  comment: string;
  len: number;
  cum: number;
}
interface FmcSolution {
  steps: FmcStep[];
  solution: string;
  total: number;
}

const AXES: Axis[] = ['ud', 'fb', 'lr'];
const AXIS_LABEL: Record<Axis, string> = { ud: 'UD', fb: 'FB', lr: 'LR' };
const STEP_TRACK: Record<ConfStage, number> = { eo: 8, dr: 12, htr: 14, fr: 11 };
const COUNT = 10;

const STAGE_DEFAULTS: Record<ConfStage, StageUI> = {
  eo: { axes: AXES, min: 0, max: STEP_TRACK.eo, nissBefore: true, nissDuring: true },
  dr: { axes: AXES, min: 0, max: STEP_TRACK.dr, nissBefore: true, nissDuring: false },
  htr: { axes: AXES, min: 0, max: STEP_TRACK.htr, nissBefore: true, nissDuring: false },
  fr: { axes: AXES, min: 0, max: STEP_TRACK.fr, nissBefore: true, nissDuring: false },
};

const TABS: { key: StageKey; label: string }[] = [
  { key: 'eo', label: 'EO' },
  { key: 'dr', label: 'DR' },
  { key: 'htr', label: 'HTR' },
  { key: 'fr', label: 'FR' },
  { key: 'fin', label: 'Finish' },
];

function initStages(): Record<ConfStage, StageUI> {
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

/** rev_inv 的 move 串镜像:倒序 + 翻转后缀 '' ↔ "'"(U2 不变)。 */
function revInv(tokens: string[]): string[] {
  return tokens
    .slice()
    .reverse()
    .map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : `${m}'`));
}

/** 截至第 upto 步(含)的线性化序列(normal 打乱上):N ++ rev_inv(I)。 */
function linearizePrefix(steps: FmcStep[], upto: number): string {
  const n: string[] = [];
  const i: string[] = [];
  for (const s of steps.slice(0, upto + 1)) {
    if (s.normal) n.push(...s.normal.split(' '));
    if (s.inverse) i.push(...s.inverse.split(' '));
  }
  return [...n, ...revInv(i)].join(' ');
}

/** 该步在 mallard 记号下的 move 串:`normal (inverse)`(空则 '—')。 */
function stepMoves(s: FmcStep): string {
  const parts: string[] = [];
  if (s.normal) parts.push(s.normal);
  if (s.inverse) parts.push(`(${s.inverse})`);
  return parts.join(' ');
}

/** 双滑块 [min,max]。 */
function DualRange({
  track,
  min,
  max,
  disabled,
  onChange,
}: {
  track: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (min: number, max: number) => void;
}) {
  const ticks = useMemo(() => Array.from({ length: track + 1 }, (_, i) => i), [track]);
  const pct = (v: number) => (track === 0 ? 0 : (v / track) * 100);
  return (
    <div className={`chx-dual${disabled ? ' is-off' : ''}`}>
      <div className="chx-dual-track">
        <div className="chx-dual-fill" style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }} />
        <input
          type="range"
          className="chx-dual-input chx-dual-min"
          min={0}
          max={track}
          step={1}
          value={min}
          disabled={disabled}
          aria-label="min length"
          onChange={(e) => onChange(Math.min(Number(e.target.value), max), max)}
        />
        <input
          type="range"
          className="chx-dual-input chx-dual-max"
          min={0}
          max={track}
          step={1}
          value={max}
          disabled={disabled}
          aria-label="max length"
          onChange={(e) => onChange(min, Math.max(Number(e.target.value), min))}
        />
      </div>
      <div className="chx-dual-ticks">
        {ticks.map((i) => (
          <span key={i} className={i >= min && i <= max ? 'is-in' : ''}>{i}</span>
        ))}
      </div>
    </div>
  );
}

interface Props {
  scramble: string;
  lang: 'zh' | 'en';
}

export default function ChainExplorer({ scramble, lang }: Props) {
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [stages, setStages] = useState(initStages);
  const [frEnabled, setFrEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<StageKey>('eo');
  const [excludeTab, setExcludeTab] = useState<StageKey>('eo');
  const [axisMenu, setAxisMenu] = useState<ConfStage | null>(null);
  const [excluded, setExcluded] = useState<Record<StageKey, string[]>>({
    eo: [], dr: [], htr: [], fr: [], fin: [],
  });
  const [sols, setSols] = useState<FmcSolution[] | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [computing, setComputing] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [sel, setSel] = useState<{ chain: number; step: number | null } | null>(null);

  const playerRef = useRef<{ jumpToStart?: (o?: { flash?: boolean }) => void; play?: () => void } | null>(null);
  const reqRef = useRef(0);
  const ranRef = useRef(false);

  const normScramble = useMemo(() => normalizeScramble(scramble) ?? scramble, [scramble]);
  const scrambleRef = useRef(normScramble);
  scrambleRef.current = normScramble;

  const cfgRef = useRef({ stages, frEnabled, excluded });
  cfgRef.current = { stages, frEnabled, excluded };

  /** cubelib niss token from the two toggles. */
  const nissTok = (s: StageUI) => (s.nissDuring ? 'always' : s.nissBefore ? 'before' : 'never');

  /** Build the CLI-style steps string for cubelib. */
  const buildSteps = useCallback((): string => {
    const { stages: st, frEnabled: fr, excluded: ex } = cfgRef.current;
    const stage = (key: ConfStage, kindTok: string) => {
      const s = st[key];
      const parts: string[] = [`niss=${nissTok(s)}`, `min-abs=${s.min}`, `max-abs=${s.max}`];
      // axis restriction → substeps (omit when all selected = cubelib default).
      if (key !== 'htr' && s.axes.length < AXES.length) {
        for (const a of s.axes) parts.push(`${kindTok}${a}`);
      }
      const exl = ex[key].filter(Boolean);
      if (exl.length) parts.push(`excl=${exl.join('|')}`);
      return `${kindTok.toUpperCase()}[${parts.join(';')}]`;
    };
    const finExl = ex.fin.filter(Boolean);
    const fin = `FIN[niss=never${finExl.length ? `;excl=${finExl.join('|')}` : ''}]`;
    const chain = [stage('eo', 'eo'), 'RZP[niss=never]', stage('dr', 'dr'), stage('htr', 'htr')];
    if (fr) chain.push(stage('fr', 'fr'));
    chain.push(fin);
    return chain.join(' > ');
  }, []);

  const compute = useCallback(async () => {
    const scr = scrambleRef.current.trim();
    if (!scr) return;
    const my = ++reqRef.current;
    ranRef.current = true;
    setComputing(true);
    setErrMsg('');
    const t0 = performance.now();
    try {
      const url = apiUrl(
        `/v1/fmc/solve?scramble=${encodeURIComponent(scr)}&steps=${encodeURIComponent(buildSteps())}&count=${COUNT}`,
      );
      const res = await fetch(url);
      if (reqRef.current !== my) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { solutions?: FmcSolution[]; error?: string };
      if (reqRef.current !== my) return;
      if (data.error) throw new Error(data.error);
      setSols(data.solutions ?? []);
      setMs(Math.round(performance.now() - t0));
      setSel(null);
    } catch (e) {
      if (reqRef.current === my) setErrMsg(e instanceof Error ? e.message : String(e));
    } finally {
      if (reqRef.current === my) setComputing(false);
    }
  }, [buildSteps]);

  // 打乱 / 配置变化 → 防抖自动重算(仅在已算过之后)。
  const firstAuto = useRef(true);
  useEffect(() => {
    if (firstAuto.current) { firstAuto.current = false; return; }
    if (!ranRef.current) return;
    const id = setTimeout(() => { void compute(); }, 400);
    return () => clearTimeout(id);
  }, [normScramble, stages, frEnabled, compute]);

  // 排除列表变化 → 立即重算。
  const firstExcluded = useRef(true);
  useEffect(() => {
    if (firstExcluded.current) { firstExcluded.current = false; return; }
    if (ranRef.current) void compute();
  }, [excluded, compute]);

  const setStage = useCallback((k: ConfStage, patch: Partial<StageUI>) => {
    setStages((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));
  }, []);

  const removeAxis = useCallback((k: ConfStage, a: Axis) => {
    setStages((prev) => {
      const next = prev[k].axes.filter((x) => x !== a);
      if (next.length === 0) return prev;
      return { ...prev, [k]: { ...prev[k], axes: next } };
    });
  }, []);

  const addAxis = useCallback((k: ConfStage, a: Axis) => {
    setStages((prev) => {
      if (prev[k].axes.includes(a)) return prev;
      const next = AXES.filter((x) => x === a || prev[k].axes.includes(x));
      return { ...prev, [k]: { ...prev[k], axes: next } };
    });
    setAxisMenu(null);
  }, []);

  // 排除某步:把该步的 mallard 记号 alg 加进该阶段黑名单(经 excl 参数回喂引擎)。
  const excludeStep = useCallback((s: FmcStep) => {
    const alg = stepMoves(s);
    if (!alg) return;
    const kind = (s.kind === 'rzp' ? 'dr' : s.kind) as StageKey;
    setExcluded((prev) => (prev[kind].includes(alg) ? prev : { ...prev, [kind]: [...prev[kind], alg] }));
    setExcludeTab(kind);
  }, []);

  const removeExcluded = useCallback((k: StageKey, i: number) => {
    setExcluded((prev) => ({ ...prev, [k]: prev[k].filter((_, j) => j !== i) }));
  }, []);

  const select = useCallback((chain: number, step: number | null, play = false) => {
    setSel({ chain, step });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const p = playerRef.current;
      try { p?.jumpToStart?.({ flash: false }); } catch { /* */ }
      if (play) { try { p?.play?.(); } catch { /* */ } }
    }));
  }, []);

  const selAlg = useMemo(() => {
    if (!sel || !sols) return null;
    const c = sols[sel.chain];
    if (!c) return null;
    return sel.step == null ? c.solution : linearizePrefix(c.steps, sel.step);
  }, [sel, sols]);

  const busy = computing;

  const renderStepPanel = (key: ConfStage) => {
    const s = stages[key];
    const disabled = key === 'fr' && !frEnabled;
    const removable = AXES.filter((a) => s.axes.includes(a));
    const addable = AXES.filter((a) => !s.axes.includes(a));
    return (
      <div className={`chx-panel${disabled ? ' is-off' : ''}`}>
        {key === 'fr' && (
          <label className="chx-fr-enable">
            <PillToggle value={frEnabled} onChange={setFrEnabled} ariaLabel="enable FR" />
            <span>{t('启用 FR', 'Enable FR')}</span>
          </label>
        )}

        <div className="chx-field-block">
          <div className="chx-field-label">{t('步数范围', 'Step length')}</div>
          <DualRange
            track={STEP_TRACK[key]}
            min={s.min}
            max={s.max}
            disabled={disabled}
            onChange={(min, max) => setStage(key, { min, max })}
          />
        </div>

        <div className="chx-field-block">
          <div className="chx-field-label">{t('变体轴', 'Variations')}</div>
          {key === 'htr' ? (
            <div className="chx-axes-note">{t('继承 DR 轴', 'follows the DR axis')}</div>
          ) : (
            <div className="chx-chips">
              {removable.map((a) => (
                <span key={a} className="chx-chip">
                  {AXIS_LABEL[a]}
                  <button
                    className="chx-chip-x"
                    disabled={disabled || removable.length <= 1}
                    aria-label={t('移除轴', 'remove axis')}
                    onClick={() => removeAxis(key, a)}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              {addable.length > 0 && (
                <div className="chx-axis-add">
                  <button
                    className="chx-chip-add"
                    disabled={disabled}
                    aria-label={t('添加轴', 'add axis')}
                    onClick={() => setAxisMenu(axisMenu === key ? null : key)}
                  >
                    <Plus size={12} />
                    <ChevronDown size={12} />
                  </button>
                  {axisMenu === key && (
                    <div className="chx-axis-menu">
                      {addable.map((a) => (
                        <button key={a} onClick={() => addAxis(key, a)}>{AXIS_LABEL[a]}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="chx-field-block">
          <div className="chx-field-label">NISS</div>
          <label className="chx-niss-row">
            <span>{t('段前允许切换', 'Allow switching before step')}</span>
            <PillToggle
              value={s.nissBefore}
              onChange={(v) => setStage(key, { nissBefore: v })}
              ariaLabel="NISS before"
            />
          </label>
          <label className="chx-niss-row">
            <span>{t('段内允许切换', 'Allow switching during step')}</span>
            <PillToggle
              value={s.nissDuring}
              onChange={(v) => setStage(key, { nissDuring: v, nissBefore: v ? true : s.nissBefore })}
              ariaLabel="NISS during"
            />
          </label>
        </div>
      </div>
    );
  };

  return (
    <section className="chx" onClick={() => axisMenu && setAxisMenu(null)}>
      {/* ── Steps ── */}
      <div className="chx-block">
        <h3 className="chx-h">{t('分步', 'Steps')}</h3>
        <div className="chx-tabs">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              className={`chx-tab${activeTab === key ? ' is-active' : ''}${key === 'fr' && !frEnabled ? ' is-dim' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {activeTab === 'fin' ? (
          <div className="chx-panel">
            <div className="chx-axes-note">
              {t('固定启用:从 HTR/FR 直接最优还原,NISS 不适用。', 'Always on: optimal solve-out from HTR/FR; NISS not applicable.')}
            </div>
          </div>
        ) : (
          renderStepPanel(activeTab)
        )}
      </div>

      <div className="chx-run">
        <button className="chx-compute" onClick={() => void compute()} disabled={busy}>
          {busy ? <Loader2 size={14} className="chx-spin" /> : null}
          {ranRef.current ? t('重新计算', 'Recompute') : t('计算', 'Compute')}
        </button>
        {computing && <span className="chx-status">{t('求解中…', 'Solving…')}</span>}
        {!busy && ms != null && <span className="chx-status">{fmtMs(ms)}</span>}
      </div>

      {errMsg && <div className="chx-err">{t('求解失败', 'Solve failed')}: {errMsg}</div>}

      {/* ── Solution ── */}
      <div className="chx-block">
        <h3 className="chx-h">{t('解', 'Solution')}</h3>
        {!sols && !busy && (
          <div className="chx-empty">{t('点「计算」生成分步还原链。', 'Click Compute to generate step-by-step chains.')}</div>
        )}
        {sols && !busy && sols.length === 0 && (
          <div className="chx-empty">{t('未找到满足当前条件的解,放宽步数范围或移除排除项。', 'No solution matches — widen a length range or remove an exclusion.')}</div>
        )}
        {sols && sols.length > 0 && (
          <div className="chx-result">
            <ol className="chx-chains">
              {sols.map((c, i) => (
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
                    {c.steps.map((s, j) => (
                      <div
                        key={j}
                        className={`chx-step${sel?.chain === i && sel?.step === j ? ' is-active' : ''}`}
                        onClick={() => select(i, j)}
                      >
                        <code className="chx-step-mv">{stepMoves(s) || '—'}</code>
                        <span className="chx-step-var">{`// ${s.variant}${s.comment ? ` ${s.comment}` : ''}`}</span>
                        <span className="chx-step-cnt">{`(${s.len}/${s.cum})`}</span>
                        {stepMoves(s) && (
                          <button
                            className="chx-step-ban"
                            title={t('排除该步解并重算', 'Exclude this step solution and re-solve')}
                            aria-label={t('排除该步', 'Exclude this step')}
                            onClick={(e) => { e.stopPropagation(); excludeStep(s); }}
                          >
                            <Ban size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="chx-solution">{`Solution (${c.total}): ${c.solution}`}</div>
                </li>
              ))}
            </ol>

            {selAlg ? (
              <div className="chx-player">
                <TwistySection puzzle="3x3x3" scramble={normScramble} alg={selAlg} playerRef={playerRef} />
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Exclude Solutions ── */}
      <div className="chx-block">
        <h3 className="chx-h">{t('排除解', 'Exclude Solutions')}</h3>
        <div className="chx-tabs">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              className={`chx-tab${excludeTab === key ? ' is-active' : ''}`}
              onClick={() => setExcludeTab(key)}
            >
              {label}
              {excluded[key].length > 0 && <span className="chx-tab-dot" />}
            </button>
          ))}
        </div>
        <div className="chx-panel">
          {excluded[excludeTab].length === 0 ? (
            <div className="chx-axes-note">
              {t('在上方某条解里点禁用图标,把该步解加进这里排除并重算。', 'Click the ban icon on a step above to exclude that step solution and re-solve.')}
            </div>
          ) : (
            <div className="chx-excl-list">
              {excluded[excludeTab].map((x, i) => (
                <span key={`${x}-${i}`} className="chx-excl-row">
                  <code>{x}</code>
                  <button
                    className="chx-excl-x"
                    onClick={() => removeExcluded(excludeTab, i)}
                    aria-label={t('移除排除项', 'Remove exclusion')}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
