import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSiteAssistantRoutes, requireAssistantUser } from '../src/routes/site_assistant.js';
import { requireAuth } from '../src/utils/recon_helpers.js';
import { getUserById } from '../src/utils/account.js';
import { JWT_SECRET, signSession } from '../src/utils/session.js';
import jwt from 'jsonwebtoken';
import { assistantTimeoutMs, boundAssistantHistory } from '@cuberoot/shared/site-assistant';

vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: vi.fn() }));
vi.mock('../src/utils/account.js', () => ({ getUserById: vi.fn() }));

const linked = { id: 42, wca_id: '2017YANR02', display_name: 'Test', avatar_url: null, avatar_source: 'auto' as const, avatar_preset: null, is_admin: false };
const config = { key: 'test-only', baseUrl: 'https://model.example/v1', model: 'test' };
const body = JSON.stringify({ question: '我的成绩呢？', lang: 'zh', viewerWcaId: '2012PARK03' });
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.mocked(requireAuth).mockResolvedValue({ uid: 42, wcaId: '2017YANR02', realWcaId: '2017YANR02', name: 'Test', isAdmin: false });
  vi.mocked(getUserById).mockResolvedValue(linked);
});
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllEnvs(); });
function setup() {
  const answer = vi.fn().mockResolvedValue({ answer: 'answer', sources: [] });
  const reserve = vi.fn().mockResolvedValue({ allowed: true, retryAfter: 60 });
  const route = createSiteAssistantRoutes({ answer, reserve, config: () => config, now: Date.now, authenticate: requireAssistantUser });
  const ask = (ip = '127.0.0.1', token = signSession({uid:42,wcaId:'2017YANR02'})) => route.request('/site-assistant', { method: 'POST', body, headers: { 'x-real-ip': ip, Authorization: `Bearer ${token}` } });
  return { answer, reserve, ask };
}
describe('assistant account access', () => {
  it('keeps a silent deep response alive with SSE comments and clears the heartbeat on completion', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      let finish!: (value: { answer: string; sources: [] }) => void;
      const answer = vi.fn(() => new Promise<{ answer: string; sources: [] }>(resolve => { finish = resolve; }));
      const route = createSiteAssistantRoutes({ answer, config: () => config, now: Date.now,
        reserve: async () => ({ allowed: true, retryAfter: 60 }), authenticate: async () => ({ uid: 42, wcaId: '2017YANR02' }) });
      const response = await route.request('/site-assistant', { method: 'POST', headers: { Accept: 'text/event-stream' }, body: JSON.stringify({ question: 'Consider this carefully', lang: 'en', thinking: 'deep' }) });
      const reader = response.body!.getReader(), decoder = new TextDecoder();
      expect(decoder.decode((await reader.read()).value)).toContain('"phase":"planning"');
      await vi.advanceTimersByTimeAsync(15_000);
      expect(decoder.decode((await reader.read()).value)).toBe(': keepalive\n\n');
      finish({ answer: 'Complete', sources: [] });
      let body = '';
      for (;;) { const chunk = await reader.read(); if (chunk.done) break; body += decoder.decode(chunk.value); }
      expect(body).toContain('"type":"done"');
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('validates long messages and thinking modes before charging and keeps server and client deadlines aligned',async()=>{
    const answer=vi.fn().mockResolvedValue({answer:'ok',sources:[]}),reserve=vi.fn().mockResolvedValue({allowed:true,retryAfter:60});
    const route=createSiteAssistantRoutes({answer,reserve,config:()=>config,now:Date.now,authenticate:async()=>({uid:42,wcaId:'2017YANR02'})});
    const timeout=vi.spyOn(AbortSignal,'timeout');
    const ask=(body:object)=>route.request('/site-assistant',{method:'POST',body:JSON.stringify({lang:'en',...body})});
    const question='a'.repeat(8000);
    expect((await ask({question,thinking:'deep'})).status).toBe(200);
    expect(answer.mock.calls[0][0]).toBe(question);
    expect(answer.mock.calls[0][10]).toBe('deep');
    expect(timeout).toHaveBeenCalledWith(assistantTimeoutMs('deep')-2000);
    expect((await ask({question:question+'a',thinking:'auto'})).status).toBe(400);
    expect((await ask({question:'test',thinking:'invalid'})).status).toBe(400);
    expect(reserve).toHaveBeenCalledTimes(1);
    const history=Array.from({length:10},(_,i)=>({role:(i%2?'assistant':'user') as 'user'|'assistant',content:String(i).repeat(12000)}));
    expect(boundAssistantHistory(history).map(m=>m.content[0])).toEqual(['8','9']);
  });
  it('rejects missing, forged and expired sessions before legacy WCA lookup', async () => {
    const { ask, reserve, answer } = setup();
    const expired = jwt.sign({uid:42,wcaId:'2017YANR02'},JWT_SECRET,{expiresIn:-1});
    for(const token of ['', 'forged-or-raw-wca-token', expired]) {
      const response=await ask('127.0.0.1',token);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({error:'login_required'});
    }
    expect(requireAuth).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });
  it('rejects failed authentication before spending quota or calling the model', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Authentication required'));
    const { ask, reserve, answer } = setup();
    const response = await ask();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'login_required' });
    expect(reserve).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });
  it('rejects an unlinked account even if the cached session and submitted viewer claim a WCA ID', async () => {
    vi.mocked(getUserById).mockResolvedValue({ ...linked, wca_id: null });
    const { ask, reserve, answer } = setup();
    const response = await ask();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'wca_link_required' });
    expect(reserve).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });
  it('rejects deleted or merged accounts and suspended sessions', async () => {
    const { ask, reserve } = setup();
    vi.mocked(getUserById).mockResolvedValue(null);
    expect((await ask()).status).toBe(401);
    vi.mocked(requireAuth).mockRejectedValue(new Error('Your account has been suspended'));
    const response = await ask();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'account_forbidden' });
    expect(reserve).not.toHaveBeenCalled();
  });
  it('uses the current bound identity without a browser CAPTCHA or client identity claim', async () => {
    vi.stubEnv('COMPETITION_ACCESS_ENFORCE', '1');
    const { ask, answer } = setup();
    expect((await ask()).status).toBe(200);
    expect(answer.mock.calls[0][6]).toBe('2017YANR02');
    expect(getUserById).toHaveBeenCalledWith(42);
    // The same still-valid session loses access on its next question after unlinking.
    vi.mocked(getUserById).mockResolvedValue({ ...linked, wca_id: null });
    expect((await ask()).status).toBe(403);
    expect(answer).toHaveBeenCalledTimes(1);
  });
  it('retains the account burst limit even when IP addresses change', async () => {
    const { ask, answer } = setup();
    for (let i = 0; i < 6; i++) expect((await ask(`192.0.2.${i}`)).status).toBe(200);
    expect((await ask('192.0.2.99')).status).toBe(429);
    expect(answer).toHaveBeenCalledTimes(6);
  });
  it('fails closed on an account lookup error without spending quota', async () => {
    vi.mocked(getUserById).mockRejectedValue(new Error('private database detail'));
    const { ask, reserve } = setup();
    const response = await ask();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'unavailable' });
    expect(reserve).not.toHaveBeenCalled();
  });
});
