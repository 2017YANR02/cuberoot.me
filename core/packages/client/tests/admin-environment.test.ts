import { expect, it } from 'vitest';
import { adminEnvironment } from '@/lib/admin-environment';

it('uses the dev tunnel on phones and iPad desktop mode, loopback on desktops', () => {
  for (const userAgent of ['iPhone', 'Android', 'HarmonyOS', 'iPad']) {
    expect(adminEnvironment('cuberoot.me', { userAgent, platform: '', maxTouchPoints: 1 }))
      .toEqual({ current: 'prod', localOrigin: 'https://dev.cuberoot.me' });
  }
  expect(adminEnvironment('cuberoot.me', { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 }).localOrigin).toBe('https://dev.cuberoot.me');
  expect(adminEnvironment('cuberoot.me', { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 }).localOrigin).toBe('http://localhost:3000');
  expect(adminEnvironment('cuberoot.me', { userAgent: 'Windows', platform: 'Win32', maxTouchPoints: 10 }).localOrigin).toBe('http://localhost:3000');
});
it('treats the tunnel and loopback as development environments', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]', 'dev.cuberoot.me']) {
    expect(adminEnvironment(host, { userAgent: 'iPhone', platform: '', maxTouchPoints: 1 }).current).toBe('local');
  }
});
