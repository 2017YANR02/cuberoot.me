import { renderWcaPreviewSvg } from '@cuberoot/puzzle-render-core/wca-preview-svg';
import { renderCubeNetSvg } from '@cuberoot/puzzle-render-core/support/cube-net-svg';
import { CUBE_FILL } from '@cuberoot/puzzle-render-core/support/cube-colors';
import { timerWcaScrambleEventId } from '@cuberoot/shared/timer/event-catalog';
import type { EventId } from '@cuberoot/shared/timer/types';

/** Only adapts the shared renderer's output to a native image source. No puzzle model here. */
export function nativeTimerPreview(event: EventId, scramble: string, facelets?: string | null): string {
  const wcaEvent = timerWcaScrambleEventId(event);
  const svg = facelets
    ? renderCubeNetSvg({ order: 3, serialized: facelets, faceColors: CUBE_FILL })
    : wcaEvent ? renderWcaPreviewSvg({ event: wcaEvent, scramble }) : null;
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '';
}
