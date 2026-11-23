import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventId, SolveMove } from '@cuberoot/shared/timer';
import { closeVideoCamera, requestVideoCamera, type VideoCameraInput } from '@/lib/video-recon/engine/camera-source';
import { TIMER_TAIL_SECONDS, type TimerReconstructionResult } from '@/lib/video-recon/engine/cube-timer';
import type { VideoWorkspace } from '@/lib/video-recon/workspace';

type Attempt = { id: string; startClockMs: number; workspace: VideoWorkspace; scramble: string; file?: File };
export type CameraTimerResult = { id: string; event: EventId; elapsedMs: number; moves: SolveMove[] | null;
  inferredScramble?: string; fileRecovery?: boolean; liveMessage?: string; simulated?: boolean };
type Pending = Pick<CameraTimerResult, 'id' | 'event' | 'elapsedMs'> & Pick<Attempt, 'file' | 'scramble'>;

export async function cameraTimerMoves(result: TimerReconstructionResult, elapsedMs: number): Promise<SolveMove[] | null> {
  const { config, result: search } = result;
  if (result.status !== 'solved' || !config || !search) return null;
  const stop = config.requested_start_seconds + elapsedMs / 1000;
  // Extra camera frames can confirm the ending, but turns made after the timed
  // solve (allowing for a frame arriving late) do not belong to the score.
  const lastMoveFrame = Math.round((stop + TIMER_TAIL_SECONDS) * config.fps);
  const timedSteps = search.steps.filter(step => step.frame_index <= lastMoveFrame);
  const { observeVideoSolve } = await import('@/lib/video-recon/solve-analysis');
  const observation = observeVideoSolve(config.scramble, timedSteps, [],
    config.source_fps ?? config.fps, config.requested_start_seconds, stop, config.fps);
  if (!observation.moves.length) return null;
  const { checkReconCompletion } = await import('@cuberoot/shared/recon-completion');
  const completion = await checkReconCompletion({ event: '3x3', scramble: config.scramble, solution: observation.moves.map(move => move.m).join(' ') });
  return completion.status === 'solved' ? observation.moves.map(move => ({ ...move, ts: Math.min(elapsedMs, move.ts) })) : null;
}

