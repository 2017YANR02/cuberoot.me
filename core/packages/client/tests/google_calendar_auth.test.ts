import { afterEach, expect, it, vi } from 'vitest';
import { requestGoogleAccessToken } from '@/lib/google-auth';
import { GOOGLE_CALENDAR_SCOPE } from '@/lib/google-calendar-backup';

afterEach(() => vi.unstubAllGlobals());
function google(response: { access_token?: string; scope?: string; error?: string }) {
  const init = vi.fn((config: { callback: (r: typeof response) => void }) => ({ requestAccessToken: () => config.callback(response) }));
  vi.stubGlobal('window', { google: { accounts: { oauth2: { initTokenClient: init } } } });
  return init;
}
it('requests only read-only calendar access without bundling existing grants', async () => {
  const init = google({ access_token: 'test-only', scope: GOOGLE_CALENDAR_SCOPE });
  expect(await requestGoogleAccessToken('client', GOOGLE_CALENDAR_SCOPE)).toBe('test-only');
  expect(init.mock.calls[0][0]).toMatchObject({ client_id: 'client', scope: GOOGLE_CALENDAR_SCOPE, include_granted_scopes: false });
});
it('does not silently accept a token when calendar permission was declined', async () => {
  google({ access_token: 'test-only', scope: 'openid email profile' });
  await expect(requestGoogleAccessToken('client', GOOGLE_CALENDAR_SCOPE)).rejects.toThrow('calendar_permission_denied');
});
it('keeps normal Google sign-in limited to identity scopes', async () => {
  const init = google({ access_token: 'test-only', scope: 'openid email profile' });
  expect(await requestGoogleAccessToken('client')).toBe('test-only');
  expect(init.mock.calls[0][0]).toMatchObject({ scope: 'openid email profile' });
});
