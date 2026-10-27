import { describe, expect, it } from 'vitest';
import { buildReconText, preferF2lBoundaryRegrips } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { computeStageSegments } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import { buildCoreTrack, type CoreTrack } from '@cuberoot/shared/timer/reconstruct/core-track';
import { notationQuaternion } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import type { GyroSample } from '@cuberoot/shared/smart-cube/gyro-track';
import { applyScramble } from '@/app/[lang]/timer/_lib/cube/state';
import { applyOneToken } from '@/app/[lang]/timer/_lib/cube/apply_token';

it('prefers a separate regrip after a completed pair when the wide interpretation is ambiguous', () => {
  const moves = [{ m: 'D', ts: 1000 }, { m: "R'", ts: 1180 }, { m: 'U', ts: 2000 }];
  const core: CoreTrack = { frame: 'scramble', events: [{ token: 'y', tMs: 800,
    startMs: 800, notationMs: 1030, angleRad: Math.PI / 2 }] };
  const original = JSON.stringify(core);
  const preferred = preferF2lBoundaryRegrips(core, moves, [1])!;
  expect(preferred.events[0].notationMs).toBeGreaterThan(moves[1].ts);
  expect(preferred.events[0].notationMs).toBeLessThan(moves[2].ts);
  expect(preferred.events[0].tMs).toBe(800);
  expect(JSON.stringify(core)).toBe(original);
  expect(preferF2lBoundaryRegrips(core, moves, [])!.events[0]).toEqual(core.events[0]);
  expect(preferF2lBoundaryRegrips(core, [{ ...moves[0] }, moves[1], { ...moves[2], ts: 1400 }], [1])!
    .events[0]).toEqual(core.events[0]);
  expect(preferF2lBoundaryRegrips({ ...core, events: [{ ...core.events[0], token: "y'" }] }, moves, [1])!
    .events[0].notationMs).toBe(1030);
});

