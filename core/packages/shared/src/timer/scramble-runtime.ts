import { optimalPocketScramble, wcaPocketScramble } from './pocket-scramble';
import {
  DEFAULT_SCRAMBLE_222_MODE,
  DEFAULT_SCRAMBLE_222_TYPE,
  type Scramble222Mode,
  type Scramble222Type,
} from './scramble-222';
import {
  TIMER_COMPOUND_SCRAMBLE_CHILDREN,
  formatTimerCompoundScramble,
  type TimerCompoundScrambleEventId,
} from './compound-scramble';
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
  | 'minx'
  | 'pyram'
  | 'redi_cube'
  | 'skewb'
  | 'sq1';

/** Runtime-neutral generators owned by shared rather than a host or cubing.js. */
export type TimerSharedScrambleProviderId =
  | 'wca-pocket'
  | 'trainer-case'
  | 'small-puzzle-random-state'
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
  kilominx: { kind: 'shared', provider: 'cstimer-nonwca' },
  gear: { kind: 'shared', provider: 'small-puzzle-random-state' },
  ivy: { kind: 'shared', provider: 'small-puzzle-random-state' },
  redi: { kind: 'cubing', cubingEventId: 'redi_cube' },
  mpyram: { kind: 'shared', provider: 'cstimer-nonwca' },
  r3: { kind: 'compound', provider: 'timer-compound' },
  r4: { kind: 'compound', provider: 'timer-compound' },
  r5: { kind: 'compound', provider: 'timer-compound' },
  cross: { kind: 'cubing', cubingEventId: '333' },
  f2l: { kind: 'cubing', cubingEventId: '333' },
  ll: { kind: 'shared', provider: 'trainer-case' },
  oll: { kind: 'shared', provider: 'trainer-case' },
  pll: { kind: 'shared', provider: 'trainer-case' },
  coll: { kind: 'shared', provider: 'trainer-case' },
  cmll: { kind: 'shared', provider: 'trainer-case' },
  zbll: { kind: 'shared', provider: 'trainer-case' },
  eg1: { kind: 'shared', provider: 'trainer-case' },
  eg2: { kind: 'shared', provider: 'trainer-case' },
  custom: { kind: 'manual' },
} as const satisfies Readonly<Record<EventId, TimerScrambleCapability>>);

export type TimerScrambleErrorCode =
  | 'unsupported-event'
  | 'generation-failed'
  | 'empty-result';

export interface TimerScrambleMetadata {
  readonly caseId?: string;
  readonly solutionAlg?: string;
}

export type TimerScrambleResult =
  | {
      readonly ok: true;
      readonly event: EventId;
      readonly kind: 'generated';
      readonly provider: TimerScrambleProviderId;
      readonly scramble: string;
      readonly metadata?: TimerScrambleMetadata;
    }
  | {
      readonly ok: true;
      readonly event: EventId;
      readonly kind: 'manual';
      readonly scramble: '';
    }
  | {
      readonly ok: false;
      readonly event: EventId;
      readonly code: TimerScrambleErrorCode;
      readonly retryable: boolean;
    };

export interface TimerScrambleRequest {
  readonly event: EventId;
  readonly scramble222Mode?: Scramble222Mode;
  readonly scramble222Type?: Scramble222Type;
  /** Exact shared case ids. Empty or stale subsets preserve the full corpus. */
  readonly trainerCaseIds?: readonly string[];
}

export type TimerCubingScrambleGenerator = (
  cubingEventId: TimerCubingScrambleEventId,
  requestedEvent: EventId,
) => Promise<string>;

export type TimerSharedScrambleValue = string | {
  readonly scramble: string;
  readonly metadata?: TimerScrambleMetadata;
};

/** Providers whose platform worker may be injected without replacing shared business logic. */
export type TimerHostSharedScrambleProviderId =
  | 'wca-pocket'
  | 'cstimer-nonwca'
  | 'small-puzzle-random-state';

export type TimerSharedScrambleGenerator = (
  provider: TimerHostSharedScrambleProviderId,
  requestedEvent: EventId,
  request: TimerScrambleRequest,
) => TimerSharedScrambleValue | Promise<TimerSharedScrambleValue>;

