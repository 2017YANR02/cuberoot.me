'use client';

import { sessionFetch } from '@/lib/session-fetch';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, Download, KeyRound, Loader2, Lock, Plus, Save, Trash2, UserPlus, X } from '@app-foundation/icons/lucide';
import BackHome from '@/components/BackHome';
import { PasswordInput } from '@/components/PasswordInput';
import { SearchInput } from '@/components/SearchInput';
import { CompactSelect } from '@/components/CompactSelect';
import { useCopy } from '@/hooks/useCopy';
import { useRequireMembership } from '@/hooks/useRequireMembership';
import { tr } from '@/i18n/tr';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { useAuthUser, authActions } from '@/lib/auth-store';
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
  version: number; updatedAt: string; wrappedKey: string; shares: VaultShare[];
}
interface VaultPayload {
  userId: number;
  canManage: boolean;
  keyProfile: { publicKey: JsonWebKey; encryptedPrivateKey: EncryptedPrivateKey } | null;
  items: VaultItemPayload[];
}
interface OpenItem {
  localId: string; serverId: string | null; ownerUserId: number; ownerName: string;
  version: number; updatedAt: string; shares: VaultShare[]; entry: VaultEntry;
}
interface UserResult { userId: number; name: string; wcaId: string | null; publicKey: JsonWebKey | null; }

