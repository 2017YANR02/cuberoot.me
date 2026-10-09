import { afterEach, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { CompetitionCaptchaStore, renderCompetitionCaptcha, issueCompetitionCaptcha, submitCompetitionCaptcha } from '../src/utils/competition_captcha';
import { verifyCompetitionProof, COMPETITION_ACCESS_COOKIE } from '@cuberoot/shared/competition-access';
const secret = 'test-only-secret-with-more-than-32-characters';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it('distinguishes incorrect, expired, exhausted, changed-browser and invalid challenges', () => {
  const store = new CompetitionCaptchaStore();
  const a = store.issue('a', 1000)!;
  expect(store.consume(a.id, a.answer, 'b', 1001)).toEqual({ code: 'captcha_browser_changed' });
  expect(store.consume(a.id, 'WRONG', 'a', 1002)).toEqual({ code: 'captcha_incorrect', attemptsRemaining: 2 });
  expect(store.consume(a.id, 'WRONG', 'a', 1003)).toEqual({ code: 'captcha_incorrect', attemptsRemaining: 1 });
  expect(store.consume(a.id, 'WRONG', 'a', 1004)).toEqual({ code: 'captcha_attempts_exhausted' });
  expect(store.consume(a.id, a.answer, 'a', 1005)).toEqual({ code: 'captcha_attempts_exhausted' });
  const b = store.issue('a', 1000)!;
  expect(store.consume(b.id, ' ' + b.answer.toLowerCase() + ' ', 'a', 120999)).toEqual({ code: 'ok' });
  expect(store.consume(b.id, b.answer, 'a', 121000)).toEqual({ code: 'captcha_invalid' });
  const c = store.issue('a', 1000)!;
  store.allow('verify:a', 10, 121000); // The HTTP endpoint sweeps before consume.
  expect(store.consume(c.id, c.answer, 'a', 121000)).toEqual({ code: 'captcha_expired' });
  store.allow('verify:a', 10, 241000);
  expect(store.consume(c.id, c.answer, 'a', 241000)).toEqual({ code: 'captcha_invalid' });
  expect(new CompetitionCaptchaStore().consume(c.id, c.answer, 'a', 1001)).toEqual({ code: 'captcha_invalid' });
  for (let i = 0; i < 6; i++) expect(store.allow('ip', 6, 300000)).toBe(true);
  expect(store.allow('ip', 6, 300001)).toBe(false);
  expect(store.allow('ip', 6, 360000)).toBe(true);
});
it('renders glyph outlines without exposing answer text', () => {
  const image = renderCompetitionCaptcha('ABC234');
  expect(image).toContain('<path');
  expect(image).not.toContain('<text');
  expect(image).not.toContain('ABC234');
});
it.each([false, true])('HTTP verification preserves one-use validation and cookie policy (embedded=%s)', async embedded => {
  vi.stubEnv('COMPETITION_ACCESS_SECRET', secret);
  const app = new Hono();
  app.get('/challenge', issueCompetitionCaptcha); app.post('/verify', submitCompetitionCaptcha);
  const consumed = vi.spyOn(CompetitionCaptchaStore.prototype, 'consume');
  const issued = vi.spyOn(CompetitionCaptchaStore.prototype, 'issue');
  const headers = { 'user-agent': 'test-browser', origin: 'https://cuberoot.me', 'content-type': 'application/json' };
  const response = await app.request('/challenge', { headers });
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(['expiresIn', 'id', 'image']);
  const answer = issued.mock.results[0].value.answer;
  const submit = (value: string, origin = headers.origin) => app.request('/verify', { method: 'POST', headers: { ...headers, origin }, body: JSON.stringify({ id: body.id, answer: value, embedded }) });
  expect((await submit(answer, 'https://evil.example')).status).toBe(403);
  expect(consumed).not.toHaveBeenCalled();
  const wrong = await submit('WRONG');
  expect(wrong.status).toBe(400);
  expect(await wrong.json()).toEqual({ code: 'captcha_incorrect', attemptsRemaining: 2 });
  expect(wrong.headers.get('set-cookie')).toBeNull();
  const good = await submit(answer);
  expect(good.status).toBe(200);
  const cookie = good.headers.get('set-cookie')!;
  expect(cookie).toContain(embedded ? 'HttpOnly; Secure; SameSite=None; Partitioned' : 'HttpOnly; Secure; SameSite=Lax');
  if (!embedded) expect(cookie).not.toContain('Partitioned');
  expect(cookie).toContain('Max-Age=604800');
  expect(await good.json()).toEqual({ expiresIn: 604800 });
  const proof = cookie.split(';')[0].slice(COMPETITION_ACCESS_COOKIE.length + 1);
  expect(await verifyCompetitionProof(secret, proof, 'browser', 'test-browser')).toBe(true);
  expect(await verifyCompetitionProof(secret, proof, 'browser', 'another-browser')).toBe(false);
  expect((await submit(answer)).status).toBe(400);
});

it('uses the same temporary rollout lifetime for the cookie and signed proof', async () => {
  vi.stubEnv('COMPETITION_ACCESS_SECRET', secret); vi.stubEnv('COMPETITION_ACCESS_ISSUE_TTL_SECONDS', '1800');
  const app = new Hono(); app.get('/challenge', issueCompetitionCaptcha); app.post('/verify', submitCompetitionCaptcha);
  const issued = vi.spyOn(CompetitionCaptchaStore.prototype, 'issue');
  const headers = { 'user-agent': 'rollout-test-browser', origin: 'https://cuberoot.me', 'content-type': 'application/json' };
  const body = await (await app.request('/challenge', { headers })).json();
  const response = await app.request('/verify', { method: 'POST', headers, body: JSON.stringify({ id: body.id, answer: issued.mock.results[0].value.answer }) });
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ expiresIn: 1800 });
  const cookie = response.headers.get('set-cookie'); expect(cookie).toContain('Max-Age=1800');
  const proof = cookie.split(';')[0].slice(COMPETITION_ACCESS_COOKIE.length + 1);
  expect(await verifyCompetitionProof(secret, proof, 'browser', headers['user-agent'], Date.now() + 1800_000)).toBe(false);
});

it.each(['captcha_expired', 'captcha_invalid', 'captcha_browser_changed', 'captcha_attempts_exhausted'] as const)('HTTP preserves %s without issuing access', async code => {
  vi.stubEnv('COMPETITION_ACCESS_SECRET', secret);
  vi.spyOn(CompetitionCaptchaStore.prototype, 'allow').mockReturnValue(true);
  vi.spyOn(CompetitionCaptchaStore.prototype, 'consume').mockReturnValue({ code });
  const app = new Hono(); app.post('/verify', submitCompetitionCaptcha);
  const response = await app.request('/verify', { method: 'POST', headers: { origin: 'https://cuberoot.me', 'content-type': 'application/json' }, body: JSON.stringify({ id: 'a'.repeat(48), answer: 'ABC234' }) });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ code });
  expect(response.headers.get('set-cookie')).toBeNull();
});
