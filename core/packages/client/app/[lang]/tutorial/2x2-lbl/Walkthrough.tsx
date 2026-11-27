'use client';

import { useRef, useState } from 'react';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { syncPlayerToMoveCount } from '@/lib/recon-alg-utils';
import { CUBE_FRAMING_EDGE } from '../components/InteractiveTutorial';
import WalkthroughPane, { type WalkthroughAlgGroup } from '../components/WalkthroughPane';
import { TWO_BY_TWO_WALKTHROUGH } from './lesson-data';
import { randomTwoByTwoWalkthrough, type WalkthroughCase } from './walkthrough-data';

function makeTimeline({ scramble, phases }: WalkthroughCase) {
  let moveCount = 0;
  let id = 0;
  const timeline = phases.map(phase => ({
    ...phase,
    steps: phase.steps.map(step => {
      const from = moveCount;
      const turns = step.alg.split(/\s+/).filter(Boolean);
      moveCount += turns.length;
      return { ...step, id: id++, from, turns, algGroups: groupAlg(step.alg, turns, step.formula) };
    }),
  }));
  const steps = timeline.flatMap(phase => phase.steps);
  const alg = steps.flatMap(step => step.alg ? [step.alg] : []).join(' ');
  const markers = timeline.slice(1).flatMap(phase => {
    const first = phase.steps.find(step => step.alg);
    return first && first.from > 0 ? [first.from] : [];
  });
  return { scramble, timeline, steps, alg, markers };
}

type TimelineStep = ReturnType<typeof makeTimeline>['steps'][number];

function groupAlg(alg: string, turns: readonly string[], repeatedAlg?: string): WalkthroughAlgGroup[] {
  if (!repeatedAlg) return turns.length ? [{ turns }] : [];
  let setup = alg;
  let repeats = 0;
  while (setup === repeatedAlg || setup.endsWith(` ${repeatedAlg}`)) {
    setup = setup.slice(0, -repeatedAlg.length).trimEnd();
    repeats++;
  }
  const round = repeatedAlg.split(' ');
  const setupLength = turns.length - repeats * round.length;
  return [
    ...(setupLength > 0 ? [{ turns: turns.slice(0, setupLength) }] : []),
    ...Array.from({ length: repeats }, () => ({ turns: round, bracketed: true })),
  ];
}

export default function Walkthrough() {
  const player = useRef<AlgPlayerHandle>(null);
  const [move, setMove] = useState(0);
  const [walkthrough, setWalkthrough] = useState(() => makeTimeline(TWO_BY_TWO_WALKTHROUGH));
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selectedStep, setSelectedStep] = useState<TimelineStep | null>(null);
  const { scramble, timeline, steps, alg, markers } = walkthrough;
  // AlgSimPlayer reports the destination step as soon as it starts animating a turn.
  const activeTurn = move - 1;
  const current = selectedStep ?? steps.findLast(step => step.turns.length > 0 && step.from <= activeTurn) ?? steps[0];

  function updateMove(nextMove: number) {
    setMove(nextMove);
    setSelectedStep(step => step?.from === nextMove ? step : null);
  }

  function seek(id: number) {
    const step = steps[id];
    setSelectedStep(step);
    syncPlayerToMoveCount(player.current?.getPlayer(), step.from);
  }

  async function shuffle() {
    setLoading(true);
    setFailed(false);
    try {
      setWalkthrough(makeTimeline(await randomTwoByTwoWalkthrough(scramble)));
      setMove(0);
      setSelectedStep(null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return <WalkthroughPane scramble={scramble} onRandomCase={shuffle} loading={loading} failed={failed}
    stages={timeline} currentStep={current.id} title={current.title} note={current.note} algGroups={current.algGroups}
    position={move} activeTurn={activeTurn - current.from} onSeek={seek}
    cube={<AlgPlayer key={scramble} ref={player} puzzle="2x2" set="" orientation="" engine="sim" fillPane
      maxFramingEdge={CUBE_FRAMING_EDGE} setup={scramble} alg={alg}
      stepMarkers={markers} pauseAfterSteps={markers} sectionPauseMs={600} moveDurationMs={720} onStepChange={updateMove} />}
  />;
}
