import { useEffect, useMemo, useRef, useState } from 'react';
import { prepareReconstruction, type ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { createLiveReconstructionStream, type AnalysisInput } from '@cuberoot/timer-ui/reconstruct-analysis';
import NotationLine from '@cuberoot/timer-ui/recon/NotationLine';
import { crossColorFromLabels } from '@/components/CubeColorChip/CubeColorChip';
import { tr, useLang } from '@/i18n/tr';
import type { MoveStep } from '@/lib/video-recon/engine/move-search-types';

type Moves = AnalysisInput['text']['moves'];

function matchingMoves(before: Moves, after: Moves) {
  const mismatch = before.findIndex((move, i) => move.m !== after[i]?.m || move.ts !== after[i]?.ts);
  return mismatch < 0 ? before.length : mismatch;
}

export function LiveVideoNotation({ scramble, steps, frame, fps, start }: {
  scramble: string; steps: readonly MoveStep[]; frame: number; fps: number; start: number;
}) {
  const language = useLang();
  const stream = useRef<ReturnType<typeof createLiveReconstructionStream> | null>(null);
  const submitted = useRef<Moves>([]);
  const [report, setReport] = useState<{ moves: Moves; lines: ReconTextLine[]; language: string }>();
  const moves = useMemo(() => steps.filter(step => step.frame_index <= frame).flatMap(step =>
    step.state_moves.map(m => ({ m, ts: Math.round(Math.max(0, step.frame_index / fps - start) * 1000) }))),
  [steps, frame, fps, start]);

  useEffect(() => {
    submitted.current = [];
    const live = createLiveReconstructionStream((input, snapshot) => {
      if (snapshot.text && input.text.physical) setReport({
        moves: input.text.physical.moves, lines: snapshot.text.lines, language: input.text.language ?? language,
      });
    });
    stream.current = live;
    return () => { live.dispose(); stream.current = null; };
  }, [scramble, language]);

  useEffect(() => {
    if (!scramble || !moves.length) return;
    if (submitted.current.length === moves.length && matchingMoves(submitted.current, moves) === moves.length) return;
    submitted.current = moves;
    const timeMs = moves[moves.length - 1].ts;
    const { text } = prepareReconstruction({ scramble, moves, timeMs }, 'cfop', language);
    if (text) stream.current?.update({ text, scoreable: false, detectLiveMethod: true });
  }, [scramble, moves, language]);

  // Search can replace an earlier candidate. Keep only boundaries whose raw prefix still matches.
  const matched = report?.language === language ? matchingMoves(report.moves, moves) : 0;
  const stages = report?.lines.filter(line => line.key !== 'tail' && line.toIdx < matched) ?? [];
  const crossColor = crossColorFromLabels(stages.map(line => line.label));
  let from = 0;
  const rows = stages.map(stage => {
    const raw = moves.slice(from, stage.toIdx + 1).map(move => move.m).join(' ');
    from = stage.toIdx + 1;
    return <NotationLine key={stage.key} line={stage.label ? `${raw} // ${stage.label}` : raw}
      crossColor={crossColor} localize={tr} renderLink={(_, children) => children} />;
  });
  if (!moves.length) return null;
  return <div className="video-recon-notation video-recon-live-notation">
    {rows}
    {from < moves.length && <span>{moves.slice(from).map(move => move.m).join(' ')}</span>}
  </div>;
}
