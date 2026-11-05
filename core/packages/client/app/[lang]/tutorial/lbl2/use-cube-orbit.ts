import { useEffect, useRef, useState, type RefObject } from 'react';
import type { AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';

/** LBL2 slow, view-only tour; touching the cube pauses it. */
export function useCubeOrbit(player: RefObject<AlgPlayerHandle | null>, identity: string) {
  const [orbitPlaying, setOrbitPlaying] = useState(false);
  const orbitTime = useRef(0);
  useEffect(() => {
    orbitTime.current = 0;
    setOrbitPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, [identity]);
  useEffect(() => {
    if (!orbitPlaying) return;
    // A continuous view-only tour: turn sideways, tilt to see underneath, return.
    const pose = (phase: number) => {
      const tilt = Math.sin(phase);
      // All piece types share the same extra 14° of underside visibility.
      const underside = tilt < 0 ? .24 * tilt * tilt : 0;
      return { x: .72 * tilt - underside, y: -phase + Math.sin(phase) };
    };
    // Traverse the existing path by angular distance so the combined tilt and
    // sideways rotation stay at a constant speed throughout each 27-second lap.
    const samples = [{ phase: 0, distance: 0 }];
    let previous = pose(0);
    for (let i = 1; i <= 2048; i++) {
      const phase = i / 2048 * Math.PI * 2;
      const next = pose(phase);
      samples.push({ phase, distance: samples[i - 1].distance + Math.hypot(next.x - previous.x, next.y - previous.y) });
      previous = next;
    }
    const pathLength = samples[samples.length - 1].distance;
    const poseAtTime = (time: number) => {
      const lap = Math.floor(time / 27000);
      const distance = time % 27000 / 27000 * pathLength;
      let low = 0;
      let high = samples.length - 1;
      while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (samples[middle].distance <= distance) low = middle;
        else high = middle;
      }
      const start = samples[low];
      const end = samples[high];
      const fraction = (distance - start.distance) / (end.distance - start.distance);
      const position = pose(start.phase + (end.phase - start.phase) * fraction);
      return { x: position.x, y: position.y - lap * Math.PI * 2 };
    };
    let frame = 0;
    let last: number | undefined;
    const tick = (now: number) => {
      // Lazy-loaded players must be ready before the tour starts advancing.
      if (!player.current?.orbitView || player.current.isUserMovePending?.()) {
        last = undefined;
        frame = requestAnimationFrame(tick);
        return;
      }
      const elapsed = last === undefined ? 0 : Math.min(now - last, 50);
      last = now;
      const before = poseAtTime(orbitTime.current);
      orbitTime.current += elapsed;
      const after = poseAtTime(orbitTime.current);
      player.current?.orbitView?.(after.y - before.y, after.x - before.x);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [identity, orbitPlaying]);
  return () => setOrbitPlaying(false);
}
