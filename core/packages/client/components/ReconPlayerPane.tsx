'use client';
/**
 * Recon scramble/solution live preview — shared by the recon submit form and the
 * add/edit-alternative form so both render an identical player: SQ1 gets the
 * cuber-engine Sq1ReconPlayer, NxN puzzles get a cuber/cubing.js engine toggle,
 * everything else gets the cubing.js TwistySection. Always forces the back-view
 * mini window. Debounces scramble/solution internally so callers can pass raw,
 * every-keystroke values.
 */
import { useCallback, useEffect, useState, type MutableRefObject } from 'react';
import TwistySection from './TwistySection';
import Sq1ReconPlayer from './Sq1ReconPlayer';
import CuberReconPlayer from './CuberReconPlayer';
import { cleanForPlayer } from '@/lib/recon-alg-utils';
import { getPuzzleId } from '@/lib/recon-utils';
import { persistItem } from '@/lib/safe-storage';
import { tr } from '@/i18n/tr';

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
  const puzzle = event ? getPuzzleId(event) : '3x3x3';
  const isNxnPuzzle = /^[2-7]x[2-7]x[2-7]$/.test(puzzle);
  const nxnOrder = isNxnPuzzle ? parseInt(puzzle, 10) : 3;

  const [reconEngine, setReconEngine] = useState<'cuber' | 'cubing'>(() => {
    if (typeof window === 'undefined') return 'cuber';
    try { return localStorage.getItem('recon.player.engine') === 'cubing' ? 'cubing' : 'cuber'; }
    catch { return 'cuber'; }
  });
  const pickEngine = useCallback((e: 'cuber' | 'cubing') => {
    setReconEngine(e);
    persistItem('recon.player.engine', e);
  }, []);

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

  const engineToggle = isNxnPuzzle ? (
    <div className="submit-engine-toggle" role="radiogroup" aria-label={tr({ zh: '渲染引擎', en: 'Render engine' })}>
      <button
        type="button" role="radio" aria-checked={reconEngine === 'cuber'}
        className={`submit-engine-opt${reconEngine === 'cuber' ? ' active' : ''}`}
        onClick={() => pickEngine('cuber')}
      >cuberoot</button>
      <button
        type="button" role="radio" aria-checked={reconEngine === 'cubing'}
        className={`submit-engine-opt${reconEngine === 'cubing' ? ' active' : ''}`}
        onClick={() => pickEngine('cubing')}
      >cubing.js</button>
    </div>
  ) : null;

  let player: React.ReactNode;
  if (event === 'sq1') {
    player = (
      <Sq1ReconPlayer scramble={debouncedScramble} alg={debouncedSolution} playerRef={playerRef} fillPane={fillPane} backView={backView} />
    );
  } else if (isNxnPuzzle && reconEngine === 'cuber') {
    player = (
      <CuberReconPlayer
        scramble={debouncedScramble}
        alg={cleanForPlayer(debouncedSolution)}
        order={nxnOrder}
        playerRef={playerRef}
        fillPane={fillPane}
      />
    );
  } else {
    player = (
      <TwistySection
        puzzle={puzzle}
        scramble={debouncedScramble}
        alg={cleanForPlayer(debouncedSolution)}
        playerRef={playerRef}
        fillPane={fillPane}
        backView={backView}
      />
    );
  }
  return <>{engineToggle}{player}</>;
}
