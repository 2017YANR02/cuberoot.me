'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { CompactSelect } from '@/components/CompactSelect';
import CaseFlowGraph, { flowLabel as label } from '../components/CaseFlowGraph';
import Link from '@/components/AppLink';
import { tr, T } from '@/i18n/tr';
import { f2lDiagramFacelets } from '../lib/cube-preview';
import catalog from '../data/alg-snapshot.json';
import snapshot from '../data/x-plus-flow.json';
import './flowchart.css';

const NO_STOPS: readonly number[] = [];
const FLOW_MASK = stickeringMaskFn(3, 'F2LOverview')!;
const NODES = [
  { name: 'X+', x: 205, y: 0 },
  { name: 'U+', x: 65, y: 140 },
  { name: 'L+', x: 345, y: 140 },
  { name: 'A+', x: 65, y: 280 },
  { name: 'B+', x: 345, y: 280 },
  { name: 'solved', x: 205, y: 440 },
];
const EDGES = [
  { from: 'X+', to: 'U+', d: 'M 160 53 H 89 Q 65 53 65 77 V 132' },
  { from: 'U+', to: 'A+', d: 'M 65 246 V 272' },
  { from: 'A+', to: 'solved', d: 'M 65 386 V 469 Q 65 493 89 493 H 152' },
  { from: 'X+', to: 'L+', d: 'M 250 53 H 321 Q 345 53 345 77 V 132' },
  { from: 'L+', to: 'B+', d: 'M 345 246 V 272' },
  { from: 'B+', to: 'solved', d: 'M 345 386 V 469 Q 345 493 321 493 H 258' },
  { from: 'X+', to: 'B+', d: 'M 205 106 V 309 Q 205 333 229 333 H 292' },
  { from: 'X+', to: 'solved', d: 'M 250 26 H 422 Q 446 26 446 50 V 546 Q 446 570 422 570 H 229 Q 205 570 205 554' },
];

// Remount only this experiment when switching source algorithms or color frames.
// All eight methods keep the same starting state, not their individual inverse.
export default function FlowchartLesson({ pathId, onPathChange, ...props }: {
  orientation: string; pauseBetween: boolean; pathId: string; onPathChange: (id: string) => void;
}) {
  const path = snapshot.paths.find(item => item.id === pathId)!;
  const pathLabel = (item: typeof path) => `${item.sourceIndex}. ${item.checkpoints.map(point => label(point.name)).join(' → ')}`;
  return <div className="f2l-flow-lab">
    <div className="f2l-flow-toolbar">
      <CompactSelect value={pathId} label={pathLabel(path)} ariaLabel={tr({ zh: '选择 X+ 公式', en: 'Choose an X+ algorithm' })}
        items={snapshot.paths.map(item => ({ value: item.id, label: pathLabel(item) }))} onChange={onPathChange} />
      <Link href="/alg/3x3/f2l/x+" prefetch={false}><T zh="X+ 公式库" en="X+ algorithms" /></Link>
    </div>
    <FlowPlayback key={`${pathId}:${props.orientation}`} path={path} onPathChange={onPathChange} {...props} />
  </div>;
}

