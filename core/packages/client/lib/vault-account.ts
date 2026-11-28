import type { VaultAccount, VaultStatus, VaultEntry, VaultField } from './vault-crypto';

export const vaultAccountStatusLabels = {
  verified: { zh: '账号密码已确认', en: 'Credentials verified' },
  problem: { zh: '账号密码有问题', en: 'Credentials have a problem' },
  untested: { zh: '账号密码未测试', en: 'Credentials untested' },
} satisfies Record<VaultStatus, { zh: string; en: string }>;

export function hasVaultAccountMetadata(entry: VaultEntry): boolean {
  return entry.accountName !== undefined || entry.privateNotes !== undefined || entry.accountStatus !== undefined;
}

export function hasVaultPrimaryAccount(entry: VaultEntry): boolean {
  return hasVaultAccountMetadata(entry) || (entry.category === 'accounts' && (entry.fields.length > 0 || Boolean(entry.notes)));
}

export function orderVaultGroups<T>(groups: readonly T[], primary: T | null, primaryIndex = 0): T[] {
  const ordered = [...groups];
  if (primary !== null) ordered.splice(primaryIndex, 0, primary);
  return ordered;
}

type AccountGroup = VaultAccount | 'primary';

export function vaultAccountGroups(entry: VaultEntry): AccountGroup[] {
  return orderVaultGroups<AccountGroup>(entry.accounts ?? [], hasVaultPrimaryAccount(entry) ? 'primary' : null, entry.primaryAccountIndex);
}

export function setVaultAccountOrder(entry: VaultEntry, groups: readonly AccountGroup[]): void {
  entry.accounts = groups.filter((group) => group !== 'primary');
  const primaryIndex = groups.indexOf('primary');
  if (primaryIndex > 0) entry.primaryAccountIndex = primaryIndex;
  else delete entry.primaryAccountIndex;
}

export const vaultAccountSlots = [
  { key: 'login', label: { zh: '账号', en: 'Account' } },
  { key: 'password', label: { zh: '密码', en: 'Password' } },
  { key: 'notes', label: { zh: '备注', en: 'Notes' } },
] as const;

type AccountSlot = typeof vaultAccountSlots[number]['key'];
type AccountContent = { fields: VaultField[]; notes?: string; privateNotes?: string };

const loginLabels = new Set([
  '账号', '帐号', '用户名', '登录名', '登录账号', '登录信息', '登录邮箱', '邮箱', '电子邮箱', '邮箱地址',
  '电子邮件', '电子邮件地址', '手机号', '手机号码', '手机', '电话', '电话号码', '登录手机号',
  'account', 'username', 'user name', 'login', 'login details', 'login name', 'email', 'e-mail',
  'email address', 'e-mail address', 'phone', 'phone number', 'mobile', 'mobile number',
]);
const passwordLabels = new Set([
  '密码', '登录密码', '旧密码', '原密码', '新密码', '当前密码', '口令', 'password', 'old password',
  'new password', 'current password', 'login password', 'passphrase', 'passcode', 'pin',
]);
const noteLabels = new Set(['备注', '附加信息', 'note', 'notes']);

function accountSlot(label: string): AccountSlot {
  const normalized = label.trim().toLowerCase();
  if (passwordLabels.has(normalized)) return 'password';
  return loginLabels.has(normalized) ? 'login' : 'notes';
}

export function isVaultSensitiveField(field: VaultField): boolean {
  return field.secret || accountSlot(field.label) === 'password';
}

export function readVaultAccount(account: AccountContent): Record<AccountSlot, string> {
  const fields = { login: [] as VaultField[], password: [] as VaultField[], notes: [] as VaultField[] };
  for (const field of account.fields) {
    if (field.value) fields[accountSlot(field.label)].push(field);
  }
  const lines = (items: VaultField[]) => items.map(({ label, value }) => label.trim() ? `${label}: ${value}` : value).join('\n');
  return {
    login: fields.login.length === 1 ? fields.login[0].value : lines(fields.login),
    password: fields.password.length === 1 ? fields.password[0].value : lines(fields.password),
    notes: [account.notes, account.privateNotes, ...fields.notes.map((field) => noteLabels.has(field.label.trim().toLowerCase())
      ? field.value : lines([field]))].filter(Boolean).join('\n\n'),
  };
}

export function updateVaultAccount(
  account: AccountContent, slot: AccountSlot, label: string, value: string, fieldId: string,
): void {
  const previous = account.fields.filter((field) => accountSlot(field.label) === slot);
  const secret = previous.some(isVaultSensitiveField);
  const position = previous.length ? account.fields.indexOf(previous[0]) : account.fields.length;
  account.fields = account.fields.filter((field) => accountSlot(field.label) !== slot);
  if (slot === 'notes') {
    // The legacy export includes ordinary notes by default. Keep inherited secrets separate.
    if (secret || account.privateNotes !== undefined) {
      account.notes = '';
      account.privateNotes = value;
    } else {
      account.notes = value;
    }
    return;
  }
  account.fields.splice(position, 0, { id: previous[0]?.id ?? fieldId, label, value, secret: slot === 'password' || secret });
}
