import { expect, it } from 'vitest';
import { mergeVaultEntries } from '@/lib/vault-merge';
import { isVaultEntry, type VaultEntry } from '@/lib/vault-crypto';

const image = { id: 'photo', name: 'original.jpg', dataUrl: 'data:image/jpeg;base64,/9j/' };
const entry = (id: string): VaultEntry => ({ id, title: id, fields: [], notes: '', category: 'personal' });

it('preserves originals and conflicting fields, combines notes and original images, and retries without duplicates', () => {
  const target = { ...entry('target'), notes: 'target notes', fields: [{ id: 'field', label: 'number', value: 'old', secret: false }], images: [image] };
  const source = { ...entry('source'), notes: 'source notes', fields: [
    { id: 'same', label: 'number', value: 'old', secret: true },
    { id: 'field', label: 'number', value: 'new', secret: false },
  ], images: [{ ...image, id: 'duplicate' }, { ...image, name: 'second.jpg', dataUrl: 'data:image/jpeg;base64,/9j/AA==' }] };
  const originals = structuredClone({ target, source });
  const merged = mergeVaultEntries(target, source);
  expect(merged.id).toBe('target');
  expect(merged.title).toBe('target');
  expect(merged.fields.map(({ value, secret }) => ({ value, secret }))).toEqual([{ value: 'old', secret: true }, { value: 'new', secret: false }]);
  expect(new Set(merged.fields.map(({ id }) => id)).size).toBe(2);
  expect(new Set(merged.images!.map(({ id }) => id)).size).toBe(2);
  expect(merged.images!.map(({ dataUrl }) => dataUrl)).toEqual([image.dataUrl, source.images[1].dataUrl]);
  expect(merged.notes).toBe('target notes\n\nsource\nsource notes');
  expect(mergeVaultEntries(merged, source)).toEqual(merged);
  expect({ target, source }).toEqual(originals);
});

it('rejects overflowing merges and validates recoverable archive metadata', () => {
  const target = { ...entry('target'), fields: Array.from({ length: 50 }, (_, index) => ({ id: String(index), label: String(index), value: '', secret: false })) };
  expect(() => mergeVaultEntries(target, { ...entry('source'), fields: [{ id: 'more', label: 'more', value: '', secret: false }] })).toThrow('vault_entry_limit');
  expect(isVaultEntry({ ...entry('source'), mergedInto: { id: 'target', title: 'target' } })).toBe(true);
  expect(isVaultEntry({ ...entry('source'), mergedInto: { id: '', title: 'target' } })).toBe(false);
});

it('keeps account pairs separate and does not duplicate them on a retry', () => {
  const password = (value: string) => ({ id: 'password', label: 'Password', value, secret: true });
  const target: VaultEntry = { ...entry('target'), category: 'accounts', fields: [password('first')] };
  const source: VaultEntry = {
    ...entry('source'), category: 'accounts', accountName: 'Work', accountStatus: 'verified',
    primaryAccountIndex: 1,
    fields: [password('second')], notes: 'work notes',
    accounts: [{ id: 'backup', name: 'Backup', accountStatus: 'problem', fields: [password('third')] }],
  };
  const merged = mergeVaultEntries(target, source);
  expect(merged.fields).toEqual(target.fields);
  expect(merged.notes).toBe('');
  expect(merged.accounts?.[1].notes).toBe('work notes');
  expect(merged.accounts?.map(({ accountStatus }) => accountStatus)).toEqual(['problem', 'verified']);
  expect(merged.accounts?.map(({ name, fields }) => [name, fields[0].value])).toEqual([['Backup', 'third'], ['Work', 'second']]);
  expect(mergeVaultEntries(merged, source)).toEqual(merged);
});

it('merges ordinary content and added accounts without treating the ordinary content as an account', () => {
  const target: VaultEntry = { ...entry('target'), category: 'business' };
  const source: VaultEntry = {
    ...entry('source'), category: 'business', notes: 'Business note',
    fields: [{ id: 'detail', label: '', value: 'Business detail', secret: false }],
    accounts: [{ id: 'account', name: 'Portal', fields: [{ id: 'login', label: 'Account', value: 'portal', secret: false }] }],
  };
  const merged = mergeVaultEntries(target, source);
  expect(merged.fields).toEqual(source.fields);
  expect(merged.notes).toBe('source\nBusiness note');
  expect(merged.accounts).toEqual(source.accounts);
  expect(mergeVaultEntries(merged, source)).toEqual(merged);
});

it('keeps grouped notes and images together when merging and retrying', () => {
  const target: VaultEntry = { ...entry('target'), category: 'business', images: [image] };
  const source: VaultEntry = {
    ...entry('source'), category: 'business', informationName: 'First license', notes: 'First note',
    images: [{ ...image, name: 'first.jpg' }],
    informationGroups: [{
      id: 'second', name: 'Second license', notes: 'Second note', fields: [],
      images: [{ ...image, id: 'second-photo', name: 'second.jpg' }],
    }],
  };
  const merged = mergeVaultEntries(target, source);
  expect(merged.images).toEqual(target.images);
  expect(merged.informationGroups).toMatchObject([
    { name: 'First license', notes: 'First note', images: [{ name: 'first.jpg' }] },
    { name: 'Second license', notes: 'Second note', images: [{ name: 'second.jpg' }] },
  ]);
  expect(isVaultEntry(merged)).toBe(true);
  expect(mergeVaultEntries(merged, source)).toEqual(merged);
});
