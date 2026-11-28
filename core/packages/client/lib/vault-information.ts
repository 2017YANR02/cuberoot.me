import { hasVaultPrimaryAccount, orderVaultGroups } from './vault-account';
import type { VaultEntry, VaultInformation, VaultInformationGroup, VaultStatus } from './vault-crypto';

export const vaultStatusLabels = {
  verified: { zh: '已确认', en: 'Verified' },
  problem: { zh: '有问题', en: 'Has a problem' },
  untested: { zh: '待确认', en: 'Unchecked' },
} satisfies Record<VaultStatus, { zh: string; en: string }>;

const emailLabels = new Set(['邮箱', '电子邮箱', '邮箱地址', '电子邮件', '电子邮件地址', 'email', 'e-mail', 'email address', 'e-mail address']);

/** Legacy information editors displayed email before password until an explicit reorder. */
export function displayedVaultFields({ fields, manualFieldOrder }: VaultInformation) {
  if (manualFieldOrder) return fields;
  const password = fields.findIndex(({ label }) => ['密码', 'password'].includes(label.trim().toLowerCase()));
  if (password < 0) return fields;
  const tail = fields.slice(password);
  const isEmail = ({ label }: typeof fields[number]) => emailLabels.has(label.trim().toLowerCase());
  return [...fields.slice(0, password), ...tail.filter(isEmail), ...tail.filter(field => !isEmail(field))];
}

type InformationGroup = VaultInformationGroup | 'primary';

export function vaultInformationGroups(entry: VaultEntry): InformationGroup[] {
  const hasPrimary = entry.category !== 'accounts' && !hasVaultPrimaryAccount(entry)
    && (!entry.primaryInformationRemoved || Boolean(entry.informationName || entry.status || entry.fields.length || entry.notes || entry.images?.length));
  return orderVaultGroups<InformationGroup>(entry.informationGroups ?? [], hasPrimary ? 'primary' : null, entry.primaryInformationIndex);
}

export function setVaultInformationOrder(entry: VaultEntry, groups: InformationGroup[]): void {
  entry.informationGroups = groups.filter(group => group !== 'primary');
  const index = groups.indexOf('primary');
  if (index > 0) entry.primaryInformationIndex = index;
  else delete entry.primaryInformationIndex;
}

export function removeVaultInformation(entry: VaultEntry, id?: string): void {
  const groups = vaultInformationGroups(entry);
  if (id !== undefined) {
    setVaultInformationOrder(entry, groups.filter(group => group === 'primary' || group.id !== id));
    return;
  }
  const remaining = groups.filter(group => group !== 'primary');
  const next = remaining.shift();
  if (next) delete entry.primaryInformationRemoved;
  else entry.primaryInformationRemoved = true;
  entry.informationName = next?.name;
  entry.status = next?.status;
  entry.manualFieldOrder = next?.manualFieldOrder;
  entry.fields = next?.fields ?? [];
  entry.notes = next?.notes ?? '';
  entry.images = next?.images;
  setVaultInformationOrder(entry, next ? ['primary', ...remaining] : []);
}
