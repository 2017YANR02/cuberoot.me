/** Shareable page addresses; recipients still need their own access permissions. */
const AUTH_ROUTE = /^\/(?:zh\/)?auth(?:\/|$)/i;
// Shares can cross containers, so strip both hosts' markers regardless of the sender.
const INTERNAL_PARAM = /^(?:(?:wechat|douyin)_redirect|ticket|token|access_token|refresh_token|id_token|auth_code|code_verifier|code_challenge|next|redirect|redirect_uri|returnTo)$/i;

function cleanParameters(value: string): string | null {
  const kept: string[] = [];
  for (const part of value.split('&')) {
    if (!part) continue;
    let key: string;
    try { key = decodeURIComponent(part.split('=')[0].replace(/\+/g, ' ')); }
    catch { return null; }
    if (!INTERNAL_PARAM.test(key)) kept.push(part);
  }
  return kept.join('&');
}

export function publicPageSharePath(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.length > 8192) return null;
  const path = value.replace(/^https:\/\/(?:www\.)?cuberoot\.me(?=\/|$)/i, '') || '/';
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(path)) return null;
  const hashAt = path.indexOf('#');
  const beforeHash = hashAt < 0 ? path : path.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const pathname = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt);
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  // Reject encoded delimiters, dot traversal and executable authentication callbacks.
  if (/[\\%?#\u0000-\u001f\u007f]/.test(decoded) || decoded.includes('//')) return null;
  if (AUTH_ROUTE.test(decoded) || decoded.split('/').some(segment => segment === '.' || segment === '..')) return null;
  const query = cleanParameters(queryAt < 0 ? '' : beforeHash.slice(queryAt + 1));
  const fragment = cleanParameters(hashAt < 0 ? '' : path.slice(hashAt + 1));
  if (query === null || fragment === null) return null;
  return `${pathname}${query ? `?${query}` : ''}${fragment ? `#${fragment}` : ''}`;
}

export interface PageShareMessage { type: 'cuberoot:page-share'; path: string; title: string }

export function decodePageShareMessage(value: unknown): PageShareMessage | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Partial<PageShareMessage>;
  const path = publicPageSharePath(message.path);
  if (message.type !== 'cuberoot:page-share' || !path || typeof message.title !== 'string') return null;
  const title = message.title.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120);
  return { type: 'cuberoot:page-share', path, title: title || 'CubeRoot' };
}
