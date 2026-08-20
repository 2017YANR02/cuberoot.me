'use client';

/**
 * RoundPanel — inline pill row for the round simulation.
 *
 * Purely presentational: props in, callbacks out. It reads no settings, no
 * storage and no URL state; the caller owns `config`, the round's solve slice
 * and the target. Renders nothing when the round sim is off.
 *
 *   2/5 · ao5 · in progress 9.12 · BPA 8.44 / WPA 10.31 · beat 9.50: need ≤ 9.87
 *
 * Visual language is GoalProgress's pill (same geometry: inline-flex, 3px 10px,
 * 999px radius, 12px mono, tabular-nums) with the hardcoded rgba/hex swapped
 * for theme tokens. It sits inside `.shell-undersurface` next to that pill, so
 * it deliberately has no card of its own.
 */

import { RotateCcw } from 'lucide-react';
import type { Solve, EventId } from '../_lib/types';
import { effectiveMs } from '../_lib/types';
import { formatMs, formatEventMs } from '../_lib/stats';
import type { RoundConfig, RoundAttempt } from '@cuberoot/shared/timer';
import { roundResult, roundProjection } from '@cuberoot/shared/timer';
import { tr, useLang } from '@/i18n/tr';

export interface RoundPanelProps {
  /** The round's attempts, oldest → newest — the slice for THIS round only. */
  solves: Solve[];
  /** Round configuration. Renders nothing while `config.on` is false. */
  config: RoundConfig;
  /** Target to chase, in ms. null / undefined hides the target pill. */
  targetMs?: number | null;
  /** Event id — only used to render FMC as move counts. */
  event?: EventId;
  /** Time precision, matching `settings.precision`. Defaults to 2 (cs). */
  precision?: 0 | 1 | 2 | 3;
  /** Shown as a "new round" button once the round is over. Omit to hide it. */
  onReset?: () => void;
}

type Tone = 'muted' | 'info' | 'success' | 'warn';

const TONES: Record<Tone, { border: string; background: string; color: string }> = {
  muted: {
    border: 'color-mix(in srgb, var(--foreground) 18%, transparent)',
    background: 'var(--shell-chip, color-mix(in srgb, var(--foreground) 5%, transparent))',
    color: 'var(--muted-foreground)',
  },
  info: {
    border: 'color-mix(in srgb, var(--signal-info) 35%, transparent)',
    background: 'color-mix(in srgb, var(--signal-info) 8%, transparent)',
    color: 'var(--foreground)',
  },
  success: {
    border: 'color-mix(in srgb, var(--signal-success) 55%, transparent)',
    background: 'color-mix(in srgb, var(--signal-success) 12%, transparent)',
    color: 'var(--signal-success)',
  },
  warn: {
    border: 'color-mix(in srgb, var(--signal-warning) 55%, transparent)',
    background: 'color-mix(in srgb, var(--signal-warning) 12%, transparent)',
    color: 'var(--signal-warning)',
  },
};

function pillStyle(tone: Tone): React.CSSProperties {
  const t = TONES[tone];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    background: t.background,
    color: t.color,
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums',
    // CJK labels must never be clipped or wrapped mid-token on a phone; the
    // row wraps between pills instead (see the wrapper's flexWrap).
    whiteSpace: 'nowrap',
    maxWidth: 'max-content',
  };
}

