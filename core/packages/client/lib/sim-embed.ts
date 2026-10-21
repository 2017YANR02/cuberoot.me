import { HOME_SCENE_ROT } from '@cuberoot/puzzle-render-core/engine/viewControls';
import type { AlgPlayerInteractionMode } from '@/components/AlgPlayer/AlgPlayer';

/** Public iframe contract. Keep untrusted query values bounded before mounting WebGL. */
export function parseSimEmbedParams(params: URLSearchParams) {
  const number = (key: string, fallback: number, min: number, max: number) => {
    const raw = params.get(key);
    const value = raw?.trim() ? Number(raw) : NaN;
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  };
  const order = Math.round(number('puzzle', 3, 2, 5));
  const drag = params.get('drag');
  const interactionMode: AlgPlayerInteractionMode = drag === '0' || drag === 'none'
    ? 'none' : drag === 'turn' ? 'turn' : 'view';
  const caseAlg = params.get('case');
  return {
    puzzle: `${order}x${order}` as '2x2' | '3x3' | '4x4' | '5x5',
    // Match the image endpoint: alg/setup are forward; case is inverse.
    alg: (caseAlg ?? '').slice(0, 4096),
    setup: caseAlg === null ? (params.get('alg') ?? params.get('setup') ?? '').slice(0, 4096) : undefined,
    set: (params.get('stickering') ?? 'full').slice(0, 64),
    sceneRot: {
      x: number('pitch', HOME_SCENE_ROT.x * 180 / Math.PI, -90, 90) * Math.PI / 180,
      y: -number('yaw', -HOME_SCENE_ROT.y * 180 / Math.PI, -180, 180) * Math.PI / 180,
      z: 0,
    },
    interactionMode,
    lockView: params.get('lockView') === '1',
  };
}
