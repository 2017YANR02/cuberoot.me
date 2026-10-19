// Build-time bindings, not global mutation: Douyin's sandbox has no globalThis.
// Shared modules retain standard API contracts; native builds use these existing
// implementations wherever the platform does not provide browser globals.
export { AbortController, AbortSignal } from 'abort-controller/dist/abort-controller';
export { default as URLSearchParams } from '@ungap/url-search-params';
