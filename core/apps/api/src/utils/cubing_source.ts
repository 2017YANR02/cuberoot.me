/** All online consumers share HTTP snapshots; offline jobs keep their own lifecycle. */
import {
  fetchCubingCompetitions as readCompetitions, fetchCubingCompetitors as readCompetitors,
  fetchCubingJson as readJson, fetchCubingLiveRound as readRound,
  type CubingCompetition,
} from '@cuberoot/shared/cubing-live';

const BASE = 'https://api.cubing.com/competitions';
const MINUTE = 60_000;
interface Entry { body: string; status: number; headers: Headers; expires: number; fetchedAt: number }

/** Per-process cache, bounded concurrency, negative caching and host-wide Retry-After. */
export class CubingHttpCache {
  private entries = new Map<string, Entry>();
  private pending = new Map<string, Promise<Entry>>();
  private dates = new Map<string, Pick<CubingCompetition, 'startDate' | 'endDate'>>();
  private active = 0;
  private queue: (() => void)[] = [];
  private bytes = 0;
  private retryAt = 0;

  clear(): void {
    this.entries.clear();
    this.pending.clear();
    this.dates.clear();
    this.bytes = 0;
    this.retryAt = 0;
  }

  retryDelayMs(): number { return Math.max(0, this.retryAt - Date.now()); }

  observeThrottle(response: Response): number {
    if (response.status !== 429 && response.status !== 503) return 0;
    const retry = response.headers.get('retry-after');
    const delay = retry && /^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 : retry ? Date.parse(retry) - Date.now() : 0;
    const ttl = Math.max(response.status === 429 ? MINUTE : 10_000, Number.isFinite(delay) ? delay : 0);
    if (response.status === 429 || retry) this.retryAt = Math.max(this.retryAt, Date.now() + ttl);
    return ttl;
  }

  private rememberDate(slug: string, comp: Pick<CubingCompetition, 'startDate' | 'endDate'>): void {
    this.dates.delete(slug);
    this.dates.set(slug, comp);
    if (this.dates.size > 2000) this.dates.delete(this.dates.keys().next().value!);
  }

  private ttl(url: URL, json: unknown): number {
    const data = json as Partial<CubingCompetition> & { round?: { status?: string }; data?: CubingCompetition[] } | null;
    if (url.pathname === '/competitions') {
      if (Array.isArray(data?.data)) for (const comp of data.data) {
        if (!comp.alias || !/^\d{4}-\d{2}-\d{2}$/.test(comp.startDate)) continue;
        this.rememberDate(comp.alias, { startDate: comp.startDate, endDate: comp.endDate });
        const key = BASE + '/' + encodeURIComponent(comp.alias);
        // A newly published competition must not inherit an earlier hour-long 404.
        if (this.entries.get(key)?.status === 404) this.remove(key);
      }
      return 2 * MINUTE;
    }
    const slug = decodeURIComponent(url.pathname.split('/')[2] ?? '');
    if (data?.startDate && /^\d{4}-\d{2}-\d{2}$/.test(data.startDate)) {
      this.rememberDate(slug, { startDate: data.startDate, endDate: data.endDate ?? null });
    }
    const date = this.dates.get(slug);
    const elapsed = date ? Date.now() - Date.parse((date.endDate || date.startDate) + 'T23:59:59+08:00') : 0;
    // SSE invalidation bypasses these TTLs, including late corrections and deletions.
    if (url.pathname.includes('/live/results/')) {
      if (elapsed > 2 * 86400_000) return 6 * 60 * MINUTE;
      if (elapsed > 0) return 15 * MINUTE;
      return data?.round?.status === 'finished' ? MINUTE : 5_000;
    }
    if (url.pathname.endsWith('/live/rounds')) return elapsed > 0 ? 15 * MINUTE : MINUTE;
    if (url.pathname.endsWith('/competitors')) return 5 * MINUTE;
    return 5 * MINUTE;
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.body.length * 2;
    this.entries.delete(key);
  }

  /** Invalidate before notifying viewers. In-flight responses must not repopulate old data. */
  invalidate(slug: string, eventId?: string, roundNumber?: number): void {
    const prefix = BASE + '/' + encodeURIComponent(slug);
    const roundPath = eventId && roundNumber
      ? prefix + '/live/results/' + encodeURIComponent(eventId) + '/' + roundNumber : null;
    for (const key of new Set([...this.entries.keys(), ...this.pending.keys()])) {
      if (key === prefix || key === prefix + '/live/rounds' || key === prefix + '/competitors'
        || key === prefix + '/live/podiums' || (roundPath ? key === roundPath : key.startsWith(prefix + '/live/results/'))) {
        this.remove(key);
        // Existing callers may finish, but the next request starts a fresh generation.
        this.pending.delete(key);
      }
    }
  }

