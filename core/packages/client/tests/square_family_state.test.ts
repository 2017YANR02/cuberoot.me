import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import SquareFamilyCube from '@/app/[lang]/sim/engine/squareFamily/SquareFamilyCube';
import { squareFamilySlotPolygon } from '@/app/[lang]/sim/engine/squareFamily/squareFamilyGeometry';
import {
  SQUARE_FAMILY_SPECS,
  applySquareFamilyMove,
  formatSquareFamilyAlg,
  invertSquareFamilyMoves,
  normalizeSquareUnits,
  parseSquareFamilyMoves,
  randomSquareFamilyScramble,
  simplifySquareFamilyAlg,
  solvedSquareFamily,
  squareFamilyComplete,
  squareFamilyMovesToString,
  tryParseSquareFamilyMoves,
  type SquareFamilyKind,
  type SquareFamilyMove,
} from '@/app/[lang]/sim/engine/squareFamily/squareFamilyState';

const KINDS = ['sq2', 'sq4'] as const satisfies readonly SquareFamilyKind[];

function applyAll(kind: SquareFamilyKind, moves: readonly SquareFamilyMove[]) {
  const spec = SQUARE_FAMILY_SPECS[kind];
  return moves.reduce((state, move) => applySquareFamilyMove(state, move, spec), solvedSquareFamily(spec));
}

