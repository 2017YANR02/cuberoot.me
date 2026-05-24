/**
 * Capacitor app 里 webview origin 是 capacitor://localhost / https://localhost,
 * fetch('/stats/foo.json') 解析成那个 origin → 404(app bundle 只装 SPA dist,
 * 没装 17MB 的 /stats/* JSON)。
 *
 * 这里 wrap window.fetch:在 native platform 且 URL 是 absolute path 但不属于
 * SPA 自己路由的,改写到 https://cuberoot.me 走原站。同样适用于 /tools/*。
 *
 * 不动 /v1/* (api.cuberoot.me 走 apiUrl 自己拼) 和 React Router 路由。
 */

const REWRITE_PREFIXES = ['/stats/', '/tools/'];
const REWRITE_HOST = 'https://cuberoot.me';

export async function installCapacitorFetchRewrite(): Promise<void> {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) return;

  const orig = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    let url: string | undefined;
    if (typeof input === 'string') url = input;
    else if (input instanceof URL) url = input.toString();
    else if (input && typeof input === 'object' && 'url' in input) url = (input as Request).url;

    if (url && REWRITE_PREFIXES.some((p) => url!.startsWith(p))) {
      const rewritten = REWRITE_HOST + url;
      if (typeof input === 'string') return orig(rewritten, init);
      if (input instanceof URL) return orig(new URL(rewritten), init);
      return orig(new Request(rewritten, input as Request), init);
    }
    return orig(input as RequestInfo, init);
  }) as typeof window.fetch;
}
