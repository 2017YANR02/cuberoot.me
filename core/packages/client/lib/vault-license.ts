import { hasVaultAccountMetadata } from './vault-account';
import type { VaultEntry } from './vault-crypto';

const creditCode = /^[0-9A-HJ-NPQRTUWXY]{18}$/;

export function isVaultLicense(entry: VaultEntry): boolean {
  return entry.category === 'business' && entry.title.includes('营业执照');
}

function matchPair<T>(candidates: readonly T[], matches: (candidate: T, index: number) => boolean): [T, T] | undefined {
  if (candidates.length !== 2) return;
  const [a, b] = candidates;
  const forward = matches(a, 0) || matches(b, 1);
  const backward = matches(a, 1) || matches(b, 0);
  if (forward === backward) return;
  return forward ? [a, b] : [b, a];
}

/** Split the old two-license merge only when the notes and original filenames identify the pairs. */
export function splitVaultLicenses(entry: VaultEntry): VaultEntry {
  if (!isVaultLicense(entry) || entry.informationName || entry.informationGroups?.length
    || entry.mergedInto || hasVaultAccountMetadata(entry) || entry.accounts?.length
    || entry.fields.length !== 2 || !entry.fields.every(({ value }) => creditCode.test(value.trim()))
    || entry.images?.length !== 2 || !entry.images.every(({ name }) => name.includes('营业执照'))) return entry;

  const notes = entry.notes.split(/\r?\n[ \t]*\r?\n(?=企业资料[ \t]*[|｜][^\r\n]*营业执照)/);
  if (notes.length !== 2) return entry;
  const names = notes.map((section) => section.match(/^[ \t]*名称[：:]([^\r\n]+)/m)?.[1].trim() ?? '');
  if (names.some((name) => !name || name.length > 200) || names[0] === names[1]) return entry;

  const codes = notes.map((section) => section.match(/^[ \t]*统一社会信用代码[：:][ \t]*(\S+)/m)?.[1]);
  const fields = matchPair(entry.fields, ({ value }, index) => codes[index] === value.trim());
  const imageNames = names.map((name) => name.replace(/[（(].*$/, '').trim());
  const images = matchPair(entry.images, ({ name }, index) => Boolean(imageNames[index]) && name.startsWith(imageNames[index]));
  if (!fields || !images || !fields[1].id) return entry;

  return {
    ...entry,
    informationName: names[0],
    fields: [fields[0]],
    notes: notes[0],
    images: [images[0]],
    informationGroups: [{ id: fields[1].id, name: names[1], fields: [fields[1]], notes: notes[1], images: [images[1]] }],
  };
}
