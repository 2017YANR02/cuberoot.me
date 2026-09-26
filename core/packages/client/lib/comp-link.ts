// Ported from packages/client-vite/src/utils/comp_link.ts.
// 比赛页内部链接 + WCA URL anchor 解析. compLinkProps tweaked for Next: returns
// `href` (next/link) instead of `to` (react-router).
import { apiUrl } from './api-base';
import { statsUrl } from './stats-base';

export interface CompLinkOpts {
  event?: string;
  round?: string;
  view?: string;
}

export interface CompResultLocation { eventId: string; roundId: string; number: number }

export function compResultHref(compId: string, result: CompResultLocation): string {
  return `/wca/comp/${encodeURIComponent(compId)}/result/${encodeURIComponent(result.eventId)}/${encodeURIComponent(result.roundId)}/${result.number}`;
}

export function parseCompResultPath(path: string): CompResultLocation | null {
  const match = /\/comp\/[^/]+\/result\/([a-z0-9]+)\/([a-z0-9]+)\/([1-9]\d*)\/?$/.exec(path);
  if (!match || !Number.isSafeInteger(Number(match[3]))) return null;
  return { eventId: match[1], roundId: match[2], number: Number(match[3]) };
}

/** The news feed has names and values, but not always a round or registration number. */
export function compRecordHref(record: {
  competitionId: string; eventId: string; personName: string; type: string; attemptResult: number;
}): string {
  const params = new URLSearchParams({ view: 'result', event: record.eventId,
    record: JSON.stringify([record.personName, record.type, record.attemptResult]) });
  return `${compHref(record.competitionId)}?${params}`;
}

export function resolveCompRecord(data: {
  users: Record<string, { name: string }>;
  events: { i: string; rs: { i: string }[] }[];
  resultsByRound: Record<string, { e: string; r: string; n: number; a: number; b: number; v: number[] }[]>;
}, eventId: string, record: string): CompResultLocation | null {
  let target: unknown;
  try { target = JSON.parse(record); } catch { return null; }
  if (!Array.isArray(target) || target.length !== 3) return null;
  const [name, type, value] = target;
  if (typeof name !== 'string' || !['single', 'average'].includes(type)
    || !Number.isSafeInteger(value) || value <= 0) return null;
  const event = data.events.find(event => event.i === eventId);
  for (const round of event?.rs ?? []) {
    const result = data.resultsByRound[`${eventId}:${round.i}`]?.find(row => data.users[String(row.n)]?.name === name
      && (type === 'average' ? row.a === value : row.b === value || row.v.includes(value)));
    if (result) return { eventId, roundId: round.i, number: result.n };
  }
  return null;
}

export function compHref(compId: string, opts?: CompLinkOpts): string {
  let url = `/wca/comp/${compId}`;
  const params: string[] = [];
  if (opts?.event) params.push(`event=${encodeURIComponent(opts.event)}`);
  if (opts?.round) params.push(`round=${encodeURIComponent(opts.round)}`);
  if (opts?.view) params.push(`view=${encodeURIComponent(opts.view)}`);
  if (params.length) url += `?${params.join('&')}`;
  return url;
}

export function parseWcaAnchor(anchor: string): CompLinkOpts {
  if (!anchor) return {};
  const m = /^e([0-9a-z]+?)(?:_([a-z0-9]+))?$/i.exec(anchor);
  if (m) {
    const opts: CompLinkOpts = { event: m[1] };
    if (m[2]) opts.round = m[2];
    return opts;
  }
  return {};
}

export function rewriteWcaCompUrl(url: string): string | null {
  const m = url.match(/\/competitions\/([^/#?]+)([^#]*)(?:#(.*))?$/);
  if (!m) return null;
  const compId = m[1];
  const anchor = m[3] || '';
  return compHref(compId, parseWcaAnchor(anchor));
}

const _prefetched = new Set<string>();
export function prefetchComp(compId: string): void {
  if (_prefetched.has(compId)) return;
  _prefetched.add(compId);
  fetch(statsUrl(`/stats/comp/${encodeURIComponent(compId)}.json`), { cache: 'force-cache' })
    .then(r => {
      if (r.ok) return;
      // Background hover prefetch must not navigate to a verification page.
      fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(compId)}`), { cache: 'force-cache', credentials: 'include' })
        .catch(() => { _prefetched.delete(compId); });
    })
    .catch(() => { _prefetched.delete(compId); });
}

/**
 * Props for next/link <Link>: { href, prefetch, onMouseEnter, onFocus, onTouchStart }.
 * prefetch:false — comp pages are bulk-listed (landing OngoingComps / calendar / search),
 * and Next's default viewport auto-prefetch would background-render dozens of them on
 * every page view. Intent (hover/focus/touch) still warms the comp stats JSON via
 * prefetchComp. Pattern B: English is the bare path, so only `lang === 'zh'`
 * adds a prefix; English/undefined stay bare (no proxy round-trip either way).
 */
export function compLinkProps(compId: string, opts?: CompLinkOpts, lang?: 'zh' | 'en') {
  const warm = () => prefetchComp(compId);
  const href = compHref(compId, opts);
  return {
    href: lang === 'zh' ? `/zh${href}` : href,
    prefetch: false as const,
    onMouseEnter: warm,
    onFocus: warm,
    onTouchStart: warm,
  };
}
