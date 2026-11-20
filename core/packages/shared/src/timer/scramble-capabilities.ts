import type { EventId, TimerScrambleSourceKind } from './types';

/**
 * The cubing.js event ids used by the shared timer runtime.
 *
 * Keep these provider spellings at this boundary. Stored solves and UI state
 * always use CubeRoot's EventId instead.
 */
export type TimerCubingScrambleEventId =
  | '333'
  | '444'
  | '555'
  | '666'
  | '777'
  | '333bf'
  | '333fm'
  | '333oh'
  | '444bf'
  | '555bf'
  | 'clock'
  | 'fto'
  | 'baby_fto'
  | 'minx'
  | 'pyram'
  | 'redi_cube'
  | 'skewb'
  | 'sq1';

/** Runtime-neutral generators owned by shared rather than a host or cubing.js. */
export type TimerSharedScrambleProviderId =
  | 'wca-pocket'
  | 'trainer-case'
  | 'training-state'
  | 'small-puzzle-random-state'
  | 'native-random-move'
  | 'cstimer-nonwca';

/** Runtime-neutral recipes that compose already registered child providers. */
export type TimerCompoundScrambleProviderId = 'timer-compound';

export type TimerScrambleProviderId =
  | 'cubing'
  | TimerSharedScrambleProviderId
  | TimerCompoundScrambleProviderId;

export type TimerScrambleCapability =
  | {
      readonly kind: 'cubing';
      readonly cubingEventId: TimerCubingScrambleEventId;
    }
  | {
      readonly kind: 'shared';
      readonly provider: TimerSharedScrambleProviderId;
    }
  | {
      readonly kind: 'compound';
      readonly provider: TimerCompoundScrambleProviderId;
    }
  | {
      /** The user supplies the scramble; an empty value is intentional. */
      readonly kind: 'manual';
    }
  | {
      /** A shared generator/provider has not been migrated for this event yet. */
      readonly kind: 'unsupported';
    };

/**
 * Exhaustive random-scramble capability table for every Timer EventId.
 *
 * There is deliberately no default strategy. Adding an EventId fails the
 * typecheck until its real capability is declared here, and a runtime value
 * outside EventId is rejected rather than becoming a 3x3 scramble.
 */
