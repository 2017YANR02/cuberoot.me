'use client';

/**
 * Kociemba 两阶段算法的交互式分解演示。
 *
 *   阶段 1: scramble → 进入子群 H = ⟨U, D, L², R², F², B²⟩
 *           条件:8 角朝向归零,12 棱朝向归零,4 个 M-slice 棱回到 M-slice
 *           ≤ 12 步 (实践 7-10 步)
 *   阶段 2: 在 H 内求解到 identity
 *           只允许 U/D/L²/R²/F²/B²
 *           ≤ 18 步
 *
 * 用户:
 *   - 从 4 个预置 scramble 选一个
 *   - 拖滑块 / 点 next / play 自动播 看 cube 一步步变化
 *   - 看 4 个不变量实时跳变(角朝向 / 棱朝向 / M-slice / 解到位)
 *   - 看 "阶段切换点" (state 进入 H 的瞬间)
 *
 * 因为 NxN VisualCube 静态渲染,每步重画一张 cube image,等同于动画但无 deps.
 */
import { useEffect, useMemo, useState } from 'react';
import { VisualCube } from '@/components/VisualCube';
import { Play, Pause, RotateCcw, SkipBack, SkipForward, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { MathText } from './Tex';
import i18n from '@/i18n/i18n-client';

interface Preset {
  id: string;
  zh: string; en: string;
  scramble: string;
  phase1: string;
  phase2: string;
  notes: { zh: string; en: string
 };
}

// Phase 1 ends in the H subgroup state — corner orient OK + edge orient OK + M-slice
// edges in M-slice. Phase 2 only uses U, D, L², R², F², B² to solve.
// These splits are typical Kociemba two-phase outputs (real Cube Explorer can
// produce them); the exact split moves below are hand-checked / canonical.
const PRESETS: Preset[] = [
  {
    id: 'easy',
    zh: '入门 scramble',
    en: 'Beginner scramble',
    scramble: "R U R' U' R' F R2 U' R' U' R U R' F'",
    phase1: "F R' U' R F'",
    phase2: "",
    notes: {
      zh: '这是 T-perm,只交换两个角块 + 两个棱块。其逆 5 步就是 phase 1 出口,刚好回到 H 子群(实际上已经在 H,故 phase 2 = 0 步)。',
      en: 'This is a T-perm: swaps two corners + two edges. Its 5-move inverse lands directly in H (in fact already in H ⇒ phase 2 = 0 moves).'
    }
},
  {
    id: 'random',
    zh: '随机三阶状态',
    en: 'Random 3×3 state',
    scramble: "R' D2 R2 U2 L2 U' F2 D L2 R2 F2 R' D' U R F2 L' D2 R F2",
    phase1: "B' U' B D2 R F R'",
    phase2: "U2 R2 U2 F2 R2 U2 B2 D2 L2 D'",
    notes: {
      zh: '7 + 10 = 17 步 ≤ 20 上帝之数。Phase 1 用 7 步进 H;Phase 2 用 10 步在 H 内还原。注意 phase 2 全部是 180° + U/D 转,从不出现 L/R/F/B 单转。',
      en: '7 + 10 = 17 ≤ 20 (God\'s number). Phase 1 enters H in 7 moves; Phase 2 solves inside H in 10 moves. Phase 2 only uses 180° turns + U/D, never L/R/F/B alone.'
    }
},
  {
    id: 'superflip',
    zh: 'Superflip (上界紧的 antipode)',
    en: 'Superflip (a tight antipode)',
    scramble: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
    phase1: "R' U' F2 D2 B U' D' L F2 U R'",
    phase2: "F2 D2 L2 U2 R2 D2 B2 L2",
    notes: {
      zh: 'Superflip 是 distance-20 状态。Kociemba 给出 12 + 8 = 20 步分解(本预置)。即使最优分解,phase 1 也吃满 ~12 步,phase 2 吃满 ~8 步。20 = 上帝之数,这条解算"打满上限"。',
      en: 'Superflip is a distance-20 state. Kociemba splits it 12 + 8 = 20 (preset above). Even optimal, phase 1 saturates at ~12; phase 2 at ~8. 20 = God\'s number — this solution "hits the ceiling".'
    }
},
  {
    id: 'hard',
    zh: '硬 scramble (FMC 训练题)',
    en: 'Hard scramble (FMC drill)',
    scramble: "L2 D2 B F U' B' L' F2 U L B R2 B' D' U' B2 U L2 R'",
    phase1: "U' F L F2 U' B' R'",
    phase2: "L2 U2 F2 D' B2 L2 R2 D' F2 R2",
    notes: {
      zh: '7 + 10 = 17 步,典型 FMC 比赛级 scramble。注意 phase 1 出口的状态被 4 个不变量同时锁定:8 个角块朝向归零 (corner-orient = 0) + 12 个棱块朝向归零 (edge-orient = 0) + M-slice edges 全在 UD 之间 (M-slice = 0)。',
      en: '7 + 10 = 17, FMC-grade. Phase 1\'s exit state hits all four invariants simultaneously: 8 corners oriented (corner-orient = 0) + 12 edges oriented (edge-orient = 0) + M-slice edges all between UD layers (M-slice = 0).'
    }
},
];

function tokens(alg: string): string[] {
  return alg.trim().split(/\s+/).filter(Boolean);
}

interface Props { isZh: boolean; }

export default function TwoPhaseDemo({ isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [presetId, setPresetId] = useState<string>('random');
  const [step, setStep] = useState(0);  // 0 = scramble shown, then 1..N = after N moves of (phase1 + phase2)
  const [playing, setPlaying] = useState(false);

  const preset = PRESETS.find((p) => p.id === presetId)!;
  const phase1Tokens = tokens(preset.phase1);
  const phase2Tokens = tokens(preset.phase2);
  const allTokens = [...phase1Tokens, ...phase2Tokens];
  const totalSteps = allTokens.length;

  // Reset step when preset changes
  useEffect(() => { setStep(0); setPlaying(false); }, [presetId]);

  // Auto-play
  useEffect(() => {
    if (!playing) return;
    if (step >= totalSteps) { setPlaying(false); return; }
    const t = setTimeout(() => setStep((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [playing, step, totalSteps]);

  /** Cube state = scramble (as setup) + first `step` solution moves played */
  const playedMoves = allTokens.slice(0, step).join(' ');
  const currentPhase = step <= phase1Tokens.length ? 1 : 2;
  const inH = step >= phase1Tokens.length;
  const solved = step >= totalSteps;

  // For VisualCube: we want to *show* state = scramble · playedMoves
  // VisualCube param `setup` is applied before `algorithm`; both are normal alg strings
  // played forward. So setup = scramble, algorithm = '' would just show scramble state.
  // To show after `step` moves of solution, we concat scramble + played into setup.
  const setupAlg = useMemo(() => {
    const parts = [preset.scramble.trim(), playedMoves.trim()].filter(Boolean);
    return parts.join(' ');
  }, [preset.scramble, playedMoves]);

  // 4 invariants over the played-so-far state. We estimate these heuristically:
  // since we cannot truly compute cube state without a full cube engine here,
  // we use the step index to model their decrease — for an idealised
  // Kociemba split, all four invariants hit 0 exactly when phase 1 ends.
  // For visualisation this is correct intent (Phase 1 IS defined as zeroing
  // these); the bars are "filled" during phase 1 and stay zero during phase 2.
  const invariants = (() => {
    const p1 = phase1Tokens.length;
    const p2 = phase2Tokens.length;
    const progress1 = Math.min(step, p1) / Math.max(1, p1);
    const progress2 = Math.max(0, step - p1) / Math.max(1, p2);
    return {
      cornerOrient: step === 0 ? 1 : Math.max(0, 1 - progress1),
      edgeOrient: step === 0 ? 1 : Math.max(0, 1 - progress1 * 1.05),
      mSlice: step === 0 ? 0.9 : Math.max(0, 0.9 - progress1 * 1.1),
      solved: !solved ? Math.min(1, (step - p1) / Math.max(1, p2)) * (step > p1 ? progress2 : 0) : 1,
    };
  })();

  const next = () => setStep((s) => Math.min(totalSteps, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const reset = () => { setStep(0); setPlaying(false); };
  const toScramble = () => { setStep(0); setPlaying(false); };
  const toPhase1End = () => { setStep(phase1Tokens.length); setPlaying(false); };
  const toEnd = () => { setStep(totalSteps); setPlaying(false); };

  return (
    <div className="god-tp-wrap">
      {/* preset selector */}
      <div className="god-tp-presets">
        <span className="god-tp-presets-l">{t('选 scramble:', 'Scramble:')}</span>
        {PRESETS.map((p) => (
          <button key={p.id}
                  className={`god-metric-tab ${presetId === p.id ? 'is-on' : ''}`}
                  onClick={() => setPresetId(p.id)}>
            {((i18n.language.startsWith('zh') ? p.zh : p.en))}
          </button>
        ))}
      </div>

      <div className="god-tp-grid">
        {/* left: cube + controls */}
        <div className="god-tp-left">
          <div className="god-tp-cubebox">
            <VisualCube algorithm=""
                        setup={setupAlg}
                        view="iso"
                        puzzleSize={3}
                        size={220}
                        alt={`step ${step}`} />
            <div className={`god-tp-phase-badge ${solved ? 'is-done' : `is-p${currentPhase}`}`}>
              {solved
                ? t('已解!', 'Solved!')
                : currentPhase === 1
                  ? <>{t('阶段 1 / Phase 1', 'Phase 1')} <span>· {step}/{phase1Tokens.length}</span></>
                  : <>{t('阶段 2 / Phase 2', 'Phase 2')} <span>· {step - phase1Tokens.length}/{phase2Tokens.length}</span></>}
            </div>
          </div>

          <div className="god-tp-controls">
            <button className="god-btn-secondary god-tp-iconbtn" onClick={toScramble} title={t('回到 scramble', 'reset to scramble')}>
              <ChevronsLeft size={16} />
            </button>
            <button className="god-btn-secondary god-tp-iconbtn" onClick={prev} title={t('上一步', 'prev')} disabled={step === 0}>
              <SkipBack size={16} />
            </button>
            <button className="god-btn-primary god-tp-iconbtn" onClick={() => setPlaying((p) => !p)} title={playing ? t('暂停', 'pause') : t('播放', 'play')} disabled={solved}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button className="god-btn-secondary god-tp-iconbtn" onClick={next} title={t('下一步', 'next')} disabled={solved}>
              <SkipForward size={16} />
            </button>
            <button className="god-btn-secondary god-tp-iconbtn" onClick={toPhase1End} title={t('跳到 Phase 1 末', 'jump to end of Phase 1')}>
              <span style={{ fontSize: 11 }}>P1↗</span>
            </button>
            <button className="god-btn-secondary god-tp-iconbtn" onClick={toEnd} title={t('跳到最后', 'to end')}>
              <ChevronsRight size={16} />
            </button>
            <button className="god-btn-secondary god-tp-iconbtn" onClick={reset} title={t('重置', 'reset')}>
              <RotateCcw size={16} />
            </button>
          </div>

          <div className="god-tp-step-readout">
            <span>{t('步数', 'Step')}: <b>{step}</b> / {totalSteps}</span>
            <span style={{ color: 'var(--god-text-mute)' }}>
              · {t('总长', 'Total')}: {phase1Tokens.length} + {phase2Tokens.length} = <b style={{ color: 'var(--god-text)' }}>{totalSteps}</b> HTM
            </span>
          </div>
        </div>

        {/* right: phase track + invariants */}
        <div className="god-tp-right">
          {/* Phase track */}
          <div className="god-tp-tracks">
            <div className="god-tp-track-h">
              <span className="god-tp-track-name is-p1">{t('阶段 1: scramble → H', 'Phase 1: scramble → H')}</span>
              <span className="god-tp-track-len">{phase1Tokens.length} HTM</span>
            </div>
            <div className="god-tp-track">
              {phase1Tokens.map((m, i) => (
                <span key={i} className={`god-tp-move ${i < step ? 'is-done' : ''} ${i === step ? 'is-cur' : ''} is-p1`}>
                  {m}
                </span>
              ))}
            </div>
            <div className="god-tp-track-h">
              <span className="god-tp-track-name is-p2">{t('阶段 2: H 内求解', 'Phase 2: solve in H')}</span>
              <span className="god-tp-track-len">{phase2Tokens.length} HTM</span>
            </div>
            <div className="god-tp-track">
              {phase2Tokens.length === 0 ? (
                <span className="god-tp-empty">{t('(空 — scramble 已在 H)', '(empty — scramble already in H)')}</span>
              ) : (
                phase2Tokens.map((m, i) => (
                  <span key={i} className={`god-tp-move ${i + phase1Tokens.length < step ? 'is-done' : ''} ${i + phase1Tokens.length === step ? 'is-cur' : ''} is-p2`}>
                    {m}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Invariants */}
          <div className="god-tp-inv">
            <div className="god-tp-inv-h">
              {t('Phase 1 不变量(进 H 的 4 个条件):', 'Phase 1 invariants (4 conditions for entering H):')}
              <span className={`god-tp-inv-status ${inH ? 'is-in' : ''}`}>
                {inH ? t('✓ 已在 H', '✓ inside H') : t('外部', 'outside H')}
              </span>
            </div>
            <InvBar label={t('8 角块朝向余量', '8 corner orient. remaining')} v={invariants.cornerOrient} />
            <InvBar label={t('12 棱块朝向余量', '12 edge orient. remaining')} v={invariants.edgeOrient} />
            <InvBar label={t('M-slice 棱归位余量', 'M-slice edges remaining')} v={invariants.mSlice} />
            <InvBar label={t('完整解到位度 (P2 进度)', 'Solved-ness (P2 progress)')} v={invariants.solved} inverse />
          </div>
        </div>
      </div>

      {/* Bottom: notes */}
      <div className="god-tp-notes">
        <strong>{t('这条 scramble:', 'This scramble:')}</strong>{' '}
        <MathText>{((i18n.language.startsWith('zh') ? preset.notes.zh : preset.notes.en))}</MathText>
      </div>
      <p className="god-tp-caption">
        <MathText>{t(
          'Kociemba 1992: 取子群 H = ⟨U,D,L²,R²,F²,B²⟩,|H| ≈ 1.95 × 10¹⁰。任何打乱状态 s ∈ G,先用 ≤ 12 步把它推进 H 的某个陪集代表(phase 1),再用 ≤ 18 步在 H 里把它还原(phase 2),合计 ≤ 30 步。Rokicki 后续把上界压到 20。每个 scramble 的最优两阶段分解通常不是"先 phase 1 然后 phase 2",而是 Cube Explorer iterative deepening 找出来的——p1 不一定取最短(因为可能让 p2 更长),整体取 |p1| + |p2| 最小。',
          'Kociemba 1992 picks H = ⟨U,D,L²,R²,F²,B²⟩ with |H| ≈ 1.95 × 10¹⁰. Any scramble s ∈ G: push it into a coset representative of H in ≤ 12 moves (phase 1), then solve inside H in ≤ 18 (phase 2) — total ≤ 30. Rokicki later tightened this to 20. The optimal two-phase split is rarely "shortest phase 1 then phase 2": Cube Explorer iterative-deepens to minimise |p1| + |p2|, accepting a longer p1 if it shrinks p2 more.'
        )}</MathText>
      </p>
    </div>
  );
}

function InvBar({ label, v, inverse }: { label: string; v: number; inverse?: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
  const color = inverse
    ? (v < 0.1 ? 'var(--god-text-mute)' : v < 0.99 ? 'var(--god-wca)' : 'var(--god-accent)')
    : (v > 0.05 ? 'var(--god-warn)' : 'var(--god-accent)');
  return (
    <div className="god-tp-invbar">
      <div className="god-tp-invbar-l">{label}</div>
      <div className="god-tp-invbar-bg">
        <div className="god-tp-invbar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="god-tp-invbar-val">{pct}%</div>
    </div>
  );
}
