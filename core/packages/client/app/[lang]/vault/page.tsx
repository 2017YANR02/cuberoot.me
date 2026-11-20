'use client';

import { sessionFetch } from '@/lib/session-fetch';
import { useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef, type FormEvent } from 'react';
import { Check, Copy, Download, KeyRound, Loader2, Lock, Plus, RotateCcw, Save, Trash2, X } from '@app-foundation/icons/lucide';
import BackHome from '@/components/BackHome';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { PasswordInput } from '@/components/PasswordInput';
import { SearchInput } from '@/components/SearchInput';
import { CompactSelect } from '@/components/CompactSelect';
import { ListSelect } from '@/components/ListSelect';
import { Tooltip } from '@/components/Tooltip';
import { useCopy } from '@/hooks/useCopy';
import { useRequireMembership } from '@/hooks/useRequireMembership';
import { tr } from '@/i18n/tr';
import { apiUrl } from '@/lib/api-base';
import { fetchFriends } from '@/lib/friends-api';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { useAuthUser, authActions } from '@/lib/auth-store';
import { mergeVaultEntries } from '@/lib/vault-merge';
import {
  createVaultKeyProfile,
  decryptVaultEntry,
  encryptVaultEntry,
  isValidVaultPassphrase,
  readVaultImages,
  recoverVaultPrivateKey,
  unlockVaultPrivateKey,
  type EncryptedPrivateKey,
  type VaultEntry,
} from '@/lib/vault-crypto';
import './vault.css';

interface VaultShare { userId: number; name: string; publicKey: JsonWebKey; }
interface VaultItemPayload {
  id: string; ownerUserId: number; ownerName: string; ciphertext: string; iv: string;
  version: number; updatedAt: string; trashedAt?: string | null; wrappedKey: string; shares: VaultShare[];
}
interface VaultPayload {
  userId: number;
  canManage: boolean;
  keyProfile: { publicKey: JsonWebKey; encryptedPrivateKey: EncryptedPrivateKey } | null;
  items: VaultItemPayload[];
  trash?: VaultItemPayload[];
}
interface OpenItem {
  localId: string; serverId: string | null; ownerUserId: number; ownerName: string;
  version: number; updatedAt: string; trashedAt: string | null; shares: VaultShare[]; entry: VaultEntry;
}
interface UserResult { userId: number; name: string; wcaId: string | null; publicKey: JsonWebKey | null; }
type ShareFriend = Omit<UserResult, 'publicKey'> & { publicKey?: JsonWebKey | null };

async function fetchVaultUsers(userId?: number, signal?: AbortSignal) {
  const query = userId === undefined ? '' : `?q=${userId}`;
  const response = await sessionFetch(apiUrl(`/v1/vault/users${query}`), { headers: authHeaders(false), signal });
  return (await handleApi<{ users: UserResult[] }>(response)).users;
}

const cloneItem = (item: OpenItem): OpenItem => structuredClone(item);
const decryptOpenItem = async (item: VaultItemPayload, key: CryptoKey): Promise<OpenItem> => ({
  localId: item.id, serverId: item.id, ownerUserId: item.ownerUserId, ownerName: item.ownerName,
  version: item.version, updatedAt: item.updatedAt, trashedAt: item.trashedAt ?? null, shares: item.shares,
  entry: await decryptVaultEntry(item.ciphertext, item.iv, item.wrappedKey, key),
});
type VaultCategory = NonNullable<VaultEntry['category']>;
const categoryLabels = {
  personal: { zh: '个人资料', en: 'Personal' },
  accounts: { zh: '账号密码', en: 'Accounts' },
  business: { zh: '企业资料', en: 'Business' },
  other: { zh: '其他', en: 'Other' },
};
const passwordFieldAliases = ['密码', 'Password'];
const emailFieldLabels = new Set(['邮箱', '电子邮箱', '邮箱地址', '电子邮件', '电子邮件地址', 'email', 'e-mail', 'email address', 'e-mail address']);
const isEmailField = (field: VaultEntry['fields'][number]) => emailFieldLabels.has(field.label.trim().toLowerCase());
const emptyEntry = (category: VaultCategory): VaultEntry => ({
  id: crypto.randomUUID(), title: '', category, notes: '',
  fields: (category === 'accounts' ? [
    { label: tr({ zh: '账号', en: 'Username' }), secret: false },
    { label: tr({ zh: '密码', en: 'Password' }), secret: true },
  ] : []).map((field) => ({ ...field, id: crypto.randomUUID(), value: '' })),
});

