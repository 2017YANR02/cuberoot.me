import { expect, it } from 'vitest';
import recording from './fixtures/pll-slice-half-turn-recording.json';
import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';
import { buildCoreTrack } from '@cuberoot/shared/timer/reconstruct/core-track';
import { buildReconText } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { computeStageSegments } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import { normalizeSolve, initialPoseRotation } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';
import { applyOneToken } from '@cuberoot/shared/timer/reconstruct/apply-token';
import { reconstructedTrack } from '@cuberoot/timer-ui/reconstruct/playback-track';

it.each(['roux', 'zz'] as const)('%s keeps stages already solved in the scramble at zero time', async method => {
  const moves = [{ m: "U'", ts: 100 }];
  const result = await buildReconText({ method, scramble: 'U', moves, totalMs: 200,
    segs: computeStageSegments('U', moves, 200)!, metrics: null, slots: null });
  const skipped = result.methodStages!.filter(stage => stage.endIdx === -1);
  expect(skipped.length).toBeGreaterThan(0);
  for (const stage of skipped) {
    expect(stage.cumulativeMs).toBe(0);
    expect(stage.turns).toBe(0);
    expect(stage.stepMs).toBe(0);
  }
});

it.each(['roux', 'zz'] as const)('%s assigns an unfinished tail to the current stage', async method => {
  const scramble = "R U F L D B";
  const moves = [{ m: 'U', ts: 100 }];
  const result = await buildReconText({ method, scramble, moves, totalMs: 200,
    segs: computeStageSegments(scramble, moves, 200)!, metrics: null, slots: null });
  const tail = result.lines.find(line => line.key === 'tail')!;
  expect(tail.stageKey).toBe(method === 'roux' ? 'fb' : 'eoline');
  expect(result.currentStage?.key).toBe(tail.stageKey);
  expect(tail.fromIdx).toBe(0);
  expect(tail.toIdx).toBe(0);
});

it.each(['roux', 'zz'] as const)('%s preserves slice gestures, pose and complete playback coverage', async method => {
  const { scramble, moves, timeMs: totalMs, model: brand } = recording;
  const samples = decodeGyroTrack(recording.gyro);
  const view = normalizeSolve(scramble, moves, { preferredRotation: initialPoseRotation(samples, brand) });
  const result = await buildReconText({ method, language: 'en',
    scramble: view.scramble, moves: view.moves, totalMs,
    segs: computeStageSegments(scramble, moves, totalMs)!, metrics: null, slots: null,
    core: buildCoreTrack(samples, { brand, moves }), physical: { scramble, moves }, viewRotation: view.rotation,
  });
  const items = result.lines.flatMap(line => line.moveRanges!);
  const playback = reconstructedTrack(result.lines, moves);
  expect(playback).not.toBeNull();
  expect(playback!.map(move => move.m)).toEqual(items.map(item => item.token));
  expect(result.methodStages!.reduce((sum, stage) => sum + (stage.turns ?? 0), 0)).toBe(result.stm);
  for (const line of result.lines.filter(line => line.key !== 'tail')) {
    const stage = result.methodStages!.find(stage => stage.key === line.key)!;
    expect(stage.endIdx).toBe(line.toIdx);
    expect(stage.stepMs).toBe(line.stepMs);
  }
  expect(items.some(item => /^M2/.test(item.token) && item.endIdx > item.startIdx)).toBe(true);
  expect(result.lines.some(line => (method === 'roux' ? ['fb', 'sb', 'cmll', 'lse'] : ['eoline', 'zzleft', 'zzright', 'll']).includes(line.key))).toBe(true);
  const covered = items.flatMap(item => Array.from({ length: Math.max(0, item.endIdx - item.startIdx + 1) }, (_, i) => item.startIdx + i));
  expect(covered).toEqual(moves.map((_, i) => i));
  for (const line of result.lines) {
    expect(line.moves).toEqual(line.moveRanges!.map(item => item.token));
    for (const item of line.moveRanges!) {
      if (item.endIdx < item.startIdx) continue; // Pure rotations consume no encoder moves.
      expect(item.ts).toBe(moves[item.startIdx].ts);
      // A wide turn can consume a gyro event arriving after the encoder event.
      expect(item.endTs).toBeGreaterThanOrEqual(moves[item.endIdx].ts);
    }
  }
  let cube = applyScramble(3, `${scramble} ${result.inspection}`);
  for (const token of result.lines.flatMap(line => line.moves)) cube = applyOneToken(cube, token);
  for (const face of Object.values(cube)) expect(new Set(face.flat()).size).toBe(1);
});
