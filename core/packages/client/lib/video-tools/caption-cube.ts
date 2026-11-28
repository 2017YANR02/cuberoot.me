import type { Object3D } from 'three';
import { mountReplayCube } from '@cuberoot/puzzle-render-core/replay/mountReplayCube';
import { normalizeAlgForTwisty } from '../alg_normalize';
import { fractionForAngle, mountTimedCubingCube, type VideoCubeEngine } from '../video-recon/timed-cubing-cube';
import { findTokenPositions } from '../recon-alg-utils';
import { captionCubeRect, type CubePosition, type PreparedCaptions } from './recon-captions';

export interface CaptionCube {
  capture(time: number, edge: number): HTMLCanvasElement;
  draw(ctx: CanvasRenderingContext2D, time: number, width: number, height: number, position?: CubePosition, scale?: number): void;
  setSolidFoundation?(solid: boolean): void;
  dispose(): void;
}

export async function createCaptionCube(scramble: string, solution: string, captions: PreparedCaptions,
  engine: VideoCubeEngine, signal: AbortSignal): Promise<CaptionCube> {
  const inspection = solution.split('\n').filter(s => /\/\/\s*(?:insp(?:ection)?|观察)\s*$/i.test(s)).join('\n');
  const setup = [...findTokenPositions(scramble), ...findTokenPositions(inspection)].map(m => m.text);
  const turns = captions.filter(c => !/\/\/\s*(?:insp(?:ection)?|观察)\s*$/i.test(c.text)).flatMap(c => c.turns);
  if (!turns.length || turns.some(m => !Number.isFinite(m.from))) throw Error('Missing turn timing');
  const host = document.createElement('div');
  const model = engine === 'cubing' ? await mountCubingCaptionCube(host, signal)
    : mountReplayCube(host, { interactive: false });
  const settledAt = turns.map(turn => turn.commit ? turn.from : turn.to);
  let applied = -1;
  let previousTime = -Infinity;
  function capture(time: number, edge: number) {
    let count = time < previousTime ? 0 : Math.max(0, applied);
    previousTime = time;
    while (count < turns.length && time >= settledAt[count]) count++;
    if (applied < 0 || count < applied) {
      model.setup([...setup, ...turns.slice(0, count).map(turn => turn.text)]);
    } else for (let i = applied; i < count; i++) model.commit(turns[i].text);
    applied = count;
    const turn = turns[count];
    if (turn && !turn.commit) {
      const progress = time <= turn.from || turn.to <= turn.from ? 0 : Math.min(1, (time - turn.from) / (turn.to - turn.from));
      model.animate(turn.text, progress);
    }
    return model.capture(edge);
  }
  return {
    capture,
    draw(ctx, time, width, height, position, scale) {
      const { left, top, edge } = captionCubeRect(width, height, position, scale);
      ctx.drawImage(capture(time, edge), left, top, edge, edge);
    },
    setSolidFoundation: 'setSolidFoundation' in model ? model.setSolidFoundation : undefined,
    dispose: model.dispose,
  };
}

async function mountCubingCaptionCube(host: HTMLElement, signal: AbortSignal) {
  const { mountReplayScene } = await import('@cuberoot/puzzle-render-core/replay/mountReplayScene');
  signal.throwIfAborted();
  // Cubing.js initializes only after its player intersects the viewport.
  host.setAttribute('aria-hidden', 'true');
  host.inert = true;
  host.style.cssText = 'position:fixed;inset:0 auto auto 0;width:64px;height:64px;visibility:hidden;pointer-events:none';
  document.body.appendChild(host);
  const removeHost = () => host.remove();
  signal.addEventListener('abort', removeHost, { once: true });
  const { object, solved, Move, setSolidFoundation, dispose } = await mountTimedCubingCube(host, signal).finally(() => {
    signal.removeEventListener('abort', removeHost);
    removeHost();
  });
  try {
    // Cube3D uses cubing.js's version of Three. Its Object3D, meshes and basic
    // materials implement the same scene graph interface used for replay capture.
    const scene = mountReplayScene(host, object as unknown as Object3D, { interactive: false, framingSize: 1 });
    let pattern = solved;
    let turn: { move: InstanceType<typeof Move>; direction: 1; fraction: number } | undefined;
    const parsed = new Map<string, InstanceType<typeof Move>>();
    const moveFor = (token: string) => {
      const cached = parsed.get(token);
      if (cached) return cached;
      const move = new Move(normalizeAlgForTwisty('3x3', token));
      parsed.set(token, move);
      return move;
    };
    return {
      setup(steps: readonly string[]) {
        pattern = steps.reduce((state, token) => state.applyMove(moveFor(token)), solved);
        turn = undefined;
      },
      commit(token: string) {
        pattern = pattern.applyMove(moveFor(token));
        turn = undefined;
      },
      animate(token: string, progress: number) {
        turn = progress > 0 ? { move: moveFor(token), direction: 1, fraction: fractionForAngle(progress) } : undefined;
      },
      capture(edge: number) {
        object.onPositionChange({ pattern, movesInProgress: turn ? [turn] : [] });
        return scene.capture(edge);
      },
      setSolidFoundation,
      dispose() {
        try { scene.dispose(); } finally { dispose(); }
      },
    };
  } catch (cause) {
    dispose();
    throw cause;
  }
}