export const TIMER_SCRAMBLE_CAPABILITIES = Object.freeze({
  '222': { kind: 'shared', provider: 'wca-pocket' },
  '333': { kind: 'cubing', cubingEventId: '333' },
  '444': { kind: 'cubing', cubingEventId: '444' },
  '555': { kind: 'cubing', cubingEventId: '555' },
  '666': { kind: 'cubing', cubingEventId: '666' },
  '777': { kind: 'cubing', cubingEventId: '777' },
  '333oh': { kind: 'cubing', cubingEventId: '333oh' },
  '333bld': { kind: 'cubing', cubingEventId: '333bf' },
  '333mbld': { kind: 'compound', provider: 'timer-compound' },
  '333ni': { kind: 'cubing', cubingEventId: '333bf' },
  '333fm': { kind: 'cubing', cubingEventId: '333fm' },
  '333mr': { kind: 'cubing', cubingEventId: '333' },
  sphere: { kind: 'cubing', cubingEventId: '333' },
  '444bld': { kind: 'cubing', cubingEventId: '444bf' },
  '555bld': { kind: 'cubing', cubingEventId: '555bf' },
  '666bld': { kind: 'compound', provider: 'timer-compound' },
  '777bld': { kind: 'compound', provider: 'timer-compound' },
  pyra: { kind: 'cubing', cubingEventId: 'pyram' },
  skewb: { kind: 'cubing', cubingEventId: 'skewb' },
  sq1: { kind: 'cubing', cubingEventId: 'sq1' },
  mega: { kind: 'cubing', cubingEventId: 'minx' },
  clock: { kind: 'cubing', cubingEventId: 'clock' },
  magic: { kind: 'compound', provider: 'timer-compound' },
  mmagic: { kind: 'compound', provider: 'timer-compound' },
  fto: { kind: 'cubing', cubingEventId: 'fto' },
  baby_fto: { kind: 'cubing', cubingEventId: 'baby_fto' },
  kilominx: { kind: 'shared', provider: 'cstimer-nonwca' },
  gear: { kind: 'shared', provider: 'small-puzzle-random-state' },
  ivy: { kind: 'shared', provider: 'small-puzzle-random-state' },
  redi: { kind: 'cubing', cubingEventId: 'redi_cube' },
  mpyram: { kind: 'shared', provider: 'cstimer-nonwca' },
  pyraminx_duo: { kind: 'shared', provider: 'small-puzzle-random-state' },
  superz: { kind: 'shared', provider: 'native-random-move' },
  dogic: { kind: 'shared', provider: 'native-random-move' },
  octahedron4: { kind: 'shared', provider: 'native-random-move' },
  dinoskewb: { kind: 'shared', provider: 'native-random-move' },
  cube3dino: { kind: 'shared', provider: 'native-random-move' },
  lattice: { kind: 'shared', provider: 'native-random-move' },
  hyperx: { kind: 'shared', provider: 'native-random-move' },
  latticex: { kind: 'shared', provider: 'native-random-move' },
  masterbrilic: { kind: 'shared', provider: 'native-random-move' },
  masterftov2: { kind: 'shared', provider: 'native-random-move' },
  quadx: { kind: 'shared', provider: 'native-random-move' },
  dinoocta: { kind: 'shared', provider: 'native-random-move' },
  fto5: { kind: 'shared', provider: 'native-random-move' },
  fto6: { kind: 'shared', provider: 'native-random-move' },
  eto: { kind: 'shared', provider: 'native-random-move' },
  radiocrystal: { kind: 'shared', provider: 'native-random-move' },
  cube3skewb: { kind: 'shared', provider: 'native-random-move' },
  heliskewb: { kind: 'shared', provider: 'native-random-move' },
  comboctahedron: { kind: 'shared', provider: 'native-random-move' },
  circoradiolarian: { kind: 'shared', provider: 'native-random-move' },
  icosababyface: { kind: 'shared', provider: 'native-random-move' },
  cube2heli: { kind: 'shared', provider: 'native-random-move' },
  cube3heli: { kind: 'shared', provider: 'native-random-move' },
  radiojewel: { kind: 'shared', provider: 'native-random-move' },
  radioweb: { kind: 'shared', provider: 'native-random-move' },
  radiojam: { kind: 'shared', provider: 'native-random-move' },
  catscradle: { kind: 'shared', provider: 'native-random-move' },
  radiocanon: { kind: 'shared', provider: 'native-random-move' },
  radiolarian3: { kind: 'shared', provider: 'native-random-move' },
  radiostar: { kind: 'shared', provider: 'native-random-move' },
  radiogem: { kind: 'shared', provider: 'native-random-move' },
  radiofathom: { kind: 'shared', provider: 'native-random-move' },
  r3: { kind: 'compound', provider: 'timer-compound' },
  r4: { kind: 'compound', provider: 'timer-compound' },
  r5: { kind: 'compound', provider: 'timer-compound' },
  cross: { kind: 'cubing', cubingEventId: '333' },
  f2l: { kind: 'shared', provider: 'training-state' },
  ll: { kind: 'shared', provider: 'trainer-case' },
  oll: { kind: 'shared', provider: 'trainer-case' },
  pll: { kind: 'shared', provider: 'trainer-case' },
  coll: { kind: 'shared', provider: 'trainer-case' },
  cmll: { kind: 'shared', provider: 'trainer-case' },
  zbll: { kind: 'shared', provider: 'trainer-case' },
  eg1: { kind: 'shared', provider: 'trainer-case' },
  eg2: { kind: 'shared', provider: 'trainer-case' },
  'cll': { kind: 'shared', provider: 'training-state' },
  'ell': { kind: 'shared', provider: 'training-state' },
  'eocp': { kind: 'shared', provider: 'training-state' },
  '2gll': { kind: 'shared', provider: 'training-state' },
  'ollcp': { kind: 'shared', provider: 'training-state' },
  'zzll': { kind: 'shared', provider: 'training-state' },
  'zbls': { kind: 'shared', provider: 'training-state' },
  'cfzb': { kind: 'shared', provider: 'training-state' },
  'lse': { kind: 'shared', provider: 'training-state' },
  'l10p': { kind: 'shared', provider: 'training-state' },
  custom: { kind: 'manual' },
  'pll-chain': { kind: 'manual' },
} as const satisfies Readonly<Record<EventId, TimerScrambleCapability>>);

/** Runtime-safe lookup for URL/import values that may only pretend to be EventId. */
export function timerScrambleCapability(event: string): TimerScrambleCapability | null {
  if (!Object.prototype.hasOwnProperty.call(TIMER_SCRAMBLE_CAPABILITIES, event)) return null;
  return TIMER_SCRAMBLE_CAPABILITIES[event as EventId];
}

/**
 * Manual queues allow an empty line set and Custom can start without a
 * scramble. Generated slots for ordinary providers always require text.
 */
export function timerScrambleAllowsEmptySlot(event: EventId, source: TimerScrambleSourceKind): boolean {
  return source === 'manual' || event === 'custom' || event === 'pll-chain';
}
