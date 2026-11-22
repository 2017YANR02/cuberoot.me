import { NXN_ORDER_MAX, NXN_ORDER_MIN } from './nxn-order';
import { isPgPuzzleId, PG_PUZZLES, type PgPuzzleId } from './sim-pg-catalog';

export { NXN_ORDER_DEFAULT, NXN_ORDER_MAX, NXN_ORDER_MIN, clampNxNOrder } from './nxn-order';
export { isPgPuzzleId, PG_DEF_BY_ID, PG_IDS, PG_PUZZLES } from './sim-pg-catalog';
export type { PgPuzzleDef, PgPuzzleId } from './sim-pg-catalog';

/** The initial geometry for the simulator's Puzzle Cuts editor. */
export const DEFAULT_CUSTOM_CUTS = 'c f 0.255';

/** Fixed entries, in simulator catalog order, with the standalone replay backend. */
const FIXED_BACKENDS = {
  nxn: 'nxn',
  custom: 'custom',
  sq1: 'native',
  sq2: 'native',
  sq4: 'native',
  ivy: 'native',
  pyraminx: 'native',
  pyraminx_duo: 'native',
  skewb: 'native',
  megaminx: 'native',
  kilominx: 'named',
  magic: 'native',
  mmagic: 'native',
  clock: 'native',
  fto: 'native',
  baby_fto: 'named',
  dino: 'native',
  redi: 'native',
  rex: 'native',
  heli: 'native',
  gear: 'native',
  ghost: 'native',
  mirror: 'nxn',
  mirror2: 'nxn',
  sphere: 'nxn',
} as const;

export type SimFixedPuzzleId = keyof typeof FIXED_BACKENDS;
export type SimPuzzleId = SimFixedPuzzleId | PgPuzzleId;
export type SimPuzzle = number | Exclude<SimPuzzleId, 'nxn'>;
export type SimPuzzleBackend = (typeof FIXED_BACKENDS)[SimFixedPuzzleId] | 'pg';

export const SIM_FIXED_PUZZLE_IDS: readonly SimFixedPuzzleId[] = Object.freeze(
  Object.keys(FIXED_BACKENDS) as SimFixedPuzzleId[],
);

export const SIM_PUZZLE_IDS: readonly SimPuzzleId[] = Object.freeze([
  ...SIM_FIXED_PUZZLE_IDS, ...PG_PUZZLES.map(({ id }) => id),
]);

export function simPuzzleBackend(puzzle: string | number): SimPuzzleBackend | undefined {
  if (typeof puzzle === 'number') {
    return Number.isInteger(puzzle) && puzzle >= NXN_ORDER_MIN && puzzle <= NXN_ORDER_MAX ? 'nxn' : undefined;
  }
  if (Object.hasOwn(FIXED_BACKENDS, puzzle)) return FIXED_BACKENDS[puzzle as SimFixedPuzzleId];
  if (isPgPuzzleId(puzzle)) return 'pg';
  return undefined;
}
