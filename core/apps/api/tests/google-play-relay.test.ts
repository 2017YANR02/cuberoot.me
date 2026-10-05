import { afterEach, expect, it, vi } from 'vitest';
import { googlePlayRelay } from '../src/payment/google-play-relay.js';
import { verifyGooglePlayRelay, GOOGLE_PLAY_RELAY_HEADER } from '@cuberoot/shared/google-play-relay';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('fails closed for wrong hosts and never follows redirects', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ verified: true }));
  vi.stubGlobal('fetch', fetcher); vi.stubEnv('GOOGLE_PLAY_RELAY_SECRET', 'fixture-'.repeat(8));
  vi.stubEnv('GOOGLE_PLAY_RELAY_URL', 'https://evil.test/api/google-play');
  await expect(googlePlayRelay({ operation: 'ready' })).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  vi.stubEnv('GOOGLE_PLAY_RELAY_URL', 'https://google-api.cuberoot.me/api/google-play');
  await googlePlayRelay({ operation: 'verifyPush', idToken: 'header.payload.signature' });
  const init = fetcher.mock.calls[0][1];
  expect(init.redirect).toBe('error'); expect(init.cache).toBe('no-store');
  expect(await verifyGooglePlayRelay(process.env.GOOGLE_PLAY_RELAY_SECRET!, init.body, init.headers[GOOGLE_PLAY_RELAY_HEADER])).toBe(true);
});
it('never treats a failed relay request as verified', async () => {
  vi.stubEnv('GOOGLE_PLAY_RELAY_SECRET', 'fixture-'.repeat(8));
  vi.stubEnv('GOOGLE_PLAY_RELAY_URL', 'https://google-api.cuberoot.me/api/google-play');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private upstream error', { status: 502 })));
  await expect(googlePlayRelay({ operation: 'ready' })).rejects.toThrow('Google Play relay request failed');
});
