declare const __CUBEROOT_DEV_API_ORIGIN__: string | undefined;
const API_ORIGIN = typeof __CUBEROOT_DEV_API_ORIGIN__ === 'string'
  ? __CUBEROOT_DEV_API_ORIGIN__
  : 'https://api.cuberoot.me';

export function mobileApiUrl(path: string): string {
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
