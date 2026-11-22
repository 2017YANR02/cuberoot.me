import { isVaultEntry, vaultEntryImages, type VaultAccount, type VaultEntry, type VaultInformationGroup } from './vault-crypto';
import { hasVaultAccountMetadata, orderVaultAccounts } from './vault-account';

const informationContent = ({ name, fields, notes, images }: VaultInformationGroup) => JSON.stringify([
  name, fields, notes, (images ?? []).map(({ name: imageName, dataUrl }) => [imageName, dataUrl]),
]);

/** Combine decrypted content locally; the caller persists only encrypted envelopes. */
export function mergeVaultEntries(target: VaultEntry, source: VaultEntry): VaultEntry {
  const merged = structuredClone(target);
  const hasAdditionalAccounts = Boolean(source.accounts?.length);
  const targetHasAccounts = target.category === 'accounts' || hasVaultAccountMetadata(target) || Boolean(target.accounts?.length);
  const keepSourcePrimary = hasVaultAccountMetadata(source) || (source.category === 'accounts' && (targetHasAccounts || hasAdditionalAccounts));
  const keepSourceInformation = source.category !== 'accounts' && !keepSourcePrimary
    && Boolean(source.informationName || source.informationGroups?.length || target.informationGroups?.length);
  for (const field of keepSourcePrimary || keepSourceInformation ? [] : source.fields) {
    const duplicate = merged.fields.find((candidate) => candidate.label === field.label && candidate.value === field.value);
    if (duplicate) duplicate.secret ||= field.secret;
    else merged.fields.push({ ...field, id: merged.fields.some((candidate) => candidate.id === field.id) ? crypto.randomUUID() : field.id });
  }
  if (keepSourcePrimary || hasAdditionalAccounts) {
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
    const primary: VaultAccount | null = keepSourcePrimary && (source.fields.length || source.accountName || source.notes || source.privateNotes || source.accountStatus !== undefined)
      ? { id: source.id || 'account', name: source.accountName || source.title, fields: source.fields,
        notes: source.notes, privateNotes: source.privateNotes, accountStatus: source.accountStatus }
      : null;
    for (const account of orderVaultAccounts(source.accounts ?? [], primary, source.primaryAccountIndex)) append(account);
  }
  const images = merged.images ?? [];
  const imageIds = new Set(vaultEntryImages(merged).map(({ id }) => id));
  for (const image of keepSourceInformation ? [] : source.images ?? []) {
    if (!images.some((candidate) => candidate.dataUrl === image.dataUrl && candidate.name === image.name)) {
      const id = imageIds.has(image.id) ? crypto.randomUUID() : image.id;
      images.push({ ...image, id });
      imageIds.add(id);
    }
  }
  if (images.length) merged.images = images;
  const sourceGroups = [...(source.informationGroups ?? [])];
  if (keepSourceInformation && (source.informationName || source.fields.length || source.notes || source.images?.length)) {
    sourceGroups.unshift({
      id: source.id || 'information', name: source.informationName || source.title,
      fields: source.fields, notes: source.notes, images: source.images,
    });
  }
  for (const group of sourceGroups) {
    const groups = merged.informationGroups ??= [];
    const content = informationContent(group);
    let id = group.id;
    for (let suffix = 1; ; suffix++) {
      const existing = groups.find((candidate) => candidate.id === id);
      if (!existing) {
        const next = { ...structuredClone(group), id };
        for (const image of next.images ?? []) {
          if (imageIds.has(image.id)) image.id = crypto.randomUUID();
          imageIds.add(image.id);
        }
        groups.push(next);
        break;
      }
      if (informationContent(existing) === content) break;
      const tail = `-${suffix}`;
      id = group.id.slice(0, 100 - tail.length) + tail;
    }
  }
  const sourceNotes = `${source.title}\n${source.notes}`;
  if (!keepSourcePrimary && !keepSourceInformation && source.notes && source.notes !== merged.notes && !merged.notes.includes(sourceNotes)) {
    merged.notes = merged.notes ? `${merged.notes}\n\n${sourceNotes}` : sourceNotes;
  }
  if (!isVaultEntry(merged)) throw new Error('vault_entry_limit');
  return merged;
}