export default function RoundPanel({
  solves,
  config,
  targetMs = null,
  event,
  precision = 2,
  onReset,
}: RoundPanelProps) {
  // Subscribe to the language toggle so the tr() calls below re-resolve.
  useLang();

  if (!config.on) return null;

  const res = roundResult(solves, config);
  const proj = roundProjection(solves, config, targetMs ?? null);

  const fmt = (ms: number | null): string =>
    event ? formatEventMs(event, ms, precision) : formatMs(ms, precision);

  const statusLabel =
    res.status === 'idle' ? tr({ zh: '待开始', en: 'ready' })
      : res.status === 'running' ? tr({ zh: '进行中', en: 'in progress' })
        : res.status === 'cut' ? tr({ zh: '未过关', en: 'cut' })
          : tr({ zh: '完成', en: 'final' });

  const shown = res.complete ? res.official : res.value;
  const hitTarget =
    targetMs !== null && targetMs > 0 && shown !== null && shown <= targetMs;
  const mainTone: Tone =
    res.status === 'cut' ? 'warn'
      : res.complete ? (hitTarget ? 'success' : shown === null || !Number.isFinite(shown) ? 'warn' : 'info')
        : 'info';

  // A cut ao5 / mo3 has no average at all (9f5+), so show a dash rather than
  // a number that never counted.
  const valueText = res.complete && res.official === null && res.done > 0
    ? '—'
    : fmt(shown);

  const averaging = res.format === 'ao5' || res.format === 'mo3';
  const showProjection = averaging && res.remaining > 0 && res.done > 0;
  const showCutoffHint = res.cutoffActive && !res.cutoffMade && res.status !== 'cut';
  const showBudget = config.cumulative && res.budgetMs !== null && !res.complete;

  const attemptTitle = tr({
    zh: '本轮每一把;灰色的把数是未过关后不再计入的',
    en: 'Every attempt of the round; greyed ones no longer count after a missed cutoff',
  });

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        margin: '6px 0',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={pillStyle(mainTone)}
        title={tr({
          zh: `第 ${Math.min(res.done + 1, res.attempts)} 把 / 共 ${res.attempts} 把`,
          en: `attempt ${Math.min(res.done + 1, res.attempts)} of ${res.attempts}`,
        })}
      >
        <span>{res.done}/{res.attempts}</span>
        <span style={{ opacity: 0.75 }}>{res.format}</span>
        <span style={{ opacity: 0.75 }}>{statusLabel}</span>
        <span>{valueText}</span>
      </span>

      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
        title={attemptTitle}
      >
        {res.list.map(a => (
          <AttemptToken key={a.index} attempt={a} fmt={fmt} />
        ))}
      </span>

      {showProjection && (
        <span style={pillStyle('muted')}>
          <span>BPA {fmt(proj.bpa)}</span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span>WPA {fmt(proj.wpa)}</span>
        </span>
      )}

      {showCutoffHint && (
        <span
          style={pillStyle('muted')}
          title={tr({
            zh: '前几把里至少有一把严格快于过关线,才能继续后面的把数(WCA 9g)',
            en: 'One of the first attempts must be strictly better than the cutoff to earn the rest (WCA 9g)',
          })}
        >
          {tr({
            zh: `过关线 ${fmt(config.cutoffMs)} (前 ${res.cutoffPhase} 把)`,
            en: `cutoff ${fmt(config.cutoffMs)} (first ${res.cutoffPhase})`,
          })}
        </span>
      )}

      {showBudget && (
        <span
          style={pillStyle('muted')}
          title={tr({
            zh: '整轮累计时限剩余额度(WCA A1a2)',
            en: 'Cumulative time limit left for the round (WCA A1a2)',
          })}
        >
          {tr({ zh: `累计余额 ${fmt(res.budgetMs)}`, en: `cumulative left ${fmt(res.budgetMs)}` })}
        </span>
      )}

      {proj.target && (
        <span style={pillStyle(proj.target.achieved ? 'success' : proj.target.impossible ? 'muted' : 'info')}>
          {proj.target.achieved
            ? tr({ zh: `${fmt(proj.target.ms)} 已锁定`, en: `${fmt(proj.target.ms)} secured` })
            : proj.target.impossible
              ? tr({ zh: `${fmt(proj.target.ms)} 已无望`, en: `${fmt(proj.target.ms)} out of reach` })
              : proj.target.needMs === null
                ? tr({ zh: `目标 ${fmt(proj.target.ms)}`, en: `target ${fmt(proj.target.ms)}` })
                : res.remaining > 1
                  ? tr({
                    zh: `想破 ${fmt(proj.target.ms)} 需每把 ≤ ${fmt(proj.target.needMs)}`,
                    en: `beat ${fmt(proj.target.ms)}: need ≤ ${fmt(proj.target.needMs)} each`,
                  })
                  : tr({
                    zh: `想破 ${fmt(proj.target.ms)} 需 ≤ ${fmt(proj.target.needMs)}`,
                    en: `beat ${fmt(proj.target.ms)}: need ≤ ${fmt(proj.target.needMs)}`,
                  })}
        </span>
      )}

      {res.complete && onReset && (
        <button
          type="button"
          onClick={onReset}
          style={{
            ...pillStyle('muted'),
            cursor: 'pointer',
            color: 'var(--foreground)',
          }}
        >
          <RotateCcw size={11} aria-hidden />
          <span>{tr({ zh: '新一轮', en: 'new round' })}</span>
        </button>
      )}
    </div>
  );
}

/** One attempt slot — a time, a dash, or a greyed-out slot that never counted. */
function AttemptToken({
  attempt,
  fmt,
}: {
  attempt: RoundAttempt;
  fmt: (ms: number | null) => string;
}) {
  const base: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  };

  if (attempt.state === 'pending') {
    return <span style={{ ...base, color: 'var(--faint-foreground)' }}>–</span>;
  }
  if (attempt.state === 'ineligible') {
    // 9f5+ — no result at all for an attempt the competitor never qualified for.
    return (
      <span
        style={{ ...base, color: 'var(--faint-foreground)', opacity: 0.55, textDecoration: 'line-through' }}
        title={tr({ zh: '未过关,这把不计入', en: 'cut — this attempt does not count' })}
      >
        {attempt.solve ? fmt(effectiveMs(attempt.solve)) : '–'}
      </span>
    );
  }
  if (attempt.state === 'dns') {
    // A1a2+++++ — cumulative limit reached, the rest of the round is DNS.
    return (
      <span
        style={{ ...base, color: 'var(--faint-foreground)' }}
        title={tr({ zh: '累计时限用尽,记为 DNS', en: 'cumulative limit reached — recorded as DNS' })}
      >
        DNS
      </span>
    );
  }
  return (
    <span
      style={{
        ...base,
        color: attempt.overLimit ? 'var(--destructive)' : 'var(--foreground)',
      }}
      title={attempt.overLimit
        ? tr({ zh: '超过时限,记为 DNF(WCA A1a4)', en: 'over the time limit — DNF (WCA A1a4)' })
        : undefined}
    >
      {fmt(attempt.ms)}
    </span>
  );
}