export interface TimerScrambleDependencies {
  /** Test seam and future host-specific worker adapter. */
  readonly generateCubingScramble?: TimerCubingScrambleGenerator;
  /** Host worker seam for pocket scrambles; all other shared providers stay canonical shared logic. */
  readonly generateSharedScramble?: TimerSharedScrambleGenerator;
  /** Deterministic seam for constant-choice recipes such as Magic. */
  readonly random?: () => number;
  /** Prevent a stalled worker/provider from leaving the visible timer unusable. */
  readonly requestTimeoutMs?: number;
}

const DEFAULT_TIMER_SCRAMBLE_REQUEST_TIMEOUT_MS = 12_000;

async function waitForTimerScramble<T>(
  result: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('timer scramble generation timed out')),
      timeoutMs,
    );
    result.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

/** Runtime-safe lookup for URL/import values that may only pretend to be EventId. */
export function timerScrambleCapability(event: string): TimerScrambleCapability | null {
  if (!Object.prototype.hasOwnProperty.call(TIMER_SCRAMBLE_CAPABILITIES, event)) return null;
  return TIMER_SCRAMBLE_CAPABILITIES[event as EventId];
}

/**
 * Website-compatible empty scramble slots.
 *
 * Manual source queues intentionally allow an empty line set to start a solve,
 * and the Custom event's random/retained-WCA route intentionally resolves to
 * an empty user-supplied slot. Every other provider must return real text.
 */
export function timerScrambleAllowsEmptySlot(
  event: EventId,
  source: TimerScrambleSourceKind,
): boolean {
  return source === 'manual' || event === 'custom';
}

async function defaultCubingScrambleGenerator(
  cubingEventId: TimerCubingScrambleEventId,
): Promise<string> {
  const { randomScrambleForEvent } = await import('cubing/scramble');
  return (await randomScrambleForEvent(cubingEventId)).toString();
}

async function defaultSharedScrambleGenerator(
  provider: TimerSharedScrambleProviderId,
  requestedEvent: EventId,
  request: TimerScrambleRequest,
  random?: () => number,
): Promise<TimerSharedScrambleValue> {
  switch (provider) {
    case 'wca-pocket': {
      const type = request.scramble222Type ?? DEFAULT_SCRAMBLE_222_TYPE;
      if (type !== 'full') throw new Error(`2x2 scramble type requires a shared specialist provider: ${type}`);
      return (request.scramble222Mode ?? DEFAULT_SCRAMBLE_222_MODE) === 'optimal'
        ? optimalPocketScramble()
        : wcaPocketScramble();
    }
    case 'trainer-case': {
      const {
        generateTimerTrainerScramble,
        isTimerTrainerEvent,
      } = await import('./trainer-scramble');
      if (!isTimerTrainerEvent(requestedEvent)) {
        throw new Error(`Trainer provider cannot generate event: ${requestedEvent}`);
      }
      const generated = generateTimerTrainerScramble(requestedEvent, {
        caseIds: request.trainerCaseIds,
        random,
      });
      return {
        scramble: generated.scramble,
        metadata: {
          caseId: generated.caseId,
          solutionAlg: generated.solutionAlg,
        },
      };
    }
    case 'small-puzzle-random-state': {
      if (requestedEvent === 'gear') {
        const { generateGearTimerScramble } = await import('@cuberoot/puzzle-solvers/gear');
        return generateGearTimerScramble(random);
      }
      if (requestedEvent === 'ivy') {
        const { generateIvyTimerScramble } = await import('@cuberoot/puzzle-solvers/ivy');
        return generateIvyTimerScramble(random);
      }
      throw new Error(`Small-puzzle provider cannot generate event: ${requestedEvent}`);
    }
    case 'cstimer-nonwca': {
      const {
        generateCstimerNonWcaTimerScramble,
        isCstimerNonWcaTimerEvent,
      } = await import('@cuberoot/puzzle-solvers/cstimer-nonwca');
      if (!isCstimerNonWcaTimerEvent(requestedEvent)) {
        throw new Error(`csTimer non-WCA provider cannot generate event: ${requestedEvent}`);
      }
      return generateCstimerNonWcaTimerScramble(requestedEvent);
    }
  }
}

