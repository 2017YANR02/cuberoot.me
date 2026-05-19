// 比赛页内部链接 + WCA URL anchor 解析
// 所有指向 worldcubeassociation.org/competitions/<id>... 的旧链接都走这里映射到 /wca/comp/<id>
import { apiUrl } from './api_base';

export interface CompLinkOpts {
  event?: string;
  round?: string;
}

/** /wca/comp/<id> 或带 ?event=&round= */
export function compHref(compId: string, opts?: CompLinkOpts): string {
  let url = `/wca/comp/${compId}`;
  const params: string[] = [];
  if (opts?.event) params.push(`event=${encodeURIComponent(opts.event)}`);
  if (opts?.round) params.push(`round=${encodeURIComponent(opts.round)}`);
  if (params.length) url += `?${params.join('&')}`;
  return url;
}

/** 解析 WCA URL 里的 anchor 部分(不带 #),映射成我们的 query。
 *  支持:
 *    e333_f          → {event:'333', round:'f'}
 *    e333fm_1        → {event:'333fm', round:'1'}
 *    e333            → {event:'333'}
 *    by_person#abc   → {} (我们没对应,落比赛首页)
 *  其他形式返回 {}。 */
export function parseWcaAnchor(anchor: string): CompLinkOpts {
  if (!anchor) return {};
  // e<event>[_<round>]
  const m = /^e([0-9a-z]+?)(?:_([a-z0-9]+))?$/i.exec(anchor);
  if (m) {
    const opts: CompLinkOpts = { event: m[1] };
    if (m[2]) opts.round = m[2];
    return opts;
  }
  return {};
}

/** 把整段 WCA competition URL → 内部 href。无法识别(不含 /competitions/<id>)时返回 null。 */
export function rewriteWcaCompUrl(url: string): string | null {
  const m = url.match(/\/competitions\/([^/#?]+)([^#]*)(?:#(.*))?$/);
  if (!m) return null;
  const compId = m[1];
  const anchor = m[3] || '';
  return compHref(compId, parseWcaAnchor(anchor));
}

// ── Hover prefetch ──
// /wca/comp/<id> 主接口大头是 TLS 握手(~2-3s 跨海) + 几十 ms 服务端 wca_db 查询.
// hover/focus 时悄悄发 fetch 进浏览器 HTTP cache (server 头是 max-age=86400 immutable),
// 真点击时 instant 出货.同 id 多次触发自动 dedupe.
const _prefetched = new Set<string>();
export function prefetchComp(compId: string): void {
  if (_prefetched.has(compId)) return;
  _prefetched.add(compId);
  const url = apiUrl(`/v1/cubing-live/${encodeURIComponent(compId)}?source=wca_db`);
  fetch(url, { cache: 'force-cache' }).catch(() => { _prefetched.delete(compId); });
}

/** 返回 react-router `<Link>` 的 props,带 hover/focus/touch 预取。
 *  用法:`<Link {...compLinkProps(id)} className="..." />` */
export function compLinkProps(compId: string, opts?: CompLinkOpts) {
  const prefetch = () => prefetchComp(compId);
  return {
    to: compHref(compId, opts),
    onMouseEnter: prefetch,
    onFocus: prefetch,
    onTouchStart: prefetch,
  };
}
