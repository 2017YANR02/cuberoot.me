import { parseClockMoves } from '@cuberoot/puzzle-solvers/clock';
import ClockBoard, { parseClockSteps, type ClockStep } from '../engine/clock/clockBoard';
import { applyAnimFrame, type PieceAnim } from '../engine/pieceAnim';
import { clockDialCenter, renderClockSvg } from '../clock-svg';
import type { NativeReplay } from './nativePlayback';

export function parseClockReplayTokens(text: string): string[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const amount = /^[A-Z+]+(\d+)[+-]$/.exec(token)?.[1];
    if (amount !== undefined && !Number.isSafeInteger(Number(amount))) {
      throw new RangeError('Clock turn values must be safe integers');
    }
  }
  parseClockMoves(text);
  // Historical scrambles may append pin positions. Pins leave the dial state intact.
  return tokens.filter(token => !/^(?:UR|DR|DL|UL|[UDud]{4})$/.test(token));
}

export function mountReplayClock(host: HTMLElement): NativeReplay {
  const board = new ClockBoard();
  const view = host.ownerDocument.createElement('div');
  view.style.width = '100%';
  view.style.height = '100%';
  view.setAttribute('aria-hidden', 'true');
  host.appendChild(view);

  let rightSideUp: boolean | undefined;
  let hands: NodeListOf<SVGGElement>;
  let active: { token: string; step: ClockStep; anims: PieceAnim[] } | undefined;
  let disposed = false;
  const centers = Array.from({ length: 18 }, (_, index) => clockDialCenter(index));

  function redraw(): void {
    const state = board.state;
    if (rightSideUp !== state.rightSideUp) {
      rightSideUp = state.rightSideUp;
      view.innerHTML = renderClockSvg(state, {});
      hands = view.querySelectorAll('g[transform]');
    }
    for (let index = 0; index < centers.length; index++) {
      const { x, y } = centers[index];
      const angle = (state.posit[index] + board.animOffset(index)) * 30;
      hands[index].setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
    }
  }

  function parseSequence(steps: readonly string[]): ClockStep[] {
    const text = parseClockReplayTokens(steps.filter(step => step !== '.').join(' ')).join(' ');
    return parseClockSteps(text);
  }

  function stepInCurrentFrame(token: string): ClockStep {
    const text = board.state.rightSideUp ? token : `y2 ${token}`;
    const step = parseClockSteps(text).at(-1);
    if (!step) throw new Error(`Invalid Clock step ${token}`);
    return step;
  }

  redraw();
  return {
    validate(steps) { parseSequence(steps); },
    setup(steps) {
      if (disposed) return;
      const replay = parseSequence(steps);
      active = undefined;
      board.reset();
      for (const step of replay) board.applyMoveSilent(step);
      redraw();
    },
    animate(token, fraction) {
      if (disposed || token === '.') return;
      if (active?.token !== token) {
        const step = stepInCurrentFrame(token);
        active = { token, step, anims: board.beginMove(step) };
      }
      applyAnimFrame(active.anims, fraction);
      redraw();
    },
    commit(token) {
      if (disposed || token === '.') return;
      const step = active?.token === token ? active.step : stepInCurrentFrame(token);
      board.applyMoveSilent(step);
      active = undefined;
      redraw();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      view.remove();
      board.dispose();
    },
  };
}
