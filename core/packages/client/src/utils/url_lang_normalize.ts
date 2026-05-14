/**
 * 全站 URL 规范化:把 ?lang= 始终排到 query 末尾。
 *
 * 拦截 history.pushState / replaceState — React Router、原生导航、
 * 任何 setSearchParams 最终都走这两个 API,单点拦截覆盖全站。
 *
 * 在 main.tsx 引入时立即生效;同时把当前 URL 也 normalize 一次。
 */

const LANG_KEY = 'lang';

function moveLangToEnd(url: string | URL): string | URL {
  try {
    const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost/';
    const u = typeof url === 'string' ? new URL(url, base) : url;
    const lang = u.searchParams.get(LANG_KEY);
    if (lang === null) return url;
    const params = u.searchParams;
    // 已在末尾就跳过(避免 replaceState 死循环)
    const keys = [...params.keys()];
    if (keys[keys.length - 1] === LANG_KEY && keys.indexOf(LANG_KEY) === keys.length - 1) return url;
    params.delete(LANG_KEY);
    params.append(LANG_KEY, lang);
    // 同源相对:返回 path+search+hash,避免暴露 origin
    if (typeof url === 'string' && !url.match(/^https?:/i)) {
      return u.pathname + u.search + u.hash;
    }
    return u.toString();
  } catch {
    return url;
  }
}

let installed = false;

export function installLangNormalize() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const origPush = window.history.pushState.bind(window.history);
  const origReplace = window.history.replaceState.bind(window.history);

  window.history.pushState = function (data: unknown, unused: string, url?: string | URL | null) {
    origPush(data, unused, url == null ? url : moveLangToEnd(url));
  };
  window.history.replaceState = function (data: unknown, unused: string, url?: string | URL | null) {
    origReplace(data, unused, url == null ? url : moveLangToEnd(url));
  };

  // 首次加载 URL 也 normalize 一次
  const cur = window.location.pathname + window.location.search + window.location.hash;
  const normalized = moveLangToEnd(cur);
  if (normalized !== cur) {
    origReplace(window.history.state, '', normalized);
  }
}