describe.each(['cfop', 'roux', 'zz'] as const)('%s gesture reconstruction', method => {
it.each([1, 5, 10, 19, 20, 30, 40, 60, 80])('recognizes a wide-turn excursion held for %ims', async holdMs => {
  const samples: GyroSample[] = [
    { tMs: 0, q: notationQuaternion(''), frame: 'scramble' },
    { tMs: 100, q: notationQuaternion('x'), frame: 'scramble' },
    { tMs: 100 + holdMs, q: notationQuaternion(''), frame: 'scramble' },
  ];
  const moves = [{ m: 'L', ts: 100 }, { m: 'F', ts: 100 + holdMs / 2 }, { m: "L'", ts: 100 + holdMs }];
  const core = buildCoreTrack(samples, { moves });
  expect(core?.events.map(event => event.token)).toEqual(['x', "x'"]);
  const scramble = "L F' L'";
  const result = await buildReconText({ method, scramble, moves, totalMs: 300,
    segs: computeStageSegments(scramble, moves, 300)!, metrics: null, slots: null, core });
  expect(result.lines.flatMap(line => line.moves)).toEqual(['r', 'U', "r'"]);
  expect(result.rotations).toEqual([]);
});

async function report(outer: string, token: string, offset: number, extra?: { m: string; ts: number }, secondRotationMs?: number) {
  const moves = [{ m: outer, ts: 500 }, ...(extra ? [extra] : []), { m: 'U', ts: 1200 }, { m: 'F', ts: 1900 }];
  const inverse = (t: string) => t.endsWith("'") ? t.slice(0, -1) : `${t}'`;
  const scramble = moves.map(m => inverse(m.m)).reverse().join(' ');
  const core: CoreTrack = { frame: 'scramble', events: [{ token, tMs: 500 + offset, startMs: 500 + offset, angleRad: Math.PI / 2 }] };
  if (secondRotationMs !== undefined) core.events = [...core.events, { token, tMs: secondRotationMs, angleRad: Math.PI / 2 }];
  const result = await buildReconText({ method, scramble, moves, totalMs: 2000,
    segs: computeStageSegments(scramble, moves, 2000)!, metrics: null, slots: null, core });
  // Playback consumes lossless move tokens, not the waste-group parentheses.
  const tokens = result.lines.flatMap(line => line.moves);
  let state = applyScramble(3, scramble);
  for (const t of tokens) state = applyOneToken(state, t);
  for (const face of Object.values(state)) expect(new Set(face.flat()).size).toBe(1);
  return { result, tokens };
}

const cases = [
  ['r', 'L', 'x'], ['l', 'R', "x'"], ['u', 'D', 'y'],
  ['d', 'U', "y'"], ['f', 'B', 'z'], ['b', 'F', "z'"],
].flatMap(([wide, outer, rotation]) => [
  [wide, outer, rotation],
  [`${wide}'`, `${outer}'`, rotation.endsWith("'") ? rotation.slice(0, -1) : `${rotation}'`],
  [`${wide}2`, `${outer}2`, `${rotation[0]}2${rotation.endsWith("'") ? "'" : ''}`],
  [`${wide}2'`, `${outer}2'`, `${rotation[0]}2${rotation.endsWith("'") ? '' : "'"}`],
]);

for (const offset of [-120, 120]) {
  it.each(cases)(`merges %s with gyro offset ${offset}ms and preserves following moves`, async (wide, outer, rotation) => {
    const { result, tokens } = await report(outer, rotation, offset);
    expect(tokens[0]).toBe(wide);
    expect(tokens.filter(t => /^[xyz]/.test(t))).toEqual([]);
    expect(result.rotations).toEqual([]);
  });
}

it.each([-121, 121])('keeps an independent rotation at offset %ims', async offset => {
  const { tokens, result } = await report('L', 'x', offset);
  expect(tokens).not.toContain('r');
  expect(result.rotations).toHaveLength(1);
});

it('does not merge the wrong direction', async () => {
  const { tokens } = await report('L', "x'", 100);
  expect(tokens.some(t => /^[rludfb]/.test(t))).toBe(false);
});

it('does not merge across another face turn', async () => {
  const { tokens } = await report('L', 'x', 100, { m: 'B', ts: 550 });
  expect(tokens).not.toContain('r');
});

it('combines two quarter-turn encoder reports into one wide half turn', async () => {
  const { tokens, result } = await report('L', 'x2', 100, { m: 'L', ts: 530 });
  expect(tokens[0]).toBe('r2');
  expect(result.rotations).toEqual([]);
});

it('combines two observed core quarters and encoder quarters into a wide half turn', async () => {
  const { tokens, result } = await report('L', 'x', 0, { m: 'L', ts: 530 }, 530);
  expect(tokens[0]).toBe('r2');
  expect(result.rotations).toEqual([]);
});

it.each(cases.filter(([, outer]) => !outer.includes('2')))(
  'reconstructs a continuous %s half turn from sampled poses', async (wide, outer, rotation) => {
    const moves = [{ m: outer, ts: 500 }, { m: outer, ts: 530 }, { m: 'U', ts: 1200 }, { m: 'F', ts: 1900 }];
    const inverse = (token: string) => token.endsWith("'") ? token.slice(0, -1) : `${token}'`;
    const scramble = moves.map(move => inverse(move.m)).reverse().join(' ');
    const core = buildCoreTrack([
      { tMs: 0, q: notationQuaternion(''), frame: 'scramble' },
      { tMs: 500, q: notationQuaternion(rotation), frame: 'scramble' },
      { tMs: 530, q: notationQuaternion(`${rotation} ${rotation}`), frame: 'scramble' },
    ], { moves });
    expect(core?.events).toHaveLength(2);
    const result = await buildReconText({ method, scramble, moves, totalMs: 2000,
      segs: computeStageSegments(scramble, moves, 2000)!, metrics: null, slots: null, core });
    const tokens = result.lines.flatMap(line => line.moves);
    expect(tokens[0]).toBe(`${wide[0]}2${wide.endsWith("'") ? "'" : ''}`);
    expect(result.rotations).toEqual([]);
    let state = applyScramble(3, scramble);
    for (const token of tokens) state = applyOneToken(state, token);
    for (const face of Object.values(state)) expect(new Set(face.flat()).size).toBe(1);
  },
);

it('consumes an encoder gesture only once', async () => {
  const { tokens, result } = await report('L', 'x', -80, undefined, 580);
  expect(tokens.filter(t => t === 'r')).toHaveLength(1);
  expect(result.rotations).toHaveLength(1);
});

it.each(['y', 'x2'])('does not merge a mismatched axis or turn amount: L + %s', async rotation => {
  const { tokens } = await report('L', rotation, 100);
  expect(tokens.some(t => /^[rludfb]/.test(t))).toBe(false);
});

});
