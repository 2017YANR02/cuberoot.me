import { tr } from '@/i18n/tr';
import type { Zippable } from 'fflate';
import type { VaultAccount, VaultEntry, VaultField } from './vault-crypto';
import { hasVaultPrimaryAccount, isVaultSensitiveField, orderVaultAccounts, readVaultAccount, vaultAccountSlots, vaultAccountStatusLabels } from './vault-account';

interface SavedVaultEntry {
  serverId: string;
  updatedAt: string;
  trashedAt: string | null;
  entry: VaultEntry;
}

type Category = NonNullable<VaultEntry['category']>;
const zipType = 'application/zip';
const markdownLabel = (value: string) => value.replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}\[\]<>()#+!|]/g, '\\$&');
const markdownBlock = (value: string) => value.split(/\r\n|\r|\n/).map((line) => `    ${line}`).join('\n');
const numbered = (index: number) => String(index + 1).padStart(3, '0');

export async function buildVaultExport(
  items: readonly SavedVaultEntry[],
  options: { includeSensitive: boolean; categoryLabel: (category: Category) => string; exportedAt: string },
): Promise<Blob> {
  const { strToU8, zip } = await import('fflate');
  const files: Zippable = {};
  const groups = new Map<Category, string[]>();
  const entries = items.map(({ serverId, updatedAt, trashedAt, entry }, index) => {
    const number = numbered(index);
    const category = entry.category ?? 'other';
    const title = markdownLabel(entry.title.trim() || tr({ zh: '未命名', en: 'Untitled' }));
    const markdownPath = `entries/${number}.md`;
    const exportFields = (fields: VaultField[]) => fields.filter((field) =>
      options.includeSensitive || !isVaultSensitiveField(field));
    const fields = exportFields(entry.fields);
    const notes = entry.notes;
    const privateNotes = options.includeSensitive ? entry.privateNotes : undefined;
    const hasPrimaryAccount = hasVaultPrimaryAccount(entry);
    const accountStatus = hasPrimaryAccount ? entry.accountStatus ?? 'untested' : undefined;
    const accounts = entry.accounts?.map(({ id, name, fields, notes, privateNotes, accountStatus }): VaultAccount => ({
      id, name, fields: exportFields(fields), notes, privateNotes: options.includeSensitive ? privateNotes : undefined,
      accountStatus: accountStatus ?? 'untested',
    }));
    const attachments = (entry.images ?? []).map(({ id, name, dataUrl }, imageIndex) => {
      const match = /^data:image\/(jpeg|png|webp);base64,/.exec(dataUrl);
      if (!match) throw new Error('Invalid vault attachment');
      const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
      const path = `attachments/${number}/${numbered(imageIndex)}.${extension}`;
      files[path] = [Uint8Array.from(atob(dataUrl.slice(match[0].length)), (char) => char.charCodeAt(0)), { level: 0 }];
      return { id, name, path };
    });
    const status = trashedAt ? tr({ zh: '回收站', en: 'Trash' }) : entry.mergedInto ? tr({ zh: '已合并', en: 'Merged' }) : '';
    const indexLine = `- [${title}](${markdownPath})${status ? ` · ${status}` : ''}`;
    const group = groups.get(category) ?? [];
    group.push(indexLine);
    groups.set(category, group);
    const lines = [`# ${title}`, '', `${tr({ zh: '分类', en: 'Category' })} · ${options.categoryLabel(category)}`, ''];
    if (status) lines.push(status, '');
    const appendAccount = (name: string, account: Pick<VaultAccount, 'fields' | 'notes' | 'privateNotes' | 'accountStatus'>) => {
      lines.push(`## ${markdownLabel(name)}`, '', tr(vaultAccountStatusLabels[account.accountStatus ?? 'untested']), '');
      const values = readVaultAccount(account);
      for (const { key, label } of vaultAccountSlots) {
        if (values[key]) lines.push(`### ${tr(label)}`, '', markdownBlock(values[key]), '');
      }
    };
    if (!hasPrimaryAccount) {
      for (const field of fields) lines.push(`## ${markdownLabel(field.label)}`, '', markdownBlock(field.value), '');
      if (notes) lines.push(`## ${tr({ zh: '备注', en: 'Notes' })}`, '', markdownBlock(notes), '');
    }
    const primary: VaultAccount | null = hasPrimaryAccount ? { id: entry.id, name: entry.accountName ?? '', fields, notes, privateNotes, accountStatus } : null;
    orderVaultAccounts(accounts ?? [], primary, entry.primaryAccountIndex).forEach((account, index) => {
      const number = index + 1;
      appendAccount(account.name || tr({ zh: `账号 ${number}`, en: `Account ${number}` }), account);
    });
    if (attachments.length) {
      lines.push(`## ${tr({ zh: '附件', en: 'Attachments' })}`, '',
        ...attachments.map(({ name, path }) => `- [${markdownLabel(name)}](../${path})`), '');
    }
    files[markdownPath] = strToU8(lines.join('\n'));
    return {
      id: serverId, entryId: entry.id, title: entry.title, category, updatedAt, trashedAt,
      mergedInto: entry.mergedInto, markdownPath, accountName: entry.accountName, accountStatus, fields, accounts,
      primaryAccountIndex: entry.primaryAccountIndex, notes, privateNotes, attachments,
    };
  });
  const index = [`# ${tr({ zh: '私密资料库', en: 'Private vault' })}`, ''];
  for (const [category, links] of groups) index.push(`## ${options.categoryLabel(category)}`, '', ...links, '');
  files['index.md'] = strToU8(index.join('\n'));
  files['vault.json'] = strToU8(JSON.stringify({
    format: 'cuberoot-vault',
    version: 1,
    exportedAt: options.exportedAt,
    includesSensitiveFields: options.includeSensitive,
    entries,
  }, null, 2));
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, (error, data) => { if (error) reject(error); else resolve(data); });
  });
  return new Blob([new Uint8Array(bytes)], { type: zipType });
}