  private async load(key: string, init?: RequestInit): Promise<Entry> {
    // A slot is transferred directly to the next waiter; never exceed three upstream requests.
    if (this.active >= 3) await new Promise<void>(resolve => this.queue.push(resolve));
    else this.active++;
    try {
      if (Date.now() < this.retryAt) return {
        body: '{}', status: 429, headers: new Headers({ 'Retry-After': String(Math.ceil((this.retryAt - Date.now()) / 1000)) }), expires: this.retryAt, fetchedAt: Date.now(),
      };
      // One viewer leaving must not cancel a request shared with other viewers/monitors.
      const response = await fetch(key, { ...init, signal: AbortSignal.timeout(15_000) });
      const body = await response.text();
      let ttl = 0;
      if (response.ok) {
        ttl = this.ttl(new URL(key), JSON.parse(body));
      } else if (response.status === 404) {
        ttl = new URL(key).pathname.split('/').length === 3 ? 60 * MINUTE : MINUTE;
      } else {
        ttl = this.observeThrottle(response) || 10_000;
      }
      return { body, status: response.status, headers: new Headers(response.headers), expires: Date.now() + ttl, fetchedAt: Date.now() };
    } catch {
      return { body: '{}', status: 503, headers: new Headers(), expires: Date.now() + 10_000, fetchedAt: Date.now() };
    } finally {
      const next = this.queue.shift();
      if (next) next(); else this.active--;
    }
  }

  request: typeof fetch = (input, init) => this.cachedRequest(input, init);

  /** Interactive views retain a short polling fallback even if SSE is unavailable. */
  liveRequest: typeof fetch = (input, init) => this.cachedRequest(input, init, 5_000);

  private async cachedRequest(input: Parameters<typeof fetch>[0], init?: RequestInit, maxAgeMs = Infinity): Promise<Response> {
    const key = input instanceof Request ? input.url : String(input);
    const url = new URL(key);
    if (url.origin !== 'https://api.cubing.com' || !url.pathname.startsWith('/competitions')) throw new Error('Invalid cubing source URL');
    init?.signal?.throwIfAborted();
    const cached = this.entries.get(key);
    let entry: Entry;
    if (cached && cached.expires > Date.now() && (cached.status >= 400 || Date.now() - cached.fetchedAt < maxAgeMs)) entry = cached;
    else {
      let job = this.pending.get(key);
      if (!job) {
        job = this.load(key, init).then(value => {
          if (this.pending.get(key) === job) {
            this.remove(key);
            this.entries.set(key, value);
            this.bytes += value.body.length * 2;
            while (this.entries.size > 2000 || this.bytes > 32 * 1024 * 1024) this.remove(this.entries.keys().next().value!);
          }
          return value;
        }).finally(() => { if (this.pending.get(key) === job) this.pending.delete(key); });
        this.pending.set(key, job);
      }
      entry = await job;
    }
    init?.signal?.throwIfAborted();
    // New Response/JSON parse for each caller: enrichers cannot mutate another consumer's cache.
    return new Response(entry.body, { status: entry.status, headers: entry.headers });
  }
}

export const cubingHttp = new CubingHttpCache();
export const fetchCubingCompetitions = () => readCompetitions(cubingHttp.request);
export const fetchCubingCompetitors = (slug: string) => readCompetitors(slug, cubingHttp.request);
export const fetchCubingJson = <T>(slug: string, path = '', signal?: AbortSignal) => readJson<T>(slug, path, signal, cubingHttp.request);
export const fetchCubingLiveRound = (slug: string, event: string, round: number, roundType: string, signal?: AbortSignal, interactive = false) =>
  readRound(slug, event, round, roundType, signal, interactive ? cubingHttp.liveRequest : cubingHttp.request);

/** A complete cached directory is authoritative; don't probe every foreign WCA competition. */
export async function findCubingCompetition(id: string): Promise<CubingCompetition | null> {
  const competitions = await fetchCubingCompetitions();
  return competitions.find(comp => comp.wcaCompetitionId === id || comp.alias === id
    || (comp.type === 'WCA' && !comp.wcaCompetitionId && comp.alias.replaceAll('-', '') === id)) ?? null;
}

/** Ongoing events retain minute polling. Ended events still receive eventual corrections. */
export function cubingRecordInterval(comp: Pick<CubingCompetition, 'startDate' | 'endDate'>, now = Date.now()): number {
  const ended = Date.parse((comp.endDate || comp.startDate) + 'T23:59:59+08:00');
  if (!Number.isFinite(ended) || now <= ended) return MINUTE;
  return now - ended <= 2 * 86400_000 ? 15 * MINUTE : 6 * 60 * MINUTE;
}
