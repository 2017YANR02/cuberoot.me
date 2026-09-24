/** The development tunnel is reachable on phones; loopback is only for desktop. */
export function adminEnvironment(hostname: string, device: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>) {
  const mobile = /android|iphone|ipad|ipod|harmony|mobile/i.test(device.userAgent)
    || (device.platform === 'MacIntel' && device.maxTouchPoints > 1);
  return {
    localOrigin: mobile ? 'https://dev.cuberoot.me' : 'http://localhost:3000',
    current: ['localhost', '127.0.0.1', '[::1]', 'dev.cuberoot.me', 'dev-mac-mini.cuberoot.me', 'dev-ruimin-mac-mini.cuberoot.me', 'dev-alienware.cuberoot.me', 'dev-ruimin-alienware.cuberoot.me', 'dev-macbook-pro.cuberoot.me', 'dev-ruimin-macbook-pro.cuberoot.me'].includes(hostname) ? 'local' : 'prod',
  };
}
