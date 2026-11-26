'use client';

import { Axis } from '@cuberoot/visualcube';
import { reviewCamera } from '@cuberoot/timer-ui/reconstruct/replay-view';
import { visualCubeSchemeForOrientation } from '@/lib/cube-orientation';
import { VisualCube } from './VisualCube';

/** Setup includes the review colour frame. The viewport only moves the eye. */
export function ReplayPracticeCube({setup, slot, set, size, alt}: {setup:string; slot?:string; set:string; size:number; alt?:string}) {
  const camera = reviewCamera(slot, set);
  const degrees = -180 / Math.PI;
  return <VisualCube setup={setup} view="iso" size={size} alt={alt} local scheme={visualCubeSchemeForOrientation('')}
    viewportRotations={[[Axis.Y, camera.y * degrees], [Axis.X, camera.x * degrees]]}/>;
}
