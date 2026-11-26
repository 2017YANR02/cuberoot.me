'use client';

import { sessionFetch } from '@/lib/session-fetch';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentPropsWithoutRef, type FormEvent, type ReactNode } from 'react';
import { Check, Copy, Download, Ellipsis, KeyRound, Loader2, Pencil, Plus, RotateCcw, Save, Trash2, X } from '@app-foundation/icons/lucide';
import { FilledStatusMark } from '@cuberoot/app-ui/filled-status-mark';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import BackHome from '@/components/BackHome';
import AppLink from '@/components/AppLink';
import { PasswordInput } from '@/components/PasswordInput';
import { SearchInput } from '@/components/SearchInput';
import SortableCard from '@/components/SortableCard';
import { CompactSelect } from '@/components/CompactSelect';
import { ListSelect } from '@/components/ListSelect';
import { Tooltip } from '@/components/Tooltip';
import { useCopy } from '@/hooks/useCopy';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import { useRequireMembership } from '@/hooks/useRequireMembership';
import { tr } from '@/i18n/tr';
import { apiUrl, directApiUrl } from '@/lib/api-base';
import { fetchFriends } from '@/lib/friends-api';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { useAuthUser, authActions } from '@/lib/auth-store';
import type { VaultBackupSource } from '@/lib/vault-backup';
import {
  isVaultTagCategory, renameLegacyVaultContract, splitVaultTitle, vaultCategoryOptions, vaultContractLabel,
  vaultDocumentLabel, vaultEntryCategory, vaultTitleTagText, type VaultCategoryFilter,
} from '@/lib/vault-category';
import { isVaultLicense, splitVaultLicenses } from '@/lib/vault-license';
import { hasVaultPrimaryAccount, readVaultAccount, setVaultAccountOrder, updateVaultAccount, vaultAccountGroups, vaultAccountSlots, vaultAccountStatusLabels } from '@/lib/vault-account';
import {
  createVaultKeyProfile,
  decryptVaultEntry,
  encryptVaultEntry,
  isValidVaultPassphrase,
  readVaultImages,
  recoverVaultPrivateKey,
  unlockVaultPrivateKey,
  MAX_VAULT_ADDITIONAL_ACCOUNTS,
  MAX_VAULT_FIELDS,
  MAX_VAULT_INFORMATION_GROUPS,
  vaultEntryImages,
  type EncryptedPrivateKey,
  type VaultAccount,
  type VaultAccountStatus,
  type VaultEntry,
  type VaultField,
  type VaultInformation,
  type VaultInformationGroup,
} from '@/lib/vault-crypto';
import './vault.css';
import VaultBackup from './VaultBackup';

interface VaultShare { userId: number; name: string; publicKey: JsonWebKey; }
interface VaultItemPayload {
  id: string; ownerUserId: number; ownerName: string; ciphertext: string; iv: string;
  version: number; updatedAt: string; trashedAt?: string | null; wrappedKey: string; shares: VaultShare[];
}
interface VaultPayload {
  userId: number;
  canManage: boolean;
  backupRevision?: string;
  keyProfile: { publicKey: JsonWebKey; encryptedPrivateKey: EncryptedPrivateKey } | null;
  items: VaultItemPayload[];
  trash?: VaultItemPayload[];
}
interface OpenItem {
  localId: string; serverId: string | null; ownerUserId: number; ownerName: string;
  version: number; updatedAt: string; trashedAt: string | null; shares: VaultShare[]; entry: VaultEntry;
  pendingEntryUpdate?: boolean;
}
interface UserResult { userId: number; name: string; wcaId: string | null; publicKey: JsonWebKey | null; }
type ShareFriend = Omit<UserResult, 'publicKey'> & { publicKey?: JsonWebKey | null };

const accountStatusVariants = { verified: 'success', problem: 'error', untested: 'unknown' } as const;
const accountGroupId = (group: VaultAccount | 'primary') => group === 'primary' ? 'primary' : `account:${group.id}`;

function VaultListTitle({ title }: { title: string }) {
  const parts = splitVaultTitle(title);
  if (!parts) return <strong>{title}</strong>;
  return <strong className="vault-list-title">
    <span className="vault-title-tag">{vaultTitleTagText(parts.tag).trim()}</span>{' '}
    <span className="vault-list-title-name">{parts.name.trim() || tr({ zh: '未命名', en: 'Untitled' })}</span>
  </strong>;
}

