import {
  activeTimerSolves,
  formatMs,
  formatSolveResult,
  initialTimerMachineState,
  scramble333,
  summarize,
  transitionTimer,
  type Solve,
  type SolveResult,
  type TimerMachineAction,
  type TimerMachineState,
  type TimerStoreData,
} from '@cuberoot/shared/timer';

import { appendTimerSolve, loadOrCreateTimerStore } from '../../lib/timer-store';

const TIMER_STORAGE_KEY = 'cuberoot:timer';
const TIMER_RECOVERY_STORAGE_KEY = 'cuberoot:timer:recovery';
const HOLD_MS = 300;

let machine: TimerMachineState = initialTimerMachineState();
let store: TimerStoreData | null = null;
let currentScramble = '';
let lastResult: SolveResult | null = null;
let holdTimer: ReturnType<typeof setTimeout> | undefined;
let tickTimer: ReturnType<typeof setInterval> | undefined;

function nowMs(): number {
  return Date.now();
}

function createId(prefix: string): string {
  return `${prefix}-${nowMs().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clearHoldTimer(): void {
  if (holdTimer !== undefined) clearTimeout(holdTimer);
  holdTimer = undefined;
}

function clearTickTimer(): void {
  if (tickTimer !== undefined) clearInterval(tickTimer);
  tickTimer = undefined;
}

Page({
  data: {
    ao5: '-',
    ao12: '-',
    best: '-',
    count: 0,
    instruction: '按住准备',
    phaseClass: 'idle',
    recent: [] as Array<{ id: string; index: number; scramble: string; time: string }>,
    scramble: '',
    timerText: '0.00',
  },

  onLoad() {
    machine = initialTimerMachineState();
    lastResult = null;
    currentScramble = scramble333(Math.random);
    const raw = wx.getStorageSync(TIMER_STORAGE_KEY) as unknown;
    const loaded = loadOrCreateTimerStore(raw, { nowMs: nowMs(), id: createId('session') });
    store = loaded.data;
    if (loaded.recoveredFromCorruption) {
      try {
        wx.setStorageSync(TIMER_RECOVERY_STORAGE_KEY, raw);
      } catch {
        // Recovery is best-effort; the invalid data is never accepted as timer state.
      }
      wx.showToast({ icon: 'none', title: '计时数据异常，已保留恢复副本' });
    }
    wx.setStorageSync(TIMER_STORAGE_KEY, store);
    this.syncTimer();
  },

  onUnload() {
    clearHoldTimer();
    clearTickTimer();
  },

  currentTimerText(): string {
    const current = nowMs();
    if (machine.phase === 'running') {
      return formatMs(Math.max(0, current - (machine.startedAtMs ?? current)));
    }
    if (machine.phase === 'inspecting') {
      const elapsed = Math.max(0, current - (machine.inspectionStartedAtMs ?? current));
      const remaining = (machine.inspectionSec ?? 0) * 1000 - elapsed;
      if (remaining >= 0) return String(Math.ceil(remaining / 1000));
      return remaining >= -2_000 ? '+2' : 'DNF';
    }
    if (machine.phase === 'stopped' && lastResult) {
      if (lastResult.autoPenalty === 'DNF') return 'DNF';
      const adjusted = lastResult.timeMs + (lastResult.autoPenalty === '+2' ? 2_000 : 0);
      return `${formatMs(adjusted)}${lastResult.autoPenalty === '+2' ? '+' : ''}`;
    }
    return formatMs(machine.lastMs ?? 0);
  },

  syncTimer() {
    const solves = store ? activeTimerSolves(store, '333') : [];
    const stats = summarize(solves, '333');
    const recent = solves.slice(-5).reverse().map((solve, offset) => ({
      id: solve.id,
      index: solves.length - offset,
      scramble: solve.scramble,
      time: formatSolveResult(solve),
    }));
    const instructions: Record<TimerMachineState['phase'], string> = {
      holding: '继续按住',
      idle: '按住准备',
      inspecting: '观察完成后按住',
      ready: '松手开始',
      running: '轻触停止',
      stopped: '按住准备',
    };
    this.setData({
      ao5: stats.ao5,
      ao12: stats.ao12,
      best: stats.best,
      count: stats.count,
      instruction: instructions[machine.phase],
      phaseClass: machine.phase,
      recent,
      scramble: currentScramble,
      timerText: this.currentTimerText(),
    });
    clearTickTimer();
    if (machine.phase === 'running' || machine.phase === 'inspecting') {
      tickTimer = setInterval(() => {
        this.setData({ timerText: this.currentTimerText() });
      }, 32);
    }
  },

  completeSolve(result: SolveResult) {
    if (!store) return;
    const completedAt = nowMs();
    const solve: Solve = {
      event: '333',
      id: createId('solve'),
      inspectionMs: result.inspectionMs || undefined,
      penalty: result.autoPenalty,
      scramble: currentScramble,
      timeMs: result.timeMs,
      ts: completedAt,
    };
    try {
      store = appendTimerSolve(store, solve);
      wx.setStorageSync(TIMER_STORAGE_KEY, store);
      lastResult = result;
      currentScramble = scramble333(Math.random);
    } catch {
      wx.showToast({ icon: 'none', title: '成绩保存失败' });
    }
  },

  applyTimerAction(action: TimerMachineAction) {
    const transition = transitionTimer(machine, action, {
      inspectionSec: store?.settings.inspectionSec ?? 0,
      inspectionTrigger: 'down',
    });
    machine = transition.state;
    if (transition.effects.includes('hold-started')) {
      clearHoldTimer();
      holdTimer = setTimeout(() => {
        const ready = transitionTimer(machine, { type: 'hold-ready' }, {
          inspectionSec: store?.settings.inspectionSec ?? 0,
          inspectionTrigger: 'down',
        });
        machine = ready.state;
        this.syncTimer();
      }, HOLD_MS);
    }
    if (transition.effects.includes('hold-cancelled') || transition.effects.includes('run-started')) {
      clearHoldTimer();
    }
    if (transition.solve) this.completeSolve(transition.solve);
    this.syncTimer();
  },

  onTouchStart() {
    this.applyTimerAction({ type: 'press-down', nowMs: nowMs() });
  },

  onTouchEnd() {
    clearHoldTimer();
    this.applyTimerAction({ type: 'press-up', nowMs: nowMs() });
  },

  onTouchCancel() {
    clearHoldTimer();
    this.applyTimerAction({ type: 'cancel-press' });
  },

  newScramble() {
    if (machine.phase === 'running') {
      wx.showToast({ icon: 'none', title: '请先停止计时' });
      return;
    }
    currentScramble = scramble333(Math.random);
    this.setData({ scramble: currentScramble });
  },
});
