/** Public Douyin product scope, applied to every user and every release channel. */
export const DOUYIN_BASIC_TIMER_EVENTS: readonly string[] = [
  '222', '333', '444', '555', '666', '777', '333oh', '333bld', '444bld', '555bld',
  '333fm', '333mbld', 'clock', 'mega', 'pyra', 'skewb', 'sq1',
];

/** Keep a small tool surface; teaching and drill routes are not part of this product. */
export function douyinContentAvailable(href: string): boolean {
  try {
    // Native Mini Program JS runtimes do not provide the browser URL APIs.
    const relative = href.replace(/^https?:\/\/(?:cuberoot\.me|www\.cuberoot\.me|dev\.cuberoot\.me|localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?)(?=\/|$)/i, '') || '/';
    if (!relative.startsWith('/') || relative.startsWith('//') || /[\\\s\u0000-\u001f]/.test(relative)) return false;
    const [beforeHash] = relative.split('#');
    const [rawPath, query = ''] = beforeHash.split('?');
    const decoded = decodeURIComponent(rawPath);
    if (/[\\%?#]/.test(decoded) || decoded.includes('//') || decoded.split('/').some(part => part === '.' || part === '..')) return false;
    const path = decoded.replace(/^\/(zh|en)(?=\/|$)/, '').replace(/\/+$/, '') || '/';
    const parameters = query.split('&').filter(Boolean).map(part => {
      const [key, value = ''] = part.split('=');
      return [decodeURIComponent(key.replace(/\+/g, ' ')), decodeURIComponent(value.replace(/\+/g, ' '))];
    });
    if (path === '/timer') {
      for (const [key] of parameters) {
        if (/^(training|train\.|hints|tool|replay|reconstruct|room|competition)/i.test(key)) return false;
      }
      return parameters.every(([key, value]) =>
        (key !== 'event' || DOUYIN_BASIC_TIMER_EVENTS.includes(value))
        && (key !== 'content' || value === 'full')
        && (key !== 'source' || ['random', 'manual', 'wca'].includes(value))
        && (key !== 'method' || value === 'practice')
        && !['view', 'draw', 'group', 'round', 'flippedEdges', 'selection', 'sets', 'case', 'split', 'multi'].includes(key)
        && (key !== 'players' || value === '1'));
    }
    return path === '/' || path === '/account' || path === '/contact' || path === '/privacy' || path === '/terms'
      || path === '/auth/miniprogram' || path === '/calc' || path === '/timezone'
      || path === '/calendar' || path === '/frame-count'
      || path === '/wca' || path.startsWith('/wca/');
  } catch { return false; }
}
