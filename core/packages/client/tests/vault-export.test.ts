import { strFromU8, unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { readVaultAccount, updateVaultAccount } from '@/lib/vault-account';
import { buildVaultExport } from '@/lib/vault-export';

const exportedAt = '2026-11-20T18:00:00.000Z';
const image = Uint8Array.of(0xff, 0xd8, 0xff, 0xd9);
const items = [{
  serverId: 'server-item',
  updatedAt: exportedAt,
  trashedAt: exportedAt,
  entry: {
    id: 'entry-id',
    category: 'accounts' as const,
    title: '账号 [示例]',
    notes: '第一行\n第二行',
    fields: [
      { id: 'name', label: '邮箱', value: 'fixture@example.com', secret: false },
      { id: 'old-password', label: 'Password', value: 'legacy-fixture-secret', secret: false },
      { id: 'custom', label: 'Recovery field', value: 'marked-fixture-secret', secret: true },
    ],
    accountName: 'Main account',
    primaryAccountIndex: 1,
    accounts: [{
      id: 'extra',
      name: 'Work account',
      accountStatus: 'problem' as const,
      privateNotes: 'nested-private-note',
      fields: [
        { id: 'login', label: 'Email', value: 'work@example.com', secret: false },
        { id: 'password', label: 'Password', value: 'nested-fixture-secret', secret: true },
      ],
    }],
    images: [{ id: 'attachment-id', name: '../../原图.jpg', dataUrl: 'data:image/jpeg;base64,/9j/2Q==' }],
  },
}];

it.each([false, true])('preserves text and original attachments with sensitive fields enabled = %s', async (includeSensitive) => {
  const archive = await buildVaultExport(items, { includeSensitive, categoryLabel: () => '账号', exportedAt });
  expect(archive.type).toBe('application/zip');
  const files = unzipSync(new Uint8Array(await archive.arrayBuffer()));
  expect(Object.keys(files).sort()).toEqual(['attachments/001/001.jpg', 'entries/001.md', 'index.md', 'vault.json']);
  expect(files['attachments/001/001.jpg']).toEqual(image);
  const markdown = strFromU8(files['entries/001.md']);
  expect(markdown).toContain('第一行\n    第二行');
  expect(markdown).toContain('fixture@example.com');
  expect(markdown).toContain('## Work account');
  expect([...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]).slice(0, 2)).toEqual(['Work account', 'Main account']);
  expect(markdown).toContain('../attachments/001/001.jpg');
  expect(strFromU8(files['index.md'])).toContain('(entries/001.md)');
  const manifest = strFromU8(files['vault.json']);
  expect(JSON.parse(manifest)).toMatchObject({
    format: 'cuberoot-vault',
    version: 1,
    includesSensitiveFields: includeSensitive,
    entries: [{
      id: 'server-item',
      trashedAt: exportedAt,
      accountName: 'Main account',
      accountStatus: 'untested',
      primaryAccountIndex: 1,
      accounts: [{ name: 'Work account', accountStatus: 'problem', fields: expect.arrayContaining([{ id: 'login', label: 'Email', value: 'work@example.com', secret: false }]) }],
      attachments: [{ name: '../../原图.jpg', path: 'attachments/001/001.jpg' }],
    }],
  });
  for (const text of [manifest, markdown]) {
    expect(text.includes('legacy-fixture-secret')).toBe(includeSensitive);
    expect(text.includes('marked-fixture-secret')).toBe(includeSensitive);
    expect(text.includes('nested-fixture-secret')).toBe(includeSensitive);
    expect(text.includes('nested-private-note')).toBe(includeSensitive);
  }
});

it('keeps legacy sensitive fields out of the default export after they are edited as notes', async () => {
  const [item] = structuredClone(items);
  const notes = readVaultAccount(item.entry).notes + '\nEdited notes';
  updateVaultAccount(item.entry, 'notes', 'Notes', notes, 'notes-field');
  expect(item.entry.notes).toBe('');
  expect(readVaultAccount(item.entry).notes).toContain('marked-fixture-secret');
  const archive = await buildVaultExport([item], { includeSensitive: false, categoryLabel: () => 'Accounts', exportedAt });
  const files = unzipSync(new Uint8Array(await archive.arrayBuffer()));
  expect(strFromU8(files['entries/001.md'])).not.toContain('marked-fixture-secret');
  expect(strFromU8(files['vault.json'])).not.toContain('marked-fixture-secret');
});
