'use client';

/**
 * /stroop —— Stroop 色词干扰测试(只做颜色这一维,不掺数字 / 方向那些变体)。
 *
 * 玩法沿用心理学里那张纸卡:整屏一格一格地报出每个格子的「墨色」,报完停表。
 * 干扰卡上写的是颜色词、印的却是另一种颜色,字面意思会抢在颜色前面被读出来,
 * 于是慢下来 —— 慢多少就是你的干扰量。所以本页给三张卡:
 *   色块(没有字,纯命名基线) / 一致(字色相同) / 干扰(字色冲突,默认)
 * 干扰量 = 干扰卡每格用时 − 色块卡每格用时,两张都跑过才算得出来。
 *
 * 计时不自己造:直接驱动 /timer 那台状态机(_shared/useTimer),用 startNow
 * 跳过 WCA 的观察 / 长按起表 —— 这里按一下空格就走,再按一下停,和图里一致。
 * 出卡逻辑在 _lib/card.ts(纯函数,tests/stroop_card.test.ts 锁死均匀与相邻约束)。
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useQueryState, parseAsStringEnum, parseAsInteger } from 'nuqs';
import { RefreshCw, Trash2 } from 'lucide-react';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import LiquidGlassChips from '@/components/LiquidGlassChips';
import { tr } from '@/i18n/tr';
import { useTimer } from '@/app/[lang]/timer/_shared/useTimer';
import { formatTimePlain } from '@/app/[lang]/timer/_shared/format';
import {
  generateCard, paletteOf, COLOR_NAMES, CARD_KINDS, CARD_COLUMNS, CELL_COUNTS, COLOR_COUNTS,
  type CardKind, type CellCount, type ColorCount, type StroopCell,
} from './_lib/card';
import {
  addRun, bestPerCell, clearRuns, interferenceMs, loadRuns, perCellMs, saveRuns,
  type StroopRun,
} from './_lib/history';
import './stroop.css';

const KIND_LABELS: Record<CardKind, { zh: string; en: string }> = {
  patch:       { zh: '色块', en: 'Patches' },
  congruent:   { zh: '一致', en: 'Congruent' },
  incongruent: { zh: '干扰', en: 'Conflict' },
};

const KIND_HINTS: Record<CardKind, { zh: string; en: string }> = {
  patch: {
    zh: '基线卡:没有字,只报色块的颜色。用它量出你自己的命名速度。',
    en: 'Baseline card — no words, just name each patch. This measures your own naming speed.',
  },
  congruent: {
    zh: '一致卡:字和颜色相同,读起来最顺。',
    en: 'Congruent card — word and ink match, so it reads fastest.',
  },
  incongruent: {
    zh: '干扰卡:字和颜色不同,报颜色、别读字。',
    en: 'Conflict card — word and ink disagree. Name the ink, not the word.',
  },
};

/** 时间读数:沿用站内计时器的写法(13.63 / 1:05.43),别再造一套格式。 */
const fmt = (ms: number) => formatTimePlain(ms, 2);

