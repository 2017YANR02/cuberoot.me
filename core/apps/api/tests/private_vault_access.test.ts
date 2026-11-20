import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFile(new URL(relative, import.meta.url), 'utf8');

describe('private vault access contract', () => {
  it('requires membership to manage and accepted friendship to share', async () => {
    const [vault, friends] = await Promise.all([
      read('../src/routes/private_vault.ts'),
      read('../src/routes/friends.ts'),
    ]);

    expect(vault).toContain("throw new Error('Vault membership required')");
    expect(vault).toContain('canManage: user.isAdmin || await hasActiveMembership(user.wcaId)');
    const managerRoutes = [
      "get('/vault/users'",
      "post('/vault/items'",
      "put('/vault/items/:id'",
      "put('/vault/items/:id/trash'",
      "delete('/vault/items/:id'",
      "delete('/vault/trash'",
    ];
    for (const route of managerRoutes) {
      const handler = vault.split(`privateVaultRoutes.${route}`)[1]?.split('\n});')[0];
      expect(handler, route).toContain('await requireVaultManager(c)');
    }
    expect(vault).toContain("friendship.status = 'accepted'");
    expect(vault).toContain('FOR SHARE');
    expect(friends).toContain('async function revokeVaultAccess');
    expect(friends.match(/await revokeVaultAccess\(tx, userId, targetUserId\)/g)).toHaveLength(2);
  });
});
