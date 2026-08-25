import { describe, expect, it, vi } from 'vitest';
import { decodeWebSessionUser } from '@cuberoot/shared/auth/web-session';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('../src/db/connection.js', () => ({ query: mocks.query, sql: mocks.sql }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'test-secret' }));

import { publicUser, type AppUser } from '../src/utils/account.js';

describe('account public user fixture', () => {
  it('emits a decoder-compatible public user for a newly-created WeChat account', () => {
    const wechatUser: AppUser = {
      id: 66,
      wca_id: null,
      display_name: '',
      avatar_url: null,
    };

    const user = publicUser(wechatUser);

    expect(user).toEqual({ uid: 66, wcaId: null, name: '', avatar: '' });
    expect(decodeWebSessionUser(user)).toEqual(user);
  });
});