function StroopPage() {
  const [kind, setKind] = useQueryState(
    'card', parseAsStringEnum<CardKind>([...CARD_KINDS]).withDefault('incongruent'),
  );
  const [rawCount, setCount] = useQueryState('n', parseAsInteger.withDefault(20));
  const [rawColors, setColors] = useQueryState('colors', parseAsInteger.withDefault(6));
  // URL 是用户能手改的,越界值一律钳回选项集,免得算出一张 0 格或 9 色的卡。
  const count: CellCount = (CELL_COUNTS as readonly number[]).includes(rawCount)
    ? rawCount as CellCount : 20;
  const colorCount: ColorCount = (COLOR_COUNTS as readonly number[]).includes(rawColors)
    ? rawColors as ColorCount : 6;

  // 卡片只在客户端生成(随机),SSR 首帧留空格子,避免 hydration 不一致。
  const [card, setCard] = useState<StroopCell[]>([]);
  const [runs, setRuns] = useState<StroopRun[]>([]);
  const [lastRun, setLastRun] = useState<StroopRun | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // 停表回调里要知道这一局用的是哪张卡的参数(而不是回调触发后 state 的新值)。
  const runningCfgRef = useRef({ kind, count, colorCount });

  useEffect(() => { setRuns(loadRuns()); }, []);

  const recordRun = useCallback((ms: number) => {
    const cfg = runningCfgRef.current;
    const run: StroopRun = { ...cfg, ms, ts: Date.now() };
    setLastRun(run);
    setRuns(prev => {
      const next = addRun(prev, run);
      saveRuns(next);
      return next;
    });
  }, []);

  const timer = useTimer(useCallback((r: { timeMs: number }) => recordRun(r.timeMs), [recordRun]));
  const { phase, displayMs, startNow, onPressDown } = timer;
  const running = phase === 'running';

  const deal = useCallback(() => {
    setCard(generateCard(kind, count, colorCount));
  }, [kind, count, colorCount]);

  // 换设置(或首次挂载)就重发一张;计时中不动,免得手一抖把正在读的卡换掉。
  useEffect(() => {
    if (phase === 'running') return;
    setCard(generateCard(kind, count, colorCount));
    // phase 只作守卫,不该因为 stopped→idle 之类的翻转再洗一次牌。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, count, colorCount]);

  /** 空格 / 点屏:running 时停表,否则换一张新卡并立刻起表(不走观察和长按)。 */
  const toggle = useCallback(() => {
    if (phase === 'running') {
      onPressDown();
      return;
    }
    runningCfgRef.current = { kind, count, colorCount };
    setLastRun(null);
    setCard(generateCard(kind, count, colorCount));
    startNow();
  }, [phase, onPressDown, startNow, kind, count, colorCount]);

  // 全局空格 —— 不用先点一下页面。焦点在舞台上时交给舞台自己的 onKeyDown 处理,
  // 否则会起表 + 停表连着触发两次。
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t === stageRef.current) return;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();  // 顺带压掉空格滚页
      toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  const columns = Math.min(CARD_COLUMNS, Math.max(1, count));
  const palette = paletteOf(colorCount);
  const best = bestPerCell(runs, kind, colorCount);
  const interference = interferenceMs(runs, colorCount);
  const recent = runs.slice(0, 5);

  return (
    <div className={`stroop-page${running ? ' is-running' : ''}`}>
      <div className="stroop-topbar">
        <BackHome />
        <HeaderToggles />
      </div>

      <header className="stroop-header">
        <h1>{tr({ zh: 'Stroop 测试', en: 'Stroop Test' })}</h1>
        <p>{tr({
          zh: '报出每个格子的颜色,不是上面写的字。字面意思会抢跑,慢下来的那部分就是干扰量。',
          en: 'Name the ink colour of every cell, not the word printed on it. The word reads itself first — how much it slows you down is the interference.',
        })}</p>
      </header>

      <div className="stroop-controls">
        <div className="stroop-control">
          <span>{tr({ zh: '卡片', en: 'Card' })}</span>
          <LiquidGlassChips<CardKind>
            items={CARD_KINDS} value={kind} onChange={(v) => void setKind(v)}
            getLabel={(k) => tr(KIND_LABELS[k])}
            ariaLabel={tr({ zh: '卡片类型', en: 'Card type' })}
          />
        </div>
        <div className="stroop-control">
          <span>{tr({ zh: '格数', en: 'Cells' })}</span>
          <LiquidGlassChips<number>
            items={CELL_COUNTS} value={count} onChange={(v) => void setCount(v)}
            getLabel={(n) => String(n)}
            ariaLabel={tr({ zh: '格数', en: 'Cells' })}
          />
        </div>
        <div className="stroop-control">
          <span>{tr({ zh: '颜色', en: 'Colours' })}</span>
          <LiquidGlassChips<number>
            items={COLOR_COUNTS} value={colorCount} onChange={(v) => void setColors(v)}
            getLabel={(n) => tr({ zh: `${n} 色`, en: `${n}` })}
            ariaLabel={tr({ zh: '颜色数', en: 'Number of colours' })}
          />
        </div>
        <button type="button" className="stroop-deal" onClick={deal}>
          <RefreshCw size={14} aria-hidden />
          {tr({ zh: '换一张', en: 'New card' })}
        </button>
      </div>

      <div
        ref={stageRef}
        className="stroop-stage"
        role="button"
        tabIndex={0}
        aria-label={tr({ zh: '按空格开始或停止计时', en: 'Press space to start or stop the timer' })}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.repeat) return;
          if (e.key !== ' ' && e.key !== 'Enter') return;
          e.preventDefault();
          toggle();
        }}
      >
        <div className="stroop-timer">{fmt(displayMs)}</div>
        <div className="stroop-hint">
          {running
            ? tr({ zh: '读完再按一次空格停表', en: 'Press space again when you finish' })
            : tr({ zh: '按空格(或点这里)开始计时', en: 'Press space — or tap here — to start' })}
        </div>

        <div
          className="stroop-grid"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {card.map((cell, i) => (
            <div key={i} className="stroop-cell" style={{ color: `var(--stroop-${cell.ink})` }}>
              {cell.word === null
                ? <span className="stroop-patch" style={{ background: `var(--stroop-${cell.ink})` }} />
                : tr(COLOR_NAMES[cell.word])}
            </div>
          ))}
        </div>
      </div>

      <div className="stroop-below">
        <p className="stroop-kind-hint">{tr(KIND_HINTS[kind])}</p>

        <div className="stroop-scores">
          {lastRun && (
            <div className="stroop-score">
              <span>{tr({ zh: '本次', en: 'This run' })}</span>
              <strong>{fmt(lastRun.ms)}</strong>
              <em>{tr({ zh: `${Math.round(perCellMs(lastRun))} ms / 格`, en: `${Math.round(perCellMs(lastRun))} ms / cell` })}</em>
            </div>
          )}
          {best !== null && (
            <div className="stroop-score">
              <span>{tr({ zh: '最好', en: 'Best' })}</span>
              <strong>{Math.round(best)} ms</strong>
              <em>{tr({ zh: `${tr(KIND_LABELS[kind])}卡每格`, en: `per cell, ${tr(KIND_LABELS[kind]).toLowerCase()}` })}</em>
            </div>
          )}
          {interference !== null && (
            <div className="stroop-score">
              <span>{tr({ zh: '干扰量', en: 'Interference' })}</span>
              <strong>{interference >= 0 ? '+' : ''}{Math.round(interference)} ms</strong>
              <em>{tr({ zh: '干扰卡比色块卡每格慢', en: 'conflict minus patches, per cell' })}</em>
            </div>
          )}
          {interference === null && (
            <div className="stroop-score stroop-score--todo">
              <span>{tr({ zh: '干扰量', en: 'Interference' })}</span>
              <strong>—</strong>
              <em>{tr({ zh: '色块卡和干扰卡各跑一次才有', en: 'run both the patches and the conflict card' })}</em>
            </div>
          )}
        </div>

        {recent.length > 0 && (
          <div className="stroop-history">
            <div className="stroop-history-head">
              <span>{tr({ zh: '最近', en: 'Recent' })}</span>
              <button
                type="button"
                className="stroop-clear"
                onClick={() => { clearRuns(); setRuns([]); setLastRun(null); }}
              >
                <Trash2 size={13} aria-hidden />
                {tr({ zh: '清空', en: 'Clear' })}
              </button>
            </div>
            <ul>
              {recent.map(r => (
                <li key={r.ts}>
                  <span className="stroop-history-kind">{tr(KIND_LABELS[r.kind])}</span>
                  <span className="stroop-history-cfg">{tr({
                    zh: `${r.count} 格 / ${r.colorCount} 色`,
                    en: `${r.count} cells / ${r.colorCount} colours`,
                  })}</span>
                  <span className="stroop-history-ms">{fmt(r.ms)}</span>
                  <span className="stroop-history-per">{Math.round(perCellMs(r))} ms</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="stroop-legend">
          {palette.map(c => (
            <span key={c} className="stroop-legend-item">
              <i style={{ background: `var(--stroop-${c})` }} aria-hidden />
              {tr(COLOR_NAMES[c])}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  // useQueryState 要读 searchParams,SSG 下必须包 Suspense。
  return (
    <Suspense fallback={<div className="stroop-page" />}>
      <StroopPage />
    </Suspense>
  );
}