describe.each(KINDS)('%s equal-sector state', (kind) => {
  const spec = SQUARE_FAMILY_SPECS[kind];

  it('has the expected sector count and angle unit', () => {
    expect(spec.slotsPerLayer).toBe(kind === 'sq2' ? 12 : 20);
    expect(spec.unitRadians).toBeCloseTo((Math.PI * 2) / spec.slotsPerLayer, 12);
    expect(spec.sliceAxisAngle).toBeCloseTo(spec.unitRadians / 2, 12);
    expect(spec.scrambleLength).toBe(kind === 'sq2' ? 10 : 20);
  });

  it('normalizes turns to (-n/2, n/2]', () => {
    const half = spec.slotsPerLayer / 2;
    expect(normalizeSquareUnits(-half, spec)).toBe(half);
    expect(normalizeSquareUnits(half + 1, spec)).toBe(-half + 1);
    expect(normalizeSquareUnits(spec.slotsPerLayer, spec)).toBe(0);
    expect(normalizeSquareUnits(Number.NaN, spec)).toBe(0);
  });

  it('cycles both outer layers and makes slash an involution', () => {
    let top = solvedSquareFamily(spec);
    let bottom = solvedSquareFamily(spec);
    for (let i = 0; i < spec.slotsPerLayer; i++) {
      top = applySquareFamilyMove(top, { kind: 'turn', top: 1, bot: 0 }, spec);
      bottom = applySquareFamilyMove(bottom, { kind: 'turn', top: 0, bot: 1 }, spec);
    }
    expect(squareFamilyComplete(top, spec)).toBe(true);
    expect(squareFamilyComplete(bottom, spec)).toBe(true);

    const once = applySquareFamilyMove(solvedSquareFamily(spec), { kind: 'slice' }, spec);
    const twice = applySquareFamilyMove(once, { kind: 'slice' }, spec);
    expect(once.sliceSolved).toBe(false);
    expect(twice).toEqual(solvedSquareFamily(spec));
  });

  it('preserves every piece and returns to solved after an inverse', () => {
    const half = spec.slotsPerLayer / 2;
    const moves: SquareFamilyMove[] = [
      { kind: 'turn', top: half, bot: -half + 1 },
      { kind: 'slice' },
      { kind: 'turn', top: 3, bot: -2 },
      { kind: 'slice' },
    ];
    const scrambled = applyAll(kind, moves);
    expect(new Set(scrambled.pieces).size).toBe(spec.slotsPerLayer * 2);
    expect([...scrambled.pieces].sort((a, b) => a - b)).toEqual(
      Array.from({ length: spec.slotsPerLayer * 2 }, (_, i) => i),
    );
    const inverse = invertSquareFamilyMoves(moves, spec);
    for (const move of inverse) {
      if (move.kind === 'slice') continue;
      expect(move.top).toBeGreaterThan(-half);
      expect(move.top).toBeLessThanOrEqual(half);
      expect(move.bot).toBeGreaterThan(-half);
      expect(move.bot).toBeLessThanOrEqual(half);
    }
    expect(squareFamilyComplete(applyAll(kind, [...moves, ...inverse]), spec)).toBe(true);
  });

  it('round-trips parenthesized notation including the upper bound', () => {
    const half = spec.slotsPerLayer / 2;
    const text = `(${half},${-half + 1}) / (-1,2)`;
    const parsed = parseSquareFamilyMoves(text, spec);
    expect(squareFamilyMovesToString(parsed)).toBe(`(${half},${-half + 1}) / (-1,2)`);
    expect(parseSquareFamilyMoves(squareFamilyMovesToString(parsed), spec)).toEqual(parsed);
  });

  it('rejects the whole malformed input and keeps Square-4 tuples explicit', () => {
    const half = spec.slotsPerLayer / 2;
    if (kind === 'sq2') {
      expect(tryParseSquareFamilyMoves('43/6/-3-2/', spec)).toEqual([
        { kind: 'turn', top: 4, bot: 3 },
        { kind: 'slice' },
        { kind: 'turn', top: 6, bot: 0 },
        { kind: 'slice' },
        { kind: 'turn', top: -3, bot: -2 },
        { kind: 'slice' },
      ]);
      expect(formatSquareFamilyAlg('(4,3)/(6,0)/(-3,-2)/', spec, 'compact'))
        .toBe('43/6/-3-2/');
      expect(formatSquareFamilyAlg('43/6/-3-2/', spec, 'wca'))
        .toBe('(4, 3) / (6, 0) / (-3, -2) /');
    } else {
      expect(tryParseSquareFamilyMoves(`${half}`, spec)).toBeNull();
      expect(formatSquareFamilyAlg('(10,3)/(0,-9)/', spec, 'compact'))
        .toBe('(10,3)/(0,-9)/');
    }
    expect(tryParseSquareFamilyMoves(`(${half})`, spec)).toBeNull();
    expect(tryParseSquareFamilyMoves('(1,0) typo /', spec)).toBeNull();
    expect(parseSquareFamilyMoves('(1,0) typo /', spec)).toEqual([]);
    expect(tryParseSquareFamilyMoves(`(${half},0) // note\n/`, spec)).toEqual([
      { kind: 'turn', top: half, bot: 0 },
      { kind: 'slice' },
    ]);
  });

  it('keeps a literal trailing slash physical and cancels adjacent slash pairs', () => {
    const moves = parseSquareFamilyMoves('(1,0)/', spec);
    expect(moves).toEqual([
      { kind: 'turn', top: 1, bot: 0 },
      { kind: 'slice' },
    ]);
    expect(applyAll(kind, moves).sliceSolved).toBe(false);
    expect(simplifySquareFamilyAlg('/ /', spec)).toBe('');
    expect(simplifySquareFamilyAlg('(1,0) / / (2,0)', spec)).toBe('(3,0)');
    expect(simplifySquareFamilyAlg('(1,0) typo', spec)).toBe('(1,0) typo');
  });

  it('keeps the last legal cube state when setup or push receives malformed text', () => {
    const cube = new SquareFamilyCube(kind);
    cube.twister.setup('(1,0) /');
    const state = JSON.stringify(cube.state);
    const init = cube.history.init;
    const history = [...cube.history.moves];

    cube.twister.setup('(1,0) typo');
    cube.twister.push('(1,0) typo');

    expect(JSON.stringify(cube.state)).toBe(state);
    expect(cube.history.init).toBe(init);
    expect(cube.history.moves).toEqual(history);
    expect(cube.twister.busy).toBe(false);
  });

  it('generates the configured number of bounded random-move tuples and slashes', () => {
    let seed = kind === 'sq2' ? 0x2a2a2a2a : 0x4a4a4a4a;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    const moves = parseSquareFamilyMoves(randomSquareFamilyScramble(spec, random), spec);
    expect(moves).toHaveLength(spec.scrambleLength * 2);
    for (let i = 0; i < moves.length; i += 2) {
      const turn = moves[i];
      expect(turn.kind).toBe('turn');
      if (turn.kind === 'turn') {
        const half = spec.slotsPerLayer / 2;
        expect(turn.top).toBeGreaterThanOrEqual(-half + 1);
        expect(turn.top).toBeLessThanOrEqual(half);
        expect(turn.bot).toBeGreaterThanOrEqual(-half + 1);
        expect(turn.bot).toBeLessThanOrEqual(half);
        expect(turn.top !== 0 || turn.bot !== 0).toBe(true);
      }
      expect(moves[i + 1]).toEqual({ kind: 'slice' });
    }
  });
});

