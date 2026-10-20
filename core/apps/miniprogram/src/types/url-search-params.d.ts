// Upstream declares `export = URLSearchParams`, but its exports map omits types.
declare module '@ungap/url-search-params' {
  const URLSearchParamsPolyfill: typeof globalThis.URLSearchParams;
  export default URLSearchParamsPolyfill;
}
