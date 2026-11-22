import { isVaultEntry, type VaultAccount, type VaultEntry } from './vault-crypto';
import { hasVaultAccountMetadata, orderVaultAccounts } from './vault-account';

/** Combine decrypted content locally; the caller persists only encrypted envelopes. */
export function mergeVaultEntries(target: VaultEntry, source: VaultEntry): VaultEntry {
  const merged = structuredClone(target);
  const sourceHasAccounts = hasVaultAccountMetadata(source) || Boolean(source.accounts?.length);
  const targetHasAccounts = target.category === 'accounts' || hasVaultAccountMetadata(target) || Boolean(target.accounts?.length);
  const keepSourceAccount = sourceHasAccounts || (targetHasAccounts && source.category === 'accounts');
  for (const field of keepSourceAccount ? [] : source.fields) {
    const duplicate = merged.fields.find((candidate) => candidate.label === field.label && candidate.value === field.value);
    if (duplicate) duplicate.secret ||= field.secret;
    else merged.fields.push({ ...field, id: merged.fields.some((candidate) => candidate.id === field.id) ? crypto.randomUUID() : field.id });
  }
  if (keepSourceAccount) {
    const accounts = merged.accounts ??= [];
    const append = (account: VaultAccount) => {
      let id = account.id;
      for (let suffix = 1; ; suffix++) {
        const existing = accounts.find((candidate) => candidate.id === id);
        if (!existing) {
          accounts.push({ ...structuredClone(account), id });
          return;
        }
        if (existing.name === account.name && (existing.notes ?? '') === (account.notes ?? '')
          && (existing.privateNotes ?? '') === (account.privateNotes ?? '')
          && JSON.stringify(existing.fields) === JSON.stringify(account.fields)) return;
        const tail = `-${suffix}`;
        id = account.id.slice(0, 100 - tail.length) + tail;
      }
    };
    const primary: VaultAccount | null = (source.fields.length || source.accountName || source.notes || source.privateNotes || source.accountStatus !== undefined)
      ? { id: source.id || 'account', name: source.accountName || source.title, fields: source.fields,
        notes: source.notes, privateNotes: source.privateNotes, accountStatus: source.accountStatus }
      : null;
    for (const account of orderVaultAccounts(source.accounts ?? [], primary, source.primaryAccountIndex)) append(account);
  }
  const images = merged.images ?? [];
  for (const image of source.images ?? []) {
    if (!images.some((candidate) => candidate.dataUrl === image.dataUrl && candidate.name === image.name)) {
      images.push({ ...image, id: images.some((candidate) => candidate.id === image.id) ? crypto.randomUUID() : image.id });
    }
  }
  if (images.length) merged.images = images;
  const sourceNotes = `${source.title}\n${source.notes}`;
  if (!keepSourceAccount && source.notes && source.notes !== merged.notes && !merged.notes.includes(sourceNotes)) {
    merged.notes = merged.notes ? `${merged.notes}\n\n${sourceNotes}` : sourceNotes;
  }
  if (!isVaultEntry(merged)) throw new Error('vault_entry_limit');
  return merged;
}
