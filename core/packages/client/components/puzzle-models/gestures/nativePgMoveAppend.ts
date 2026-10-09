import { Alg, Move, experimentalAppendMove } from 'cubing/alg';
import type { NativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle, parseNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';

type AppendOptions = NonNullable<Parameters<typeof experimentalAppendMove>[2]>;
type EditableField = 'alg' | 'setupAlg' | 'setupAnchor';
interface Snapshot {
  alg: Alg;
  setupAlg: Alg;
  setupAnchor: 'start' | 'end';
}

interface Options {
  enabled: () => boolean;
  current: () => boolean;
  onMove: (moveText: string, anchoredSetup?: { setup: string }) => string | void;
}

/** Native PG manual append with bounded validation and end-anchor preservation.
 * For end anchoring, S -> S M and A -> A M keep S A^-1 as the start while the
 * endpoint moves to S M. Public Alg append and native catchUpMove retain the
 * player's cancellation rules and animation without storing an unchecked async
 * calculation in model.alg, where later rejection would poison the prop graph.
 *
 * The installed model.experimentalAddMove returns Promise<boolean>; TwistyPlayer's
 * public forwarding method may discard that promise, as it does upstream.
 */
export function attachNativePgMoveAppend(
  // TwistyPlayer exposes this model publicly through its experimental API.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  id: NativePuzzleId,
  opts: Options,
): () => void {
  const originalAddMove = model.experimentalAddMove;
  const puzzle = nativePuzzleKPuzzle(id);
  const puzzleSpecificSimplifyOptions: NonNullable<AppendOptions['puzzleSpecificSimplifyOptions']> = {
    quantumMoveOrder: (quantum) => puzzle.moveToTransformation(new Move(quantum, 1)).repetitionOrder(),
  };
  let live = true;
  let revision = 0;
  let expected: (Snapshot & { algEchoes: ReadonlySet<string> }) | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  const restores: Array<() => void> = [];
  const writes = {} as Record<EditableField, (input: unknown) => void>;
  const allowed = (): boolean => live && opts.current() && opts.enabled();
  const canonicalText = (text: string): string => parseNativePuzzleAlg(id, text).toString().trim();

  const isAcceptedEcho = (field: EditableField, input: unknown): boolean => {
    if (!expected) return false;
    if (field === 'setupAnchor') return input === expected.setupAnchor;
    const text = typeof input === 'string' ? input : input instanceof Alg ? input.toString() : null;
    if (text === null) return false; // An external promise invalidates pending work immediately.
    try {
      const canonical = canonicalText(text);
      // A newly edited comment is a new editor state even when its permutation
      // is unchanged. Only the actual callback receipt and native append text are
      // echoes; arbitrary transformation-equivalent edits invalidate the queue.
      return field === 'setupAlg'
        ? canonical === canonicalText(expected.setupAlg.toString())
        : expected.algEchoes.has(canonical);
    } catch { return false; }
  };
  for (const field of ['alg', 'setupAlg', 'setupAnchor'] as const) {
    const prop = model[field];
    const originalSet = prop.set;
    writes[field] = (input) => originalSet.call(prop, input);
    const wrappedSet = (input: unknown): void => {
      if (!isAcceptedEcho(field, input)) {
        revision++;
        expected = null;
      }
      originalSet.call(prop, input);
    };
    prop.set = wrappedSet;
    restores.push(() => { if (prop.set === wrappedSet) prop.set = originalSet; });
  }

  const readAlg = (value: { alg: Alg; issues?: { errors?: readonly string[] } }): Alg => {
    if (value.issues?.errors?.length) throw new Error('The editor contains an invalid algorithm');
    return parseNativePuzzleAlg(id, value.alg.toString());
  };
  const apply = async (move: Move, appendOptions: AppendOptions | undefined, requestedRevision: number): Promise<boolean> => {
    if (!allowed() || revision !== requestedRevision) return false;
    const [algValue, setupValue, setupAnchor] = await Promise.all([
      model.alg.get(), model.setupAlg.get(), model.setupAnchor.get(),
    ]);
    if (!allowed() || revision !== requestedRevision || (setupAnchor !== 'start' && setupAnchor !== 'end')) return false;
    const previous: Snapshot = { alg: readAlg(algValue), setupAlg: readAlg(setupValue), setupAnchor };
    const text = move.toString();
    // A newline is essential when an editor ends with a // line comment. Check
    // the full append before simplification, including its expanded work bound.
    parseNativePuzzleAlg(id, `${previous.alg.toString()}\n${text}`);
    if (setupAnchor === 'end') parseNativePuzzleAlg(id, `${previous.setupAlg.toString()}\n${text}`);
    const options: AppendOptions = {
      ...appendOptions,
      puzzleLoader: { puzzleSpecificSimplifyOptions },
    };
    const nextAlg = experimentalAppendMove(previous.alg, move, options);
    const nextSetup = setupAnchor === 'end'
      ? experimentalAppendMove(previous.setupAlg, move, options)
      : previous.setupAlg;
    parseNativePuzzleAlg(id, nextAlg.toString());
    parseNativePuzzleAlg(id, nextSetup.toString());
    const algEchoes = new Set([canonicalText(nextAlg.toString())]);
    if (!allowed() || revision !== requestedRevision) return false;

    // No await from here through the callback: an edit/disposal cannot interleave
    // an old transaction between the model writes or receive a late notification.
    expected = { alg: nextAlg, setupAlg: nextSetup, setupAnchor, algEchoes };
    if (setupAnchor === 'end') writes.setupAlg(nextSetup);
    writes.alg(nextAlg);
    model.timestampRequest.set('end');
    model.catchUpMove.set({ move, amount: 0 });
    try {
      const receipt = setupAnchor === 'end'
        ? opts.onMove(text, { setup: nextSetup.toString() })
        : opts.onMove(text);
      // The editor synchronously returns its actual appended/reduced text before
      // React effects echo it into the model. This also covers multiple queued
      // turns whose raw notation differs from native canonical move amounts.
      if (typeof receipt === 'string' && revision === requestedRevision && expected?.algEchoes === algEchoes && allowed()) {
        algEchoes.add(canonicalText(receipt));
      }
    } catch { /* Model accepted the move; an observer failure must not poison it. */ }
    return true;
  };

  const wrappedAddMove = (input: string | Move, appendOptions?: AppendOptions): Promise<boolean> => {
    if (!allowed()) return Promise.resolve(false);
    let move: Move;
    try {
      const text = typeof input === 'string' ? input : input.toString();
      parseNativePuzzleAlg(id, text);
      move = new Move(text); // The append API accepts one move, not an algorithm.
    } catch { return Promise.resolve(false); }
    const requestedRevision = revision;
    const result = tail.then(() => apply(move, appendOptions, requestedRevision)).catch(() => false);
    tail = result;
    return result;
  };
  model.experimentalAddMove = wrappedAddMove;

  return () => {
    live = false;
    revision++;
    expected = null;
    if (model.experimentalAddMove === wrappedAddMove) model.experimentalAddMove = originalAddMove;
    for (const restore of restores) restore();
  };
}
