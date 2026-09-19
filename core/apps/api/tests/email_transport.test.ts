import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { vi.stubEnv('RESEND_API_KEY', 'synthetic-mail-transport-key'); vi.stubEnv('MAIL_FROM', 'Fixture <fixture@example.invalid>'); });
import { sendEmail, emailConfigured } from '../src/utils/email.js';
const message = { to: 'synthetic@example.invalid', subject: 'Synthetic code', html: '<p>000123</p>', text: '000123' };
afterEach(() => vi.unstubAllGlobals());
afterAll(() => vi.unstubAllEnvs());
describe('email error privacy', () => {
  it('does not read or expose provider body, recipient or code on rejection', async () => {
    const response = new Response('synthetic@example.invalid 000123 private-token', { status: 429 });
    const read = vi.spyOn(response, 'text'); const fetch = vi.fn().mockResolvedValue(response); vi.stubGlobal('fetch', fetch);
    await expect(sendEmail(message)).rejects.toMatchObject({ code: 'PROVIDER_REJECTED', status: 429, message: 'Email transport failed (PROVIDER_REJECTED)' });
    expect(read).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('network exception details are replaced and no automatic retry occurs', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('synthetic@example.invalid 000123 private-token')); vi.stubGlobal('fetch', fetch);
    await expect(sendEmail(message)).rejects.toMatchObject({ code: 'NETWORK_ERROR', message: 'Email transport failed (NETWORK_ERROR)' }); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('preserves request fields and unsubscribe headers on successful provider acceptance', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"id":"synthetic-message"}')); vi.stubGlobal('fetch', fetch);
    const headers = { 'List-Unsubscribe': '<https://example.invalid/unsubscribe>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
    await expect(sendEmail({ ...message, headers })).resolves.toBeUndefined();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ to: [message.to], subject: message.subject, html: message.html, text: message.text, headers });
  });
  it('rejects an ambiguous empty success response without retry or a false sent result', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetch);
    await expect(sendEmail(message)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('retains captured application configuration and rejects email header injection before I/O', async () => {
    expect(emailConfigured()).toBe(true);
    vi.stubEnv('RESEND_API_KEY', 'later-key-does-not-reconfigure-module');
    const fetch = vi.fn().mockResolvedValue(new Response('{"id":"synthetic-message"}')); vi.stubGlobal('fetch', fetch);
    await sendEmail(message);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer synthetic-mail-transport-key');
    await expect(sendEmail({ ...message, headers: { 'X-Test': 'value\r\nBcc: private@example.invalid' } })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

});
