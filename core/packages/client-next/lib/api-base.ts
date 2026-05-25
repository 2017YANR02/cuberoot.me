// Ported from packages/client/src/utils/api_base.ts.
// Next equivalent of import.meta.env.DEV is process.env.NODE_ENV.
// Override via NEXT_PUBLIC_API_ORIGIN (NEXT_PUBLIC_* is inlined into the client bundle).

export const API_ORIGIN = (() => {
  const override = process.env.NEXT_PUBLIC_API_ORIGIN;
  if (override) return override;
  if (process.env.NODE_ENV === 'development') return '';
  return 'https://api.cuberoot.me';
})();

export function apiUrl(path: string): string {
  return API_ORIGIN + path;
}
