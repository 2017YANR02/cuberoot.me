import { isVaultEntry, type VaultEntry } from './vault-crypto';

/** Combine decrypted content locally; the caller persists only encrypted envelopes. */
export function mergeVaultEntries(target: VaultEntry, source: VaultEntry): VaultEntry {
  const merged = structuredClone(target);
  for (const field of source.fields) {
    const duplicate = merged.fields.find((candidate) => candidate.label === field.label && candidate.value === field.value);
    if (duplicate) duplicate.secret ||= field.secret;
    else merged.fields.push({ ...field, id: merged.fields.some((candidate) => candidate.id === field.id) ? crypto.randomUUID() : field.id });
  }
  const images = merged.images ?? [];
  for (const image of source.images ?? []) {
    if (!images.some((candidate) => candidate.dataUrl === image.dataUrl && candidate.name === image.name)) {
      images.push({ ...image, id: images.some((candidate) => candidate.id === image.id) ? crypto.randomUUID() : image.id });
    }
  }
  if (images.length) merged.images = images;
  const sourceNotes = `${source.title}\n${source.notes}`;
  if (source.notes && source.notes !== merged.notes && !merged.notes.includes(sourceNotes)) {
    merged.notes = merged.notes ? `${merged.notes}\n\n${sourceNotes}` : sourceNotes;
  }
  if (!isVaultEntry(merged)) throw new Error('vault_entry_limit');
  return merged;
}
