import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { LiveSmartCubeAnchor, type LiveSmartCubeAnchorSnapshot } from '@cuberoot/shared/smart-cube/anchor';
import { createSmartCubeGuidanceController, type SmartCubeGuidanceState } from '@cuberoot/shared/smart-cube/scramble-guidance';
import { smartCubeFixupState } from '@cuberoot/shared/smart-cube/scramble-hint';
import { observeSmartPractice, smartPracticeSetup, smartPracticeTurns, type SmartPracticeAttempt } from './practice-smart-cube';

export type PracticeCubeMove = (move: string, timestamp: number, facelets: string) => void;
const emptyAnchor: LiveSmartCubeAnchorSnapshot = { moves: [], algAnchored: false };
const solve333: ConstructorParameters<typeof LiveSmartCubeAnchor>[0]['solve'] =
  async state => (await import('@/lib/kociemba/random_state')).solve333(state);

export function usePracticeSmartCube(
  setup: string,
  connected: boolean,
  facelets: string | null,
  onMove: RefObject<PracticeCubeMove | null>,
  matchesGoal: (attempt: SmartPracticeAttempt) => boolean,
) {
  const start = useMemo(() => smartPracticeSetup(setup), [setup]);
  const [anchor, setAnchor] = useState(emptyAnchor);
  const [guidance, setGuidance] = useState<SmartCubeGuidanceState>();
  const [attempt, setAttempt] = useState<SmartPracticeAttempt | null>(null);
  const [finish, setFinish] = useState<{ attempt: SmartPracticeAttempt; anchor: LiveSmartCubeAnchorSnapshot }>();
  const goalReached = useEffectEvent(matchesGoal);
  const reset = useRef<(() => void) | null>(null);
  const syncFacelets = useRef<((value: string) => void) | null>(null);

  useLayoutEffect(() => {
    if (!connected) return;
    const mirror = new LiveSmartCubeAnchor({ solve: solve333, onChange: setAnchor });
    const guide = createSmartCubeGuidanceController({
      onChange: setGuidance,
      solve: async (from, target) => {
        const state = smartCubeFixupState(from, target);
        return state ? solve333(state) : null;
      },
    });
    mirror.setConnection('lbl-practice');
    guide.setConnected(true);
    let attemptId = 0;
    let current: SmartPracticeAttempt | null = null;
    let finished = false;
    guide.setContext({ id: attemptId, ...start });

    const observe = (value: string, move?: string) => {
      mirror.observeFacelets(value);
      const next = observeSmartPractice(current, value, start, move);
      if (next === current) return;
      current = next;
      if (finished) return;
      setAttempt(next);
      if (next.started) {
        guide.setRunning(true);
        if (next.history !== '' && goalReached(next)) {
          finished = true;
          setFinish({ attempt: next, anchor: mirror.getSnapshot() });
        }
      } else if (move) guide.observe(value, move);
      else guide.syncFacelets(value);
    };
    syncFacelets.current = observe;
    onMove.current = (move, timestamp, value) => {
      mirror.move(move, timestamp);
      observe(value, move);
    };
    reset.current = () => {
      const value = current?.facelets;
      current = null;
      finished = false;
      setFinish(undefined);
      guide.setRunning(false);
      guide.setContext({ id: ++attemptId, ...start });
      if (value) observe(value);
    };
    return () => {
      onMove.current = null;
      syncFacelets.current = null;
      reset.current = null;
      guide.dispose();
      mirror.setConnection(null);
    };
  }, [connected, onMove, start]);

  useEffect(() => {
    if (facelets) syncFacelets.current?.(facelets);
  }, [connected, facelets]);

  const displayedAnchor = finish?.anchor ?? anchor;
  const position = useMemo(() => displayedAnchor.algAnchored
    ? { turns: smartPracticeTurns(displayedAnchor.moves), pose: start.pose }
    : undefined, [displayedAnchor, start.pose]);
  return { attempt: finish?.attempt ?? attempt, finished: !!finish, guidance: guidance?.hint, position, orientation: start.orientation, reset };
}