function FlowPlayback({ path, orientation, pauseBetween, onPathChange }: {
  path: typeof snapshot.paths[number]; orientation: string; pauseBetween: boolean; onPathChange: (id: string) => void;
}) {
  const player = useRef<AlgPlayerHandle>(null);
  const [step, setStep] = useState(0);
  const [moving, setMoving] = useState(false);
  const moves = useMemo(() => path.alg.split(/\s+/), [path]);
  const sections = useMemo(() => path.checkpoints.slice(1).map((point, index) => ({
    from: path.checkpoints[index].name, to: point.name,
    start: path.checkpoints[index].step, end: point.step,
    alg: moves.slice(path.checkpoints[index].step, point.step).join(' '),
  })), [moves, path]);
  const stops = useMemo(() => sections.slice(0, -1).map(section => section.end), [sections]);
  const diagrams = useMemo(() => NODES.map(node => {
    const checkpoint = path.checkpoints.find(point => point.name === node.name);
    const setup = checkpoint ? `${snapshot.setup} ${moves.slice(0, checkpoint.step).join(' ')}`
      : node.name === 'solved' ? '' : catalog.cases.find(item => item.name === node.name)!.setup;
    return f2lDiagramFacelets(setup, orientation, FLOW_MASK);
  }), [moves, orientation, path]);

  // The step callback fires as a turn starts. Wait for the existing engine's
  // backlog to clear before highlighting the reached case, including after seeks.
  useEffect(() => {
    let frame: number;
    let cancelled = false;
    const observe = () => {
      if (cancelled) return;
      const pending = !!player.current?.isUserMovePending?.(false);
      setMoving(pending);
      if (pending) frame = requestAnimationFrame(observe);
    };
    frame = requestAnimationFrame(observe);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [step]);

  const position = moving && step > 0 ? step - 0.5 : step;
  const currentPoint = path.checkpoints.find(point => point.step === position);
  const activeSection = sections.find(section => position > section.start && position < section.end);
  const seek = (target: number) => {
    const instance = player.current?.getPlayer();
    if (instance) instance.timestamp = target;
  };

  return <div className="f2l-flow-layout">
    <section className="f2l-flow-player">
      <div className="f2l-flow-cube"><AlgPlayer ref={player} puzzle="3x3" set="f2l-overview" engine="sim"
        setup={snapshot.setup} alg={path.alg} orientation={orientation} fillPane moveDurationMs={850}
        onStepChange={setStep} stepMarkers={stops} pauseAfterSteps={pauseBetween ? stops : NO_STOPS} sectionPauseMs={2000} /></div>
      <div className="f2l-flow-alg" aria-label={tr({ zh: '复原公式分段', en: 'Solution sections' })}>
        {sections.map(section => <button type="button" className="f2l-flow-alg-step" key={section.end} onClick={() => seek(section.end)}
          aria-label={`${label(section.from)} → ${label(section.to)}: ${section.alg}`}
          aria-current={activeSection === section ? 'step' : undefined}>
          <code>({section.alg})</code>
        </button>)}
      </div>
      <p className="f2l-flow-status" role="status">
        {currentPoint ? label(currentPoint.name) : activeSection ? `${label(activeSection.from)} → ${label(activeSection.to)}` : 'X+'}
        <span>{step} / {moves.length}</span>
      </p>
      <p className="f2l-flow-scramble"><T zh="打乱:" en="Scramble:" /> <code>{snapshot.setup}</code></p>
    </section>
    <section className="f2l-flow-graph" aria-label={tr({ zh: 'X+ case 转化流程图', en: 'X+ case transformation flowchart' })}>
      <CaseFlowGraph viewBox="0 -8 470 594" edges={EDGES.map(edge => {
          const section = sections.find(item => item.from === edge.from && item.to === edge.to);
          const active = !!section && section === activeSection;
          const progress = section ? Math.max(0, Math.min(1, (position - section.start) / (section.end - section.start))) : 0;
          const selectPath = () => {
            // Keep the chosen formula when several formulas share this edge.
            if (section) return;
            const next = snapshot.paths.find(candidate => candidate.checkpoints.some((point, index) =>
              point.name === edge.from && candidate.checkpoints[index + 1]?.name === edge.to));
            if (next) onPathChange(next.id);
          };
          return { ...edge, selected: !!section, complete: progress === 1, current: active, moving: active && moving, progress, onSelect: selectPath };
        })} nodes={NODES.map((node, index) => {
          const point = path.checkpoints.find(item => item.name === node.name);
          const current = currentPoint?.name === node.name;
          return { ...node, facelets: diagrams[index], selected: !!point, current, visited: !!point && position > point.step,
            receiving: activeSection?.to === node.name && moving, onSelect: point ? () => seek(point.step) : undefined };
        })} />
    </section>
  </div>;
}
