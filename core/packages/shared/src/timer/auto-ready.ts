import { parseScrambleStrict, type ParsedMove } from '@cuberoot/puzzle-solvers/cube-moves';
import type { TimerSmartCubeSettings } from './settings-contract';

export const TIMER_SMART_CUBE_AUTO_READY_COPY = {
  scrambled: { zh: '打乱正确', en: 'When scrambled' },
  still: { zh: '无操作 2 秒', en: 'Idle for 2 seconds' },
  'double-flick': { zh: "来回转动（U U'）", en: "Turn and return (U U')" },
} satisfies Record<TimerSmartCubeSettings['bluetoothAutoReady'], { en: string; zh: string }>;

export type TimerAutoReadyMode = 'still' | 'double-flick';

/** A readiness gesture fires once per enabled interval. Hosts supply the live move stream and gate. */
export function createTimerAutoReadyController(onReady: () => void) {
  let mode: TimerAutoReadyMode | false = false;
  let fired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let previous: ParsedMove[] | null = null;

  function fire() {
    if (fired || !mode) return;
    fired = true;
    try { onReady(); }
    catch (error) { console.error('[auto-ready] onReady threw', error); }
  }

  function setMode(next: TimerAutoReadyMode | false) {
    if (mode === next) return;
    mode = next;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    fired = false;
    previous = null;
  }

  return {
    setMode,
    move(move: string) {
      if (!mode || fired) return;
      if (mode === 'still') {
        if (timer !== undefined) clearTimeout(timer);
        timer = setTimeout(() => { timer = undefined; fire(); }, 2000);
        return;
      }
      // One stream event is one turn. Slice turns expand into commuting blocks.
      const { moves, bad } = parseScrambleStrict(move);
      if (/\s|,/.test(move.trim()) || bad.length || !moves.length
        || moves.some(turn => turn.isRotation || Math.abs(turn.amount) !== 1)) {
        previous = null;
        return;
      }
      const last = previous;
      previous = moves;
      if (last?.length === moves.length && moves.every((turn, index) => {
        const before = last[index];
        return turn.face === before.face && turn.layers === before.layers && turn.amount === -before.amount;
      })) fire();
    },
    dispose() { setMode(false); },
  };
}