const cloneItem = (item: OpenItem): OpenItem => structuredClone(item);
const decryptOpenItem = async (item: VaultItemPayload, key: CryptoKey): Promise<OpenItem> => ({
  localId: item.id, serverId: item.id, ownerUserId: item.ownerUserId, ownerName: item.ownerName,
  version: item.version, updatedAt: item.updatedAt, shares: item.shares,
  entry: await decryptVaultEntry(item.ciphertext, item.iv, item.wrappedKey, key),
});
type VaultCategory = NonNullable<VaultEntry['category']>;
const categoryLabels = {
  personal: { zh: '个人资料', en: 'Personal' },
  accounts: { zh: '账号密码', en: 'Accounts' },
  business: { zh: '企业资料', en: 'Business' },
  other: { zh: '其他', en: 'Other' },
};
const emptyEntry = (category: VaultCategory): VaultEntry => ({
  id: crypto.randomUUID(), title: '', category, notes: '',
  fields: (category === 'accounts' ? [
    { label: tr({ zh: '账号', en: 'Username' }), secret: false },
    { label: tr({ zh: '密码', en: 'Password' }), secret: true },
  ] : []).map((field) => ({ ...field, id: crypto.randomUUID(), value: '' })),
});

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
  const [shareQuery, setShareQuery] = useState('');
  const [shareResults, setShareResults] = useState<UserResult[]>([]);
  const [shareSearchError, setShareSearchError] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');

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
    return items.filter(({ entry }) => (!categoryFilter || (entry.category ?? 'other') === categoryFilter)
      && (!q || [entry.title, entry.notes, ...entry.fields.flatMap((field) => [field.label, ...(field.secret ? [] : [field.value])])]
        .some((value) => value.toLocaleLowerCase().includes(q))));
  }, [filter, categoryFilter, items]);

  const openVault = async (key: CryptoKey, data: VaultPayload) => {
    const results = await Promise.allSettled(data.items.map((item) => decryptOpenItem(item, key)));
    const opened = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
    setPrivateKey(key);
    setItems(opened);
    setDraft(opened[0] ? cloneItem(opened[0]) : null);
    setFailedCount(results.length - opened.length);
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
  const selectItem = (item: OpenItem) => {
    if (!confirmDiscard()) return;
    discardUnsavedNew();
    setDraft(cloneItem(item));
    setDirty(false);
    setShareResults([]);
    setExpandedImage(null);
  };
  const addItem = () => {
    if (!payload?.canManage || !confirmDiscard()) return;
    discardUnsavedNew();
    const item: OpenItem = {
      localId: `new:${crypto.randomUUID()}`, serverId: null, ownerUserId: payload.userId,
      ownerName: user?.name ?? '', version: 0, updatedAt: new Date().toISOString(), shares: [], entry: emptyEntry((categoryFilter || 'accounts') as VaultCategory),
    };
    setItems((current) => [item, ...current]);
    setDraft(item);
    setDirty(true);
    setExpandedImage(null);
    setFilter('');
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
      const encrypted = await encryptVaultEntry(draft.entry, [
        { userId: payload.userId, publicKey: payload.keyProfile.publicKey },
        ...draft.shares.map(({ userId, publicKey }) => ({ userId, publicKey })),
      ]);
      const response = await handleApi<{ id?: string; version: number; updatedAt: string }>(await sessionFetch(
        apiUrl(draft.serverId ? `/v1/vault/items/${draft.serverId}` : '/v1/vault/items'),
        {
          method: draft.serverId ? 'PUT' : 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ ...encrypted, expectedVersion: draft.serverId ? draft.version : null }),
        },
      ));
      const saved: OpenItem = {
        ...cloneItem(draft),
        serverId: draft.serverId ?? response.id ?? null,
        localId: draft.serverId ?? response.id ?? draft.localId,
        version: response.version,
        updatedAt: response.updatedAt,
      };
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
        ? tr({ zh: '每条内容最多 10 张图片，原图合计不超过 1 MiB。可分成多条保存。', en: 'Each item supports up to 10 images totaling 1 MiB. Split larger collections into separate items.' })
        : tr({ zh: '无法读取图片，请选择有效的 JPG、PNG 或 WebP 文件。', en: 'Could not read the image. Choose a valid JPG, PNG, or WebP file.' }));
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!draft || !payload?.canManage || draft.ownerUserId !== payload.userId
      || !window.confirm(tr({ zh: '永久删除这条加密内容？', en: 'Permanently delete this encrypted item?' }))) return;
    setBusy(true);
    setError(null);
    try {
      if (draft.serverId) await handleApi(await sessionFetch(apiUrl(`/v1/vault/items/${draft.serverId}`), { method: 'DELETE', headers: authHeaders(false) }));
      const next = items.filter((item) => item.localId !== draft.localId);
      setItems(next);
      setDraft(next[0] ? cloneItem(next[0]) : null);
      setDirty(false);
    } catch {
      setError(tr({ zh: '删除失败，请稍后重试。', en: 'Could not delete the item. Try again later.' }));
    } finally { setBusy(false); }
  };

  const canSearchUsers = Boolean(user && privateKey && draft && payload?.canManage && draft.ownerUserId === payload.userId);
  useEffect(() => {
    setShareResults([]);
    setShareSearchError(false);
    setSearchingUsers(false);
    const query = shareQuery.trim();
    if (!canSearchUsers || query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearchingUsers(true);
      void sessionFetch(apiUrl(`/v1/vault/users?q=${encodeURIComponent(query)}`), {
        headers: authHeaders(false), signal: controller.signal,
      })
        .then((response) => handleApi<{ users: UserResult[] }>(response))
        .then((data) => { if (!controller.signal.aborted) setShareResults(data.users); })
        .catch(() => { if (!controller.signal.aborted) setShareSearchError(true); })
        .finally(() => { if (!controller.signal.aborted) setSearchingUsers(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [canSearchUsers, draft?.localId, shareQuery]);

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
    return (
      <main className="vault-page vault-gate">
        <div className="vault-topbar"><BackHome /></div>
        <KeyRound aria-hidden="true" />
        <h1>{tr({ zh: '私密资料库', en: 'Private vault' })}</h1>
        {(recoveryMode || isSetup) && <p>{recoveryMode
          ? tr({ zh: '输入创建时保存的恢复密钥，再设置一个新口令。', en: 'Enter the recovery key saved during setup, then set a new passphrase.' })
          : tr(payload.canManage
              ? { zh: '设置一个独立解锁口令。创建后会生成一枚只显示一次的恢复密钥。', en: 'Set a separate vault passphrase. A one-time recovery key will be generated after creation.' }
              : { zh: '设置解锁口令以接收好友分享。只有会员和管理员可以新建或管理自己的内容。', en: 'Set a passphrase to receive shares from friends. Only members and administrators can create or manage their own items.' })}</p>}
        <form className="vault-unlock" onSubmit={recoveryMode ? recover : isSetup ? setup : unlock}>
          {recoveryMode && <><label htmlFor="vault-recovery">{tr({ zh: '恢复密钥', en: 'Recovery key' })}</label><input id="vault-recovery" className="vault-unlock-input" value={recoveryCode} autoComplete="off" onChange={(event) => setRecoveryCode(event.target.value)} /></>}
          <label htmlFor="vault-passphrase">{recoveryMode ? tr({ zh: '新资料库口令', en: 'New vault passphrase' }) : tr({ zh: '资料库口令', en: 'Vault passphrase' })}</label>
          <PasswordInput wrapperClassName="vault-password-field" id="vault-passphrase" className="vault-unlock-input" value={passphrase} inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete={isSetup || recoveryMode ? 'new-password' : 'current-password'} onChange={setPassphrase} show={showPassphrases} onShowChange={setShowPassphrases} />
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

  const editable = Boolean(draft && payload.canManage && draft.ownerUserId === payload.userId);
  const accountFields = [
    { label: tr({ zh: '账号', en: 'Username' }), aliases: ['账号', 'Username', 'Account'], secret: false },
    { label: tr({ zh: '密码', en: 'Password' }), aliases: ['密码', 'Password'], secret: true },
  ];
  const editorFields = draft ? (draft.entry.category === 'accounts'
    ? [
      ...accountFields.map((definition, index) => {
        const existing = draft.entry.fields.find((field) => definition.aliases.some((alias) => alias.toLowerCase() === field.label.trim().toLowerCase()));
        return existing ? { ...existing, label: definition.label, secret: definition.secret || existing.secret } : { id: `account-default-${index}`, label: definition.label, secret: definition.secret, value: '' };
      }),
      ...draft.entry.fields.filter((field) => !accountFields.some((definition) => draft.entry.fields.find((candidate) => definition.aliases.some((alias) => alias.toLowerCase() === candidate.label.trim().toLowerCase()))?.id === field.id)),
    ]
    : draft.entry.fields) : [];
  const categoryOptions = Object.entries(categoryLabels).map(([value, label]) => ({ value, label: tr(label) }));
  return (
    <main className="vault-page">
      <div className="vault-topbar"><BackHome /><button type="button" className="vault-button" disabled={busy} onClick={() => {
        if (confirmDiscard()) window.location.reload();
      }}><Lock />{tr({ zh: '锁定', en: 'Lock' })}</button></div>
      <header className="vault-header">
        <div><h1>{tr({ zh: '私密资料库', en: 'Private vault' })}</h1></div>
      </header>
      <div className="vault-toolbar">
        {payload.canManage && <div className="vault-actions">
          <button type="button" className="vault-button is-primary" disabled={busy} onClick={addItem}><Plus />{tr({ zh: '新建', en: 'New item' })}</button>
        </div>}
      </div>
      {!payload.canManage && <p className="vault-muted">{tr({ zh: '你可以查看现有内容；成为会员后才能新建、编辑、删除或分享。', en: 'You can view existing items. Membership is required to create, edit, delete, or share.' })}</p>}
      {!payload.canManage && <button type="button" className="vault-button is-primary" onClick={() => { if (confirmDiscard()) requireMembership(); }}>{tr({ zh: '新建与管理资料', en: 'Create & manage items' })}</button>}
      {failedCount > 0 && <p className="vault-error" role="alert">{tr({ zh: `${failedCount} 条内容无法解密。`, en: `${failedCount} item(s) could not be decrypted.` })}</p>}
      {error && <p className="vault-error" role="alert">{error}</p>}

      <div className="vault-workspace">
        <aside className="vault-sidebar">
          <SearchInput value={filter} onChange={setFilter} placeholder={tr({ zh: '搜索资料', en: 'Search items' })} className="vault-filter" inputClassName="vault-input" />
          <CompactSelect items={[{ value: '', label: tr({ zh: '全部分类', en: 'All categories' }) }, ...categoryOptions]} value={categoryFilter} onChange={setCategoryFilter} label={categoryFilter ? tr(categoryLabels[categoryFilter as VaultCategory]) : tr({ zh: '全部分类', en: 'All categories' })} ariaLabel={tr({ zh: '筛选分类', en: 'Filter category' })} className="vault-category-filter" showArrow />
          <div className="vault-list">{visibleItems.map((item) => (
            <button key={item.localId} type="button" disabled={busy} className={`vault-list-item${draft?.localId === item.localId ? ' is-active' : ''}`} onClick={() => selectItem(item)}>
              <strong>{item.entry.title || tr({ zh: '未命名', en: 'Untitled' })}</strong>
              <span>{item.ownerUserId === payload.userId ? tr({ zh: '我的内容', en: 'Mine' }) : item.ownerName}</span>
            </button>
          ))}{!visibleItems.length && <p className="vault-muted">{tr({ zh: '没有内容。', en: 'No items.' })}</p>}</div>
        </aside>

        <section className="vault-editor">{!draft ? <p className="vault-muted">{tr({ zh: '选择一条内容，或新建一条。', en: 'Select an item or create one.' })}</p> : <fieldset className="vault-editor-fields" disabled={busy}>
          <div className="vault-editor-head">
            <input className="vault-title-input" value={draft.entry.title} readOnly={!editable} maxLength={200} placeholder={tr({ zh: '标题', en: 'Title' })} onChange={(event) => updateDraft((item) => { item.entry.title = event.target.value; })} />
            {editable && <div className="vault-actions"><button type="button" className="vault-button is-primary" disabled={busy || !dirty} onClick={() => void save()}><Save />{tr({ zh: '保存', en: 'Save' })}</button><button type="button" className="vault-button is-danger" disabled={busy} onClick={() => void remove()}><Trash2 />{tr({ zh: '删除', en: 'Delete' })}</button></div>}
          </div>
          {editable && <CompactSelect items={categoryOptions} value={draft.entry.category ?? 'other'} onChange={(value) => updateDraft((item) => { item.entry.category = value as VaultCategory; })} label={tr(categoryLabels[draft.entry.category ?? 'other'])} ariaLabel={tr({ zh: '资料分类', en: 'Item category' })} disabled={busy} className="vault-entry-category" showArrow />}

          <div className="vault-fields">{editorFields.map((field, index) => {
            const changeValue = (value: string) => updateDraft((item) => {
              const existing = item.entry.fields.find((candidate) => candidate.id === field.id);
              if (existing) { existing.value = value; existing.secret = field.secret; }
              else item.entry.fields.push({ ...field, id: crypto.randomUUID(), value });
            });
            return <div className="vault-field" key={draft.entry.category === 'accounts' && index < 2 ? `account-${index}` : field.id}>
              <label className="vault-field-label" htmlFor={`vault-field-${field.id}`}>{field.label}</label>
              <div className="vault-value-line">
                <input id={`vault-field-${field.id}`} className="vault-value-input" value={field.value} readOnly={!editable} maxLength={100_000} placeholder={field.secret ? field.label : tr({ zh: '内容', en: 'Value' })} onChange={(event) => changeValue(event.target.value)} />
                <button type="button" className="vault-icon-button" aria-label={tr({ zh: '复制', en: 'Copy' })} onClick={() => copy(field.value, field.id)}>{copiedKey === field.id ? <Check /> : <Copy />}</button>
              </div>
            </div>;
          })}</div>

          <label className="vault-notes-label" htmlFor="vault-notes">{tr({ zh: '备注', en: 'Notes' })}</label>
          <textarea id="vault-notes" className="vault-notes" value={draft.entry.notes} readOnly={!editable} maxLength={500_000} rows={4} onChange={(event) => updateDraft((item) => { item.entry.notes = event.target.value; })} />

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
                <a className="vault-button" href={image.dataUrl} download={image.name}><Download />{tr({ zh: '下载原图', en: 'Download original' })}</a>
                {editable && <button type="button" className="vault-button is-danger" aria-label={tr({ zh: `移除图片：${image.name}`, en: `Remove image: ${image.name}` })} onClick={() => updateDraft((item) => { item.entry.images!.splice(index, 1); })}><X />{tr({ zh: '移除', en: 'Remove' })}</button>}
              </div>
            </div>)}</div>
          </section>}

          <section className="vault-sharing">
            <h2>{tr({ zh: '分享给好友', en: 'Share with friends' })}</h2>
            <div className="vault-share-list">{draft.shares.map((share) => <span className="vault-share" key={share.userId}>{share.name}<small>#{share.userId}</small>{editable && <button type="button" className="vault-share-remove" aria-label={tr({ zh: `移除 ${share.name}`, en: `Remove ${share.name}` })} onClick={() => updateDraft((item) => { item.shares = item.shares.filter((candidate) => candidate.userId !== share.userId); })}><X /></button>}</span>)}</div>
            {editable && <div className="vault-user-search"><SearchInput value={shareQuery} onChange={setShareQuery} placeholder={tr({ zh: '搜索好友', en: 'Search friends' })} className="vault-share-search" inputClassName="vault-input" />{searchingUsers && <Loader2 className="vault-spin" aria-label={tr({ zh: '正在搜索', en: 'Searching' })} />}</div>}
            {editable && shareSearchError && <p role="alert">{tr({ zh: '好友搜索失败，请稍后重试。', en: 'Could not search friends. Try again later.' })}</p>}
            {editable && shareResults.length > 0 && <div className="vault-user-results">{shareResults.map((result) => {
              const added = draft.shares.some((share) => share.userId === result.userId);
              return <div key={result.userId}><span><strong>{result.name}</strong><small>#{result.userId}{result.wcaId ? `  ${result.wcaId}` : ''}</small></span><button type="button" className="vault-button" disabled={!result.publicKey || added} onClick={() => { if (result.publicKey) updateDraft((item) => { item.shares.push({ userId: result.userId, name: result.name, publicKey: result.publicKey as JsonWebKey }); }); }}><UserPlus />{added ? tr({ zh: '已添加', en: 'Added' }) : result.publicKey ? tr({ zh: '添加', en: 'Add' }) : tr({ zh: '对方尚未启用接收', en: 'Receiving not enabled' })}</button></div>;
            })}</div>}
          </section>
        </fieldset>}</section>
      </div>
    </main>
  );
}
