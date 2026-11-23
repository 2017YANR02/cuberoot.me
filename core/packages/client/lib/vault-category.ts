import type { VaultEntry } from './vault-crypto';

export const vaultContractLabel = { zh: '合同', en: 'Contract' };
export const vaultDocumentLabel = { zh: '证件', en: 'Documents' };
export const vaultCategoryOptions = [
  { value: '', label: { zh: '全部', en: 'All' } },
  { value: 'personal', label: { zh: '个人', en: 'Personal' } },
  { value: 'accounts', label: { zh: '账号', en: 'Accounts' } },
  { value: 'business', label: { zh: '企业', en: 'Business' } },
  { value: 'documents', label: vaultDocumentLabel },
  { value: 'contract', label: { ...vaultContractLabel, en: 'Contracts' } },
] as const;

type VaultTagCategory = `tag:${string}`;
export type VaultCategoryFilter = (typeof vaultCategoryOptions)[number]['value'] | VaultTagCategory;
export type VaultEntryCategory = Exclude<VaultCategoryFilter, ''> | 'other';

export function isVaultTagCategory(category: string): category is VaultTagCategory {
  return category.startsWith('tag:');
}

export function splitVaultTitle(title: string) {
  const separator = title.search(/[|｜│]/);
  if (separator < 0) return null;
  const tag = title.slice(0, separator).trimStart().replace(/ $/, '');
  if (!tag.trim()) return null;
  const name = title.slice(separator + 1).trimStart();
  return { tag, name, prefix: title.slice(0, title.length - name.length), suffix: ` ${title.slice(separator)}` };
}

const legacyContractTag = '存证记录';
const compactTitleTags = new Map([
  ['个人资料', '个人'],
  ['账号密码', '账号'],
  ['企业资料', '企业'],
  ['个人证件', vaultDocumentLabel.zh],
  ['身份核验', '核验'],
  ['个人照片', '照片'],
  ['个人履历', '履历'],
  ['户籍资料', '户籍'],
  ['就业资料', '就业'],
  ['网站管理', '网站'],
  ['软件授权', '授权'],
  ['网络账号', '网络'],
  ['银行资料', '银行'],
  ['支付资料', '支付'],
  [legacyContractTag, vaultContractLabel.zh],
]);

export function vaultTitleTagText(tag: string): string {
  return compactTitleTags.get(tag.trim()) ?? tag;
}

// Tagged entries use their displayed tag. Older untagged entries retain the stored category.
export function vaultEntryCategory(entry: VaultEntry): VaultEntryCategory {
  const parts = splitVaultTitle(entry.title);
  if (!parts) return entry.category ?? 'other';
  const tag = vaultTitleTagText(parts.tag).trim();
  const englishTag = tag.toLowerCase();
  const standard = vaultCategoryOptions.find(({ value, label }) => value && (label.zh === tag || label.en.toLowerCase() === englishTag));
  if (standard?.value) return standard.value;
  if (englishTag === 'account') return 'accounts';
  if (englishTag === 'document') return 'documents';
  if (englishTag === vaultContractLabel.en.toLowerCase()) return 'contract';
  return `tag:${tag}`;
}

export function renameLegacyVaultContract(entry: VaultEntry): VaultEntry {
  if (vaultEntryCategory(entry) !== 'contract') return entry;
  const parts = splitVaultTitle(entry.title);
  return parts?.tag.trim() === legacyContractTag
    ? { ...entry, title: `${parts.prefix.replace(legacyContractTag, vaultContractLabel.zh)}${parts.name}` }
    : entry;
}
