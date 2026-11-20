import { optimalPocketScramble, wcaPocketScramble } from './pocket-scramble';
import { applyColorNeutral, isCnEligible, normalizeTimerColorNeutralMode, type CnMode } from './color-neutral';
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
import type { EventId } from './types';
import { timerScrambleCapability, type TimerCubingScrambleEventId, type TimerScrambleProviderId, type TimerSharedScrambleProviderId } from './scramble-capabilities';

export * from './scramble-capabilities';

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
  /** Opt-in for ordinary generated scrambles; hosts omit this for constrained generators. */
  readonly cnMode?: CnMode;
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
  | 'training-state'
  | 'wca-pocket'
  | 'cstimer-nonwca'
  | 'small-puzzle-random-state'
  | 'native-random-move';

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
  /** Prevent a stalled provider from blocking the timer. Null delegates the
   * timeout to the host transport when the generator runs inside a Worker. */
  readonly requestTimeoutMs?: number | null;
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
    case 'training-state': {
      const { generateTimerTrainingStateScramble, isTimerTrainingStateEvent } = await import('./training-state-scramble');
      const { generateCstimerScramble } = await import('@cuberoot/puzzle-solvers/cstimer-nonwca');
      if (!isTimerTrainingStateEvent(requestedEvent)) throw new Error('Unknown training state event');
      if (requestedEvent === 'lse' || requestedEvent === 'l10p') {
        const { generateRouxTrainingCandidate } = await import('./training-state-engine');
        return generateTimerTrainingStateScramble(requestedEvent, () => generateRouxTrainingCandidate(
          requestedEvent === 'lse' ? 'roux-lse' : 'roux-l10p'));
      }
      return generateTimerTrainingStateScramble(requestedEvent, generateCstimerScramble);
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
      if (requestedEvent === 'pyraminx_duo') {
        const { generatePyraminxDuoScramble } = await import('@cuberoot/puzzle-solvers/pyraminx-duo');
        return generatePyraminxDuoScramble(random);
      }
      throw new Error(`Small-puzzle provider cannot generate event: ${requestedEvent}`);
    }
    case 'native-random-move': {
      const { generateNativePuzzleScramble, isNativePuzzleId } = await import('@cuberoot/puzzle-solvers/native-puzzles');
      if (!isNativePuzzleId(requestedEvent)) {
        throw new Error(`Native random-move provider cannot generate event: ${requestedEvent}`);
      }
      return generateNativePuzzleScramble(requestedEvent, random);
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
    const generation = Promise.resolve(capability.kind === 'cubing'
        ? (dependencies.generateCubingScramble ?? defaultCubingScrambleGenerator)(
            capability.cubingEventId,
            request.event,
          )
        : capability.provider === 'training-state'
            || capability.provider === 'wca-pocket'
            || capability.provider === 'cstimer-nonwca'
            || capability.provider === 'small-puzzle-random-state'
            || capability.provider === 'native-random-move'
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
            ));
    const generatedValue = await (dependencies.requestTimeoutMs === null
      ? generation
      : waitForTimerScramble(generation, dependencies.requestTimeoutMs ?? DEFAULT_TIMER_SCRAMBLE_REQUEST_TIMEOUT_MS));
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
      scramble: isCnEligible(request.event)
        ? applyColorNeutral(scramble, normalizeTimerColorNeutralMode(request.cnMode), dependencies.random)
        : scramble,
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
