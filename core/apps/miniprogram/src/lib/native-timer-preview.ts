import { renderWcaPreviewSvg } from '@cuberoot/puzzle-render-core/wca-preview-svg';
import { renderCubeNetSvg } from '@cuberoot/puzzle-render-core/support/cube-net-svg';
import { CUBE_FILL } from '@cuberoot/puzzle-render-core/support/cube-colors';
import { renderIvyScrambleSvg } from '@cuberoot/puzzle-render-core/ivy-svg';
import { renderMagicSvg } from '@cuberoot/puzzle-render-core/magic-svg';
import { renderNativePuzzleSvg } from '@cuberoot/puzzle-render-core/native-puzzle-svg';
import { renderPyraminxDuoSvg } from '@cuberoot/puzzle-render-core/pyraminx-duo-svg';
import { renderCubeSVG } from '@cuberoot/visualcube/render';
import { isPgInteractionPuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { timerRelayPreviewScramble } from '@cuberoot/shared/timer/compound-scramble';
import { timerEventNxnSize, timerWcaScrambleEventId } from '@cuberoot/shared/timer/event-catalog';
import { createTimerWorkerRpc } from '@cuberoot/shared/timer/worker-rpc';
import type { EventId } from '@cuberoot/shared/timer/types';
import { TIMER_SMART_CUBE_LIVE_VIEWS, type TimerSmartCubeSettings } from '@cuberoot/shared/timer/settings-contract';
import { openNativeTimerWorkerPort } from './native-timer-worker';

function timerPreviewSvg(event: EventId, scramble: string): string | null {
  // A multi-blind scramble contains independent puzzles. The shared solo
  // timer also has no single-cube preview for this event.
  if (event === '333mbld') return null;
  if (isPgInteractionPuzzleId(event)) return renderNativePuzzleSvg(event, scramble);
  switch (event) {
    case 'magic': case 'mmagic': return renderMagicSvg(event, scramble);
    case 'ivy': return renderIvyScrambleSvg(scramble);
    case 'pyraminx_duo': return renderPyraminxDuoSvg(scramble);
    case 'sphere': return null;
    case 'r3': case 'r4': case 'r5': return renderWcaPreviewSvg({ event: '333', scramble: timerRelayPreviewScramble(scramble) });
    case 'custom': return renderWcaPreviewSvg({ event: '333', scramble });
  }
  const wcaEvent = timerWcaScrambleEventId(event);
  if (wcaEvent) return renderWcaPreviewSvg({ event: wcaEvent, scramble });
  const order = timerEventNxnSize(event);
  return order ? renderWcaPreviewSvg({ event: `nxn${order}`, scramble }) : null;
}

/** Adapt the shared renderer's output to a native image source. */
export function nativeTimerPreview(event: EventId, scramble: string, facelets?: string | null): string {
  const svg = facelets
    ? renderCubeNetSvg({ order: 3, serialized: facelets, faceColors: CUBE_FILL })
    : timerPreviewSvg(event, scramble);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '';
}

export const NATIVE_TIMER_LIVE_VIEWS = TIMER_SMART_CUBE_LIVE_VIEWS.filter(view => view !== 'twizzle');
type NativeTimerLiveView = (typeof NATIVE_TIMER_LIVE_VIEWS)[number];

export function nativeTimerLiveView(view: TimerSmartCubeSettings['liveCubeView']): NativeTimerLiveView {
  return view === 'twizzle' ? '3d' : view;
}

export function nativeTimerLiveCubeImage(facelets: string, view: NativeTimerLiveView): string {
  if (view === '3d' || view === 'net') return nativeTimerPreview('333', '', facelets.toUpperCase());
  const svg = renderCubeSVG({ width: 88, height: 88, cubeSize: 3, facelets: facelets.toLowerCase().split(''),
    ...(view === 'q2look' ? { view } : {}) });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function workerPreviewPuzzle(event: EventId) {
  switch (event) {
    case 'fto': case 'kilominx': case 'sphere': return event;
    case 'redi': return 'redi_cube';
    default: return null;
  }
}

export function nativeTimerUsesAsyncPreview(event: EventId): boolean {
  return workerPreviewPuzzle(event) !== null;
}

export async function nativeTimerPreviewAsync(event: EventId, scramble: string, signal?: AbortSignal): Promise<string> {
  const puzzle = workerPreviewPuzzle(event);
  if (!puzzle) return nativeTimerPreview(event, scramble);
  const rpc = createTimerWorkerRpc<{ puzzle: typeof puzzle; scramble: string }, string | null>({
    createWorker: () => openNativeTimerWorkerPort('timer-preview'),
    makeRequest: (id, request) => ({ id, request }),
    label: 'Native timer preview',
  });
  try {
    const svg = await rpc.request({ puzzle, scramble }, signal, 20_000);
    return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '';
  } finally {
    rpc.dispose();
  }
}
