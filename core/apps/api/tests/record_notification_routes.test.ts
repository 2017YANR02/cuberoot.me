import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';
import { defaultRecordNotificationPreferences } from '@cuberoot/shared/record-notifications';
const mocks = vi.hoisted(() => ({ query: vi.fn(), requireAuth: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: mocks.requireAuth }));
vi.mock('../src/utils/notify.js', () => ({ rememberLang: vi.fn(), verifyUnsubToken: vi.fn() }));
vi.mock('../src/utils/account.js', () => ({ publicUserIdsForOwnerKeys: vi.fn() }));
import { notificationRoutes } from '../src/routes/notifications';

describe('record subscription endpoints', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireAuth.mockResolvedValue({ wcaId: 'u42' }); mocks.query.mockResolvedValue([{ id: 42 }]); });
  it('requires an authenticated identity before reading or writing', async () => {
    mocks.requireAuth.mockRejectedValue(new HTTPException(401));
    expect((await notificationRoutes.request('/notifications/records')).status).toBe(401);
    expect((await notificationRoutes.request('/notifications/records', { method: 'PUT', body: '{}' })).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('returns default optional subscriptions and actual verified-email readiness', async () => {
    mocks.query.mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce([{ wca_id: null, preferences: null, email_ready: false }]);
    const response = await notificationRoutes.request('/notifications/records');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ preferences: defaultRecordNotificationPreferences(), ownWcaId: null, emailReady: false });
  });
  it('saves only for the authenticated account as a JSONB object', async () => {
    const preferences = { ...defaultRecordNotificationPreferences(), levels: ['WR'], regions: ['cn', 'AS'] };
    const response = await notificationRoutes.request('/notifications/records', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences) });
    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[1][1]).toEqual([42, preferences]);
  });
  it.each([{ regions: ['zz'] }, { user_id: 123 }, { levels: ['PR'] }, { events: ['unknown'] }])('refuses invalid preferences: %j', async overrides => {
    const response = await notificationRoutes.request('/notifications/records', { method: 'PUT', body: JSON.stringify({ ...defaultRecordNotificationPreferences(), ...overrides }) });
    expect(response.status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
