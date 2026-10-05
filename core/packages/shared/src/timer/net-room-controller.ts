import { preferLatestNetRoomState, type NetBattleCredentials, type NetBattleSession, type NetRoomState, type NetResult } from './net-battle';

export type NetRoomGoneReason = 'room not found' | 'invalid player capability' | 'removed from room';
export function netRoomGoneReason(error: unknown): NetRoomGoneReason | null {
  const message = error instanceof Error ? error.message : '';
  return message === 'room not found' || message === 'invalid player capability' || message === 'removed from room' ? message : null;
}

/** A transport failure must not turn a saved participant into a newly joined player. */
export async function restoreNetRoomSession(session: NetBattleSession,
  getRoom: (code: string, auth: NetBattleCredentials) => Promise<NetRoomState>,
): Promise<NetRoomState> {
  const state = await getRoom(session.code, session);
  if (state.code !== session.code) throw new Error('invalid player capability');
  if (!state.players[session.playerId]) throw new Error('removed from room');
  return state;
}

type Session = { code: string; auth: NetBattleCredentials };
type Request = (session: Session) => Promise<NetRoomState>;
interface RequestOptions { retries?: number; quiet?: boolean; advance?: boolean; onSuccess?(): void; onSettled?(): void; accepted?(state: NetRoomState, session: Session): boolean }

/** One lifecycle for Web and installed hosts. Every request captures the current membership,
 * including its generation, so leaving/rejoining the same room cannot accept late responses. */
export class NetRoomController {
  callbacks: {
    onState(state: NetRoomState): void;
    onError(error: unknown): void;
    onGone(reason: NetRoomGoneReason): void;
    isTiming(): boolean;
  } = { onState() {}, onError() {}, onGone() {}, isTiming: () => false };
  private session: Session | null = null;
  private generation = 0;
  private latest: NetRoomState | null = null;
  private displayed: NetRoomState | null = null;
  private polling = false;
  private advancing = false;
  private ensuring = new Set<string>();
  private submissions = new Map<number, Promise<boolean>>();
  get isAdvancing(): boolean { return this.advancing; }
  activate(state: NetRoomState, auth: NetBattleCredentials): void {
    this.deactivate();
    this.session = { code: state.code, auth: { ...auth } };
    this.receive(state, true);
  }
  deactivate(): void {
    this.generation++;
    this.session = null;
    this.latest = this.displayed = null;
    this.polling = this.advancing = false;
    this.ensuring = new Set();
    this.submissions = new Map();
  }
  private receive(state: NetRoomState, advance = false): void {
    if (!this.session || state.code !== this.session.code) return;
    const latest = preferLatestNetRoomState(this.latest, state);
    if (latest !== state && !advance) return;
    state = latest;
    if (!state.players[this.session.auth.playerId]) { this.end('removed from room'); return; }
    this.latest = state;
    const current = this.displayed;
    if (current && state.round > current.round && (!advance || this.callbacks.isTiming())) {
      // Keep this device's result visible until it explicitly continues; refresh membership/heartbeats.
      const players = Object.fromEntries(Object.entries(state.players).map(([id, player]) => [id,
        current.players[id] ? { ...current.players[id], seen: player.seen } : player,
      ]));
      const historical = state.history.find(round => round.round === current.round)?.results;
      this.displayed = { ...current, now: state.now, admin: state.admin, players,
        results: { ...current.results, ...(historical ? { [current.round]: historical } : {}), ...state.results },
        history: state.history, scores: state.scores };
    } else this.displayed = state;
    this.callbacks.onState(this.displayed);
  }
  private end(reason: NetRoomGoneReason): void { this.deactivate(); this.callbacks.onGone(reason); }
  async execute(request: Request, options: RequestOptions = {}): Promise<boolean> {
    const session = this.session, generation = this.generation;
    if (!session) return false;
    try {
      for (let attempt = 0; attempt <= (options.retries ?? 0); attempt++) {
        try {
          const state = await request(session);
          if (generation !== this.generation) return false;
          this.receive(state, options.advance);
          if (generation !== this.generation) return false;
          if (options.accepted && !options.accepted(state, session)) {
            this.callbacks.onError(new Error('result rejected'));
            return false;
          }
          options.onSuccess?.();
          return true;
        } catch (error) {
          if (generation !== this.generation) return false;
          const gone = netRoomGoneReason(error);
          if (gone) { this.end(gone); return false; }
          if (attempt === (options.retries ?? 0)) {
            if (!options.quiet) this.callbacks.onError(error);
            return false;
          }
        }
      }
      return false;
    } finally { if (generation === this.generation) options.onSettled?.(); }
  }
  async poll(getRoom: (code: string, auth: NetBattleCredentials) => Promise<NetRoomState>): Promise<void> {
    if (this.polling || !this.session) return;
    const generation = this.generation;
    this.polling = true;
    try { await this.execute(({ code, auth }) => getRoom(code, auth), { quiet: true }); }
    finally { if (generation === this.generation) this.polling = false; }
  }
  submitResult(round: number, request: Request, expected: NetResult): Promise<boolean> {
    const generation = this.generation, submissions = this.submissions;
    const previous = submissions.get(round) ?? Promise.resolve(true);
    const pending = previous.then(() => generation === this.generation
      ? this.execute(request, { retries: 1, accepted: (state, session) => {
        if (!(state as NetRoomState & { advanced?: boolean }).advanced) return true;
        const saved = state.results[String(round)]?.[session.auth.playerId]
          ?? state.history.find(item => item.round === round)?.results[session.auth.playerId];
        return saved?.t === expected.t && saved?.p === expected.p;
      } }) : false);
    submissions.set(round, pending);
    void pending.finally(() => { if (submissions.get(round) === pending) submissions.delete(round); });
    return pending;
  }
  async advance(next: (code: string, auth: NetBattleCredentials, round: number, force: boolean) => Promise<NetRoomState>, force = false): Promise<void> {
    if (this.advancing || !this.displayed || this.callbacks.isTiming()) return;
    const round = this.displayed.round, generation = this.generation;
    this.advancing = true;
    try { await this.execute(({ code, auth }) => next(code, auth, round, force), { advance: true }); }
    finally { if (generation === this.generation) this.advancing = false; }
  }
  async ensure(event: string, request: Request): Promise<void> {
    if (!this.displayed) return;
    const key = `${this.displayed.round}:${event}`;
    const ensuring = this.ensuring;
    if (ensuring.has(key)) return;
    ensuring.add(key);
    try { await this.execute(request, { quiet: true }); }
    finally { ensuring.delete(key); }
  }
}

