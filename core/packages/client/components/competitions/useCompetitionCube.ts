'use client';

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  CompetitionCubeAttempt, COMPETITION_INSPECTION_MS, COMPETITION_LIVE_PATH,
  type CompetitionCubePhase, type NetBattleCredentials,
} from '@cuberoot/shared/timer';
import { fromFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import type { Solve333 } from '@cuberoot/shared/smart-cube/anchor';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { createSmartCubeGuidanceController, type SmartCubeGuidanceState } from '@cuberoot/shared/smart-cube/scramble-guidance';
import { mirrorForBrand, sensorBasisForBrand, type Quat } from '@cuberoot/shared/smart-cube/orientation';
import { useNetBattleLiveCube } from '@cuberoot/timer-ui';
import { mayUseMiniProgramBridge, useBluetoothCube, type ConnectPickOptions } from '@/lib/bluetooth';
import { installedBleAvailable } from '@/lib/installed-ble-bridge';
import { websocketApiUrl } from '@/lib/api-base';
import { persistItem } from '@/lib/safe-storage';
import { useLiveCubeAnchor } from '@/app/[lang]/timer/_shared/useLiveCubeAnchor';
import { fixupScramble } from '@/app/[lang]/timer/_lib/bluetooth/scramble_fixup';
import { play, playInspectionBeep, warmupSound } from '@/app/[lang]/timer/_lib/sound';
import {
  reportCompetitionTelemetry, setCompetitionArenaPhase, setCompetitionDuelPhase, startCompetitionTelemetry,
  type CompetitionArenaPhase, type CompetitionTelemetryReport,
} from '@/lib/online-competition-api';
import { preloadCompetitionReconstruction, replaySolve } from './CompetitionReconstruction';

type CubeRound = { number: number; issued: string; scramble: string; inspectAt: string | null };
type PendingReport = { key: string; report: Omit<CompetitionTelemetryReport, 'runId'> };
type Run = { id: string; startKey: string; runId?: string; solveKey?: string; solveSent?: boolean; terminalKey?: string; terminalSending?: boolean; terminalSent?: boolean };
type Attempt = { id: string; round: CubeRound; target: string; machine: CompetitionCubeAttempt };

const defaultGuidance: SmartCubeGuidanceState = { correctionActive: false, hint: null, match: null };
const solveAnchor: Solve333 = async state => {
  const { solve333 } = await import('@/app/[lang]/timer/_lib/scramble/kociemba/random_state');
  return solve333(state);
};

export function useCompetitionCube({ id, duel, smart, roomId, credentials, roundNumber, round, settled, offset, refresh }: {
  id: string; duel: boolean; smart: boolean; roomId: string | null; credentials: NetBattleCredentials | null;
  roundNumber: number; round: CubeRound | null; settled: boolean; offset: number; refresh(): void;
}) {
  const settledRef = useRef(settled);
  settledRef.current = settled;
  const [guidance, setGuidance] = useState(defaultGuidance);
  const [phaseState, setPhase] = useState<{ id: string; phase: CompetitionCubePhase } | null>(null);
  const [recap, setRecap] = useState<ReturnType<typeof replaySolve>>(null);
  const [moves, setMoves] = useState(0);
  const [calibration, setCalibration] = useState(0);
  const [macPrompt, setMacPrompt] = useState<{ deviceName: string; isWrongKey?: boolean } | null>(null);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [connectAttempt, setConnectAttempt] = useState<Promise<void> | null>(null);
  const connectingRef = useRef(false);
  const [syncError, setSyncError] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [hasGyro, setHasGyro] = useState(false);
  const macResolver = useRef<((value: string | null) => void) | null>(null);
  const quatRef = useRef<Quat | null>(null);
  const calibrationRef = useRef<Quat | null>(null);
  const gripRef = useRef<Quat | null>(null);
  const active = useRef<Attempt | null>(null);
  const pending = useRef<PendingReport | null>(null);
  const run = useRef<Run | null>(null);
  const draining = useRef(false);
  const lastFacelets = useRef<string | null>(null);
  const mounted = useRef(false);
  const beep = useRef(0);
  const roundId = round ? `${id}:${round.number}:${round.issued}` : '';
  const controller = useMemo(() => createSmartCubeGuidanceController({
    onChange: setGuidance,
    solve: async (from, target) => {
      const a = fromFaceletString(from);
      const b = fromFaceletString(target);
      return a && b ? fixupScramble(a, b) : null;
    },
  }), []);
  const latest = useRef({ onMove: (_move: string, _at: number, _facelets: string, _metadata?: { futureHistory?: boolean }, _clock?: Parameters<CompetitionCubeAttempt['move']>[0]['clock']) => {},
    onDisconnect: () => {}, onGyro: (_pose: Quat) => {} });
  const cube = useBluetoothCube({
    allowSimulated: false,
    onMove: (...args) => latest.current.onMove(...args),
    onGyro: smart ? pose => latest.current.onGyro(pose) : undefined,
    onConnectionEvent: event => {
      if (event.kind === 'disconnected') latest.current.onDisconnect();
    },
    onNeedMac: (deviceName, isWrongKey) => new Promise(resolve => {
      macResolver.current = resolve;
      setMacPrompt({ deviceName, isWrongKey });
    }),
  });

  const anchor = useLiveCubeAnchor(cube.status.connected ? cube.status.deviceId || cube.status.deviceName || 'cube' : null, cube.facelets);
  const credentialRef = useRef<{ roomId: string | null; credentials: NetBattleCredentials | null }>({ roomId: null, credentials: null });
  const expiry = Number(credentialRef.current.credentials?.playerToken.split('_', 1)[0]) * 1000;
  if (credentialRef.current.roomId !== roomId || !credentialRef.current.credentials || expiry < Date.now() + 60_000) {
    credentialRef.current = { roomId, credentials };
  }
  const live = useNetBattleLiveCube({
    code: roomId, credentials: credentialRef.current.credentials, round: Math.max(1, roundNumber),
    localConnected: smart && duel && cube.status.connected, localFacelets: cube.facelets,
    websocketUrl: websocketApiUrl(COMPETITION_LIVE_PATH), solve: solveAnchor, onInvalidate: refresh,
  });
  const status = useRef(cube.status);
  status.current = cube.status;
  const phase = phaseState?.id === roundId ? phaseState.phase : null;

  async function submitPhase(attempt: Attempt, value: CompetitionArenaPhase, key: string, inspectionMs?: number) {
    const number = attempt.round.number;
    return duel ? setCompetitionDuelPhase(id, number, value, key, inspectionMs)
      : setCompetitionArenaPhase(id, number, value, key, inspectionMs);
  }

  async function flush() {
    const attempt = active.current;
    const context = run.current;
    if (!attempt || !context || context.id !== attempt.id || context.terminalSent || settledRef.current) return;
    const current = attempt.machine.phase;
    if (current.kind === 'scrambling') return;
    const stillCurrent = () => mounted.current && active.current === attempt;
    if (current.kind === 'finished' && current.reason) {
      if (context.terminalSending) return;
      context.terminalSending = true;
      context.terminalKey ??= crypto.randomUUID();
      try {
        await submitPhase(attempt, current.reason === 'disconnected' ? 'disconnected' : 'timeout', context.terminalKey);
        context.terminalSent = true;
        if (stillCurrent()) setSyncError(false);
      } catch {
        if (stillCurrent()) setSyncError(true);
      } finally {
        context.terminalSending = false;
        refresh();
      }
      return;
    }
    if (draining.current) return;
    draining.current = true;
    try {
      if (!context.runId) {
        const response = await startCompetitionTelemetry(id, duel, attempt.round.number, {
          serverIssuedAt: attempt.round.issued, scramble: attempt.round.scramble, startFacelets: attempt.target,
        }, context.startKey);
        if (!stillCurrent() || !response.runId) return;
        context.runId = response.runId;
      }
      const now = attempt.machine.phase;
      if (now.kind === 'running' && !context.solveSent) {
        context.solveKey ??= crypto.randomUUID();
        await submitPhase(attempt, 'solving', context.solveKey, Math.round(now.inspectionMs));
        context.solveSent = true;
      }
      const queued = pending.current;
      if (queued && stillCurrent()) {
        await reportCompetitionTelemetry(id, duel, attempt.round.number, { ...queued.report, runId: context.runId }, queued.key);
        if (stillCurrent()) pending.current = null;
        try { localStorage.removeItem(`competition-arena-report:${attempt.id}`); } catch { /* Already recorded. */ }
      }
      if (stillCurrent()) setSyncError(false);
    } catch {
      if (stillCurrent()) setSyncError(true);
    } finally {
      draining.current = false;
      refresh();
    }
  }

  const service = useEffectEvent(() => {
    const attempt = active.current;
    if (!attempt || settledRef.current) return;
    const now = performance.now();
    attempt.machine.tick(now);
    const current = attempt.machine.phase;
    if (current.kind === 'inspecting') {
      const elapsed = now - current.at;
      if (elapsed >= 12_000 && beep.current < 12) { beep.current = 12; playInspectionBeep(); }
      else if (elapsed >= 8_000 && beep.current < 8) { beep.current = 8; playInspectionBeep(); }
    }
  });
  const retry = useEffectEvent(() => {
    const current = active.current?.machine.phase;
    if (current?.kind === 'finished' && !current.reason && !pending.current) return;
    if ((current?.kind === 'confirming' || current?.kind === 'inspecting') && run.current?.runId) return;
    if (current?.kind === 'running' && run.current?.solveSent) return;
    void flush();
  });

  useEffect(() => {
    mounted.current = true;
    const clock = setInterval(() => service(), 33);
    const retryTimer = setInterval(() => retry(), 1500);
    return () => {
      mounted.current = false;
      clearInterval(clock);
      clearInterval(retryTimer);
      macResolver.current?.(null);
    };
  }, []);
  useEffect(() => {
    controller.setConnected(cube.status.connected);
    if (cube.status.connected) return preloadCompetitionReconstruction();
  }, [controller, cube.status.connected]);

  useEffect(() => {
    active.current = null;
    pending.current = null;
    run.current = null;
    if (round) {
      setRecap(null);
      setMoves(0);
    }
    setSyncError(false);
    beep.current = 0;
    gripRef.current = null;
    controller.setRunning(false);
    const target = round && smart ? smartCubeTargetFacelets(round.scramble) : null;
    controller.setContext(round && target ? { id: roundId, scramble: round.scramble, targetFacelets: target } : null);
    if (!round || !target || settledRef.current) return;
    const issued = Date.parse(round.issued) - offset;
    const context: Run = { id: roundId, startKey: crypto.randomUUID() };
    run.current = context;
    const machine = new CompetitionCubeAttempt(issued, target, {
      change(next) {
        setPhase({ id: roundId, phase: next });
        if (next.kind === 'confirming') gripRef.current = quatRef.current;
        if (next.kind === 'inspecting') play('inspection-start');
        if (next.kind === 'running') controller.setRunning(true);
        if (next.kind === 'confirming' || next.kind === 'running') void flush();
      },
      device() {
        const sample = quatRef.current;
        const reference = gripRef.current;
        return { device: { model: status.current.brand, name: status.current.deviceName },
          ...(sample && reference ? { grip: { reference, initial: sample } } : {}) };
      },
      finish(finished, inspectionMs, recording) {
        setMoves(recording.moves.length);
        if (!finished.reason) {
          const report = {
            serverIssuedAt: round.issued, scramble: round.scramble, startFacelets: target,
            endFacelets: lastFacelets.current ?? target, deviceBrand: recording.device?.model || status.current.brand,
            deviceName: recording.device?.name || status.current.deviceName, disconnected: false,
            inspectionMs: Math.round(inspectionMs), durationMs: finished.durationMs, gyro: recording.gyro,
            moves: recording.moves.map(({ m, ts }) => ({ move: m, elapsedMs: Math.floor(ts) })),
          };
          pending.current = { key: crypto.randomUUID(), report };
          setRecap(replaySolve(roundId, { ...report, timestamp: new Date().toISOString() }));
          persistItem(`competition-arena-report:${roundId}`, JSON.stringify({ startKey: context.startKey, pending: pending.current }));
        }
        void flush();
      },
    });
    try {
      const stored = JSON.parse(localStorage.getItem(`competition-arena-report:${roundId}`) ?? 'null') as { startKey: string; pending: PendingReport } | null;
      if (stored?.pending?.report.serverIssuedAt === round.issued && typeof stored.startKey === 'string') {
        context.startKey = stored.startKey;
        pending.current = stored.pending;
        machine.phase = { kind: 'finished', at: performance.now(), durationMs: stored.pending.report.durationMs };
        setRecap(replaySolve(roundId, stored.pending.report));
      }
    } catch { /* Storage can be unavailable. */ }
    if (!pending.current && round.inspectAt) {
      // The server has a run whose device stream was lost on a reload.
      machine.phase = { kind: 'finished', at: performance.now(), durationMs: 0, reason: 'disconnected' };
    }
    active.current = { id: roundId, round, target, machine };
    setPhase({ id: roundId, phase: machine.phase });
    if (pending.current || round.inspectAt) void flush();
    // Snapshot updates must not replace a live attempt or rebase its monotonic clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, roundId, smart]);

  latest.current = {
    onMove(move, at, facelets, metadata, clock) {
      anchor.anchor.move(move, at);
      if (duel) live.publishMove(move);
      lastFacelets.current = facelets;
      const attempt = active.current;
      if (!attempt || settledRef.current) return;
      const machine = attempt.machine;
      if (machine.phase.kind === 'scrambling') {
        if (metadata?.futureHistory) return;
        const observation = controller.observe(facelets, move);
        machine.aligned(facelets, observation.completedNow, at);
      } else {
        machine.move({ move, at, facelets, clock });
        if (machine.phase.kind === 'running') setMoves(machine.recording.snapshotMoves().length);

      }
    },
    onDisconnect() {
      controller.setConnected(false);
      if (!settledRef.current) active.current?.machine.disconnected(performance.now());
      quatRef.current = null;
      calibrationRef.current = null;
      setHasGyro(false);
    },
    onGyro(pose) {
      if (!quatRef.current) setHasGyro(true);
      quatRef.current = pose;
      active.current?.machine.gyro(pose, performance.now());
      if (duel) live.publishGyro(pose, { basis: sensorBasisForBrand(status.current.brand),
        mirror: mirrorForBrand(status.current.brand), reference: calibrationRef.current });
    },
  };

  useEffect(() => {
    if (!cube.status.connected || !cube.facelets) return;
    lastFacelets.current = cube.facelets;
    const attempt = active.current;
    if (!attempt || settledRef.current || attempt.machine.phase.kind !== 'scrambling') return;
    const observation = controller.observe(cube.facelets);
    attempt.machine.aligned(cube.facelets, observation.completedNow, performance.now());
  }, [controller, cube.facelets, cube.status.connected, roundId]);

  function resolveMac(value: string | null) {
    macResolver.current?.(value);
    macResolver.current = null;
    setMacPrompt(null);
  }
  async function connectDevice(pick?: ConnectPickOptions) {
    if (connectingRef.current) return;
    connectingRef.current = true;
    warmupSound();
    setConnecting(true);
    try { await cube.connect(pick); }
    finally {
      connectingRef.current = false;
      setConnecting(false);
    }
  }

  function openDevice(pair = false) {
    setDeviceOpen(true);
    if (!pair || connectingRef.current || cube.status.connected) return;
    if (!navigator.bluetooth?.requestDevice && !installedBleAvailable() && !mayUseMiniProgramBridge()) return;
    const attempt = connectDevice();
    // The shared modal observes the original rejection and displays its details.
    void attempt.catch(() => {});
    setConnectAttempt(attempt);
  }

  function closeDevice() {
    resolveMac(null);
    if (connectingRef.current && !cube.status.connected) cube.disconnect();
    setDeviceOpen(false);
    setConnectAttempt(null);
  }
  return {
    cube, anchor, quatRef, calibration, hasGyro, guidance, phase, moves, recap, live, connecting,
    macPrompt, resolveMac, deviceOpen, connectAttempt, connectDevice, openDevice, closeDevice, syncError,
    resetView: () => { calibrationRef.current = quatRef.current; setCalibration(value => value + 1); },
    inspectionMs: COMPETITION_INSPECTION_MS,
  };
}