async function generateCompoundScramble(
  event: TimerCompoundScrambleEventId,
  request: TimerScrambleRequest,
  dependencies: TimerScrambleDependencies,
): Promise<TimerScrambleResult> {
  const childScrambles: string[] = [];
  for (const childEvent of TIMER_COMPOUND_SCRAMBLE_CHILDREN[event]) {
    const childRequest: TimerScrambleRequest = childEvent === '222'
      ? {
          event: childEvent,
          scramble222Mode: request.scramble222Mode,
          // Relay scrambles always use a complete 2x2 state rather than a
          // persisted 2x2-only specialist case selection.
          scramble222Type: 'full',
        }
      : { event: childEvent };
    const child = await generateTimerScramble(childRequest, dependencies);
    if (!child.ok) {
      return {
        ok: false,
        event,
        code: child.code,
        retryable: child.retryable,
      };
    }
    if (child.kind !== 'generated') {
      return {
        ok: false,
        event,
        code: 'generation-failed',
        retryable: true,
      };
    }
    childScrambles.push(child.scramble);
  }

  try {
    const scramble = formatTimerCompoundScramble(
      event,
      childScrambles,
      dependencies.random,
    ).trim();
    if (!scramble) {
      return {
        ok: false,
        event,
        code: 'empty-result',
        retryable: true,
      };
    }
    return {
      ok: true,
      event,
      kind: 'generated',
      provider: 'timer-compound',
      scramble,
    };
  } catch {
    return {
      ok: false,
      event,
      code: 'generation-failed',
      retryable: true,
    };
  }
}

/**
 * Generate a timer scramble without consulting app globals or silently
 * changing the requested event. Unsupported and failed providers are data the
 * host can render/retry; neither branch ever substitutes a 3x3 scramble.
 */
export async function generateTimerScramble(
  request: TimerScrambleRequest,
  dependencies: TimerScrambleDependencies = {},
): Promise<TimerScrambleResult> {
  const capability = timerScrambleCapability(request.event);
  if (!capability || capability.kind === 'unsupported') {
    return {
      ok: false,
      event: request.event,
      code: 'unsupported-event',
      retryable: false,
    };
  }
  if (capability.kind === 'manual') {
    return { ok: true, event: request.event, kind: 'manual', scramble: '' };
  }
  if (capability.kind === 'compound') {
    return generateCompoundScramble(request.event as TimerCompoundScrambleEventId, request, dependencies);
  }

  try {
    const provider: TimerScrambleProviderId = capability.kind === 'cubing'
      ? 'cubing'
      : capability.provider;
    const generatedValue = await waitForTimerScramble(
      Promise.resolve(capability.kind === 'cubing'
        ? (dependencies.generateCubingScramble ?? defaultCubingScrambleGenerator)(
            capability.cubingEventId,
            request.event,
          )
        : capability.provider === 'wca-pocket'
            || capability.provider === 'cstimer-nonwca'
            || capability.provider === 'small-puzzle-random-state'
          ? dependencies.generateSharedScramble
            ? dependencies.generateSharedScramble(capability.provider, request.event, request)
            : defaultSharedScrambleGenerator(
                capability.provider,
                request.event,
                request,
                dependencies.random,
              )
          : defaultSharedScrambleGenerator(
              capability.provider,
              request.event,
              request,
              dependencies.random,
            )),
      dependencies.requestTimeoutMs ?? DEFAULT_TIMER_SCRAMBLE_REQUEST_TIMEOUT_MS,
    );
    const generated = typeof generatedValue === 'string'
      ? { scramble: generatedValue }
      : generatedValue;
    const scramble = generated.scramble.trim();
    if (!scramble) {
      return {
        ok: false,
        event: request.event,
        code: 'empty-result',
        retryable: true,
      };
    }
    return {
      ok: true,
      event: request.event,
      kind: 'generated',
      provider,
      scramble,
      ...(generated.metadata ? { metadata: generated.metadata } : {}),
    };
  } catch {
    return {
      ok: false,
      event: request.event,
      code: 'generation-failed',
      retryable: true,
    };
  }
}
