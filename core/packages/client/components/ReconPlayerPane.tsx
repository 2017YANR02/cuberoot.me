'use client';
/**
 * Recon scramble/solution live preview — shared by the recon submit form and the
 * add/edit-alternative form so both render an identical player. Engine selection is
 * delegated to ReconEnginePlayer (SQ1 / NxN → in-house cuber engine, else → cubing.js
 * TwistySection); this wrapper owns the submit-flow specifics: an always-on back-view
 * mini window, and debouncing scramble/solution so callers can pass raw, every-keystroke
 * values.
 */
import { useEffect, useState, type MutableRefObject } from 'react';
import ReconEnginePlayer from './recon/ReconEnginePlayer';

interface Props {
  event: string | undefined;
  scramble: string;
  solution: string;
  fillPane?: boolean;
  backView?: boolean;
  debounceMs?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: MutableRefObject<any>;
}

export default function ReconPlayerPane({
  event, scramble, solution, fillPane = true, backView = true, debounceMs = 500, playerRef,
}: Props) {
  const [debouncedScramble, setDebouncedScramble] = useState(scramble);
  const [debouncedSolution, setDebouncedSolution] = useState(solution);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedScramble(scramble);
      setDebouncedSolution(solution);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [scramble, solution, debounceMs]);

  if (!event) return null;

  return (
    <ReconEnginePlayer
      event={event}
      scramble={debouncedScramble}
      solution={debouncedSolution}
      playerRef={playerRef}
      fillPane={fillPane}
      backView={backView}
    />
  );
}