function VaultTextArea({ className, value, ...props }: ComponentPropsWithoutRef<'textarea'> & { value: string }) {
  return (
    <div className="vault-grow-textarea">
      <div className={className} data-vault-text-measure aria-hidden="true">{value}{'\u200b'}</div>
      <textarea {...props} className={className} value={value} />
    </div>
  );
}

export default function VaultPage() {
  const user = useAuthUser();
  const login = authActions.login;
  const { copiedKey, copy } = useCopy();
  const [mounted, setMounted] = useState(false);
  const [payload, setPayload] = useState<VaultPayload | null>(null);
  const requireMembership = useRequireMembership(payload?.canManage === true);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [items, setItems] = useState<OpenItem[]>([]);
  const [draft, setDraft] = useState<OpenItem | null>(null);
  const [dirty, setDirty] = useState(false);
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
  const [showExport, setShowExport] = useState(false);
  const [exportScope, setExportScope] = useState<'current' | 'all'>('all');
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setError(null);
    void sessionFetch(apiUrl('/v1/vault'), { headers: authHeaders(false) })
      .then((response) => handleApi<VaultPayload>(response))
      .then((data) => { if (!cancelled) setPayload(data); })
      .catch(() => { if (!cancelled) setError(tr({ zh: '资料库加载失败，请稍后重试。', en: 'Could not load the vault. Try again later.' })); });
    return () => { cancelled = true; };
  }, [user]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);

  const visibleItems = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase();
    const matches = (value: string) => value.toLocaleLowerCase().includes(q);
    return items.filter(({ entry, trashedAt }) => Boolean(trashedAt) === showTrash
      && (!categoryFilter || (entry.category ?? 'other') === categoryFilter)
      && (!q || matches(entry.title) || matches(entry.notes)
        || entry.fields.some(({ label, value }) => matches(label) || matches(value))));
  }, [filter, categoryFilter, items, showTrash]);

  const openVault = async (key: CryptoKey, data: VaultPayload) => {
    const trash = data.trash ?? [];
    const results = await Promise.allSettled([...data.items, ...trash].map((item) => decryptOpenItem(item, key)));
    const opened = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
    const active = opened.filter((item) => !item.trashedAt);
    setPrivateKey(key);
    setItems(opened);
    const first = active.find((item) => !item.entry.mergedInto) ?? active[0];
    setDraft(first ? cloneItem(first) : null);
    setFailedCount(data.items.length - active.length);
    setFailedTrashCount(trash.length - (opened.length - active.length));
    setFailedOwnedActiveCount(data.items.filter((item) => item.ownerUserId === data.userId).length
      - active.filter((item) => item.ownerUserId === data.userId).length);
    setShowTrash(false);
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
    setMergeTargetId('');
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
    if (!payload?.canManage || !confirmDiscard()) return;
    discardUnsavedNew();
    const item: OpenItem = {
      localId: `new:${crypto.randomUUID()}`, serverId: null, ownerUserId: payload.userId,
      ownerName: user?.name ?? '', version: 0, updatedAt: new Date().toISOString(), trashedAt: null,
      shares: [], entry: emptyEntry((categoryFilter || 'accounts') as VaultCategory),
    };
    setItems((current) => [item, ...current]);
    setDraft(item);
    setDirty(true);
    setExpandedImage(null);
    setFilter('');
    setMergeTargetId('');
  };
  const updateDraft = (update: (item: OpenItem) => void) => {
    setDraft((current) => {
      if (!current) return current;
      const next = cloneItem(current);
      update(next);
      return next;
    });
    setDirty(true);
  };

  const persistItem = async (item: OpenItem): Promise<OpenItem> => {
    if (!payload?.keyProfile || !privateKey || !payload.canManage || item.ownerUserId !== payload.userId) throw new Error('forbidden');
    const encrypted = await encryptVaultEntry(item.entry, [
      { userId: payload.userId, publicKey: payload.keyProfile.publicKey },
      ...item.shares.map(({ userId, publicKey }) => ({ userId, publicKey })),
    ]);
    const response = await handleApi<{ id?: string; version: number; updatedAt: string }>(await sessionFetch(
      apiUrl(item.serverId ? `/v1/vault/items/${item.serverId}` : '/v1/vault/items'),
      { method: item.serverId ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify({ ...encrypted, expectedVersion: item.serverId ? item.version : null }) },
    ));
    return { ...cloneItem(item), serverId: item.serverId ?? response.id ?? null, localId: item.serverId ?? response.id ?? item.localId, version: response.version, updatedAt: response.updatedAt };
  };

  const save = async () => {
    if (!draft || !payload?.keyProfile || !privateKey || draft.ownerUserId !== payload.userId || !payload.canManage) return;
    if (!draft.entry.title.trim()) {
      setError(tr({ zh: '请填写标题。', en: 'Enter a title.' }));
      return;
    }
    if (draft.entry.images?.some((image) => !image.name.trim())) {
      setError(tr({ zh: '请填写图片名称。', en: 'Enter a name for each image.' }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await persistItem(draft);
      setItems((current) => current.map((item) => item.localId === draft.localId ? saved : item));
      setDraft(saved);
      setDirty(false);
    } catch (saveError) {
      setError((saveError as Error).message === 'item changed in another tab'
        ? tr({ zh: '这条内容已在其他页面修改，请刷新后重试。', en: 'This item changed in another tab. Refresh and try again.' })
        : (saveError as Error).message === 'vault_entry_limit'
          ? tr({ zh: '这条内容过大，请将部分图片或文字分到另一条内容。', en: 'This item is too large. Move some images or text to another item.' })
          : tr({ zh: '保存失败，请稍后重试。', en: 'Could not save. Try again later.' }));
    } finally { setBusy(false); }
  };

  const merge = async () => {
    const target = items.find((item) => item.localId === mergeTargetId);
    if (busy || dirty || !draft?.serverId || !target?.serverId || target.localId === draft.localId || !payload?.canManage
      || draft.ownerUserId !== payload.userId || target.ownerUserId !== payload.userId
      || draft.trashedAt || target.trashedAt || draft.shares.length || target.shares.length || draft.entry.mergedInto || target.entry.mergedInto) return;
    if (!window.confirm(tr({ zh: `将「${draft.entry.title}」合并到「${target.entry.title}」？原条目会标为已合并，仍可恢复。`, en: `Merge “${draft.entry.title}” into “${target.entry.title}”? The original will be marked as merged and can still be restored.` }))) return;
    setBusy(true);
    setError(null);
    let targetSaved = false;
    try {
      const combined = await persistItem({ ...target, entry: mergeVaultEntries(target.entry, draft.entry) });
      targetSaved = true;
      setItems((current) => current.map((item) => item.localId === target.localId ? combined : item));
      // Archive only after the complete merged entry has been saved successfully.
      const archived = await persistItem({ ...draft, entry: { ...draft.entry, mergedInto: { id: target.serverId, title: target.entry.title } } });
      setItems((current) => current.map((item) => item.localId === draft.localId ? archived : item));
      setDraft(combined);
      setFilter('');
      setCategoryFilter('');
      setMergeTargetId('');
      setExpandedImage(null);
    } catch (mergeError) {
      setError(targetSaved
        ? tr({ zh: '目标条目已保存，但原条目未标为已合并。资料均保留，请刷新后重试。', en: 'The target was saved, but the original could not be marked as merged. All content is retained. Refresh and retry.' })
        : (mergeError as Error).message === 'vault_entry_limit'
          ? tr({ zh: '合并后超出单条容量限制，原条目均未改动。', en: 'The merged item exceeds the size limit. Neither item was changed.' })
          : tr({ zh: '合并未完成，原条目均保留。请刷新后重试。', en: 'The merge did not complete. Both originals are retained. Refresh and retry.' }));
    } finally { setBusy(false); }
  };

  const restoreMerged = async () => {
    if (busy || !draft?.entry.mergedInto) return;
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

  const addImages = async (files: File[]) => {
    if (!draft || busy || !files.length) return;
    const localId = draft.localId;
    setBusy(true);
    setError(null);
    try {
      const images = await readVaultImages(files, draft.entry.images);
      setDraft((current) => current?.localId === localId ? { ...current, entry: { ...current.entry, images } } : current);
      setDirty(true);
    } catch (imageError) {
      setError((imageError as Error).message === 'vault_image_limit'
        ? tr({ zh: '每条内容最多 10 张图片，原图合计不超过 2 MiB。可分成多条保存。', en: 'Each item supports up to 10 images totaling 2 MiB. Split larger collections into separate items.' })
        : tr({ zh: '无法读取图片，请选择有效的 JPG、PNG 或 WebP 文件。', en: 'Could not read the image. Choose a valid JPG, PNG, or WebP file.' }));
    } finally { setBusy(false); }
  };

  const changeTrash = async (trashed: boolean) => {
    if (busy || !draft || !payload?.canManage || draft.ownerUserId !== payload.userId || !confirmDiscard()) return;
    if (!draft.serverId) {
      discardUnsavedNew();
      showItem(null);
      return;
    }
    const item = items.find((candidate) => candidate.localId === draft.localId);
    if (!item || Boolean(item.trashedAt) === trashed) return;
    if (trashed && item.shares.length && !window.confirm(tr({
      zh: '移入回收站会停止分享。恢复后可以重新分享。确定移入？',
      en: 'Moving this item to Trash revokes sharing. You can share it again after restoring it. Move to Trash?',
    }))) return;
    setBusy(true);
    setError(null);
    try {
      const state = await handleApi<{ version: number; updatedAt: string; trashedAt: string | null }>(
        await sessionFetch(apiUrl(`/v1/vault/items/${draft.serverId}/trash`), {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ trashed, expectedVersion: item.version }),
        }),
      );
      setItems((current) => current.map((candidate) => candidate.localId === item.localId
        ? { ...item, ...state, shares: [] } : candidate));
      showItem(visibleItems.find((candidate) => candidate.localId !== item.localId) ?? null);
    } catch {
      setError(tr(trashed
        ? { zh: '无法移入回收站，请刷新后重试。', en: 'Could not move the item to Trash. Refresh and try again.' }
        : { zh: '无法恢复资料，请刷新后重试。', en: 'Could not restore the item. Refresh and try again.' }));
    } finally { setBusy(false); }
  };

  const emptyTrash = async () => {
    if (busy || !showTrash || !payload?.canManage || !window.confirm(tr({
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

  const canListFriends = Boolean(user && privateKey && draft && !draft.trashedAt && !draft.entry.mergedInto && payload?.canManage && draft.ownerUserId === payload.userId);
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
  if (!payload) return <main className="vault-page vault-loading"><Loader2 className="vault-spin" />{error ?? tr({ zh: '正在加载…', en: 'Loading…' })}</main>;
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

  const manageable = Boolean(draft && payload.canManage && draft.ownerUserId === payload.userId);
  const editable = manageable && !showTrash && !draft?.entry.mergedInto;
  const mergeTargets = items.filter((item) => item.serverId && !item.trashedAt && item.localId !== draft?.localId && item.ownerUserId === payload.userId && !item.shares.length && !item.entry.mergedInto);
  const hasTrash = failedTrashCount > 0 || items.some((item) => item.trashedAt);
  const visibleFailedCount = showTrash ? failedTrashCount : failedCount;
  const accountFields = [
    { label: tr({ zh: '账号', en: 'Username' }), aliases: ['账号', 'Username', 'Account'], secret: false },
    { label: tr({ zh: '密码', en: 'Password' }), aliases: passwordFieldAliases, secret: true },
  ];
  const displayFields = draft ? (draft.entry.category === 'accounts'
    ? [
      ...accountFields.flatMap((definition) => {
        const existing = draft.entry.fields.find((field) => definition.aliases.some((alias) => alias.toLowerCase() === field.label.trim().toLowerCase()));
        return existing ? [{ ...existing, label: definition.label, secret: definition.secret || existing.secret }] : [];
      }),
      ...draft.entry.fields.filter((field) => !accountFields.some((definition) => draft.entry.fields.find((candidate) => definition.aliases.some((alias) => alias.toLowerCase() === candidate.label.trim().toLowerCase()))?.id === field.id)),
    ]
    : draft.entry.fields) : [];
  const passwordIndex = displayFields.findIndex(({ label }) =>
    passwordFieldAliases.some((alias) => alias.toLowerCase() === label.trim().toLowerCase()));
  const fieldsFromPassword = passwordIndex < 0 ? [] : displayFields.slice(passwordIndex);
  const editorFields = passwordIndex < 0 ? displayFields : [
    ...displayFields.slice(0, passwordIndex),
    ...fieldsFromPassword.filter(isEmailField),
    ...fieldsFromPassword.filter((field) => !isEmailField(field)),
  ];
  const categoryOptions = Object.entries(categoryLabels).map(([value, label]) => ({ value, label: tr(label) }));
  const ownedItems = items.flatMap((item) => item.serverId && item.ownerUserId === payload.userId
    ? [{ ...item, serverId: item.serverId }] : []);
  const currentExportItem = ownedItems.find((item) => item.localId === draft?.localId);
  const exportItems = exportScope === 'all' ? ownedItems : currentExportItem ? [currentExportItem] : [];
  const failedOwnedCount = failedOwnedActiveCount + failedTrashCount;
  const exportVault = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !showExport || !exportItems.length) return;
    setBusy(true);
    setError(null);
    try {
      const [{ buildVaultExport }, { saveBlob }] = await Promise.all([import('@/lib/vault-export'), import('@/lib/document-export')]);
      const exportedAt = new Date().toISOString();
      const archive = await buildVaultExport(exportItems, {
        exportedAt,
        includeSensitive,
        categoryLabel: (category) => tr(categoryLabels[category]),
      });
      saveBlob(archive, `cuberoot-vault-${exportedAt.slice(0, 10)}.zip`);
      setShowExport(false);
      setIncludeSensitive(false);
    } catch {
      setError(tr({ zh: '无法打包资料，请重试。', en: 'Could not package the vault. Try again.' }));
    } finally { setBusy(false); }
  };
  return (
    <main className="vault-page">
      <div className="vault-topbar"><BackHome /><button type="button" className="vault-button" disabled={busy} onClick={() => {
        if (confirmDiscard()) window.location.reload();
      }}><Lock />{tr({ zh: '锁定', en: 'Lock' })}</button></div>
      <header className="vault-header">
        <div><h1>{tr(showTrash ? { zh: '回收站', en: 'Trash' } : { zh: '私密资料库', en: 'Private vault' })}</h1></div>
      </header>
      <div className="vault-toolbar">
        <div className="vault-actions">
          {payload.canManage && !showTrash && <button type="button" className="vault-button is-primary" disabled={busy} onClick={addItem}><Plus />{tr({ zh: '新建', en: 'New item' })}</button>}
          {(payload.canManage || hasTrash || showTrash) && <button type="button" className="vault-button" disabled={busy} onClick={toggleTrash}>
            {showTrash ? tr({ zh: '返回', en: 'Back' }) : <><Trash2 aria-hidden="true" />{tr({ zh: '回收站', en: 'Trash' })}</>}
          </button>}
          {ownedItems.length > 0 && <MoreToggle className="vault-button" expanded={showExport} aria-controls="vault-export" disabled={busy} onToggle={() => {
            setExportScope('all');
            setIncludeSensitive(false);
            setShowExport((current) => !current);
          }}><Download aria-hidden="true" />{tr({ zh: '导出资料', en: 'Export vault' })}</MoreToggle>}
          {showTrash && payload.canManage && <button type="button" className="vault-button is-danger" disabled={busy || !hasTrash} onClick={() => void emptyTrash()}>
            <Trash2 aria-hidden="true" />{tr({ zh: '清空回收站', en: 'Empty Trash' })}
          </button>}
        </div>
      </div>
      <MoreTogglePanel id="vault-export" expanded={showExport && ownedItems.length > 0}>
        <form className="vault-export" onSubmit={(event) => void exportVault(event)}>
          <label htmlFor="vault-export-scope">{tr({ zh: '导出范围', en: 'Export scope' })}</label>
          <select id="vault-export-scope" className="vault-input" disabled={busy}
            value={exportScope}
            onChange={(event) => setExportScope(event.target.value === 'current' ? 'current' : 'all')}>
            <option value="all">{tr({ zh: '全部自有资料（含回收站）', en: 'All your items, including Trash' })}</option>
            <option value="current" disabled={!currentExportItem}>{tr({ zh: '当前条目', en: 'Current item' })}</option>
          </select>
          <BoolToggle value={includeSensitive} onChange={setIncludeSensitive} disabled={busy} label={tr({ zh: '包含密码等敏感字段', en: 'Include passwords and other sensitive fields' })} />
          <p className="vault-muted">{tr({ zh: 'ZIP 为明文，包含所选已保存资料的文字和原图。', en: 'The ZIP is unencrypted and contains the saved text and original images for the selected items.' })}</p>
          {exportScope === 'all' && failedOwnedCount > 0 && <p className="vault-muted">
            {tr({ zh: `${failedOwnedCount} 条自有资料无法解密，导出时会跳过。`, en: `${failedOwnedCount} owned item(s) could not be decrypted and will be skipped.` })}
          </p>}
          <button type="submit" className="vault-button is-primary" disabled={busy || !exportItems.length}>
            <Download aria-hidden="true" />{tr({ zh: '下载 ZIP', en: 'Download ZIP' })}
          </button>
        </form>
      </MoreTogglePanel>
      {!payload.canManage && <p className="vault-muted">{tr({ zh: '你可以查看现有内容；成为会员后才能新建、编辑、删除或分享。', en: 'You can view existing items. Membership is required to create, edit, delete, or share.' })}</p>}
      {!payload.canManage && <button type="button" className="vault-button is-primary" onClick={() => { if (confirmDiscard()) requireMembership(); }}>{tr({ zh: '新建与管理资料', en: 'Create & manage items' })}</button>}
      {visibleFailedCount > 0 && <p className="vault-error" role="alert">{tr({ zh: `${visibleFailedCount} 条内容无法解密。`, en: `${visibleFailedCount} item(s) could not be decrypted.` })}</p>}
      {error && <p className="vault-error" role="alert">{error}</p>}

      <div className="vault-workspace">
        <aside className="vault-sidebar">
          <SearchInput value={filter} onChange={setFilter} placeholder={tr({ zh: '搜索资料', en: 'Search items' })} className="vault-filter" inputClassName="vault-input" autoComplete="off" spellCheck={false} autoCapitalize="off" />
          <CompactSelect items={[{ value: '', label: tr({ zh: '全部分类', en: 'All categories' }) }, ...categoryOptions]} value={categoryFilter} onChange={setCategoryFilter} label={categoryFilter ? tr(categoryLabels[categoryFilter as VaultCategory]) : tr({ zh: '全部分类', en: 'All categories' })} ariaLabel={tr({ zh: '筛选分类', en: 'Filter category' })} className="vault-category-filter" showArrow />
          <div className="vault-list">{visibleItems.map((item) => (
            <button key={item.localId} type="button" disabled={busy} className={`vault-list-item${draft?.localId === item.localId ? ' is-active' : ''}`} onClick={() => selectItem(item)}>
              <strong>{item.entry.title || tr({ zh: '未命名', en: 'Untitled' })}</strong>
              <span>
                {item.ownerUserId === payload.userId ? tr({ zh: '我的内容', en: 'Mine' }) : item.ownerName}
                {item.entry.mergedInto && <> · {tr({ zh: '已合并', en: 'Merged' })}</>}
              </span>
            </button>
          ))}{!visibleItems.length && <p className="vault-muted">{tr(showTrash && !hasTrash
            ? { zh: '回收站为空。', en: 'Trash is empty.' }
            : { zh: '没有内容。', en: 'No items.' })}</p>}</div>
        </aside>

        <section className="vault-editor">{draft && <fieldset className="vault-editor-fields" disabled={busy}>
          <div className="vault-editor-head">
            <input className="vault-title-input" value={draft.entry.title} readOnly={!editable} maxLength={200} placeholder={tr({ zh: '标题', en: 'Title' })} onChange={(event) => updateDraft((item) => { item.entry.title = event.target.value; })} />
            {manageable && <div className="vault-actions">
              {editable && <button type="button" className="vault-button is-primary" disabled={!dirty} onClick={() => void save()}><Save aria-hidden="true" />{tr({ zh: '保存', en: 'Save' })}</button>}
              {showTrash
                ? <button type="button" className="vault-button" onClick={() => void changeTrash(false)}><RotateCcw aria-hidden="true" />{tr({ zh: '恢复', en: 'Restore' })}</button>
                : <button type="button" className="vault-button is-danger" onClick={() => void changeTrash(true)}><Trash2 aria-hidden="true" />{tr(draft.serverId ? { zh: '移入回收站', en: 'Move to Trash' } : { zh: '丢弃', en: 'Discard' })}</button>}
            </div>}
          </div>
          {editable && <CompactSelect items={categoryOptions} value={draft.entry.category ?? 'other'} onChange={(value) => updateDraft((item) => { item.entry.category = value as VaultCategory; })} label={tr(categoryLabels[draft.entry.category ?? 'other'])} ariaLabel={tr({ zh: '资料分类', en: 'Item category' })} disabled={busy} className="vault-entry-category" showArrow />}
          {manageable && draft.entry.mergedInto && <div className="vault-actions">
            <span className="vault-muted">{tr({ zh: `已合并到「${draft.entry.mergedInto.title}」`, en: `Merged into “${draft.entry.mergedInto.title}”` })}</span>
            {!showTrash && <button type="button" className="vault-button" onClick={() => void restoreMerged()}>{tr({ zh: '恢复原条目', en: 'Restore original' })}</button>}
          </div>}
          {editable && draft.serverId && !draft.shares.length && <details key={draft.localId}>
            <summary>{tr({ zh: '合并到…', en: 'Merge into…' })}</summary>
            <div className="vault-actions">
              <CompactSelect items={mergeTargets.map((item) => ({ value: item.localId, label: item.entry.title }))} value={mergeTargetId} onChange={setMergeTargetId} label={mergeTargets.find((item) => item.localId === mergeTargetId)?.entry.title || tr({ zh: '选择目标条目', en: 'Choose target item' })} ariaLabel={tr({ zh: '合并目标', en: 'Merge target' })} disabled={busy || dirty} showArrow />
              <button type="button" className="vault-button" disabled={busy || dirty || !mergeTargetId} onClick={() => void merge()}>{tr({ zh: '合并', en: 'Merge' })}</button>
            </div>
            <p className="vault-muted">{tr(dirty ? { zh: '请先保存修改，再合并。', en: 'Save your changes before merging.' } : { zh: '合并字段、备注和图片。合并后可打开原条目恢复。仅支持未分享的条目。', en: 'Combine fields, notes and images. After merging, open the original item to restore it. Only unshared items are supported.' })}</p>
          </details>}

          <div className="vault-fields">{editorFields.map((field) => {
            const changeValue = (value: string) => updateDraft((item) => {
              const existing = item.entry.fields.find((candidate) => candidate.id === field.id);
              if (existing) { existing.value = value; existing.secret = field.secret; }
            });
            return <div className="vault-field" key={field.id}>
              <label className="vault-field-label" htmlFor={`vault-field-${field.id}`}>{field.label}</label>
              <div className="vault-value-line">
                <VaultTextArea id={`vault-field-${field.id}`} className="vault-value-input" value={field.value} readOnly={!editable} maxLength={100_000} rows={1} placeholder={field.secret ? field.label : tr({ zh: '内容', en: 'Value' })} onChange={(event) => changeValue(event.target.value)} />
                <button type="button" className="vault-icon-button" aria-label={tr({ zh: '复制', en: 'Copy' })} onClick={() => copy(field.value, field.id)}>{copiedKey === field.id ? <Check /> : <Copy />}</button>
                {editable && <Tooltip content={tr({ zh: '删除字段', en: 'Remove field' })}>{(tip) => <button {...tip} type="button" className="vault-icon-button is-danger" aria-label={tr({ zh: `删除字段：${field.label}`, en: `Remove field: ${field.label}` })} onClick={() => updateDraft((item) => { item.entry.fields = item.entry.fields.filter((candidate) => candidate.id !== field.id); })}><Trash2 /></button>}</Tooltip>}
              </div>
            </div>;
          })}</div>

          <label className="vault-notes-label" htmlFor="vault-notes">{tr({ zh: '备注', en: 'Notes' })}</label>
          <VaultTextArea id="vault-notes" className="vault-notes" value={draft.entry.notes} readOnly={!editable} maxLength={500_000} rows={4} onChange={(event) => updateDraft((item) => { item.entry.notes = event.target.value; })} />

          {(editable || Boolean(draft.entry.images?.length)) && <section className="vault-images">
            <div className="vault-image-heading">
              <h2>{tr({ zh: '图片附件', en: 'Image attachments' })}</h2>
              {editable && <>
                <input ref={imageInput} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" aria-label={tr({ zh: '选择图片', en: 'Choose images' })} onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = '';
                  void addImages(files);
                }} />
                <button type="button" className="vault-button" onClick={() => imageInput.current?.click()}><Plus />{tr({ zh: '添加图片', en: 'Add images' })}</button>
              </>}
            </div>
            <div className="vault-image-grid">{draft.entry.images?.map((image, index) => <div key={image.id} className={`vault-image${expandedImage === image.id ? ' is-expanded' : ''}`}>
              <button type="button" className="vault-image-preview" aria-expanded={expandedImage === image.id} aria-label={tr({ zh: `查看图片：${image.name}`, en: `View image: ${image.name}` })} onClick={() => setExpandedImage((current) => current === image.id ? null : image.id)}>
                {/* Original image is decrypted locally; never send it through an image optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.dataUrl} alt={image.name} />
              </button>
              <input className="vault-input" aria-label={tr({ zh: `图片名称 ${index + 1}`, en: `Image name ${index + 1}` })} value={image.name} readOnly={!editable} maxLength={200} onChange={(event) => updateDraft((item) => { item.entry.images![index].name = event.target.value; })} />
              <div className="vault-actions">
                <Tooltip content={tr({ zh: '下载原图', en: 'Download original' })}>{(tip) => (
                  <a {...tip} className="vault-button" href={image.dataUrl} download={image.name} aria-label={tr({ zh: `下载原图：${image.name}`, en: `Download original: ${image.name}` })}><Download aria-hidden="true" /></a>
                )}</Tooltip>
                {editable && <Tooltip content={tr({ zh: '移除图片', en: 'Remove image' })}>{(tip) => (
                  <button {...tip} type="button" className="vault-button is-danger" aria-label={tr({ zh: `移除图片：${image.name}`, en: `Remove image: ${image.name}` })} onClick={() => updateDraft((item) => { item.entry.images!.splice(index, 1); })}><X aria-hidden="true" /></button>
                )}</Tooltip>}
              </div>
            </div>)}</div>
          </section>}

          {!showTrash && <section className="vault-sharing">
            <h2>{tr({ zh: '分享给好友', en: 'Share with friends' })}</h2>
            <div className="vault-share-list">{draft.shares.map((share) => <span className="vault-share" key={share.userId}>{share.name}<small>#{share.userId}</small>{editable && <button type="button" className="vault-share-remove" aria-label={tr({ zh: `移除 ${share.name}`, en: `Remove ${share.name}` })} onClick={() => updateDraft((item) => { item.shares = item.shares.filter((candidate) => candidate.userId !== share.userId); })}><X /></button>}</span>)}</div>
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
              allLabel={tr({ zh: '选择好友', en: 'Choose a friend' })}
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
