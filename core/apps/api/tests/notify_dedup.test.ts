import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), sendEmail: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/email.js', () => ({ emailConfigured: () => true, sendEmail: mocks.sendEmail }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'test-secret-not-for-production' }));
import { notify } from '../src/utils/notify';
const input = { recipients: ['2025LIAN01'], kind: 'wca_record' as const, actorKey: '', actorName: '', title: 'Fixture', excerpt: '4.52 三阶平均', link: '/wca/comp/Fixture', dedupeKey: 'record-key' };

describe('notification delivery deduplication', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.sendEmail.mockResolvedValue(undefined); });
  it('does not email a repeated achievement', async () => {
    mocks.query.mockResolvedValue([]);
    await notify(input);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
  it('emails newly inserted records using the existing unsubscribe headers', async () => {
    mocks.query.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([{ provider_uid: 'fixture@example.test', lang: 'zh' }]);
    await notify(input);
    await vi.waitFor(() => expect(mocks.sendEmail).toHaveBeenCalledTimes(1));
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({ to: 'fixture@example.test', subject: '纪录快讯 — Fixture', headers: { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } });
    expect(mocks.query.mock.calls[1][0]).toContain('AND u.email_notify');
    expect(mocks.query.mock.calls[1][0]).toContain('i.verified_at IS NOT NULL');
  });
  it('keeps the inbox entry without email for an unsubscribed/unverified recipient', async () => {
    mocks.query.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([]);
    await notify(input);
    await Promise.resolve();
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
