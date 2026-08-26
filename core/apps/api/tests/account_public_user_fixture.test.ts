import { describe, expect, it, vi } from 'vitest';
import { decodeWebSessionUser } from '@cuberoot/shared/auth/web-session';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('../src/db/connection.js', () => ({ query: mocks.query, sql: mocks.sql }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'test-secret' }));

import { publicUser, updateUploadedAvatar, type AppUser } from '../src/utils/account.js';

describe('account public user fixture', () => {
  it('emits a decoder-compatible public user for a newly-created WeChat account', () => {
    const wechatUser: AppUser = {
      id: 66,
      wca_id: null,
      display_name: '',
      avatar_url: null,
      avatar_source: 'auto',
      avatar_preset: null,
    };

    const user = publicUser(wechatUser);

    expect(user).toEqual({
      uid: 66,
      wcaId: null,
      name: '',
      avatar: '',
      avatarSource: 'auto',
      avatarPreset: null,
    });
    expect(decodeWebSessionUser(user)).toEqual(user);
  });

  it('changes to an upload only when the image belongs to the account owner key', async () => {
    mocks.query.mockResolvedValueOnce([]);

    await expect(updateUploadedAvatar(
      66,
      'u66',
      901,
      'https://api.example.test/v1/article/img/901',
    )).resolves.toBeNull();

    const [statement, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(statement).toContain('EXISTS (');
    expect(statement).toContain('image.id = ? AND image.owner_wca_id = ?');
    expect(params).toEqual([
      'https://api.example.test/v1/article/img/901',
      66,
      901,
      'u66',
    ]);
  });
});
