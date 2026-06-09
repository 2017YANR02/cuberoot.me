/**
 * WCA real-scramble pool — feeds the timer with actual past WCA competition
 * scrambles (mirrored server-side in wca_scrambles, served by
 * /v1/wca/scrambles/random). generateScramble() is synchronous, so we keep a
 * small in-memory queue per WCA event and refill it in the background; the
 * SoloView shows a brief loading state when the queue is momentarily empty.
 *
 * Each scramble carries its source metadata (competition / event / round /
 * group / number) so the SoloView can show where it came from — same shape as
 * the landing page's RecentScrambles meta (ci/cn/e/r/g/n/x). Metadata is keyed
 * by the (normalized) scramble string, looked up via wcaMetaFor().
 */
import { apiUrl } from '@/lib/api-base';
import type { EventId } from '../types';

// timer EventId → WCA scrambles event_id. Events absent here have no real
// competition scrambles (relays / CFOP-step training / 6-7 BLD / magic) and
// always fall back to locally generated scrambles.
const EVENT_MAP: Partial<Record<EventId, string>> = {
  '222': '222', '333': '333', '444': '444', '555': '555', '666': '666', '777': '777',
  '333oh': '333oh', '333fm': '333fm', '333mr': '333', '333ni': '333',
  '333bld': '333bf', '333mbld': '333mbf', '444bld': '444bf', '555bld': '555bf',
  pyra: 'pyram', skewb: 'skewb', sq1: 'sq1', mega: 'minx', clock: 'clock',
};

const FETCH_COUNT = 50;
const REFILL_AT = 8;
const META_CAP = 1000; // 元数据 Map 软上限,超出按插入序丢最旧。

/** 一条真实打乱的来源元数据(键名对齐首页 RecentScrambles 的 ScrMeta)。 */
export interface WcaScrambleMeta {
  ci: string;          // competition_id
  cn: string;          // 比赛英文名(localizeCompName 再本地化)
  e: string;           // event_id
  r: string;           // round_type_id
  g: string;           // group_id
  n: number;           // scramble_num
  x: 0 | 1;            // is_extra
}
interface RandomItem extends WcaScrambleMeta { scramble: string }

const pools: Record<string, string[]> = {};
const inflight: Record<string, Promise<void> | undefined> = {};
const metaByScramble = new Map<string, WcaScrambleMeta>();

/** Normalize stray non-ASCII punctuation (e.g. a Pyraminx scramble that used ’
 *  instead of ') so cubing.js / renderers accept the move string. */
function normalize(s: string): string {
  return s.replace(/[‘’ʼ′]/g, "'");
}

function wcaEvent(event: EventId): string | undefined {
  return EVENT_MAP[event];
}

function rememberMeta(s: string, m: WcaScrambleMeta): void {
  metaByScramble.set(s, m);
  while (metaByScramble.size > META_CAP) {
    const oldest = metaByScramble.keys().next().value;
    if (oldest === undefined) break;
    metaByScramble.delete(oldest);
  }
}

async function fill(wev: string): Promise<void> {
  if (inflight[wev]) return inflight[wev];
  const p = (async () => {
    try {
      const res = await fetch(
        apiUrl(`/v1/wca/scrambles/random?event=${encodeURIComponent(wev)}&count=${FETCH_COUNT}`),
      );
      if (res.ok) {
        const data = (await res.json()) as { scrambles?: RandomItem[] };
        if (Array.isArray(data.scrambles)) {
          const q = (pools[wev] ??= []);
          for (const it of data.scrambles) {
            if (!it?.scramble) continue;
            const s = normalize(it.scramble);
            q.push(s);
            rememberMeta(s, { ci: it.ci, cn: it.cn, e: it.e, r: it.r, g: it.g, n: it.n, x: it.x });
          }
        }
      }
    } catch {
      /* network error — caller falls back to a generated scramble */
    } finally {
      inflight[wev] = undefined;
    }
  })();
  inflight[wev] = p;
  return p;
}

/** Whether this event has real WCA scrambles available. */
export function hasWcaScrambles(event: EventId): boolean {
  return wcaEvent(event) !== undefined;
}

/** Warm the pool ahead of time (on event switch / when WCA mode turns on). */
export function prefetchWca(event: EventId): void {
  const wev = wcaEvent(event);
  if (!wev) return;
  if ((pools[wev]?.length ?? 0) < REFILL_AT) void fill(wev);
}

/** Synchronous take — returns a scramble if the pool has one (and tops it up in
 *  the background), else null so the caller can show loading and await nextWca. */
export function peekWca(event: EventId): string | null {
  const wev = wcaEvent(event);
  if (!wev) return null;
  const s = pools[wev]?.shift() ?? null;
  if ((pools[wev]?.length ?? 0) < REFILL_AT) void fill(wev);
  return s;
}

/** Async take — ensures the pool is filled, then returns one. null if the event
 *  has no real scrambles or the fetch failed. */
export async function nextWca(event: EventId): Promise<string | null> {
  const wev = wcaEvent(event);
  if (!wev) return null;
  if ((pools[wev]?.length ?? 0) === 0) await fill(wev);
  return pools[wev]?.shift() ?? null;
}

/** Source metadata for a scramble previously dispensed by this pool, else null
 *  (locally generated scramble, or one evicted from the capped meta map). */
export function wcaMetaFor(scramble: string): WcaScrambleMeta | null {
  return metaByScramble.get(normalize(scramble)) ?? null;
}