function VaultAccountStatusPicker({ status, disabled, onChange, removeAction }: {
  status: VaultAccountStatus;
  disabled: boolean;
  onChange: (status: VaultAccountStatus) => void;
  removeAction: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const optionsId = useId();
  const actions = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<HTMLDivElement>(null);
  const expanded = open && !disabled;
  const label = tr(vaultAccountStatusLabels[status]);
  usePopoverDismiss(expanded, () => setOpen(false), actions, trigger);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  return <div ref={actions} className="vault-account-status"
    onPointerLeave={(event) => {
      if (event.pointerType === 'mouse' && !options.current?.contains(document.activeElement)) setOpen(false);
    }}
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
    <button ref={trigger} type="button" className="vault-icon-button" data-status={status} disabled={disabled}
      aria-expanded={expanded} aria-controls={optionsId} aria-label={label} title={label}
      aria-description={disabled ? undefined : tr({ zh: '更改账号状态', en: 'Change account status' })}
      onPointerEnter={(event) => {
        if (!disabled && event.pointerType === 'mouse') setOpen(true);
      }}
      onClick={() => setOpen((current) => !current)}><FilledStatusMark variant={accountStatusVariants[status]} /></button>
    <div ref={options} id={optionsId} className="vault-account-status-options" hidden={!expanded}
      role="group" aria-label={tr({ zh: '账号操作', en: 'Account actions' })}>
      {expanded && (Object.keys(accountStatusVariants) as VaultAccountStatus[]).filter((value) => value !== status).map((value) => {
        const optionLabel = tr(vaultAccountStatusLabels[value]);
        return <button key={value} type="button" className="vault-icon-button" data-status={value} aria-label={optionLabel} title={optionLabel}
          onClick={() => {
            onChange(value);
            setOpen(false);
            trigger.current?.focus({ preventScroll: true });
          }}><FilledStatusMark variant={accountStatusVariants[value]} /></button>;
      })}
    </div>
    {removeAction}
  </div>;
}

async function fetchVaultUsers(userId?: number, signal?: AbortSignal) {
  const query = userId === undefined ? '' : `?q=${userId}`;
  const response = await sessionFetch(apiUrl(`/v1/vault/users${query}`), { headers: authHeaders(false), signal });
  return (await handleApi<{ users: UserResult[] }>(response)).users;
}

const cloneItem = (item: OpenItem): OpenItem => structuredClone(item);
const decryptOpenItem = async (item: VaultItemPayload, key: CryptoKey): Promise<OpenItem> => {
  const original = await decryptVaultEntry(item.ciphertext, item.iv, item.wrappedKey, key);
  const categorized = renameLegacyVaultContract(original);
  const entry = item.trashedAt ? categorized : splitVaultLicenses(categorized);
  return {
    localId: item.id, serverId: item.id, ownerUserId: item.ownerUserId, ownerName: item.ownerName,
    version: item.version, updatedAt: item.updatedAt, trashedAt: item.trashedAt ?? null, shares: item.shares,
    entry, pendingEntryUpdate: entry !== original,
  };
};
const passwordFieldAliases = ['密码', 'Password'];
const emailFieldLabels = new Set(['邮箱', '电子邮箱', '邮箱地址', '电子邮件', '电子邮件地址', 'email', 'e-mail', 'email address', 'e-mail address']);
const isEmailField = (field: VaultField) => emailFieldLabels.has(field.label.trim().toLowerCase());
const credentialFields = (loginLabel: string): VaultField[] => [
  { id: crypto.randomUUID(), label: loginLabel, value: '', secret: false },
  { id: crypto.randomUUID(), label: tr({ zh: '密码', en: 'Password' }), value: '', secret: true },
];

function orderVaultFields(fields: VaultField[]) {
  const passwordIndex = fields.findIndex(({ label }) =>
    passwordFieldAliases.some((alias) => alias.toLowerCase() === label.trim().toLowerCase()));
  if (passwordIndex < 0) return fields;
  const fieldsFromPassword = fields.slice(passwordIndex);
  return [...fields.slice(0, passwordIndex), ...fieldsFromPassword.filter(isEmailField),
    ...fieldsFromPassword.filter((field) => !isEmailField(field))];
}

function emptyEntry(category: Exclude<VaultCategoryFilter, ''>): VaultEntry {
  const tag = isVaultTagCategory(category) ? category.slice(4)
    : category === 'documents' ? tr(vaultDocumentLabel)
      : category === 'contract' ? tr(vaultContractLabel) : '';
  return {
    id: crypto.randomUUID(), title: tag ? `${tag}｜` : '',
    category: isVaultTagCategory(category) || category === 'contract' ? 'other' : category === 'documents' ? 'personal' : category,
    notes: '', fields: category === 'accounts' ? credentialFields(tr({ zh: '账号', en: 'Username' })) : [],
  };
}

const informationAt = (entry: VaultEntry, groupId?: string): VaultInformation | undefined =>
  groupId === undefined ? entry : entry.informationGroups?.find(({ id }) => id === groupId);

type VaultTextAreaProps = ComponentPropsWithoutRef<'textarea'> & { value: string };

function VaultTextArea({ className, value, readOnly, ...props }: VaultTextAreaProps) {
  return (
    <div className="vault-grow-textarea" data-readonly={readOnly || undefined}>
      <div className={className} data-vault-text-measure aria-hidden="true">{value}{'\u200b'}</div>
      <textarea {...props} className={`vault-grow-input ${className ?? ''}`} value={value} readOnly={readOnly} rows={readOnly ? 1 : props.rows} />
    </div>
  );
}

export default function VaultPage() {
  const user = useAuthUser();
  const signedIn = user !== null;
  const authUserId = user?.uid;
  const authWcaId = user?.wcaId;
  const login = authActions.login;
  const { copiedKey, copy } = useCopy();
  const accountSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [mounted, setMounted] = useState(false);
  const [payload, setPayload] = useState<VaultPayload | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const requireMembership = useRequireMembership(payload?.canManage === true);
  const [unlockedVault, setUnlockedVault] = useState<{ userId: number; key: CryptoKey } | null>(null);
  const privateKey = unlockedVault && unlockedVault.userId === payload?.userId
    && (user?.uid === undefined || user.uid === payload.userId) ? unlockedVault.key : null;
  const [items, setItems] = useState<OpenItem[]>([]);
  const [draft, setDraft] = useState<OpenItem | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassphrases, setShowPassphrases] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [mustSaveRecoveryCode, setMustSaveRecoveryCode] = useState(false);
  const [filter, setFilter] = useState('');
  const [shareFriends, setShareFriends] = useState<ShareFriend[] | null>(null);
  const [shareLoadError, setShareLoadError] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [failedTrashCount, setFailedTrashCount] = useState(0);
  const [failedOwnedActiveCount, setFailedOwnedActiveCount] = useState(0);
  const [showTrash, setShowTrash] = useState(false);
  const [busyOperation, setBusy] = useState<boolean | 'save'>(false);
  const busy = Boolean(busyOperation);
  const saving = busyOperation === 'save';
  const [error, setError] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<VaultCategoryFilter>('');
  const canEditVault = editMode && payload?.canManage === true;
  const manageable = Boolean(draft && payload?.canManage && draft.ownerUserId === payload.userId);
  const editable = canEditVault && manageable && !showTrash && !draft?.entry.mergedInto;
  const vaultOwnerId = payload?.userId;
  const checkBackupRevision = useCallback(async (signal: AbortSignal): Promise<string | null> => {
    const response = await sessionFetch(apiUrl('/v1/vault/backup-revision'), {
      headers: authHeaders(false), cache: 'no-store', signal,
    });
    if (response.status === 404) return null; // Older deployments still support full snapshots.
    const data = await handleApi<{ userId: number; revision: string }>(response);
    if (data.userId !== vaultOwnerId) throw new Error('Vault owner has changed');
    return data.revision;
  }, [vaultOwnerId]);
  const loadBackupSource = useCallback(async (signal: AbortSignal): Promise<VaultBackupSource> => {
    if (!privateKey || vaultOwnerId === undefined) throw new Error('Vault is locked');
    const snapshot = await handleApi<VaultPayload>(await sessionFetch(directApiUrl('/v1/vault'), {
      headers: authHeaders(false), cache: 'no-store', signal,
    }));
    if (snapshot.userId !== vaultOwnerId || !snapshot.keyProfile) throw new Error('Vault owner has changed');
    const owned = [...snapshot.items, ...(snapshot.trash ?? [])].filter((item) => item.ownerUserId === vaultOwnerId);
    return {
      revision: snapshot.backupRevision ?? JSON.stringify(
        owned.map(({ id, version, updatedAt, trashedAt }) => [id, version, updatedAt, trashedAt]),
      ),
      // A partial or unreadable snapshot must leave the previous local file intact.
      readItems: () => Promise.all(owned.map(async ({ ciphertext, iv, wrappedKey, trashedAt }) => ({
        entry: await decryptVaultEntry(ciphertext, iv, wrappedKey, privateKey),
        trashedAt,
      }))),
    };
  }, [privateKey, vaultOwnerId]);
  const backupRevision = useMemo(() => JSON.stringify([
    failedOwnedActiveCount, failedTrashCount,
    items.filter(({ ownerUserId, serverId }) => ownerUserId === vaultOwnerId && serverId)
      .map(({ serverId, version, updatedAt, trashedAt }) => [serverId, version, updatedAt, trashedAt]),
  ]), [failedOwnedActiveCount, failedTrashCount, items, vaultOwnerId]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    const controller = new AbortController();
    let timeout: number | undefined;
    const resetTimeout = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => controller.abort(), 20_000);
    };
    resetTimeout();
    setError(null);
    void sessionFetch(directApiUrl('/v1/vault'), { headers: authHeaders(false), cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (cancelled || !response.ok || !response.body) return handleApi<VaultPayload>(response);
        resetTimeout();
        const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, stream) {
            if (!cancelled) resetTimeout();
            stream.enqueue(chunk);
          },
        }));
        return handleApi<VaultPayload>(new Response(body, response));
      })
      .then((data) => {
        if (cancelled) return;
        if (authUserId !== undefined && authUserId !== data.userId) throw new Error('Vault owner has changed');
        setPayload(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError(tr({ zh: '资料库加载失败。', en: 'Could not load the vault.' }));
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [signedIn, authUserId, authWcaId, loadAttempt]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);

  const categorizedItems = useMemo(() => items.filter(({ trashedAt }) => Boolean(trashedAt) === showTrash)
    .map((item) => ({ item, category: vaultEntryCategory(item.entry) })), [items, showTrash]);
  const visibleItems = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase();
    const matches = (value: string) => value.toLocaleLowerCase().includes(q);
    const fieldsMatch = (fields: VaultField[]) => fields.some(({ value }) => matches(value));
    return categorizedItems.filter(({ item: { entry }, category }) => (!categoryFilter || category === categoryFilter)
      && (!q || matches(entry.title) || matches(entry.notes)
        || matches(entry.accountName ?? '') || matches(entry.privateNotes ?? '') || fieldsMatch(entry.fields)
        || matches(entry.informationName ?? '')
        || entry.informationGroups?.some(({ name, notes, fields }) => matches(name) || matches(notes) || fieldsMatch(fields))
        || entry.accounts?.some(({ name, fields, notes, privateNotes }) =>
          matches(name) || fieldsMatch(fields) || matches(notes ?? '') || matches(privateNotes ?? '')))).map(({ item }) => item);
  }, [filter, categoryFilter, categorizedItems]);

  const openVault = async (key: CryptoKey, data: VaultPayload) => {
    const trash = data.trash ?? [];
    const results = await Promise.allSettled([...data.items, ...trash].map((item) => decryptOpenItem(item, key)));
    const opened = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
    const active = opened.filter((item) => !item.trashedAt);
    setUnlockedVault({ userId: data.userId, key });
    setItems(opened);
    const first = active.find((item) => !item.entry.mergedInto) ?? active[0];
    setDraft(first ? cloneItem(first) : null);
    setFailedCount(data.items.length - active.length);
    setFailedTrashCount(trash.length - (opened.length - active.length));
    setFailedOwnedActiveCount(data.items.filter((item) => item.ownerUserId === data.userId).length
      - active.filter((item) => item.ownerUserId === data.userId).length);
    setShowTrash(false);
    setEditMode(false);
    setDirty(false);
    setPassphrase('');
  };

  const setup = async (event: FormEvent) => {
    event.preventDefault();
    if (!payload || !isValidVaultPassphrase(passphrase)) {
      setError(tr({ zh: '资料库口令必须是 6 位数字。', en: 'The vault passphrase must be exactly 6 digits.' }));
      return;
    }
    if (passphrase !== confirmation) {
      setError(tr({ zh: '两次输入的口令不一致。', en: 'The passphrases do not match.' }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createVaultKeyProfile(passphrase);
      const keyProfile = { publicKey: created.publicKey, encryptedPrivateKey: created.encryptedPrivateKey };
      await handleApi(await sessionFetch(apiUrl('/v1/vault/key'), { method: 'PUT', headers: authHeaders(), body: JSON.stringify(keyProfile) }));
      const next = { ...payload, keyProfile };
      setPayload(next);
      await openVault(await unlockVaultPrivateKey(passphrase, keyProfile.encryptedPrivateKey), next);
      setRecoveryCode(created.recoveryCode);
      setMustSaveRecoveryCode(true);
      setConfirmation('');
    } catch {
      setError(tr({ zh: '无法初始化资料库，请稍后重试。', en: 'Could not initialize the vault. Try again later.' }));
    } finally { setBusy(false); }
  };

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!payload?.keyProfile) return;
    if (!isValidVaultPassphrase(passphrase)) {
      setError(tr({ zh: '资料库口令必须是 6 位数字。', en: 'The vault passphrase must be exactly 6 digits.' }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await openVault(await unlockVaultPrivateKey(passphrase, payload.keyProfile.encryptedPrivateKey), payload);
    } catch {
      setError(tr({ zh: '口令不正确，或加密资料已损坏。', en: 'The passphrase is wrong or the encrypted data is damaged.' }));
    } finally { setBusy(false); }
  };

  const recover = async (event: FormEvent) => {
    event.preventDefault();
    if (!payload?.keyProfile || recoveryCode.trim().length === 0 || !isValidVaultPassphrase(passphrase)) {
      setError(tr({ zh: '请填写恢复密钥，并设置一个 6 位数字的新口令。', en: 'Enter the recovery key and set a new 6-digit passphrase.' }));
      return;
    }
    if (passphrase !== confirmation) {
      setError(tr({ zh: '两次输入的新口令不一致。', en: 'The new passphrases do not match.' }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const recovered = await recoverVaultPrivateKey(recoveryCode, passphrase, payload.keyProfile.encryptedPrivateKey);
      const keyProfile = { ...payload.keyProfile, encryptedPrivateKey: recovered.encryptedPrivateKey };
      await handleApi(await sessionFetch(apiUrl('/v1/vault/key'), { method: 'PUT', headers: authHeaders(), body: JSON.stringify(keyProfile) }));
      const next = { ...payload, keyProfile };
      setPayload(next);
      setRecoveryMode(false);
      setRecoveryCode('');
      setConfirmation('');
      await openVault(recovered.privateKey, next);
    } catch {
      setError(tr({ zh: '恢复密钥不正确，或恢复资料已损坏。', en: 'The recovery key is wrong or the recovery data is damaged.' }));
    } finally { setBusy(false); }
  };

  const downloadRecoveryCode = () => {
    const url = URL.createObjectURL(new Blob([`${recoveryCode}\n`], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cuberoot-vault-recovery-key.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const confirmDiscard = () => !dirty || window.confirm(tr({ zh: '放弃尚未保存的修改？', en: 'Discard unsaved changes?' }));
  const discardUnsavedNew = () => {
    if (draft && !draft.serverId) setItems((current) => current.filter((item) => item.localId !== draft.localId));
  };
  const showItem = (item: OpenItem | null) => {
    setDraft(item ? cloneItem(item) : null);
    setDirty(false);
    setExpandedImage(null);
  };
  const toggleEditMode = () => {
    if (!payload?.canManage || busy) return;
    if (editMode) {
      if (!confirmDiscard()) return;
      if (dirty) {
        discardUnsavedNew();
        showItem(draft?.serverId ? items.find((item) => item.localId === draft.localId) ?? null : null);
      }
      setError(null);
    }
    setEditMode(!editMode);
  };
  const selectItem = (item: OpenItem) => {
    if (!confirmDiscard()) return;
    discardUnsavedNew();
    showItem(item);
  };
  const toggleTrash = () => {
    if (!confirmDiscard()) return;
    discardUnsavedNew();
    showItem(null);
    setFilter('');
    setCategoryFilter('');
    setError(null);
    setShowTrash((current) => !current);
  };
  const addItem = () => {
    if (!canEditVault || !payload || busy || showTrash || !confirmDiscard()) return;
    discardUnsavedNew();
    const item: OpenItem = {
      localId: `new:${crypto.randomUUID()}`, serverId: null, ownerUserId: payload.userId,
      ownerName: user?.name ?? '', version: 0, updatedAt: new Date().toISOString(), trashedAt: null,
      shares: [], entry: emptyEntry(categoryFilter || 'accounts'),
    };
    setItems((current) => [item, ...current]);
    setDraft(item);
    setDirty(true);
    setExpandedImage(null);
    setFilter('');
  };
  const updateDraft = (update: (item: OpenItem) => void) => {
    if (!editable || busy) return;
    setDraft((current) => {
      if (!current) return current;
      const next = cloneItem(current);
      update(next);
      return next;
    });
    setDirty(true);
  };

  const updateInformation = (groupId: string | undefined, update: (information: VaultInformation) => void) =>
    updateDraft(({ entry }) => {
      const information = informationAt(entry, groupId);
      if (information) update(information);
    });

  const persistItem = async (item: OpenItem): Promise<OpenItem> => {
    if (!canEditVault || !payload?.keyProfile || !privateKey || item.ownerUserId !== payload.userId) throw new Error('forbidden');
    const encrypted = await encryptVaultEntry(item.entry, [
      { userId: payload.userId, publicKey: payload.keyProfile.publicKey },
      ...item.shares.map(({ userId, publicKey }) => ({ userId, publicKey })),
    ]);
    const response = await handleApi<{ id?: string; version: number; updatedAt: string }>(await sessionFetch(
      apiUrl(item.serverId ? `/v1/vault/items/${item.serverId}` : '/v1/vault/items'),
      { method: item.serverId ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify({ ...encrypted, expectedVersion: item.serverId ? item.version : null }) },
    ));
    return { ...cloneItem(item), serverId: item.serverId ?? response.id ?? null, localId: item.serverId ?? response.id ?? item.localId,
      version: response.version, updatedAt: response.updatedAt, pendingEntryUpdate: false };
  };

  const persistTrashState = async (item: OpenItem, trashed: boolean): Promise<OpenItem> => {
    if (!item.serverId) throw new Error('Cannot move an unsaved entry to Trash');
    const state = await handleApi<{ version: number; updatedAt: string; trashedAt: string | null }>(
      await sessionFetch(apiUrl(`/v1/vault/items/${item.serverId}/trash`), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ trashed, expectedVersion: item.version }),
      }),
    );
    return { ...item, ...state, shares: [] };
  };

  const save = async () => {
    if (busy || !editable || !draft) return;
    if (!(splitVaultTitle(draft.entry.title)?.name ?? draft.entry.title).trim()) {
      setError(tr({ zh: '请填写标题。', en: 'Enter a title.' }));
      return;
    }
    if (vaultEntryImages(draft.entry).some((image) => !image.name.trim())) {
      setError(tr({ zh: '请填写图片名称。', en: 'Enter a name for each image.' }));
      return;
    }
    setBusy('save');
    setError(null);
    try {
      const saved = await persistItem(draft);
      setItems((current) => current.map((item) => item.localId === draft.localId ? saved : item));
      setDraft(saved);
      setDirty(false);
      setEditMode(false);
    } catch (saveError) {
      setError((saveError as Error).message === 'item changed in another tab'
        ? tr({ zh: '这条内容已在其他页面修改，请刷新后重试。', en: 'This item changed in another tab. Refresh and try again.' })
        : (saveError as Error).message === 'vault_entry_limit'
          ? tr({ zh: '这条内容过大，请将部分图片或文字分到另一条内容。', en: 'This item is too large. Move some images or text to another item.' })
          : tr({ zh: '保存失败，请稍后重试。', en: 'Could not save. Try again later.' }));
    } finally { setBusy(false); }
  };

  const restoreMerged = async () => {
    if (!canEditVault || !manageable || busy || showTrash || !draft?.entry.mergedInto) return;
    setBusy(true);
    setError(null);
    try {
      const restored = cloneItem(draft);
      delete restored.entry.mergedInto;
      const saved = await persistItem(restored);
      setItems((current) => current.map((item) => item.localId === saved.localId ? saved : item));
      setDraft(saved);
      setDirty(false);
    } catch { setError(tr({ zh: '恢复失败，请刷新后重试。', en: 'Could not restore. Refresh and retry.' })); }
    finally { setBusy(false); }
  };

  const addImages = async (files: File[], groupId?: string) => {
    if (!editable || !draft || busy || !files.length) return;
    const localId = draft.localId;
    setBusy(true);
    setError(null);
    try {
      const existing = vaultEntryImages(draft.entry);
      const images = await readVaultImages(files, existing);
      setDraft((current) => {
        if (current?.localId !== localId) return current;
        const next = cloneItem(current);
        const information = informationAt(next.entry, groupId);
        if (!information) return current;
        information.images = [...(information.images ?? []), ...images.slice(existing.length)];
        return next;
      });
      setDirty(true);
    } catch (imageError) {
      setError((imageError as Error).message === 'vault_image_limit'
        ? tr({ zh: '每条内容最多 10 张图片，原图合计不超过 2 MiB。可分成多条保存。', en: 'Each item supports up to 10 images totaling 2 MiB. Split larger collections into separate items.' })
        : tr({ zh: '无法读取图片，请选择有效的 JPG、PNG 或 WebP 文件。', en: 'Could not read the image. Choose a valid JPG, PNG, or WebP file.' }));
    } finally { setBusy(false); }
  };

  const changeTrash = async (trashed: boolean, target = draft) => {
    if (!canEditVault || busy || !target || target.ownerUserId !== payload?.userId) return;
    const selected = target.localId === draft?.localId;
    if (selected && !confirmDiscard()) return;
    if (!target.serverId) {
      if (selected) {
        discardUnsavedNew();
        showItem(null);
      }
      return;
    }
    const item = items.find((candidate) => candidate.localId === target.localId);
    if (!item || Boolean(item.trashedAt) === trashed) return;
    if (trashed && item.shares.length && !window.confirm(tr({
      zh: '移入回收站会停止分享。恢复后可以重新分享。确定移入？',
      en: 'Moving this item to Trash revokes sharing. You can share it again after restoring it. Move to Trash?',
    }))) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await persistTrashState(item, trashed);
      setItems((current) => current.map((candidate) => candidate.localId === item.localId ? updated : candidate));
      if (selected) showItem(visibleItems.find((candidate) => candidate.localId !== item.localId) ?? null);
    } catch {
      setError(tr(trashed
        ? { zh: '无法移入回收站，请刷新后重试。', en: 'Could not move the item to Trash. Refresh and try again.' }
        : { zh: '无法恢复资料，请刷新后重试。', en: 'Could not restore the item. Refresh and try again.' }));
    } finally { setBusy(false); }
  };

  const emptyTrash = async () => {
    if (!canEditVault || busy || !showTrash || !window.confirm(tr({
      zh: '永久删除回收站里的所有资料？清空后无法恢复。',
      en: 'Permanently delete all items in Trash? This cannot be undone.',
    }))) return;
    setBusy(true);
    setError(null);
    try {
      await handleApi(await sessionFetch(apiUrl('/v1/vault/trash'), { method: 'DELETE', headers: authHeaders(false) }));
      setItems((current) => current.filter((item) => !item.trashedAt));
      setFailedTrashCount(0);
      showItem(null);
    } catch {
      setError(tr({ zh: '无法清空回收站，请刷新后重试。', en: 'Could not empty Trash. Refresh and try again.' }));
    } finally { setBusy(false); }
  };

  const canListFriends = Boolean(user && privateKey && editable && draft && !draft.trashedAt);
  useEffect(() => {
    setShareFriends(null);
    setShareLoadError(false);
    if (!canListFriends) return;
    const controller = new AbortController();
    const loadFriends = async () => {
      const friends = await fetchVaultUsers(undefined, controller.signal);
      if (friends.length || controller.signal.aborted) return friends;
      // Older APIs return an empty result when the search has no query.
      const overview = await fetchFriends(controller.signal);
      return overview.friends.map(({ userId, name, wcaId }) => ({ userId, name, wcaId }));
    };
    void loadFriends()
      .then((friends) => { if (!controller.signal.aborted) setShareFriends(friends); })
      .catch(() => { if (!controller.signal.aborted) setShareLoadError(true); });
    return () => controller.abort();
  }, [canListFriends, user?.uid]);

  const addShareFriend = async (value: string) => {
    const friend = shareFriends?.find((entry) => String(entry.userId) === value);
    if (busy || !canListFriends || !friend || friend.publicKey === null
      || draft?.shares.some((share) => share.userId === friend.userId)) return;
    const { userId, name } = friend;
    setError(null);
    let publicKey: ShareFriend['publicKey'] = friend.publicKey;
    if (publicKey === undefined) {
      setBusy(true);
      try {
        const results = await fetchVaultUsers(userId);
        const match = results.find((entry) => entry.userId === userId);
        if (!match) {
          setError(tr({ zh: '这位好友暂不可分享，请刷新后重试。', en: 'Sharing with this friend is unavailable. Refresh and try again.' }));
          return;
        }
        publicKey = match.publicKey;
        setShareFriends((current) => current?.map((entry) => entry.userId === userId ? { ...entry, publicKey: match.publicKey } : entry) ?? null);
      } catch {
        setError(tr({ zh: '无法确认好友的接收状态，请稍后重试。', en: 'Could not check whether this friend can receive shares. Try again later.' }));
        return;
      } finally { setBusy(false); }
    }
    if (!publicKey) {
      setError(tr({ zh: '这位好友尚未启用接收。', en: 'This friend has not enabled receiving.' }));
      return;
    }
    const recipient = { userId, name, publicKey };
    updateDraft((item) => { item.shares.push(recipient); });
  };

  if (!mounted) return <main className="vault-page" />;
  if (!user) return (
    <main className="vault-page vault-gate">
      <div className="vault-topbar"><BackHome /></div>
      <KeyRound aria-hidden="true" />
      <h1>{tr({ zh: '私密资料库', en: 'Private vault' })}</h1>
      <p>{tr({ zh: '登录后才能访问你的加密内容。', en: 'Sign in to access your encrypted content.' })}</p>
      <button type="button" className="vault-button is-primary" onClick={login}>{tr({ zh: '登录', en: 'Sign in' })}</button>
    </main>
  );
  if (!payload || (user.uid !== undefined && user.uid !== payload.userId)) {
    return <main className="vault-page vault-loading">{error ? <>
      <span role="alert">{error}</span>
      <button type="button" className="vault-button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>{tr({ zh: '重试', en: 'Retry' })}</button>
    </> : <span className="vault-actions" role="status"><Loader2 className="vault-spin" aria-hidden="true" />{tr({ zh: '正在加载…', en: 'Loading…' })}</span>}</main>;
  }
  if (privateKey && mustSaveRecoveryCode) return (
    <main className="vault-page vault-gate">
      <div className="vault-topbar"><BackHome /></div>
      <KeyRound aria-hidden="true" />
      <h1>{tr({ zh: '保存恢复密钥', en: 'Save your recovery key' })}</h1>
      <p>{tr({ zh: '忘记资料库口令时，只能用这枚密钥重设。它只显示这一次，请保存到安全位置。', en: 'This key is the only way to reset a forgotten vault passphrase. It is shown once, so store it somewhere safe.' })}</p>
      <div className="vault-unlock">
        <label htmlFor="vault-recovery-display">{tr({ zh: '恢复密钥', en: 'Recovery key' })}</label>
        <input id="vault-recovery-display" className="vault-unlock-input" value={recoveryCode} readOnly />
        <div className="vault-actions">
          <button type="button" className="vault-button" onClick={() => copy(recoveryCode, 'vault-recovery')}>{copiedKey === 'vault-recovery' ? <Check /> : <Copy />}{tr({ zh: '复制', en: 'Copy' })}</button>
          <button type="button" className="vault-button" onClick={downloadRecoveryCode}><Download />{tr({ zh: '下载', en: 'Download' })}</button>
          <button type="button" className="vault-button is-primary" onClick={() => { setMustSaveRecoveryCode(false); setRecoveryCode(''); }}>{tr({ zh: '我已保存，进入资料库', en: 'Saved, open the vault' })}</button>
        </div>
      </div>
    </main>
  );
  if (!privateKey) {
    const isSetup = !payload.keyProfile;
    const passphraseLabel = tr(recoveryMode
      ? { zh: '输入新口令', en: 'Enter a new passphrase' }
      : { zh: '输入口令', en: 'Enter passphrase' });
    return (
      <main className="vault-page vault-gate">
        <div className="vault-topbar"><BackHome /></div>
        <div className="vault-gate-heading">
          <KeyRound aria-hidden="true" />
          <h1>{tr({ zh: '私密资料库', en: 'Private vault' })}</h1>
        </div>
        {(recoveryMode || isSetup) && <p>{recoveryMode
          ? tr({ zh: '输入创建时保存的恢复密钥，再设置一个新口令。', en: 'Enter the recovery key saved during setup, then set a new passphrase.' })
          : tr(payload.canManage
              ? { zh: '设置一个独立解锁口令。创建后会生成一枚只显示一次的恢复密钥。', en: 'Set a separate vault passphrase. A one-time recovery key will be generated after creation.' }
              : { zh: '设置解锁口令以接收好友分享。只有会员和管理员可以新建或管理自己的内容。', en: 'Set a passphrase to receive shares from friends. Only members and administrators can create or manage their own items.' })}</p>}
        <form className="vault-unlock" onSubmit={recoveryMode ? recover : isSetup ? setup : unlock}>
          {recoveryMode && <><label htmlFor="vault-recovery">{tr({ zh: '恢复密钥', en: 'Recovery key' })}</label><input id="vault-recovery" className="vault-unlock-input" value={recoveryCode} autoComplete="off" onChange={(event) => setRecoveryCode(event.target.value)} /></>}
          <PasswordInput wrapperClassName="vault-password-field" id="vault-passphrase" className="vault-unlock-input" aria-label={passphraseLabel} placeholder={passphraseLabel} autoFocus={!recoveryMode} value={passphrase} inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete={isSetup || recoveryMode ? 'new-password' : 'current-password'} onChange={setPassphrase} show={showPassphrases} onShowChange={setShowPassphrases} />
          {(isSetup || recoveryMode) && <><label htmlFor="vault-confirm">{recoveryMode ? tr({ zh: '再次输入新口令', en: 'Confirm new passphrase' }) : tr({ zh: '再次输入', en: 'Confirm passphrase' })}</label><PasswordInput wrapperClassName="vault-password-field" id="vault-confirm" className="vault-unlock-input" value={confirmation} inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="new-password" onChange={setConfirmation} show={showPassphrases} onShowChange={setShowPassphrases} /></>}
          <div className="vault-actions">
            <button type="submit" className="vault-button is-primary" disabled={busy}>{busy && <Loader2 className="vault-spin" />}{tr(recoveryMode ? { zh: '重设口令并解锁', en: 'Reset and unlock' } : isSetup ? payload.canManage ? { zh: '创建并解锁', en: 'Create and unlock' } : { zh: '启用接收并解锁', en: 'Enable receiving and unlock' } : { zh: '解锁', en: 'Unlock' })}</button>
            {!isSetup && <button type="button" className="vault-button" onClick={() => { setRecoveryMode((current) => !current); setRecoveryCode(''); setPassphrase(''); setConfirmation(''); setShowPassphrases(false); setError(null); }}>{recoveryMode ? tr({ zh: '返回口令解锁', en: 'Back to passphrase' }) : tr({ zh: '忘记口令', en: 'Forgot passphrase' })}</button>}
          </div>
        </form>
        {error && <p className="vault-error" role="alert">{error}</p>}
      </main>
    );
  }

  const hasTrash = failedTrashCount > 0 || items.some((item) => item.trashedAt);
  const visibleFailedCount = showTrash ? failedTrashCount : failedCount;
  const accounts = draft?.entry.accounts ?? [];
  const informationGroups = draft?.entry.informationGroups ?? [];
  const accountGroups = draft ? vaultAccountGroups(draft.entry) : [];
  const accountGroupIds = accountGroups.map(accountGroupId);
  const canReorderAccounts = editable && accountGroups.length > 1;
  const hasPrimaryAccount = draft ? hasVaultPrimaryAccount(draft.entry) : false;
  const titleParts = draft ? splitVaultTitle(draft.entry.title) : null;
  const titleTag = titleParts ? vaultTitleTagText(titleParts.tag) : '';
  const isAccountEntry = draft?.entry.category === 'accounts' || hasPrimaryAccount;
  const groupedLicense = Boolean(draft && isVaultLicense(draft.entry) && informationGroups.length);
  const moveToTrashLabel = tr({ zh: '移入回收站', en: 'Move to Trash' });
  const shareWithFriendsLabel = tr({ zh: '分享给好友', en: 'Share with friends' });
  const [loginSlot, passwordSlot, notesSlot] = vaultAccountSlots;
  const renderValueControl = ({ id, copyKey = id, copyLabel, ...props }: VaultTextAreaProps & {
    id: string;
    copyKey?: string;
    copyLabel: string;
  }) => {
    if (canEditVault || !props.value) return <VaultTextArea id={id} {...props} />;
    const { className, title, value } = props;
    const key = `${draft?.localId}:${copyKey}`;
    const copied = copiedKey === key;
    return <>
      <button id={id} type="button" className={`${className} vault-copy-value`} title={title}
        aria-labelledby={`${id}-copy-label ${id}-copy-text`} onClick={() => copy(value, key)}>
        <span id={`${id}-copy-label`} className="sr-only">{copyLabel}</span>
        <span id={`${id}-copy-text`}>{value}</span>
        {copied && <span className="vault-copy-feedback"><FilledStatusMark variant="success" /></span>}
      </button>
      <span className="sr-only" role="status">{copied && tr({ zh: '已复制', en: 'Copied' })}</span>
    </>;
  };
  const renderNotes = ({ id, value, update, copyKey, entryNotes = false }: {
    id: string;
    value: string;
    update: (value: string) => void;
    copyKey?: string;
    entryNotes?: boolean;
  }) => {
    if (!editable && !value.trim()) return null;
    return <div className={`vault-field-row vault-field-row--notes${entryNotes ? ' vault-entry-notes' : ''}`}>
      <label className="vault-field-label" htmlFor={id}>{tr(notesSlot.label)}</label>
      <div className="vault-value-line">
        {renderValueControl({
          id, copyKey, copyLabel: tr({ zh: '复制备注', en: 'Copy notes' }),
          className: 'vault-value-input vault-notes', value, readOnly: !editable,
          maxLength: 500_000, rows: 1, onChange: (event) => update(event.target.value),
        })}
      </div>
    </div>;
  };
  const renderFields = (fields: VaultField[], groupId?: string) => {
    return <div className="vault-fields">{orderVaultFields(fields).map((field, index) => {
      const id = groupId ? `vault-field-${groupId}-${field.id}` : `vault-field-${field.id}`;
      const fieldLabel = tr({ zh: `内容 ${index + 1}`, en: `Value ${index + 1}` });
      return <div className="vault-field" key={field.id}>
        <div className="vault-value-line">
          {renderValueControl({
            id, copyLabel: tr({ zh: '复制', en: 'Copy' }), className: 'vault-value-input',
            'aria-label': fieldLabel, value: field.value, readOnly: !editable, maxLength: 100_000, rows: 1,
            placeholder: tr({ zh: '内容', en: 'Value' }), onChange: (event) => {
              const value = event.target.value;
              updateInformation(groupId, (information) => {
                const existing = information.fields.find((candidate) => candidate.id === field.id);
                if (existing) existing.value = value;
              });
            },
          })}
          {editable && <Tooltip content={tr({ zh: '删除字段', en: 'Remove field' })}>{(tip) => <button {...tip} type="button" className="vault-icon-button is-danger" aria-label={tr({ zh: `删除第 ${index + 1} 项内容`, en: `Remove value ${index + 1}` })} onClick={() => updateInformation(groupId, (information) => {
            information.fields = information.fields.filter((candidate) => candidate.id !== field.id);
          })}><Trash2 /></button>}</Tooltip>}
        </div>
      </div>;
    })}</div>;
  };
  const renderImages = ({ images }: VaultInformation, groupId?: string) => {
    if (!editable && !images?.length) return null;
    const inputId = groupId ? `vault-image-file-${groupId}` : 'vault-image-file';
    return <section className="vault-images" aria-label={tr({ zh: '图片附件', en: 'Image attachments' })}>
      {editable && <div className="vault-image-actions">
        <input id={inputId} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" aria-label={tr({ zh: '选择图片', en: 'Choose images' })} onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          void addImages(files, groupId);
        }} />
        <button type="button" className="vault-button" onClick={() => document.getElementById(inputId)?.click()}><Plus aria-hidden="true" />{tr({ zh: '添加图片', en: 'Add images' })}</button>
      </div>}
      <div className="vault-image-grid">{images?.map((image, index) => <div key={image.id} className={`vault-image${expandedImage === image.id ? ' is-expanded' : ''}`}>
        <button type="button" className="vault-image-preview" aria-expanded={expandedImage === image.id} aria-label={tr({ zh: `查看图片：${image.name}`, en: `View image: ${image.name}` })} onClick={() => setExpandedImage((current) => current === image.id ? null : image.id)}>
          {/* Original image is decrypted locally; never send it through an image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.dataUrl} alt={image.name} />
        </button>
        <input className="vault-input" aria-label={tr({ zh: `图片名称 ${index + 1}`, en: `Image name ${index + 1}` })} value={image.name} readOnly={!editable} maxLength={200} onChange={(event) => updateInformation(groupId, (information) => { information.images![index].name = event.target.value; })} />
        {canEditVault && <div className="vault-actions">
          <Tooltip content={tr({ zh: '下载原图', en: 'Download original' })}>{(tip) => (
            <a {...tip} className="vault-button" href={image.dataUrl} download={image.name} aria-label={tr({ zh: `下载原图：${image.name}`, en: `Download original: ${image.name}` })}><Download aria-hidden="true" /></a>
          )}</Tooltip>
          {editable && <Tooltip content={tr({ zh: '移除图片', en: 'Remove image' })}>{(tip) => (
            <button {...tip} type="button" className="vault-button is-danger" aria-label={tr({ zh: `移除图片：${image.name}`, en: `Remove image: ${image.name}` })} onClick={() => updateInformation(groupId, (information) => { information.images!.splice(index, 1); })}><X aria-hidden="true" /></button>
          )}</Tooltip>}
        </div>}
      </div>)}</div>
    </section>;
  };
  const renderInformation = (information: VaultInformation, number: number, group?: VaultInformationGroup) => {
    const groupId = group?.id;
    const name = group?.name ?? draft?.entry.informationName ?? '';
    const groupLabel = tr({ zh: `第 ${number} 组`, en: `Group ${number}` });
    const notesRow = renderNotes({
      id: groupId ? `vault-notes-${groupId}` : 'vault-notes', value: information.notes, entryNotes: true,
      update: (notes) => updateInformation(groupId, (current) => { current.notes = notes; }),
    });
    return <section key={groupId ?? 'primary'} className="vault-information-group" aria-label={name || groupLabel}>
      {(name || informationGroups.length > 0) && <div className="vault-information-heading">
        {editable ? <input className="vault-input" aria-label={tr({ zh: `第 ${number} 组名称`, en: `Name of group ${number}` })}
          placeholder={groupLabel} maxLength={200} value={name} onChange={(event) => {
            const nextName = event.target.value;
            updateDraft(({ entry }) => {
              if (!group) {
                entry.informationName = nextName;
                return;
              }
              const current = entry.informationGroups?.find(({ id }) => id === groupId);
              if (current) current.name = nextName;
            });
          }} /> : <strong>{name || groupLabel}</strong>}
        {editable && group && <button type="button" className="vault-icon-button vault-icon-button--plain is-danger"
          aria-label={tr({ zh: `删除第 ${number} 组`, en: `Remove group ${number}` })}
          onClick={() => {
            if (!window.confirm(tr({ zh: '删除这一组的内容、备注和图片？', en: 'Remove the content, notes and images in this group?' }))) return;
            updateDraft(({ entry }) => { entry.informationGroups = entry.informationGroups?.filter(({ id }) => id !== groupId); });
          }}><Trash2 aria-hidden="true" /></button>}
      </div>}
      {renderFields(information.fields, groupId)}
      {editable && <button type="button" className="vault-button vault-add-content"
        disabled={information.fields.length >= MAX_VAULT_FIELDS} onClick={() => {
          const field = { id: crypto.randomUUID(), label: '', value: '', secret: false };
          updateInformation(groupId, (current) => { if (current.fields.length < MAX_VAULT_FIELDS) current.fields.push(field); });
        }}><Plus aria-hidden="true" />{tr({ zh: '添加内容', en: 'Add content' })}</button>}
      {!groupedLicense && notesRow}
      {renderImages(information, groupId)}
      {groupedLicense && notesRow}
    </section>;
  };
  const renderAccount = (content: VaultEntry | VaultAccount, number: number, extra?: VaultAccount) => {
    const nickname = extra?.name || ('accountName' in content ? content.accountName : '');
    const values = readVaultAccount(content);
    const accountLabel = tr({ zh: `账号 ${number}`, en: `Account ${number}` });
    const accountKey = accountGroupId(extra ?? 'primary');
    const updateValue = ({ key, label }: typeof vaultAccountSlots[number], value: string) => {
      const fieldId = crypto.randomUUID();
      updateDraft(({ entry }) => {
        const account = extra ? entry.accounts?.find(({ id }) => id === extra.id) : entry;
        if (account) updateVaultAccount(account, key, tr(label), value, fieldId);
      });
    };
    const renderValue = (slot: typeof loginSlot | typeof passwordSlot) => {
      const { key, label } = slot;
      const id = `vault-account-${number}-${key}`;
      const text = tr(label);
      return <div className="vault-value-line">
        {renderValueControl({
          id, copyKey: `${accountKey}:${key}`, copyLabel: tr({ zh: `复制${label.zh}`, en: `Copy ${label.en.toLowerCase()}` }),
          className: 'vault-value-input', 'aria-label': key === 'login' ? text : undefined,
          placeholder: key === 'login' ? (nickname || (editable ? tr({ zh: '输入账号', en: 'Enter account login' }) : undefined)) : undefined,
          title: key === 'login' && nickname ? nickname : undefined,
          value: values[key], readOnly: !editable, maxLength: 100_000, rows: 1,
          onChange: (event) => updateValue(slot, event.target.value),
        })}
      </div>;
    };
    return <SortableCard key={accountKey} id={accountKey} className="vault-account-sortable" stretch={false}
      draggable={canReorderAccounts} disabled={busy} dragIcon={<Ellipsis size={16} aria-hidden="true" />}
      dragLabel={tr({ zh: `拖动调整账号 ${number} 顺序`, en: `Drag to reorder account ${number}` })}>
      {(dragHandle) => <section id={`vault-account-${number}`} className="vault-account" aria-label={nickname ? `${accountLabel} · ${nickname}` : accountLabel}>
        <div className="vault-account-heading">
          <VaultAccountStatusPicker key={draft?.localId} status={content.accountStatus ?? 'untested'} disabled={!editable || busy}
            onChange={(status) => updateDraft((item) => {
              const account = extra ? item.entry.accounts?.find(({ id }) => id === extra.id) : item.entry;
              if (account) account.accountStatus = status;
            })}
            removeAction={editable && <button type="button" className="vault-icon-button is-danger"
              title={tr({ zh: '移除账号', en: 'Remove account' })}
              aria-label={tr({ zh: `移除账号 ${number}`, en: `Remove account ${number}` })}
              onClick={() => {
                if ((nickname || content.accountStatus || Object.values(values).some(Boolean)) && !window.confirm(tr({ zh: '移除这组账号信息？', en: 'Remove this account’s details?' }))) return;
                updateDraft(({ entry }) => {
                  if (extra) {
                    setVaultAccountOrder(entry, vaultAccountGroups(entry).filter((group) => group === 'primary' || group.id !== extra.id));
                    return;
                  }
                  entry.fields = [];
                  entry.notes = '';
                  delete entry.accountName;
                  delete entry.privateNotes;
                  delete entry.accountStatus;
                  delete entry.primaryAccountIndex;
                });
              }}><Trash2 aria-hidden="true" /></button>} />
          {renderValue(loginSlot)}
          {dragHandle}
        </div>
        <div className="vault-account-fields">
          <div className="vault-field-row">
            <label className="vault-field-label" htmlFor={`vault-account-${number}-password`}>
              <KeyRound size={16} className="w-[2em]" aria-hidden="true" />
              <span className="sr-only">{tr(passwordSlot.label)}</span>
            </label>
            {renderValue(passwordSlot)}
          </div>
          {renderNotes({
            id: `vault-account-${number}-notes`, value: values.notes, copyKey: `${accountKey}:notes`,
            update: (value) => updateValue(notesSlot, value),
          })}
        </div>
      </section>}
    </SortableCard>;
  };
  const tagCategories = new Set(categorizedItems.map(({ category }) => category).filter(isVaultTagCategory));
  if (isVaultTagCategory(categoryFilter)) tagCategories.add(categoryFilter);
  const categoryOptions = [
    ...vaultCategoryOptions.map(({ value, label }) => ({ value, label: tr(label) })),
    ...[...tagCategories].sort().map((value) => ({ value, label: value.slice(4) })),
  ];
  return (
    <main className="vault-page">
      <div className="vault-topbar"><BackHome /></div>
      <header className="vault-header">
        <div className="vault-header-title">
          <h1>{tr(showTrash ? { zh: '回收站', en: 'Trash' } : { zh: '私密资料库', en: 'Private vault' })}</h1>
          <div className="vault-actions">
            <VaultBackup key={payload.userId} userId={payload.userId} load={loadBackupSource}
              revision={backupRevision} checkRevision={checkBackupRevision} />
            {(payload.canManage || hasTrash || showTrash) && <button type="button" className="vault-button" disabled={busy} onClick={toggleTrash}>
              {showTrash ? tr({ zh: '返回', en: 'Back' }) : <><Trash2 aria-hidden="true" />{tr({ zh: '回收站', en: 'Trash' })}</>}
            </button>}
            {payload.canManage && (
              <button type="button" className="vault-icon-button vault-icon-button--plain vault-edit-toggle" disabled={busy}
                aria-label={tr({ zh: '编辑模式', en: 'Edit mode' })} aria-pressed={editMode} onClick={toggleEditMode}>
                <Pencil aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </header>
      {canEditVault && (
        <div className="vault-actions vault-toolbar">
          {!showTrash && <button type="button" className="vault-button is-primary" disabled={busy} onClick={addItem}><Plus />{tr({ zh: '新建', en: 'New item' })}</button>}
          {showTrash && <button type="button" className="vault-button is-danger" disabled={busy || !hasTrash} onClick={() => void emptyTrash()}>
            <Trash2 aria-hidden="true" />{tr({ zh: '清空回收站', en: 'Empty Trash' })}
          </button>}
        </div>
      )}
      {!payload.canManage && <p className="vault-muted">{tr({ zh: '你可以查看现有内容；成为会员后才能新建、编辑、删除或分享。', en: 'You can view existing items. Membership is required to create, edit, delete, or share.' })}</p>}
      {!payload.canManage && <button type="button" className="vault-button is-primary" onClick={() => { if (confirmDiscard()) requireMembership(); }}>{tr({ zh: '新建与管理资料', en: 'Create & manage items' })}</button>}
      {visibleFailedCount > 0 && <p className="vault-error" role="alert">{tr({ zh: `${visibleFailedCount} 条内容无法解密。`, en: `${visibleFailedCount} item(s) could not be decrypted.` })}</p>}
      {error && <p className="vault-error" role="alert">{error}</p>}

      <div className="vault-workspace">
        <aside className="vault-sidebar">
          <SearchInput value={filter} onChange={setFilter} placeholder={tr({ zh: '搜索资料', en: 'Search items' })} className="vault-filter" inputClassName="vault-input" autoComplete="off" spellCheck={false} autoCapitalize="off" />
          <CompactSelect items={categoryOptions} value={categoryFilter} onChange={setCategoryFilter} label={categoryOptions.find(({ value }) => value === categoryFilter)?.label ?? categoryOptions[0].label} ariaLabel={tr({ zh: '筛选分类', en: 'Filter category' })} className="vault-category-filter" showArrow />
          <div className="vault-list">{visibleItems.map((item) => {
            const title = item.entry.title || tr({ zh: '未命名', en: 'Untitled' });
            const metadata = [
              item.ownerUserId !== payload.userId ? item.ownerName : '',
              item.entry.mergedInto ? tr({ zh: '已合并', en: 'Merged' }) : '',
            ].filter(Boolean).join(' · ');
            return <div key={item.localId} className={`vault-list-row${draft?.localId === item.localId ? ' is-active' : ''}`}>
              <button type="button" disabled={busy} className="vault-list-item" onClick={() => selectItem(item)}>
                <VaultListTitle title={title} />
                {metadata && <span>{metadata}</span>}
              </button>
              {canEditVault && !showTrash && item.serverId && item.ownerUserId === payload.userId
                && <button type="button" className="vault-icon-button vault-icon-button--plain is-danger" disabled={busy}
                  aria-label={tr({ zh: `将「${title}」移入回收站`, en: `Move “${title}” to Trash` })}
                  onClick={() => void changeTrash(true, item)}><Trash2 aria-hidden="true" /></button>}
            </div>;
          })}{!visibleItems.length && <p className="vault-muted">{tr(showTrash && !hasTrash
            ? { zh: '回收站为空。', en: 'Trash is empty.' }
            : { zh: '没有内容。', en: 'No items.' })}</p>}</div>
        </aside>

        <section className="vault-editor">{draft && <fieldset className="vault-editor-fields" disabled={busy}>
          <div className="vault-editor-head">
            <div className="vault-editor-title">
              {titleParts && (editable ? <input className="vault-title-tag vault-title-tag-input"
                aria-label={tr({ zh: '标题标签', en: 'Title tag' })} value={titleTag}
                size={Math.max(1, titleTag.length)} maxLength={Math.max(0, 200 - titleParts.suffix.length)}
                onChange={(event) => updateDraft((item) => {
                  const tag = event.target.value.replace(/[|｜│]/g, '');
                  item.entry.title = tag.trim() ? `${tag}${titleParts.suffix}` : titleParts.name;
                })} /> : <span className="vault-title-tag">{titleTag.trim()}</span>)}
              <input className="vault-title-input" value={titleParts?.name ?? draft.entry.title} readOnly={!editable}
                maxLength={200 - (titleParts?.prefix.length ?? 0)} placeholder={tr({ zh: '标题', en: 'Title' })}
                onChange={(event) => updateDraft((item) => { item.entry.title = `${titleParts?.prefix ?? ''}${event.target.value}`; })} />
            </div>
            {canEditVault && manageable && <div className="vault-actions">
              {editable && <button type="button" className="vault-button is-primary" disabled={busy || (!dirty && !draft.pendingEntryUpdate)} aria-busy={saving} onClick={() => void save()}>
                {saving ? <Loader2 className="vault-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                {tr({ zh: '保存', en: 'Save' })}
              </button>}
              {showTrash && <button type="button" className="vault-button" onClick={() => void changeTrash(false)}><RotateCcw aria-hidden="true" />{tr({ zh: '恢复', en: 'Restore' })}</button>}
              {!showTrash && (draft.serverId
                ? <button type="button" className="vault-icon-button vault-icon-button--plain is-danger" aria-label={moveToTrashLabel} onClick={() => void changeTrash(true)}><Trash2 aria-hidden="true" /></button>
                : <button type="button" className="vault-button is-danger" onClick={() => void changeTrash(true)}><Trash2 aria-hidden="true" />{tr({ zh: '丢弃', en: 'Discard' })}</button>)}
            </div>}
          </div>
          {manageable && draft.entry.mergedInto && <div className="vault-actions">
            <span className="vault-muted">{tr({ zh: `已合并到「${draft.entry.mergedInto.title}」`, en: `Merged into “${draft.entry.mergedInto.title}”` })}</span>
            {canEditVault && !showTrash && <button type="button" className="vault-button" onClick={() => void restoreMerged()}>{tr({ zh: '恢复原条目', en: 'Restore original' })}</button>}
          </div>}

          {(!isAccountEntry || informationGroups.length > 0) && <div className="vault-information-groups">
            {!isAccountEntry && renderInformation(draft.entry, 1)}
            {informationGroups.map((group, index) => renderInformation(group, index + (isAccountEntry ? 1 : 2), group))}
          </div>}
          {editable && (!isAccountEntry || informationGroups.length > 0) && <button type="button" className="vault-button vault-add-content"
            disabled={informationGroups.length >= MAX_VAULT_INFORMATION_GROUPS} onClick={() => {
              const group = { id: crypto.randomUUID(), name: '', fields: [], notes: '' };
              updateDraft(({ entry }) => { (entry.informationGroups ??= []).push(group); });
            }}><Plus aria-hidden="true" />{tr({ zh: '添加一组', en: 'Add group' })}</button>}

          <DndContext key={`account-order:${draft.localId}`} sensors={accountSensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
            if (!canReorderAccounts || busy || !over || active.id === over.id) return;
            const from = accountGroupIds.findIndex((id) => id === active.id);
            const to = accountGroupIds.findIndex((id) => id === over.id);
            if (from < 0 || to < 0) return;
            updateDraft(({ entry }) => setVaultAccountOrder(entry, arrayMove(vaultAccountGroups(entry), from, to)));
          }}>
            <SortableContext items={accountGroupIds} strategy={verticalListSortingStrategy}>
              {accountGroups.map((account, index) => account === 'primary'
                ? renderAccount(draft.entry, index + 1)
                : renderAccount(account, index + 1, account))}
            </SortableContext>
          </DndContext>
          {editable && (isAccountEntry || accounts.length > 0) && <button type="button" className="vault-button vault-add-account"
            disabled={accounts.length >= MAX_VAULT_ADDITIONAL_ACCOUNTS}
            onClick={() => {
              const account = { id: crypto.randomUUID(), name: '', fields: [] };
              updateDraft((item) => { (item.entry.accounts ??= []).push(account); });
            }}><Plus aria-hidden="true" />{tr({ zh: '添加账号', en: 'Add account' })}</button>}

          {isAccountEntry && renderImages(draft.entry)}

          {!showTrash && (editable || draft.shares.length > 0) && <section className="vault-sharing" aria-label={shareWithFriendsLabel}>
            {!editable && <h2>{shareWithFriendsLabel}</h2>}
            {draft.shares.length > 0 && <div className="vault-share-list">{draft.shares.map((share) => <span className="vault-share" key={share.userId}>{share.name}<small>#{share.userId}</small>{editable && <button type="button" className="vault-share-remove" aria-label={tr({ zh: `移除 ${share.name}`, en: `Remove ${share.name}` })} onClick={() => updateDraft((item) => { item.shares = item.shares.filter((candidate) => candidate.userId !== share.userId); })}><X /></button>}</span>)}</div>}
            {editable && shareLoadError && <p role="alert">{tr({ zh: '无法加载好友，请刷新后重试。', en: 'Could not load friends. Refresh and try again.' })}</p>}
            {editable && !shareLoadError && shareFriends === null && <p role="status">{tr({ zh: '正在加载好友…', en: 'Loading friends…' })}</p>}
            {editable && !shareLoadError && shareFriends?.length === 0 && <p>
              {tr({ zh: '暂无好友。', en: 'No friends yet.' })}{' '}
              <AppLink href="/friends" className="vault-button" onNavigate={(event) => { if (!confirmDiscard()) event.preventDefault(); }}>
                {tr({ zh: '去添加好友', en: 'Add friends' })}
              </AppLink>
            </p>}
            {editable && shareFriends && shareFriends.length > 0 && <ListSelect
              portal
              searchable
              className="vault-friend-select"
              searchPlaceholder={tr({ zh: '搜索好友', en: 'Search friends' })}
              allLabel={shareWithFriendsLabel}
              value=""
              disabled={busy}
              items={shareFriends.map((friend) => {
                const added = draft.shares.some((share) => share.userId === friend.userId);
                const status = added
                  ? tr({ zh: '已添加', en: 'Added' })
                  : friend.publicKey === null
                    ? tr({ zh: '尚未启用接收', en: 'Receiving not enabled' })
                    : '';
                return {
                  value: String(friend.userId),
                  label: friend.name,
                  description: [`#${friend.userId}`, friend.wcaId, status].filter(Boolean).join(' · '),
                  disabled: added || friend.publicKey === null,
                };
              })}
              onChange={(value) => void addShareFriend(value)}
            />}
          </section>}
        </fieldset>}</section>
      </div>
    </main>
  );
}
