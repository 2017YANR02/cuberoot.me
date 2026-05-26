// Ported from packages/client/src/utils/comp_link.ts.
// 比赛页内部链接 + WCA URL anchor 解析. compLinkProps tweaked for Next: returns
// `href` (next/link) instead of `to` (react-router).
import { apiUrl } from './api-base';

export interface CompLinkOpts {
  event?: string;
  round?: string;
}

export function compHref(compId: string, opts?: CompLinkOpts): string {
  let url = `/wca/comp/${compId}`;
  const params: string[] = [];
  if (opts?.event) params.push(`event=${encodeURIComponent(opts.event)}`);
  if (opts?.round) params.push(`round=${encodeURIComponent(opts.round)}`);
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
  fetch(`/stats/comp/${encodeURIComponent(compId)}.json`, { cache: 'force-cache' })
    .then(r => {
      if (r.ok) return;
      fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(compId)}`), { cache: 'force-cache' })
        .catch(() => { _prefetched.delete(compId); });
    })
    .catch(() => { _prefetched.delete(compId); });
}

/** Returns props for next/link <Link>: { href, onMouseEnter, onFocus, onTouchStart }. */
export function compLinkProps(compId: string, opts?: CompLinkOpts) {
  const prefetch = () => prefetchComp(compId);
  return {
    href: compHref(compId, opts),
    onMouseEnter: prefetch,
    onFocus: prefetch,
    onTouchStart: prefetch,
  };
}
