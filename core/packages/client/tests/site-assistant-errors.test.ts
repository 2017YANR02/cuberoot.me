import { describe, expect, it } from 'vitest';
import { assistantResponseError, ASSISTANT_ERROR_TEXT } from '@/lib/site-assistant-errors';

describe('assistant failures',()=>{
  it('distinguishes login, WCA binding and suspended accounts from CAPTCHA',()=>{
    expect(assistantResponseError(new Response('',{status:401}),null)).toBe('login_required');
    expect(assistantResponseError(new Response('',{status:403}),{error:'wca_link_required'})).toBe('wca_link_required');
    expect(assistantResponseError(new Response('',{status:403}),{error:'account_forbidden'})).toBe('account_forbidden');
  });
  it('distinguishes browser verification, quota, burst limits and timeouts',()=>{
    expect(assistantResponseError(new Response('',{status:403}),{code:'competition_verification_required'})).toBe('verification_required');
    expect(assistantResponseError(new Response('',{status:429,headers:{'x-vercel-mitigated':'challenge'}}),null)).toBe('verification_required');
    expect(assistantResponseError(new Response('',{status:429}),{error:'daily_limit'})).toBe('daily_limit');
    expect(assistantResponseError(new Response('',{status:429}),null)).toBe('busy');
    expect(assistantResponseError(new Response('',{status:504}),null)).toBe('timeout');
  });
  it('does not send the user to a CAPTCHA for a server-side source failure or unknown 403',()=>{
    expect(assistantResponseError(new Response('',{status:503}),{error:'source_verification_required'})).toBe('source_verification_required');
    expect(assistantResponseError(new Response('',{status:403}),{error:'internal-secret'})).toBe('unavailable');
    expect(assistantResponseError(new Response('',{status:500}),{error:'__proto__'})).toBe('unavailable');
    expect(ASSISTANT_ERROR_TEXT.daily_limit.zh).toContain('1000');
    expect(ASSISTANT_ERROR_TEXT.daily_limit.en).toContain('1000');
  });
});
