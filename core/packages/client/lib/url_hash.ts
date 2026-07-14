/**
 * 写 URL 的 `#` 片段,**不进历史栈**。
 *
 * 为什么不走 nuqs:nuqs 管的是 query string,片段它不碰。
 * 为什么不 `location.hash = x`:那会往历史里塞一条 —— 在列表里点七张卡,就得按七次后退。
 *
 * 片段不是页内状态(它是「现在指着哪个 case」的名片,给人复制去分享的),和 CLAUDE.md
 * 「URL 状态统一 nuqs」那条不冲突。全站只有这一个文件碰 raw history,守卫
 * tests/url-state-no-raw-history.test.ts 里对它放行。
 */
export function replaceHash(hash: string): void {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  const bare = hash.replace(/^#/, '');
  const url = bare ? `${pathname}${search}#${bare}` : `${pathname}${search}`;
  // allow-raw-history: 片段(#case 名)不是页内状态,nuqs 只管 query string;replaceState 是为了不把历史栈塞满
  // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
  window.history.replaceState(null, '', url);
}
