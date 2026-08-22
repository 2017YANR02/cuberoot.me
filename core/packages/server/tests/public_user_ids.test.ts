import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../src/db/connection.js', () => ({ query: queryMock, sql: vi.fn() }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'test-secret' }));

import { publicUserIdsForOwnerKeys } from '../src/utils/account.js';

describe('public user IDs for owner keys', () => {
  beforeEach(() => queryMock.mockReset());

  it('resolves WCA and synthetic owner keys in batches without exposing deleted owners', async () => {
    queryMock
      .mockResolvedValueOnce([{ id: '66', wca_id: '2017YANR02' }])
      .mockResolvedValueOnce([{ id: '42' }]);

    const ids = await publicUserIdsForOwnerKeys([
      '2017YANR02', 'u42', '2017YANR02', 'deleted:9', null, '', 'not-an-owner',
    ]);

    expect([...ids.entries()]).toEqual([
      ['2017YANR02', 66],
      ['u42', 42],
    ]);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0][1]).toEqual(['2017YANR02']);
    expect(queryMock.mock.calls[1][1]).toEqual([42]);
  });

  it('does not query for empty or unsupported owner keys', async () => {
    await expect(publicUserIdsForOwnerKeys([null, undefined, '', 'deleted:9'])).resolves.toEqual(new Map());
    expect(queryMock).not.toHaveBeenCalled();
  });
});