/** Hosts own visibility/connectivity subscriptions; cadence and non-overlap stay shared. */
export function startNetRoomPolling(controller: NetRoomController,
  getRoom: (code: string, auth: NetBattleCredentials) => Promise<NetRoomState>,
  host: { visible(): boolean; subscribeWake(wake: () => void): () => void },
): () => void {
  let stopped = false;
  const wake = () => { if (!stopped && host.visible()) void controller.poll(getRoom); };
  const interval = setInterval(wake, 1_000);
  const unsubscribe = host.subscribeWake(wake);
  return () => { stopped = true; clearInterval(interval); unsubscribe(); };
}

/** Restore retries keep the saved capability; only a definitive expiry/removal clears it. */
export function startNetRoomRestore(options: {
  current(): boolean;
  load(): Promise<NetBattleSession | null>;
  getRoom(code: string, auth: NetBattleCredentials): Promise<NetRoomState>;
  clear(): Promise<void>;
  restored(session: NetBattleSession, state: NetRoomState): void;
  missing(): void;
  error(error: unknown): void;
}): () => void {
  let stopped = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const current = () => !stopped && options.current();
  const run = async () => {
    try {
      const session = await options.load();
      if (!current()) return;
      if (!session) { options.missing(); return; }
      const state = await restoreNetRoomSession(session, options.getRoom);
      if (current()) options.restored(session, state);
    } catch (error) {
      if (!current()) return;
      if (netRoomGoneReason(error)) {
        await options.clear().catch(() => undefined);
        if (current()) options.error(error);
      } else {
        options.error(error);
        retry = setTimeout(() => { if (current()) void run(); }, 1_000);
      }
    }
  };
  void run();
  return () => { stopped = true; clearTimeout(retry); };
}
