'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import { Alg } from 'cubing/alg';
import type { AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import CaseFlowGraph from './CaseFlowGraph';
import { f2lDiagramFacelets } from '../lib/cube-preview';
import type { f2lTeachingPaths } from '../lib/curriculum';

type Lesson = ReturnType<typeof f2lTeachingPaths>[number];

/** The selected teaching algorithm only; practice retains its branching graph. */
export default function TeachingFlowGraph({ lesson, orientation, step, player }: {
  lesson: Lesson; orientation: string; step: number; player: RefObject<AlgPlayerHandle | null>;
}) {
  const [moving, setMoving] = useState(false);
  const [position, setPosition] = useState(step);
  const points = useMemo(() => {
    const moves = Array.from(new Alg(lesson.alg).expand().childAlgNodes(), move => move.toString());
    return [0, ...lesson.sections.map(section => section.end)].map((end, index) => ({
      name: index === lesson.sections.length ? 'solved' : lesson.chain[index],
      step: end,
      facelets: f2lDiagramFacelets(`${lesson.setup} ${moves.slice(0, end).join(' ')}`, orientation),
    }));
  }, [lesson, orientation]);
  useEffect(() => {
    let frame = 0;
    const started = performance.now();
    let animated: boolean | undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const observe = (now: number) => {
      const pending = !!player.current?.isUserMovePending?.(false);
      // The player enqueues its turn after React effects, before this frame.
      animated ??= pending && step > 0;
      setMoving(pending);
      // Start at the source node, including when a progress path first mounts.
      // Pending moves stay short of the destination until the cube settles.
      const progress = Math.min(pending ? .95 : 1, (now - started) / 350);
      setPosition(animated && !reducedMotion ? step - 1 + progress : step);
      if (pending || (animated && !reducedMotion && progress < 1)) frame = requestAnimationFrame(observe);
    };
    frame = requestAnimationFrame(observe);
    return () => cancelAnimationFrame(frame);
  }, [step, lesson, player]);
  return <div className="f2l-flow-graph f2l-teaching-flow">
    <CaseFlowGraph viewBox={`0 -8 560 ${lesson.sections.length * 180 + 134}`}
      nodes={points.map((point, index) => ({
        ...point, x: 280, y: index * 180,
        selected: true, current: position === point.step, visited: position > point.step,
        onSelect: () => { const instance = player.current?.getPlayer(); if (instance) instance.timestamp = point.step; },
      }))}
      edges={points.slice(1).flatMap((point, index) => {
        const start = points[index].step;
        const progress = Math.max(0, Math.min(1, (position - start) / (point.step - start)));
        const current = position > start && position < point.step;
        const edge = { from: points[index].name, to: point.name,
          selected: progress > 0, complete: progress === 1, current, moving: current && moving, progress };
        const y = index * 180;
        return [{ ...edge, d: index % 2 === 0
          ? `M 325 ${y + 53} H 510 Q 542 ${y + 53} 542 ${y + 85} V ${y + 201} Q 542 ${y + 233} 510 ${y + 233} H 325`
          : `M 235 ${y + 53} H 50 Q 18 ${y + 53} 18 ${y + 85} V ${y + 201} Q 18 ${y + 233} 50 ${y + 233} H 235` }];
      })} />
  </div>;
}
