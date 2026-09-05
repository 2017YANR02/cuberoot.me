import { afterEach, expect, it, vi } from 'vitest';
import { listPublicMembers } from '@/lib/membership-api';

afterEach(() => vi.unstubAllGlobals());

it('only returns members with valid WCA profile identities', async () => {
  const member = { name: 'Member', planSlug: 'admin' };
  const valid = [
    { ...member, wcaId: '2017TEST01' },
    { ...member, wcaId: '2017TEST02' },
  ];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    members: [
      valid[0],
      { ...member, wcaId: null },
      { ...member, wcaId: null },
      { ...member },
      { ...member, wcaId: '' },
      { ...member, wcaId: 'invalid' },
      valid[1],
    ],
  }))));

  expect(await listPublicMembers()).toEqual(valid);
});
