import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { privateVaultRoutes } from '../src/routes/private_vault.js';

const sql = vi.hoisted(() => vi.fn());
vi.mock('../src/db/connection.js', () => ({ sql }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: () => '127.0.0.1' }));
vi.mock('../src/utils/app_user_auth.js', () => ({ requireAppUserId: async () => 7 }));
vi.mock('../src/utils/membership.js', () => ({ hasActiveMembership: async () => false }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  checkRateLimit: () => {},
  requireAuth: async () => ({ isAdmin: false }),
}));

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

  it('matches the full backup revision using only the signed-in owner’s metadata', async () => {
    const updated_at = new Date('2026-11-21T16:00:00Z');
    const own = { id: 'owner-item', owner_user_id: '7', version: '1', updated_at, trashed_at: updated_at };
    const shared = { ...own, id: 'shared-item', owner_user_id: '99', trashed_at: null };
    sql.mockImplementation(async (parts: TemplateStringsArray, ...parameters: unknown[]) => {
      const query = parts.join('?');
      if (query.includes("encrypted_private_key #>> '{recovery,iv}'")) return [{ iv: 'recovery-iv' }];
      if (query.includes('FROM vault_user_keys')) return [{ encrypted_private_key: { recovery: { iv: 'recovery-iv' } } }];
      if (query.includes('SELECT item.id, item.version')) {
        expect(query).toMatch(/WHERE item.owner_user_id = \? AND access.recipient_user_id = \?/);
        expect(parameters).toEqual([7, 7]);
        expect(query).not.toContain('ciphertext');
        return [own];
      }
      return query.includes('SELECT item.id, item.owner_user_id') ? [own, shared] : [];
    });

    const full = await privateVaultRoutes.request('/vault');
    const check = await privateVaultRoutes.request('/vault/backup-revision?userId=99');
    expect(full.status).toBe(200);
    expect(check.status).toBe(200);
    expect(check.headers.get('Cache-Control')).toBe('no-store');
    const { backupRevision } = await full.json();
    expect(await check.json()).toEqual({ userId: 7, revision: backupRevision });
    expect(backupRevision).toMatch(/^[0-9a-f]{64}$/);

    own.version = '2';
    const changed = await privateVaultRoutes.request('/vault/backup-revision');
    expect((await changed.json()).revision).not.toBe(backupRevision);
  });
});
