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
