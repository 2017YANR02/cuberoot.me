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
      fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(compId)}`), { cache: 'force-cache' })
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
