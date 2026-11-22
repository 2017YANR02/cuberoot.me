import { hasVaultPrimaryAccount, orderVaultAccounts, vaultAccountStatusLabels } from './vault-account';
import { bytesToBase64, type VaultAccount, type VaultEntry } from './vault-crypto';
import { vaultBackupReaderScript, vaultBackupReaderStyle } from './vault-backup-reader';

export const VAULT_BACKUP_FORMAT = 3;
export const VAULT_BACKUP_LAYOUT_REVISION = 1;
export const VAULT_BACKUP_FILENAME = 'cuberoot-vault-local.html';

export interface VaultBackupItem {
  entry: VaultEntry;
  trashedAt?: string | null;
}

export interface VaultBackupSource {
  revision: string;
  readItems: () => Promise<VaultBackupItem[]>;
}

export const vaultBackupLabels = {
  title: { zh: '私密资料库备份', en: 'Private vault backup' },
  lastBackup: { zh: '备份时间', en: 'Backed up at' },
  search: { zh: '搜索资料', en: 'Search items' },
  untitled: { zh: '未命名', en: 'Untitled' },
  trash: { zh: '回收站', en: 'Trash' },
  account: { zh: '账号', en: 'Account' },
  notes: { zh: '备注', en: 'Notes' },
  mergedInto: { zh: '已合并到', en: 'Merged into' },
  empty: { zh: '没有符合条件的资料。', en: 'No matching items.' },
  ...vaultAccountStatusLabels,
};

type Labels = Record<keyof typeof vaultBackupLabels, string>;
export interface VaultBackupLocale {
  lang: 'en' | 'zh-Hans';
  labels: Labels;
}

const hash = async (value: string) => bytesToBase64(new Uint8Array(
  await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
));
export const vaultBackupMarker = (id: string) => `<!doctype html><!-- CubeRoot Vault local backup ${id} -->`;

const html = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function renderFields({ fields, notes, privateNotes }: VaultAccount, labels: Labels): string {
  const rows = fields.map(({ label, value }) => [label, value]);
  for (const note of [notes, privateNotes]) {
    if (note) rows.push([labels.notes, note]);
  }
  return rows.length ? `<dl>${rows.map(([label, value]) => `<dt>${html(label)}</dt><dd>${html(value)}</dd>`).join('\n')}</dl>` : '';
}

function renderItem({ entry, trashedAt }: VaultBackupItem, labels: Labels): string {
  const primary: VaultAccount = {
    id: entry.id, name: entry.accountName ?? '', fields: entry.fields, notes: entry.notes,
    privateNotes: entry.privateNotes, accountStatus: entry.accountStatus,
  };
  const hasPrimary = hasVaultPrimaryAccount(entry);
  const accounts = orderVaultAccounts(entry.accounts ?? [], hasPrimary ? primary : null, entry.primaryAccountIndex);
  const accountSections = accounts.map((account, index) => {
    const { name, accountStatus } = account;
    const title = name || (accounts.length > 1 ? `${labels.account} ${index + 1}` : '');
    return `<section class="backup-account">
${title ? `<h3>${html(title)}</h3>` : ''}
${accountStatus ? `<p>${html(labels[accountStatus])}</p>` : ''}
${renderFields(account, labels)}
</section>`;
  });
  const images = (entry.images ?? []).flatMap(({ name, dataUrl }) =>
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)
      ? [`<figure><img src="${dataUrl}" alt="${html(name)}" loading="lazy"><figcaption>${html(name)}</figcaption></figure>`]
      : []);
  const title = entry.title || labels.untitled;
  return `<details data-entry-id="${html(entry.id)}" data-category="${html(entry.category ?? 'other')}"${trashedAt ? ` data-trashed-at="${html(trashedAt)}"` : ''}>
<summary>${html(title)}${trashedAt ? ` · ${html(labels.trash)}` : ''}</summary>
<div>
${entry.mergedInto ? `<p>${html(labels.mergedInto)} ${html(entry.mergedInto.title)}</p>` : ''}
${hasPrimary ? '' : renderFields(primary, labels)}
${accountSections.join('\n')}
${images.join('\n')}
</div>
</details>`;
}

export async function buildVaultBackup(
  id: string,
  items: VaultBackupItem[],
  savedAt: string,
  { lang, labels }: VaultBackupLocale,
): Promise<Blob> {
  const [scriptHash, styleHash] = await Promise.all([hash(vaultBackupReaderScript), hash(vaultBackupReaderStyle)]);
  return new Blob([
    `${vaultBackupMarker(id)}
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'sha256-${styleHash}'; img-src data:; base-uri 'none'; form-action 'none'">
<title>${html(labels.title)}</title>
<style>${vaultBackupReaderStyle}</style>
</head>
<body>
<main>
  <h1>${html(labels.title)}</h1>
  <p>${html(labels.lastBackup)} <time datetime="${html(savedAt)}">${html(new Date(savedAt).toLocaleString(lang))}</time></p>
  <div id="search-controls" hidden><label for="search">${html(labels.search)}</label>
    <input type="search" id="search" autocomplete="off" spellcheck="false"></div>
  <p id="empty"${items.length ? ' hidden' : ''}>${html(labels.empty)}</p>
  <div id="items">\n`,
    ...items.map((item) => renderItem(item, labels)),
    `\n  </div>
</main>
<script>${vaultBackupReaderScript}</script>
</body>
</html>`,
  ], { type: 'text/html;charset=utf-8' });
}
