import { DEV_PREVIEW_HOSTS } from '@cuberoot/shared/dev-preview';

/** The development tunnel is reachable on phones; loopback is only for desktop. */
export function adminEnvironment(hostname: string, device: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>) {
  const mobile = /android|iphone|ipad|ipod|harmony|mobile/i.test(device.userAgent)
    || (device.platform === 'MacIntel' && device.maxTouchPoints > 1);
  return {
    localOrigin: mobile ? 'https://dev.cuberoot.me' : 'http://localhost:3000',
    current: ['localhost', '127.0.0.1', '[::1]', ...DEV_PREVIEW_HOSTS].includes(hostname) ? 'local' : 'prod',
  };
}