describe.each(KINDS)('%s geometry/state synchronization', (kind) => {
  it('exports every schematic sticker with an outward-facing polygon', () => {
    const cube = new SquareFamilyCube(kind);
    let stickers = 0;
    let schematicStickers = 0;
    cube.traverse((object) => {
      if (object.userData.simRole !== 'sticker') return;
      stickers++;
      const flat = object.userData.schematicPoly as number[] | undefined;
      const outward = object.userData.simStickerNormal as THREE.Vector3 | undefined;
      expect(flat, `${kind} ${object.userData.stickerKey} schematic polygon`).toBeDefined();
      expect(outward, `${kind} ${object.userData.stickerKey} outward normal`).toBeDefined();
      if (!flat || !outward) return;
      schematicStickers++;
      const points = Array.from({ length: flat.length / 3 }, (_, index) => (
        new THREE.Vector3(flat[index * 3], flat[index * 3 + 1], flat[index * 3 + 2])
      ));
      const normal = new THREE.Vector3()
        .subVectors(points[1], points[0])
        .cross(new THREE.Vector3().subVectors(points[2], points[0]))
        .normalize();
      expect(normal.dot(outward.clone().normalize()), `${kind} ${object.userData.stickerKey} winding`)
        .toBeCloseTo(1, 10);
    });
    expect(stickers).toBe(cube.spec.slotsPerLayer * 4 + 6);
    expect(schematicStickers).toBe(stickers);
    cube.dispose();
  });

  it('keeps the physical top and bottom piece sets aligned after mixed moves', () => {
    const cube = new SquareFamilyCube(kind);
    const n = cube.spec.slotsPerLayer;
    const pieceReferenceDirections = cube.pieces.map((_, pieceId) => {
      const poly = squareFamilySlotPolygon(pieceId % n, pieceId < n, cube.spec);
      return new THREE.Vector3(poly[1][0], 0, poly[1][1]).normalize()
        .add(new THREE.Vector3(poly[2][0], 0, poly[2][1]).normalize())
        .normalize();
    });
    const solvedSlotDirections = pieceReferenceDirections.map((direction, slot) => ({
      top: slot < n,
      direction,
    }));
    const idByPivot = new Map(cube.pieces.map((piece) => [piece.pivot, piece.pieceId]));
    const idsFor = (move: SquareFamilyMove) => cube.beginMove(move)
      .map((anim) => idByPivot.get(anim.pivot))
      .filter((id): id is number => id !== undefined)
      .sort((a, b) => a - b);
    const assertLayers = () => {
      expect(idsFor({ kind: 'turn', top: 1, bot: 0 })).toEqual(
        cube.state.pieces.slice(0, n).sort((a, b) => a - b),
      );
      expect(idsFor({ kind: 'turn', top: 0, bot: 1 })).toEqual(
        cube.state.pieces.slice(n).sort((a, b) => a - b),
      );
      const occupiedSlots = new Set<number>();
      for (const piece of cube.pieces) {
        const probe = cube.currentProbe(piece);
        let nearestSlot = -1;
        let nearestDistance = Number.POSITIVE_INFINITY;
        const top = probe.y > 0;
        const direction = pieceReferenceDirections[piece.pieceId].clone()
          .applyQuaternion(piece.pivot.quaternion)
          .setY(0)
          .normalize();
        for (let slot = 0; slot < solvedSlotDirections.length; slot++) {
          if (solvedSlotDirections[slot].top !== top) continue;
          const distance = direction.distanceToSquared(solvedSlotDirections[slot].direction);
          if (distance < nearestDistance) {
            nearestSlot = slot;
            nearestDistance = distance;
          }
        }
        expect(nearestDistance, `${kind} piece ${piece.pieceId} slot angle`).toBeLessThan(1e-8);
        expect(occupiedSlots.has(nearestSlot), `${kind} duplicate physical slot ${nearestSlot}`).toBe(false);
        occupiedSlots.add(nearestSlot);
        expect(cube.state.pieces[nearestSlot]).toBe(piece.pieceId);
      }
    };

    const half = n / 2;
    const sequence: SquareFamilyMove[] = [
      { kind: 'turn', top: 1, bot: -2 },
      { kind: 'slice' },
      { kind: 'turn', top: half, bot: 3 },
      { kind: 'slice' },
      { kind: 'turn', top: -3, bot: half },
    ];
    assertLayers();
    for (const move of sequence) {
      cube.applyMoveInstant(move);
      assertLayers();
    }
    expect(cube.beginMove({ kind: 'slice' })).toHaveLength(n + 1);
    cube.dispose();
  });
});