/** The ordinary timer owns the clock and solve record; the camera owns the timed capture. */
export function useCameraTimerCapture(onResult: (result: CameraTimerResult) => void) {
  const [workspace, setWorkspace] = useState<VideoWorkspace>();
  const workspaceRef = useRef<VideoWorkspace>(undefined);
  const cameraRequest = useRef<Promise<VideoCameraInput>>(undefined);
  const simulationRequest = useRef<AbortController>(undefined);
  const recoveryRequest = useRef<AbortController>(undefined);
  const [recovery, setRecovery] = useState<{ id: string; workspace: VideoWorkspace }>();
  const activeAttempt = useRef<Attempt>(undefined);
  const pending = useRef(new Map<string, Pending>());
  const refresh = useRef<() => void>(undefined);
  const resultCallback = useRef(onResult);
  resultCallback.current = onResult;
  const [waiting, setWaiting] = useState(false);

  const cancelConnect = useCallback(() => {
    simulationRequest.current?.abort();
    simulationRequest.current = undefined;
    recoveryRequest.current?.abort();
    const request = cameraRequest.current;
    cameraRequest.current = undefined;
    void request?.then(closeVideoCamera, () => {});
  }, []);
  useEffect(() => cancelConnect, [cancelConnect]);

  const requestCamera = useCallback((request: Promise<VideoCameraInput>) => {
    if (workspaceRef.current) void workspaceRef.current.camera(request);
    else {
      cameraRequest.current = request;
      // Permission can be denied before the preview component is downloaded.
      void request.catch(() => {});
    }
  }, []);

  const connect = useCallback(() => {
    cancelConnect();
    requestCamera(requestVideoCamera());
  }, [cancelConnect, requestCamera]);

  const simulate = useCallback((file: File, onEnded: () => void) => {
    cancelConnect();
    const controller = new AbortController();
    simulationRequest.current = controller;
    requestCamera(import('@/lib/video-recon/engine/simulated-camera')
      .then(({ openSimulatedVideoCamera }) => openSimulatedVideoCamera(file, onEnded, controller.signal)));
  }, [cancelConnect, requestCamera]);

  const attach = useCallback((next?: VideoWorkspace) => {
    workspaceRef.current = next;
    setWorkspace(next);
    if (next && cameraRequest.current) {
      const request = cameraRequest.current;
      cameraRequest.current = undefined;
      void next.camera(request);
    }
  }, []);

  useEffect(() => {
    if (!workspace) return;
    let active = true;
    const resolved = new Set<string>();
    const publish = () => {
      const results = workspace.getSnapshot().timerReconstructions;
      for (const attempt of pending.current.values()) {
        const result = results[attempt.id];
        if (!result || (result.status !== 'solved' && result.status !== 'failed') || resolved.has(attempt.id)) continue;
        resolved.add(attempt.id);
        void (async (): Promise<CameraTimerResult> => {
          const { id, event, elapsedMs, file, scramble } = attempt;
          const moves = await cameraTimerMoves(result, elapsedMs).catch(() => null);
          if (moves || !file || !active) {
            const inferredScramble = result.result?.inferred_scramble;
            return { id, event, elapsedMs, moves, ...(inferredScramble && { inferredScramble }), ...(file && { simulated: true }) };
          }
          const controller = new AbortController();
          recoveryRequest.current = controller;
          try {
            const { reviewSimulationFile } = await import('@/lib/video-recon/engine/simulated-camera');
            let fallback = await reviewSimulationFile(id, file, controller.signal, workspace => setRecovery({ id, workspace }));
            if (scramble.trim() && fallback?.config && fallback.result) {
              const { alignKnownOpening } = await import('@/lib/video-recon/engine/known-opening');
              const checked = await alignKnownOpening(scramble, fallback.result);
              fallback = checked ? { ...fallback, config: { ...fallback.config, scramble }, result: checked } : undefined;
            }
            const recoveredMoves = fallback && await cameraTimerMoves(fallback, elapsedMs);
            return { id, event, elapsedMs, moves: recoveredMoves ?? null, simulated: true,
              inferredScramble: fallback?.result?.inferred_scramble, fileRecovery: !!recoveredMoves, liveMessage: result.message };
          } catch {
            return { id, event, elapsedMs, moves: null, simulated: true, liveMessage: result.message };
          } finally {
            if (recoveryRequest.current === controller) recoveryRequest.current = undefined;
            if (active) setRecovery(current => current?.id === id ? undefined : current);
          }
        })().then(result => {
          if (!active) return;
          pending.current.delete(attempt.id);
          resolved.delete(attempt.id);
          setWaiting(pending.current.size > 0);
          resultCallback.current(result);
        });
      }
    };
    refresh.current = publish;
    const unsubscribe = workspace.subscribe(publish);
    publish();
    return () => { active = false; refresh.current = undefined; unsubscribe(); };
  }, [workspace]);

  const start = useCallback((scramble: string, startedAtMs: number, file?: File) => {
    const workspace = workspaceRef.current;
    activeAttempt.current = undefined;
    if (!workspace?.getSnapshot().timerReady || (!file && !scramble.trim())) return;
    const id = crypto.randomUUID();
    const startClockMs = performance.timeOrigin + startedAtMs;
    workspace.startTimerSolve(id, scramble, startClockMs);
    activeAttempt.current = { id, startClockMs, workspace, scramble, file };
  }, []);

  const stop = useCallback((event: EventId, elapsedMs: number) => {
    const attempt = activeAttempt.current;
    activeAttempt.current = undefined;
    if (!attempt) return;
    pending.current.set(attempt.id, { id: attempt.id, event, elapsedMs, scramble: attempt.scramble, file: attempt.file });
    setWaiting(true);
    attempt.workspace.stopTimerSolve(attempt.id, attempt.startClockMs + elapsedMs);
    queueMicrotask(() => refresh.current?.());
    return attempt.id;
  }, []);

  const cancel = useCallback(() => {
    const attempt = activeAttempt.current;
    activeAttempt.current = undefined;
    if (!attempt) return;
    attempt.workspace.stopTimerSolve(attempt.id, performance.timeOrigin + performance.now(), 0);
    attempt.workspace.deleteTimerSolve(attempt.id);
  }, []);

  return { attach, connect, simulate, cancelConnect, start, stop, cancel, waiting, workspace, recovery,
    capturing: !!activeAttempt.current, isPending: (id: string) => pending.current.has(id) };
}
